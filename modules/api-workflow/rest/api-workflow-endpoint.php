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
		register_rest_route( 'vip-workflow/v1', '/api-workflow', [
			[
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'get_items' ],
				'permission_callback' => [ __CLASS__, 'permission_callback' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'create_item' ],
				'permission_callback' => [ __CLASS__, 'permission_callback' ],
			],
		] );

		register_rest_route( 'vip-workflow/v1', '/api-workflow/(?P<id>[\d]+)', [
			[
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'get_item' ],
				'permission_callback' => [ __CLASS__, 'permission_callback' ],
			],
			[
				'methods'             => 'POST', // Use POST for update to be safe with some environments
				'callback'            => [ __CLASS__, 'update_item' ],
				'permission_callback' => [ __CLASS__, 'permission_callback' ],
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ __CLASS__, 'delete_item' ],
				'permission_callback' => [ __CLASS__, 'permission_callback' ],
			],
		] );
	}

	public static function permission_callback() {
		return current_user_can( 'manage_options' );
	}

	public static function get_items( $request ) {
		$posts = get_posts( [
			'post_type'   => APIWorkflow::POST_TYPE,
			'post_status' => 'publish',
			'numberposts' => -1,
		] );

		$data = array_map( function ( $post ) {
			return [
				'id'     => $post->ID,
				'title'  => $post->post_title,
				'config' => get_post_meta( $post->ID, 'workflow_config', true ),
			];
		}, $posts );

		return rest_ensure_response( $data );
	}

	public static function create_item( $request ) {
		$params = $request->get_params();
		$title = sanitize_text_field( $params['title'] ?? 'New Workflow' );

		$post_id = wp_insert_post( [
			'post_type'   => APIWorkflow::POST_TYPE,
			'post_title'  => $title,
			'post_status' => 'publish',
		] );

		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}

		if ( isset( $params['config'] ) ) {
			update_post_meta( $post_id, 'workflow_config', $params['config'] );
		}

		return rest_ensure_response( [
			'id'     => $post_id,
			'title'  => $title,
			'config' => $params['config'] ?? [],
		] );
	}

	public static function get_item( $request ) {
		$id = $request['id'];
		$post = get_post( $id );

		if ( ! $post || $post->post_type !== APIWorkflow::POST_TYPE ) {
			return new WP_Error( 'not_found', 'Workflow not found', [ 'status' => 404 ] );
		}

		return rest_ensure_response( [
			'id'     => $post->ID,
			'title'  => $post->post_title,
			'config' => get_post_meta( $post->ID, 'workflow_config', true ),
		] );
	}

	public static function update_item( $request ) {
		$id = $request['id'];
		$params = $request->get_params();

		$post = get_post( $id );
		if ( ! $post || $post->post_type !== APIWorkflow::POST_TYPE ) {
			return new WP_Error( 'not_found', 'Workflow not found', [ 'status' => 404 ] );
		}

		if ( isset( $params['title'] ) ) {
			wp_update_post( [
				'ID'         => $id,
				'post_title' => sanitize_text_field( $params['title'] ),
			] );
		}

		if ( isset( $params['config'] ) ) {
			update_post_meta( $id, 'workflow_config', $params['config'] );
		}

		return rest_ensure_response( [
			'id'     => $id,
			'title'  => get_the_title( $id ),
			'config' => get_post_meta( $id, 'workflow_config', true ),
		] );
	}

	public static function delete_item( $request ) {
		$id = $request['id'];
		$post = get_post( $id );
		if ( ! $post || $post->post_type !== APIWorkflow::POST_TYPE ) {
			return new WP_Error( 'not_found', 'Workflow not found', [ 'status' => 404 ] );
		}

		wp_delete_post( $id, true );

		return rest_ensure_response( [ 'deleted' => true ] );
	}
}
