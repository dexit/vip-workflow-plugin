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
