<?php
/**
 * class EditorialMetadata
 * REST endpoint for updating an editorial metadata
 */

namespace VIPWorkflow\Modules\EditorialMetadata\REST;

use VIPWorkflow\Modules\EditorialMetadata;
use WP_Error;
use WP_REST_Request;
use WP_Term;

class EditorialMetadataEndpoint {
	/**
	 * Initialize the class
	 */
	public static function init() {
		add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );
	}

	/**
	 * Register the REST routes
	 */
	public static function register_routes() {
		register_rest_route( 'vip-workflow/v1', '/editorial-metadata', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'handle_create_editorial_metadata' ],
			'permission_callback' => [ __CLASS__, 'permission_callback' ],
			'args'                => [
				'name'        => [
					'required'          => true,
					'validate_callback' => function($p) { return ! empty( trim( $p ) ); },
					'sanitize_callback' => function($p) { return trim( $p ); },
				],
				'type'        => [
					'required'          => true,
					'validate_callback' => function($p) { return in_array( trim( $p ), EditorialMetadata::SUPPORTED_METADATA_TYPES ); },
					'sanitize_callback' => function($p) { return trim( $p ); },
				],
				'description' => [
					'default'           => '',
					'sanitize_callback' => function($p) { return stripslashes( wp_filter_nohtml_kses( trim( $p ) ) ); },
				],
				'config'      => [
					'default'           => [],
				],
			],
		] );

		register_rest_route( 'vip-workflow/v1', '/editorial-metadata/(?P<id>[0-9]+)', [
			'methods'             => 'PUT',
			'callback'            => [ __CLASS__, 'handle_update_editorial_metadata' ],
			'permission_callback' => [ __CLASS__, 'permission_callback' ],
			'args'                => [
				'name'        => [
					'required'          => true,
					'validate_callback' => function($p) { return ! empty( trim( $p ) ); },
					'sanitize_callback' => function($p) { return trim( $p ); },
				],
				'id'          => [
					'required'          => true,
					'validate_callback' => function($p) { return get_term( absint( $p ), EditorialMetadata::METADATA_TAXONOMY ) instanceof WP_Term; },
					'sanitize_callback' => function($p) { return absint( $p ); },
				],
				'description' => [
					'default'           => '',
					'sanitize_callback' => function($p) { return stripslashes( wp_filter_nohtml_kses( trim( $p ) ) ); },
				],
				'config'      => [
					'default'           => [],
				],
			],
		] );

		register_rest_route( 'vip-workflow/v1', '/editorial-metadata/(?P<id>[0-9]+)', [
			'methods'             => 'DELETE',
			'callback'            => [ __CLASS__, 'handle_delete_editorial_metadata' ],
			'permission_callback' => [ __CLASS__, 'permission_callback' ],
		] );
	}

	public static function permission_callback() {
		return current_user_can( 'manage_options' );
	}

	public static function handle_create_editorial_metadata( WP_REST_Request $request ) {
		$args = [
			'name'        => sanitize_text_field( $request->get_param( 'name' ) ),
			'description' => $request->get_param( 'description' ),
			'type'        => $request->get_param( 'type' ),
			'config'      => $request->get_param( 'config' ),
		];

		return rest_ensure_response( EditorialMetadata::insert_editorial_metadata_term( $args ) );
	}

	public static function handle_update_editorial_metadata( WP_REST_Request $request ) {
		$term_id = $request->get_param( 'id' );
		$args = [
			'name'        => sanitize_text_field( $request->get_param( 'name' ) ),
			'description' => $request->get_param( 'description' ),
			'config'      => $request->get_param( 'config' ),
		];

		return rest_ensure_response( EditorialMetadata::update_editorial_metadata_term( $term_id, $args ) );
	}

	public static function handle_delete_editorial_metadata( WP_REST_Request $request ) {
		return rest_ensure_response( EditorialMetadata::delete_editorial_metadata_term( $request->get_param( 'id' ) ) );
	}

	public static function get_url() {
		return rest_url( sprintf( '%s/%s', 'vip-workflow/v1', 'editorial-metadata/' ) );
	}
}

EditorialMetadataEndpoint::init();
