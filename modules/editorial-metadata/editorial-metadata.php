<?php

/**
 * Class EditorialMetadata
 * Editorial Metadata for VIP Workflow
 */
namespace VIPWorkflow\Modules;

require_once __DIR__ . '/rest/editorial-metadata-endpoint.php';

use VIPWorkflow\Modules\EditorialMetadata\REST\EditorialMetadataEndpoint;
use VIPWorkflow\Modules\Shared\PHP\HelperUtilities;
use VIPWorkflow\Modules\Shared\PHP\InstallUtilities;
use WP_Error;
use WP_Term;

class EditorialMetadata {

	const COMPONENTS_SLUG = 'vw-editorial-metadata';

	const SUPPORTED_METADATA_TYPES = [
		'php_callback',
		'data_mapping',
		'despatch_config',
<<<<<<< HEAD
		'dto_schema',
		'data_extractor',
		'data_transformer',
=======
>>>>>>> trunk
		'checkbox',
		'text',
		'date',
	];
	const METADATA_TAXONOMY        = 'vw_editorial_meta';
	const SETTINGS_SLUG            = 'vw-editorial-metadata';
	const METADATA_TYPE_KEY        = 'type';
	const METADATA_POSTMETA_KEY    = 'postmeta_key';
	const METADATA_CONFIG_KEY      = 'config';

	public static function init(): void {
		add_action( 'init', [ __CLASS__, 'register_editorial_metadata_taxonomy' ] );
		add_action( 'init', [ __CLASS__, 'register_editorial_metadata_terms_as_post_meta' ] );
		add_action( 'init', [ __CLASS__, 'setup_install' ] );
		add_action( 'admin_menu', [ __CLASS__, 'add_admin_menu' ] );
		add_action( 'admin_enqueue_scripts', [ __CLASS__, 'action_admin_enqueue_scripts' ] );
		add_action( 'enqueue_block_editor_assets', [ __CLASS__, 'load_scripts_for_block_editor' ] );
		add_action( 'enqueue_block_editor_assets', [ __CLASS__, 'load_styles_for_block_editor' ] );
	}

	public static function register_editorial_metadata_terms_as_post_meta(): void {
		$editorial_metadata_terms = self::get_editorial_metadata_terms();
		foreach ( $editorial_metadata_terms as $term ) {
			$post_meta_key  = $term->meta[ self::METADATA_POSTMETA_KEY ];
			$post_meta_args = self::get_postmeta_args( $term );
			foreach ( HelperUtilities::get_supported_post_types() as $post_type ) {
				register_post_meta( $post_type, $post_meta_key, $post_meta_args );
			}
		}
	}

	public static function register_editorial_metadata_taxonomy(): void {
		$supported_post_types = HelperUtilities::get_supported_post_types();
		register_taxonomy( self::METADATA_TAXONOMY, $supported_post_types,
			[
				'public'  => false,
				'labels'  => [
					'name'          => _x( 'Workflow Components', 'taxonomy general name', 'vip-workflow' ),
					'singular_name' => _x( 'Workflow Component', 'taxonomy singular name', 'vip-workflow' ),
				],
				'rewrite' => false,
			]
		);
	}

	public static function setup_install(): void {
	}

	public static function add_admin_menu(): void {
		$menu_title = __( 'Workflow Components', 'vip-workflow' );
		add_submenu_page( CustomStatus::SETTINGS_SLUG, $menu_title, $menu_title, 'manage_options', self::SETTINGS_SLUG, [ __CLASS__, 'render_editorial_metadata_view' ] );
	}

	public static function render_editorial_metadata_view(): void {
		include_once __DIR__ . '/views/manage-editorial-metadata.php';
	}

	public static function action_admin_enqueue_scripts(): void {
		if ( HelperUtilities::is_settings_view_loaded( self::SETTINGS_SLUG ) ) {
			$asset_file_path = VIP_WORKFLOW_ROOT . '/dist/modules/editorial-metadata/editorial-metadata.asset.php';
			if ( file_exists( $asset_file_path ) ) {
				$asset_file = include $asset_file_path;
				wp_enqueue_script( 'vip-workflow-editorial-metadata-js', VIP_WORKFLOW_URL . 'dist/modules/editorial-metadata/editorial-metadata.js', $asset_file['dependencies'], $asset_file['version'], true );
				wp_localize_script( 'vip-workflow-editorial-metadata-js', 'VW_EDITORIAL_METADATA_CONFIGURE', [
					'supported_metadata_types'    => self::SUPPORTED_METADATA_TYPES,
					'editorial_metadata_terms'    => self::get_editorial_metadata_terms(),
					'url_edit_editorial_metadata' => EditorialMetadataEndpoint::get_url(),
				] );
			}
		}
	}

	public static function load_scripts_for_block_editor(): void {
		$asset_file_path = VIP_WORKFLOW_ROOT . '/dist/modules/editorial-metadata/editorial-metadata-block.asset.php';
		if ( ! file_exists( $asset_file_path ) ) {
			return;
		}
		$asset_file   = include $asset_file_path;
		$dependencies = array_merge( $asset_file['dependencies'], [ 'vip-workflow-block-custom-status-script' ] );
		wp_enqueue_script( 'vip-workflow-block-editorial-metadata-script', VIP_WORKFLOW_URL . 'dist/modules/editorial-metadata/editorial-metadata-block.js', $dependencies, $asset_file['version'], true );
		wp_localize_script( 'vip-workflow-block-editorial-metadata-script', 'VW_EDITORIAL_METADATA', [
			'editorial_metadata_terms' => self::get_editorial_metadata_terms(),
		] );
	}

	public static function load_styles_for_block_editor(): void {
		$asset_file_path = VIP_WORKFLOW_ROOT . '/dist/modules/editorial-metadata/editorial-metadata-block.asset.php';
		if ( file_exists( $asset_file_path ) ) {
			$asset_file = include $asset_file_path;
			wp_enqueue_style( 'vip-workflow-editorial-metadata-styles', VIP_WORKFLOW_URL . 'dist/modules/editorial-metadata/editorial-metadata-block.css', [ 'wp-components' ], $asset_file['version'] );
		}
	}

	public static function get_editorial_metadata_terms(): array {
		$terms = get_terms( [
			'taxonomy'   => self::METADATA_TAXONOMY,
			'orderby'    => 'name',
			'hide_empty' => false,
		]);
		if ( is_wp_error( $terms ) || empty( $terms ) ) {
			return [];
		}
		return array_map( [ __CLASS__, 'add_metadata_to_term' ], $terms );
	}

	public static function get_editorial_metadata_term_by( string $field, int|string $value ): WP_Term|false {
		if ( ! in_array( $field, [ 'id', 'slug', 'name' ] ) ) { return false; }
		$term = ( 'id' === $field ) ? get_term( $value, self::METADATA_TAXONOMY ) : get_term_by( $field, $value, self::METADATA_TAXONOMY );
		return ( is_wp_error( $term ) || ! $term ) ? false : self::add_metadata_to_term( $term );
	}

	public static function add_metadata_to_term( WP_Term $term ): WP_Term {
		if ( ! isset( $term->taxonomy ) || self::METADATA_TAXONOMY !== $term->taxonomy ) { return $term; }
		$term->meta = [
			self::METADATA_TYPE_KEY     => get_term_meta( $term->term_id, self::METADATA_TYPE_KEY, true ),
			self::METADATA_POSTMETA_KEY => get_term_meta( $term->term_id, self::METADATA_POSTMETA_KEY, true ),
			self::METADATA_CONFIG_KEY   => get_term_meta( $term->term_id, self::METADATA_CONFIG_KEY, true ),
		];
		return $term;
	}

	public static function insert_editorial_metadata_term( array $args ): WP_Term|WP_Error {
		$term_name = $args['name'];
		$inserted_term = wp_insert_term( $term_name, self::METADATA_TAXONOMY, [
			'slug'        => $args['slug'] ?? sanitize_title( $term_name ),
			'description' => $args['description'] ?? '',
		] );
		if ( is_wp_error( $inserted_term ) ) { return $inserted_term; }
		$term_id = $inserted_term['term_id'];
		update_term_meta( $term_id, self::METADATA_TYPE_KEY, $args['type'] );
		update_term_meta( $term_id, self::METADATA_POSTMETA_KEY, self::get_postmeta_key( $args['type'], $term_id ) );
		update_term_meta( $term_id, self::METADATA_CONFIG_KEY, $args['config'] ?? [] );
		return self::get_editorial_metadata_term_by( 'id', $term_id );
	}

	public static function update_editorial_metadata_term( int $term_id, array $args = [] ): WP_Term|WP_Error {
		wp_update_term( $term_id, self::METADATA_TAXONOMY, [
			'name'        => $args['name'] ?? null,
			'description' => $args['description'] ?? null,
		] );
		if ( isset( $args['config'] ) ) {
			update_term_meta( $term_id, self::METADATA_CONFIG_KEY, $args['config'] );
		}
		return self::get_editorial_metadata_term_by( 'id', $term_id );
	}

	public static function delete_editorial_metadata_term( int $term_id ): bool|WP_Error {
		return wp_delete_term( $term_id, self::METADATA_TAXONOMY );
	}

	public static function get_postmeta_args( WP_Term $term ): array {
		return [ 'type' => 'string', 'single' => true, 'show_in_rest' => true ];
	}

	public static function get_postmeta_key( string $term_type, int $term_id ): string {
		return "vw_editorial_meta_{$term_type}_{$term_id}";
	}
}
EditorialMetadata::init();
