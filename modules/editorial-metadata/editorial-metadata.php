<?php
namespace VIPWorkflow\Modules;

require_once __DIR__ . '/rest/editorial-metadata-endpoint.php';

use VIPWorkflow\Modules\EditorialMetadata\REST\EditorialMetadataEndpoint;
use VIPWorkflow\Modules\Shared\PHP\HelperUtilities;
use WP_Error;
use WP_Term;

class EditorialMetadata {
	const SUPPORTED_METADATA_TYPES = [
		'php_callback', 'data_mapping', 'despatch_config', 'dto_schema',
		'data_extractor', 'data_transformer', 'data_ingestor',
		'checkbox', 'text', 'date',
	];

	const METADATA_TAXONOMY        = 'vw_component';
	const SETTINGS_SLUG            = 'vw-workflow-components';
	const METADATA_TYPE_KEY        = 'type';
	const METADATA_POSTMETA_KEY    = 'postmeta_key';
	const METADATA_CONFIG_KEY      = 'config';

	public static function init(): void {
		add_action( 'init', [ __CLASS__, 'register_component_taxonomy' ] );
		add_action( 'admin_menu', [ __CLASS__, 'add_admin_menu' ] );
		add_action( 'admin_enqueue_scripts', [ __CLASS__, 'action_admin_enqueue_scripts' ] );
	}

	public static function register_component_taxonomy(): void {
		register_taxonomy( self::METADATA_TAXONOMY, HelperUtilities::get_supported_post_types(), [
			'public'  => false,
			'labels'  => [ 'name' => 'Workflow Components', 'singular_name' => 'Workflow Component' ],
			'rewrite' => false,
		]);
	}

	public static function add_admin_menu(): void {
		add_submenu_page( CustomStatus::SETTINGS_SLUG, 'Workflow Components', 'Workflow Components', 'manage_options', self::SETTINGS_SLUG, [ __CLASS__, 'render_component_view' ] );
	}

	public static function render_component_view(): void {
		include_once __DIR__ . '/views/manage-editorial-metadata.php';
	}

	public static function action_admin_enqueue_scripts(): void {
		if ( HelperUtilities::is_settings_view_loaded( self::SETTINGS_SLUG ) ) {
			 = VIP_WORKFLOW_ROOT . '/dist/modules/editorial-metadata/editorial-metadata-configure.asset.php';
			if ( file_exists(  ) ) {
				 = include ;
				wp_enqueue_script( 'vw-components-js', VIP_WORKFLOW_URL . 'dist/modules/editorial-metadata/editorial-metadata-configure.js', ['dependencies'], ['version'], true );
				wp_localize_script( 'vw-components-js', 'VW_EDITORIAL_METADATA_CONFIGURE', [
					'supported_metadata_types'    => self::SUPPORTED_METADATA_TYPES,
					'editorial_metadata_terms'    => self::get_editorial_metadata_terms(),
					'url_edit_editorial_metadata' => EditorialMetadataEndpoint::get_url(),
				] );
			}
		}
	}

	public static function get_editorial_metadata_terms(): array {
		 = get_terms( [ 'taxonomy' => self::METADATA_TAXONOMY, 'hide_empty' => false ] );
		if ( is_wp_error(  ) || empty(  ) ) return [];
		return array_map( [ __CLASS__, 'add_metadata_to_term' ],  );
	}

	public static function add_metadata_to_term( WP_Term  ): WP_Term {
		->meta = [
			self::METADATA_TYPE_KEY     => get_term_meta( ->term_id, self::METADATA_TYPE_KEY, true ),
			self::METADATA_POSTMETA_KEY => get_term_meta( ->term_id, self::METADATA_POSTMETA_KEY, true ),
			self::METADATA_CONFIG_KEY   => get_term_meta( ->term_id, self::METADATA_CONFIG_KEY, true ),
		];
		return ;
	}

	public static function get_editorial_metadata_term_by( string ,  ) {
		 = get_term_by( , , self::METADATA_TAXONOMY );
		return (  && ! is_wp_error(  ) ) ? self::add_metadata_to_term(  ) : false;
	}

	public static function insert_editorial_metadata_term( array  ) {
		 = wp_insert_term( ['name'], self::METADATA_TAXONOMY, [ 'description' => ['description'] ?? '' ] );
		if ( is_wp_error(  ) ) return ;
		 = ['term_id'];
		update_term_meta( , self::METADATA_TYPE_KEY, ['type'] );
		update_term_meta( , self::METADATA_POSTMETA_KEY, "vw_meta_{['type']}_{}" );
		update_term_meta( , self::METADATA_CONFIG_KEY, ['config'] ?? [] );
		return self::get_editorial_metadata_term_by( 'id',  );
	}

	public static function update_editorial_metadata_term( int , array  ) {
		wp_update_term( , self::METADATA_TAXONOMY, [ 'name' => ['name'] ?? null, 'description' => ['description'] ?? null ] );
		if ( isset( ['config'] ) ) update_term_meta( , self::METADATA_CONFIG_KEY, ['config'] );
		return self::get_editorial_metadata_term_by( 'id',  );
	}

	public static function delete_editorial_metadata_term( int  ) {
		return wp_delete_term( , self::METADATA_TAXONOMY );
	}
}
EditorialMetadata::init();
