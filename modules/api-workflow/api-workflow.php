<?php
/**
 * Plugin Name: API Workflow Ingestion
 * Description: Advanced Workflow system with Ingestion, Digestion, Storage, and Dispatching.
 */

if ( ! defined( 'ABSPATH' ) ) {
	return;
}

// Load dependencies
require_once __DIR__ . '/rest/api-workflow-endpoint.php';

// Ensure Action Scheduler is loaded
if ( file_exists( WP_CONTENT_DIR . '/plugins/action-scheduler/action-scheduler.php' ) ) {
    require_once WP_CONTENT_DIR . '/plugins/action-scheduler/action-scheduler.php';
}

add_action( 'init', 'vw_api_init_core' );
add_action( 'rest_api_init', 'vw_api_register_dynamic_routes' );
add_action( 'init', 'vw_api_register_dynamic_hooks' );

/**
 * Initialize core features
 */
function vw_api_init_core() {
    register_post_type( 'vw_workflow_log', array(
        'labels' => array( 'name' => 'Workflow Logs' ),
        'public' => false,
        'show_ui' => true,
        'supports' => array( 'title', 'editor', 'excerpt', 'custom-fields' ),
        'menu_icon' => 'dashicons-list-view',
    ) );
}

/**
 * Register dynamic routes
 */
function vw_api_register_dynamic_routes() {
	$config = get_option( 'vw_api_endpoint_config', array( 'workflows' => array() ) );
	$workflows = isset( $config['workflows'] ) ? $config['workflows'] : array();

	foreach ( $workflows as $workflow ) {
		$entries = isset( $workflow['entries'] ) ? $workflow['entries'] : array();
		foreach ( $entries as $entry ) {
            if ( $entry['type'] !== 'rest' || empty($entry['route']) ) continue;
            register_rest_route( 'vw-ingest/v1', '/' . ltrim( $entry['route'], '/' ), array(
                'methods'             => isset( $entry['method'] ) ? $entry['method'] : 'POST',
                'callback'            => function( $request ) use ( $workflow ) {
                    return vw_api_handle_workflow_request( $workflow, $request );
                },
                'permission_callback' => '__return_true',
            ) );
        }
	}
}

	public static function handle_request( $request ) {
		$steps = CustomStatus::get_custom_statuses();
		$context = [
			'request' => $request->get_params(),
			'headers' => $request->get_headers(),
			'steps'   => [],
			'dto'     => [],
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
			'data'    => $results,
			'dto'     => $context['dto']
		] );
	}
}

	private static function execute_step( $step, &$context ) {
		$component_ids = $step->meta['required_metadata_ids'] ?? [];
		$step_results = [];

		foreach ( $component_ids as $component_id ) {
			$component = EditorialMetadata::get_editorial_metadata_term_by( 'id', $component_id );
			if ( $component ) {
				$res = self::execute_component( $component, $context );
				$step_results[ $component->slug ] = $res;
			}
		}

		$result = vw_api_execute_step( $step, $context );
        if ( is_array($result) && isset($result['__skip_workflow']) && $result['__skip_workflow'] ) {
            $context['steps'][ $step['id'] ] = array( 'result' => $result, 'status' => 'stopped' );
            break;
        }
		$context['steps'][ $step['id'] ] = array( 'result' => $result );
		if ( is_wp_error( $result ) ) break;
	}

    vw_api_log_execution( $workflow, $context, microtime(true) - $execution_start );
	return rest_ensure_response( array( 'success' => true, 'workflow_id' => $workflow_id, 'steps' => $context['steps'] ) );
}

		switch ( $type ) {
			case 'php_callback':
				return self::run_php_callback( $config, $context );
			case 'dto_schema':
				return self::validate_dto_schema( $config, $context );
			case 'data_extractor':
				return self::extract_data( $config, $context );
			case 'data_transformer':
				return self::transform_data( $config, $context );
			case 'data_ingestor':
				return self::ingest_dto_to_cpt( $config, $context );
			case 'despatch_config':
				return self::send_webhook( $config, $context );
		}
		return null;
	}

	private static function run_php_callback( $config, $context ) {
		if ( ! empty( $config['function_name'] ) && is_callable( $config['function_name'] ) ) {
			return call_user_func( $config['function_name'], $context );
		}
		return [ 'error' => 'Function not callable' ];
	}

	private static function validate_dto_schema( $config, &$context ) {
		$schema = json_decode( $config['schema'] ?? '{}', true );
		$context['dto_schema'] = $schema;
		return [ 'schema_loaded' => true ];
	}

	private static function extract_data( $config, $context ) {
		$source = $config['source_type'] ?? 'post';
		$extractor_config = json_decode( $config['extractor_config'] ?? '{}', true );

		if ( $source === 'post' ) {
			$post_id = self::parse_template( $extractor_config['post_id'] ?? '{{request.post_id}}', $context );
			$post = get_post( absint($post_id) );
			if ( ! $post ) return [ 'error' => 'Post not found' ];

			$extracted = [
				'post_title'   => $post->post_title,
				'post_content' => $post->post_content,
				'meta'         => []
			];
			foreach ( ($extractor_config['meta_keys'] ?? []) as $key ) {
				$extracted['meta'][$key] = get_post_meta( $post->ID, $key, true );
			}
			return $extracted;
		}
		return [ 'error' => 'Unsupported source' ];
	}

	private static function transform_data( $config, &$context ) {
		$mapping = json_decode( $config['mapping'] ?? '{}', true );
		$transformed = self::parse_template( $mapping, $context );
		$context['dto'] = array_merge( $context['dto'], $transformed );
		return $transformed;
	}

	private static function ingest_dto_to_cpt( $config, $context ) {
		$post_type = $config['post_type'] ?? 'post';
		$mapping = json_decode( $config['mapping'] ?? '{}', true );

		$post_data = self::parse_template( $mapping, $context );
		$post_id = wp_insert_post( array_merge( [ 'post_type' => $post_type, 'post_status' => 'publish' ], $post_data ) );

		return [ 'post_id' => $post_id ];
	}

	private static function send_webhook( $config, $context ) {
		$url = self::parse_template( $config['url'] ?? '', $context );
		$headers = self::parse_template( $config['headers'] ?? [], $context );
		$body = $context['dto'];

		$response = wp_remote_request( $url, [
			'method'  => $config['method'] ?? 'POST',
			'body'    => wp_json_encode( $body ),
			'headers' => array_merge( [ 'Content-Type' => 'application/json' ], (array)$headers ),
		] );

		return is_wp_error( $response ) ? [ 'error' => $response->get_error_message() ] : [
			'status' => wp_remote_retrieve_response_code( $response ),
			'body'   => wp_remote_retrieve_body( $response ),
		];
	}
	return $result;
}

	public static function parse_template( $data, $context ) {
		if ( is_array( $data ) ) {
			foreach ( $data as $key => $value ) {
				$data[ $key ] = self::parse_template( $value, $context );
			}
			return $data;
		}
		if ( is_string( $data ) && ( strpos( $data, '{' ) === 0 || strpos( $data, '[' ) === 0 ) ) {
			$decoded = json_decode( $data, true );
			if ( json_last_error() === JSON_ERROR_NONE ) {
				return self::parse_template( $decoded, $context );
			}
		}
		if ( ! is_string( $data ) ) return $data;

function vw_api_parse_template_array( $array, $context ) {
	if ( ! is_array( $array ) ) return vw_api_parse_template( $array, $context );
	foreach ( $array as $key => $value ) { $array[ $key ] = vw_api_parse_template_array( $value, $context ); }
	return $array;
}
APIWorkflow::init();
