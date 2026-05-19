<?php
namespace VIPWorkflow\Modules;

use VIPWorkflow\Modules\Shared\PHP\HelperUtilities;
use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class APIWorkflow {
	const SETTINGS_SLUG = 'vw-api-manager';

	public static function init(): void {
		add_action( 'init', [ __CLASS__, 'register_api_endpoints' ], 20 );
		add_action( 'admin_menu', [ __CLASS__, 'add_admin_menu' ] );
		add_action( 'admin_enqueue_scripts', [ __CLASS__, 'action_admin_enqueue_scripts' ] );
	}

	public static function register_api_endpoints(): void {
		if ( ! class_exists( 'VIPWorkflow\Modules\CustomStatus' ) ) return;
		 = CustomStatus::get_custom_statuses();
		foreach (  as  ) {
			 = ->meta[ CustomStatus::STATUS_CONFIG_KEY ] ?? [];
			if ( empty( ['api_path'] ) ) continue;

			register_rest_route( 'vw-api/v1', ['api_path'], [
				'methods'             => ['api_method'] ?? 'POST',
				'callback'            => [ __CLASS__, 'handle_api_request' ],
				'permission_callback' => [ __CLASS__, 'check_api_permission' ],
				'args'                => [ 'workflow_id' => [ 'default' => ->term_id ] ]
			]);
		}
	}

	public static function check_api_permission( WP_REST_Request  ): bool {
		 = ->get_param( 'workflow_id' );
		      = get_term_meta( , CustomStatus::STATUS_CONFIG_KEY, true );

		if ( empty( ['api_auth_type'] ) || ['api_auth_type'] === 'none' ) return true;

		if ( ['api_auth_type'] === 'api_key' ) {
			return ->get_header( 'X-VW-API-KEY' ) === ['api_key'];
		}

		if ( ['api_auth_type'] === 'bearer' ) {
			 = ->get_header( 'Authorization' );
			return  === 'Bearer ' . ['api_key'];
		}

		return false;
	}

	public static function handle_api_request( WP_REST_Request  ): WP_REST_Response|WP_Error {
		 = ->get_param( 'workflow_id' );
		    = CustomStatus::get_custom_status_by( 'id',  );
		if ( !  ) return new WP_Error( 'invalid_workflow', 'Workflow not found', [ 'status' => 404 ] );

		 = [
			'request' => [
				'body'    => ->get_json_params(),
				'params'  => ->get_params(),
				'headers' => ->get_headers(),
			],
			'steps'   => [],
			'dto'     => [],
		];

		 = EditorialMetadata::get_editorial_metadata_terms();
		foreach (  as  ) {
			 = self::execute_component( ,  );
			['steps'][ ->slug ] = ;
		}

		return new WP_REST_Response( [ 'success' => true, 'context' =>  ], 200 );
	}

	private static function execute_component( , & ) {
		   = ->meta[ EditorialMetadata::METADATA_TYPE_KEY ];
		 = ->meta[ EditorialMetadata::METADATA_CONFIG_KEY ];

		switch (  ) {
			case 'data_extractor':
				 = [];
				foreach ( (array) (['mapping'] ?? []) as  =>  ) {
					[  ] = self::parse_template_tags( ,  );
				}
				['dto'] = array_merge( ['dto'],  );
				return ;

			case 'data_transformer':
				foreach ( (array) (['dto'] ?? []) as  =>  ) {
					if ( isset( ['rules'][  ] ) ) {
						 = ['rules'][  ];
						if (  === 'uppercase' ) ['dto'][  ] = strtoupper(  );
						if (  === 'lowercase' ) ['dto'][  ] = strtolower(  );
					}
				}
				return ['dto'];

			case 'data_ingestor':
				 = ['post_type'] ?? 'post';
				 = [ 'post_type' => , 'post_status' => 'publish' ];
				foreach ( (array) (['field_mapping'] ?? []) as  =>  ) {
					 = ['dto'][  ] ?? '';
					if ( in_array( , [ 'post_title', 'post_content', 'post_excerpt' ] ) ) {
						[  ] = ;
					}
				}
				 = wp_insert_post(  );
				if ( ! is_wp_error(  ) ) {
					foreach ( (array) (['meta_mapping'] ?? []) as  =>  ) {
						 = ['dto'][  ] ?? '';
						update_post_meta( , ,  );
					}
				}
				return ;

			case 'despatch_config':
				  = self::parse_template_tags( ['url'] ?? '',  );
				 = [];
				foreach ( (array) (['body_mapping'] ?? []) as  =>  ) {
					[  ] = self::parse_template_tags( ,  );
				}
				 = wp_remote_post( , [
					'method'  => ['method'] ?? 'POST',
					'headers' => ['headers'] ?? [],
					'body'    => json_encode(  ),
				]);
				return is_wp_error(  ) ? ->get_error_message() : wp_remote_retrieve_body(  );

			case 'php_callback':
				if ( ! empty( ['function_name'] ) && is_callable( ['function_name'] ) ) {
					return call_user_func( ['function_name'],  );
				}
				break;
		}
		return null;
	}

	public static function parse_template_tags( ,  ) {
		if ( ! is_string(  ) ) return ;
		return preg_replace_callback( '/\{\{(.+?)\}\}/', function(  ) use (  ) {
			 = explode( '.', trim( [1] ) );
			  = ;
			foreach (  as  ) {
				if ( is_array(  ) && isset( [  ] ) ) {
					 = [  ];
				} elseif ( is_object(  ) && isset( -> ) ) {
					 = ->;
				} else {
					return [0];
				}
			}
			return is_scalar(  ) ?  : json_encode(  );
		},  );
	}

	public static function add_admin_menu(): void {
		add_submenu_page( CustomStatus::SETTINGS_SLUG, 'API Manager', 'API Manager', 'manage_options', self::SETTINGS_SLUG, [ __CLASS__, 'render_admin_view' ] );
	}

	public static function render_admin_view(): void {
		include_once VIP_WORKFLOW_ROOT . '/modules/api-workflow/views/manage-api-workflow.php';
	}

	public static function action_admin_enqueue_scripts(): void {
		if ( HelperUtilities::is_settings_view_loaded( self::SETTINGS_SLUG ) ) {
			 = VIP_WORKFLOW_ROOT . '/dist/modules/api-workflow/api-workflow.asset.php';
			if ( file_exists(  ) ) {
				 = include ;
				wp_enqueue_script( 'vw-api-manager-js', VIP_WORKFLOW_URL . 'dist/modules/api-workflow/api-workflow.js', ['dependencies'], ['version'], true );
			}
		}
	}
}
APIWorkflow::init();
