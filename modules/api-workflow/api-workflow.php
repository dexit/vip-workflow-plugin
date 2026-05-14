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
	}

	public static function register_dynamic_routes(): void {
		$config = get_option( 'vw_api_endpoint_config' );
		if ( empty( $config ) || empty( $config['path'] ) ) {
			return;
		}

		register_rest_route( 'vw-api/v1', $config['path'], [
			'methods'             => $config['method'] ?? 'POST',
			'callback'            => [ __CLASS__, 'handle_request' ],
			'permission_callback' => function () use ( $config ) {
				if ( ! empty( $config['api_key'] ) ) {
					$header_key = $_SERVER['HTTP_X_VW_API_KEY'] ?? '';
					return $header_key === $config['api_key'];
				}
				return true;
			},
		] );
	}

	public static function handle_request( $request ) {
		$steps = CustomStatus::get_custom_statuses();
		$context = [
			'request' => $request->get_params(),
			'headers' => $request->get_headers(),
			'steps'   => [],
		];

		$results = [];
		foreach ( $steps as $step ) {
			$step_result = self::execute_step( $step, $context );
			$results[] = [
				'step' => $step->name,
				'result' => $step_result
			];
			$context['steps'][ $step->slug ] = $step_result;
		}

		return rest_ensure_response( [
			'success' => true,
			'data'    => $results
		] );
	}

	private static function execute_step( $step, &$context ) {
		$component_ids = $step->meta['required_metadata_ids'] ?? [];
		$step_results = [];

		foreach ( $component_ids as $component_id ) {
			$component = EditorialMetadata::get_editorial_metadata_term_by( 'id', $component_id );
			if ( $component ) {
				$step_results[ $component->slug ] = self::execute_component( $component, $context );
			}
		}

		return $step_results;
	}

	private static function execute_component( $component, &$context ) {
		$type = $component->meta['type'];
		$config = $component->meta['config'];

		switch ( $type ) {
			case 'php_callback':
				if ( ! empty( $config['function_name'] ) && is_callable( $config['function_name'] ) ) {
					return call_user_func( $config['function_name'], $context );
				}
				break;
			case 'data_mapping':
				return self::parse_template( $config['mapping'] ?? [], $context );
			case 'despatch_config':
				return self::send_webhook( $config, $context );
		}
		return null;
	}

	private static function send_webhook( $config, $context ) {
		$url = self::parse_template( $config['url'] ?? '', $context );
		$method = $config['method'] ?? 'POST';
		$headers = self::parse_template( $config['headers'] ?? [], $context );
		$body = $context; // Default body is the whole context, can be refined

		$response = wp_remote_request( $url, [
			'method'  => $method,
			'body'    => wp_json_encode( $body ),
			'headers' => array_merge( [ 'Content-Type' => 'application/json' ], (array)$headers ),
		] );

		return is_wp_error( $response ) ? [ 'error' => $response->get_error_message() ] : [
			'status' => wp_remote_retrieve_response_code( $response ),
			'body'   => wp_remote_retrieve_body( $response ),
		];
	}

	private static function parse_template( $data, $context ) {
		if ( is_array( $data ) ) {
			foreach ( $data as $key => $value ) {
				$data[ $key ] = self::parse_template( $value, $context );
			}
			return $data;
		}

		if ( is_string( $data ) && strpos( $data, '{' ) !== false ) {
			// Check if it's a JSON string
			$decoded = json_decode( $data, true );
			if ( json_last_error() === JSON_ERROR_NONE && is_array( $decoded ) ) {
				return self::parse_template( $decoded, $context );
			}
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
