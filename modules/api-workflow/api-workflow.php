<?php
/**
 * class APIWorkflow
 * Manage custom REST API endpoints and workflows using Steps (Statuses) and Components (Metadata).
 */

namespace VIPWorkflow\Modules;

require_once __DIR__ . '/rest/api-workflow-endpoint.php';

use VIPWorkflow\Modules\CustomStatus;
use VIPWorkflow\Modules\EditorialMetadata;

class APIWorkflow {

	public static function init(): void {
		add_action( 'rest_api_init', [ __CLASS__, 'register_dynamic_routes' ] );
		add_action( 'vw_api_execute_async_step', [ __CLASS__, 'handle_async_step' ], 10, 2 );
		add_action( 'admin_menu', [ __CLASS__, 'add_admin_menu' ] );
		add_action( 'admin_enqueue_scripts', [ __CLASS__, 'admin_enqueue_scripts' ] );
	}

	public static function add_admin_menu(): void {
		add_submenu_page(
			'vw-custom-status',
			__( 'API Workflows', 'vip-workflow' ),
			__( 'API Workflows', 'vip-workflow' ),
			'manage_options',
			'vw-api-workflow',
			[ __CLASS__, 'render_admin_page' ]
		);
	}

	public static function render_admin_page(): void {
		require_once __DIR__ . '/views/manage-api-workflow.php';
	}

	public static function admin_enqueue_scripts( $hook ): void {
		if ( strpos( $hook, 'vw-api-workflow' ) === false ) {
			return;
		}

		$asset_path = VIP_WORKFLOW_ROOT . '/dist/modules/api-workflow/api-workflow.asset.php';
		if ( ! file_exists( $asset_path ) ) {
			return;
		}

		$asset_file = include $asset_path;
		wp_enqueue_script(
			'vw-api-workflow-js',
			VIP_WORKFLOW_URL . 'dist/modules/api-workflow/api-workflow.js',
			$asset_file['dependencies'],
			$asset_file['version'],
			true
		);
		wp_enqueue_style( 'wp-components' );
	}

	public static function register_dynamic_routes(): void {
		$workflows = get_option( 'vw_api_endpoint_config' );
		if ( empty( $workflows ) || ! is_array( $workflows ) ) {
			return;
		}

		foreach ( $workflows as $workflow ) {
			if ( empty( $workflow['path'] ) ) {
				continue;
			}

			register_rest_route( 'vw-api/v1', $workflow['path'], [
				'methods'             => $workflow['method'] ?? 'POST',
				'callback'            => function ( $request ) use ( $workflow ) {
					return self::handle_request( $request, $workflow );
				},
				'permission_callback' => function () use ( $workflow ) {
					if ( ! empty( $workflow['api_key'] ) ) {
						$header_key = $_SERVER['HTTP_X_VW_API_KEY'] ?? '';
						return $header_key === $workflow['api_key'];
					}
					return true;
				},
			] );
		}
	}

	public static function handle_request( $request, $workflow ) {
		if ( ! self::check_rate_limit( $workflow ) ) {
			return new \WP_Error( 'rest_rate_limited', __( 'Rate limit exceeded.', 'vip-workflow' ), [ 'status' => 429 ] );
		}

		$steps = $workflow['steps'] ?? [];
		$context = [
			'request' => [
				'params'  => $request->get_params(),
				'headers' => $request->get_headers(),
				'body'    => $request->get_json_params(),
			],
			'steps'   => [],
			'workflow' => $workflow,
		];

		/**
		 * Action before workflow starts
		 */
		do_action( 'vw_api_before_workflow', $workflow, $context );

		$results = [];
		foreach ( $steps as $step ) {
			$step_id = $step['id'] ?? uniqid();

			/**
			 * Action before step executes
			 */
			do_action( 'vw_api_before_step', $step, $context );

			if ( ! empty( $step['async'] ) && function_exists( 'as_enqueue_async_action' ) ) {
				as_enqueue_async_action( 'vw_api_execute_async_step', [ 'step' => $step, 'context' => $context ], 'vip-workflow' );
				$step_result = [ 'status' => 'queued', 'step_id' => $step_id ];
			} else {
				$step_result = self::execute_step( $step, $context );
			}

			$results[] = [
				'step_id' => $step_id,
				'name'    => $step['name'] ?? '',
				'result'  => $step_result
			];

			if ( ! empty( $step['name'] ) ) {
				$context['steps'][ $step['name'] ] = $step_result;
			} else {
				$context['steps'][ $step_id ] = $step_result;
			}

			/**
			 * Action after step executes
			 */
			do_action( 'vw_api_after_step', $step, $step_result, $context );
		}

		/**
		 * Action after workflow completes
		 */
		do_action( 'vw_api_after_workflow', $workflow, $results, $context );

		return rest_ensure_response( [
			'success' => true,
			'data'    => $results
		] );
	}

	public static function handle_async_step( $step, $context ) {
		self::execute_step( $step, $context );
	}

	private static function check_rate_limit( $workflow ) {
		$rate_limit = $workflow['rate_limit'] ?? [];
		if ( empty( $rate_limit['enabled'] ) ) {
			return true;
		}

		$limit = $rate_limit['limit'] ?? 60;
		$window = $rate_limit['window'] ?? 60;
		$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
		$workflow_id = $workflow['id'] ?? 'default';
		$transient_key = "vw_ratelimit_{$workflow_id}_{$ip}";

		$requests = get_transient( $transient_key );
		if ( false === $requests ) {
			set_transient( $transient_key, 1, $window );
			return true;
		}

		if ( $requests >= $limit ) {
			return false;
		}

		set_transient( $transient_key, $requests + 1, $window );
		return true;
	}

	private static function execute_step( $step, &$context ) {
		$type = $step['type'] ?? '';

		switch ( $type ) {
			case 'webhook':
				return self::send_webhook( $step, $context );
			case 'php_action':
				return self::execute_php_action( $step, $context );
			case 'ingest':
				return self::ingest_post( $step, $context );
			case 'email':
				return self::send_email( $step, $context );
		}

		return null;
	}

	private static function execute_php_action( $step, &$context ) {
		$code = $step['code'] ?? '';
		if ( empty( $code ) ) {
			$callback = $step['callback'] ?? '';
			if ( ! empty( $callback ) && is_callable( $callback ) ) {
				return call_user_func( $callback, $context );
			}
			return null;
		}

		// Security: In a real-world VIP plugin, we'd be very careful with eval.
		// For this implementation, we'll use it as requested for the "code editor" feature.
		try {
			ob_start();
			$result = eval( '?>' . $code );
			$output = ob_get_clean();
			return [
				'result' => $result,
				'output' => $output,
			];
		} catch ( \Throwable $e ) {
			return [
				'error' => $e->getMessage(),
			];
		}
	}

	private static function send_webhook( $config, $context ) {
		$url = self::parse_template( $config['url'] ?? '', $context );
		$method = $config['method'] ?? 'POST';
		$headers = self::parse_template( $config['headers'] ?? [], $context );
		$body = self::parse_template( $config['body'] ?? '', $context );

		if ( is_string( $headers ) ) {
			$headers = json_decode( $headers, true ) ?: [];
		}
		if ( is_string( $body ) ) {
			$decoded_body = json_decode( $body, true );
			if ( json_last_error() === JSON_ERROR_NONE ) {
				$body = $decoded_body;
			}
		}

		$response = wp_remote_request( $url, [
			'method'  => $method,
			'body'    => is_array( $body ) ? wp_json_encode( $body ) : $body,
			'headers' => array_merge( [ 'Content-Type' => 'application/json' ], (array)$headers ),
		] );

		return is_wp_error( $response ) ? [ 'error' => $response->get_error_message() ] : [
			'status' => wp_remote_retrieve_response_code( $response ),
			'body'   => wp_remote_retrieve_body( $response ),
		];
	}

	private static function ingest_post( $step, $context ) {
		$post_type = $step['post_type'] ?? 'post';
		$post_title = self::parse_template( $step['post_title'] ?? '', $context );
		$post_content = self::parse_template( $step['post_content'] ?? '', $context );
		$meta = self::parse_template( $step['meta'] ?? [], $context );

		if ( is_string( $meta ) ) {
			$meta = json_decode( $meta, true ) ?: [];
		}

		$post_id = wp_insert_post( [
			'post_type'    => $post_type,
			'post_title'   => $post_title,
			'post_content' => $post_content,
			'post_status'  => 'draft',
		] );

		if ( is_wp_error( $post_id ) ) {
			return [ 'error' => $post_id->get_error_message() ];
		}

		foreach ( $meta as $key => $value ) {
			update_post_meta( $post_id, $key, $value );
		}

		return [ 'post_id' => $post_id ];
	}

	private static function send_email( $step, $context ) {
		$to = self::parse_template( $step['to'] ?? '', $context );
		$subject = self::parse_template( $step['subject'] ?? '', $context );
		$message = self::parse_template( $step['message'] ?? '', $context );

		$sent = wp_mail( $to, $subject, $message );

		return [ 'sent' => $sent ];
	}

	private static function parse_template( $data, $context ) {
		if ( is_array( $data ) ) {
			foreach ( $data as $key => $value ) {
				$data[ $key ] = self::parse_template( $value, $context );
			}
			return $data;
		}

		if ( ! is_string( $data ) ) {
			return $data;
		}

		return preg_replace_callback( '/{{(.*?)}}/', function ( $matches ) use ( $context ) {
			$path = explode( '.', trim( $matches[1] ) );
			$value = $context;
			foreach ( $path as $segment ) {
				if ( is_array( $value ) && isset( $value[ $segment ] ) ) {
					$value = $value[ $segment ];
				} elseif ( is_object( $value ) && isset( $value->$segment ) ) {
					$value = $value->$segment;
				} else {
					return $matches[0];
				}
			}
			return is_scalar( $value ) ? $value : json_encode( $value );
		}, $data );
	}
}

APIWorkflow::init();
