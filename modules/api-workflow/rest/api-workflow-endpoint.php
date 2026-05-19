<?php
namespace VIPWorkflow\Modules\APIWorkflow\REST;
use VIPWorkflow\Modules\APIWorkflow;
use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class APIWorkflowEndpoint {
	public static function init() {
		add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );
	}
	public static function register_routes() {
		register_rest_route( 'vip-workflow/v1', '/api-config', [
			[
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'get_config' ],
				'permission_callback' => [ __CLASS__, 'permission_callback' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'update_config' ],
				'permission_callback' => [ __CLASS__, 'permission_callback' ],
			],
		] );
	}
	public static function permission_callback() {
		return current_user_can( 'manage_options' );
	}
	public static function get_config() {
		return rest_ensure_response( get_option( 'vw_api_endpoint_config', [
			'path' => '/my-workflow-api',
			'method' => 'POST',
			'api_key' => ''
		] ) );
	}
	public static function update_config( $request ) {
		$params = $request->get_params();
		update_option( 'vw_api_endpoint_config', $params );
		return rest_ensure_response( $params );
	}
}
APIWorkflowEndpoint::init();
=======

add_action( 'rest_api_init', function () {
    register_rest_route( 'vip-workflow/v1', '/api-workflow/config', array(
        'methods' => 'GET',
        'callback' => 'vw_get_api_workflow_config',
        'permission_callback' => function () {
            return current_user_can( 'manage_options' );
        }
    ) );

    register_rest_route( 'vip-workflow/v1', '/api-workflow/config', array(
        'methods' => 'POST',
        'callback' => 'vw_update_api_workflow_config',
        'permission_callback' => function () {
            return current_user_can( 'manage_options' );
        }
    ) );
} );

function vw_get_api_workflow_config() {
    $config = get_option( 'vw_api_endpoint_config', array( 'workflows' => array() ) );
    return rest_ensure_response( $config );
}

function vw_update_api_workflow_config( $request ) {
    $params = $request->get_json_params();

    if ( ! isset( $params['workflows'] ) || ! is_array( $params['workflows'] ) ) {
        return new WP_Error( 'invalid_config', 'Invalid configuration format.', array( 'status' => 400 ) );
    }

    // Basic sanitization
    foreach ( $params['workflows'] as &$workflow ) {
        $workflow['id'] = sanitize_key( $workflow['id'] );

        // Multi-entry support
        if ( isset( $workflow['entries'] ) && is_array( $workflow['entries'] ) ) {
            foreach ( $workflow['entries'] as &$entry ) {
                $entry['type'] = sanitize_text_field( $entry['type'] );
                if ( $entry['type'] === 'rest' ) {
                    $entry['route'] = sanitize_text_field( $entry['route'] );
                    $entry['method'] = in_array( strtoupper($entry['method']), array( 'GET', 'POST', 'PUT', 'DELETE' ) ) ? strtoupper($entry['method']) : 'POST';
                } elseif ( $entry['type'] === 'hook' ) {
                    $entry['action'] = sanitize_key( $entry['action'] );
                }
            }
        }

        if ( isset( $workflow['steps'] ) ) {
            foreach ( $workflow['steps'] as &$step ) {
                $step['id'] = sanitize_key( $step['id'] );
                $step['type'] = sanitize_text_field( $step['type'] );
                // Step-specific configs are left largely as-is to allow flexible PHP and template tags
            }
        }
    }

    update_option( 'vw_api_endpoint_config', $params );

    flush_rewrite_rules();

    return rest_ensure_response( array( 'success' => true ) );
}
