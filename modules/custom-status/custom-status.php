<?php
namespace VIPWorkflow\Modules;

require_once __DIR__ . '/rest/custom-status-endpoint.php';

use VIPWorkflow\Modules\CustomStatus\REST\CustomStatusEndpoint;
use VIPWorkflow\Modules\Shared\PHP\HelperUtilities;
use VIPWorkflow\Modules\Shared\PHP\InstallUtilities;
use WP_Error;
use WP_Term;

class CustomStatus {
	const STATUS_TAXONOMY    = 'vw_workflow';
	const SETTINGS_SLUG      = 'vw-workflow-builder';
	const STATUS_CONFIG_KEY  = 'workflow_config';

	public static function init(): void {
		add_action( 'init', [ __CLASS__, 'register_workflow_taxonomy' ] );
		add_action( 'admin_menu', [ __CLASS__, 'add_admin_menu' ] );
		add_action( 'admin_enqueue_scripts', [ __CLASS__, 'action_admin_enqueue_scripts' ] );
	}

	public static function register_workflow_taxonomy(): void {
		register_taxonomy( self::STATUS_TAXONOMY, HelperUtilities::get_supported_post_types(), [
			'public'  => false,
			'labels'  => [ 'name' => 'API Workflows', 'singular_name' => 'API Workflow' ],
			'rewrite' => false,
		]);
	}

	public static function add_admin_menu(): void {
		add_menu_page( 'API Workflow Builder', 'Workflow Builder', 'manage_options', self::SETTINGS_SLUG, [ __CLASS__, 'render_workflow_view' ], 'dashicons-rest-api', 30 );
	}

	public static function render_workflow_view(): void {
		include_once __DIR__ . '/views/manage-workflow.php';
	}

	public static function action_admin_enqueue_scripts(): void {
		if ( HelperUtilities::is_settings_view_loaded( self::SETTINGS_SLUG ) ) {
			 = VIP_WORKFLOW_ROOT . '/dist/modules/custom-status/custom-status-configure.asset.php';
			if ( file_exists(  ) ) {
				 = include ;
				wp_enqueue_script( 'vw-workflow-builder-js', VIP_WORKFLOW_URL . 'dist/modules/custom-status/custom-status-configure.js', ['dependencies'], ['version'], true );
				wp_localize_script( 'vw-workflow-builder-js', 'VW_CUSTOM_STATUS_CONFIGURE', [
					'custom_statuses'    => self::get_custom_statuses(),
					'url_edit_status'    => CustomStatusEndpoint::get_url(),
				] );
			}
		}
	}

	public static function get_custom_statuses(): array {
		 = get_terms( [ 'taxonomy' => self::STATUS_TAXONOMY, 'hide_empty' => false ] );
		if ( is_wp_error(  ) || empty(  ) ) return [];
		return array_map( [ __CLASS__, 'add_config_to_term' ],  );
	}

	public static function add_config_to_term( WP_Term  ): WP_Term {
		->meta = [
			self::STATUS_CONFIG_KEY => get_term_meta( ->term_id, self::STATUS_CONFIG_KEY, true ),
		];
		return ;
	}

	public static function get_custom_status_by( string ,  ) {
		 = get_term_by( , , self::STATUS_TAXONOMY );
		return (  && ! is_wp_error(  ) ) ? self::add_config_to_term(  ) : false;
	}

	public static function insert_custom_status_term( array  ) {
		 = wp_insert_term( ['name'], self::STATUS_TAXONOMY, [ 'description' => ['description'] ?? '' ] );
		if ( is_wp_error(  ) ) return ;
		update_term_meta( ['term_id'], self::STATUS_CONFIG_KEY, ['config'] ?? [] );
		return self::get_custom_status_by( 'id', ['term_id'] );
	}

	public static function update_custom_status_term( int , array  ) {
		wp_update_term( , self::STATUS_TAXONOMY, [ 'name' => ['name'] ?? null, 'description' => ['description'] ?? null ] );
		if ( isset( ['config'] ) ) update_term_meta( , self::STATUS_CONFIG_KEY, ['config'] );
		return self::get_custom_status_by( 'id',  );
	}

	public static function delete_custom_status_term( int  ) {
		return wp_delete_term( , self::STATUS_TAXONOMY );
	}
}
CustomStatus::init();
