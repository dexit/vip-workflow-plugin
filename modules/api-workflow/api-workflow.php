<?php
/**
 * Plugin Name: API Workflow Ingestion
 * Description: Robust REST API ingestion with PHP hooks, custom actions, and Action Scheduler dispatching.
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

add_action( 'rest_api_init', 'vw_api_register_dynamic_routes' );

/**
 * Register all configured dynamic routes.
 */
function vw_api_register_dynamic_routes() {
	$config = get_option( 'vw_api_endpoint_config', array( 'workflows' => array() ) );
	$workflows = isset( $config['workflows'] ) ? $config['workflows'] : array();

	foreach ( $workflows as $workflow ) {
		if ( empty( $workflow['route'] ) || empty( $workflow['id'] ) ) {
			continue;
		}

		register_rest_route( 'vw-ingest/v1', '/' . ltrim( $workflow['route'], '/' ), array(
			'methods'             => isset( $workflow['method'] ) ? $workflow['method'] : 'POST',
			'callback'            => function( $request ) use ( $workflow ) {
				return vw_api_handle_workflow_request( $workflow, $request );
			},
			'permission_callback' => '__return_true',
		) );
	}
}

/**
 * Main request handler for a specific workflow.
 */
function vw_api_handle_workflow_request( $workflow, $request ) {
	$workflow_id = $workflow['id'];
	$client_ip   = $request->get_header( 'X-Forwarded-For' ) ?: (isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0.0.0.0');

	// 1. Rate Limiting
	$limit  = isset( $workflow['rate_limit'] ) ? (int) $workflow['rate_limit'] : 0;
	$window = isset( $workflow['rate_window'] ) ? (int) $workflow['rate_window'] : 3600;

	if ( $limit > 0 ) {
		$transient_key = 'vw_api_rate_' . md5( $workflow_id . $client_ip );
		$count         = (int) get_transient( $transient_key );

		if ( $count >= $limit ) {
			return new WP_Error( 'rate_limit_exceeded', 'Too many requests.', array( 'status' => 429 ) );
		}
		set_transient( $transient_key, $count + 1, $window );
	}

	// 2. Context
	$context = array(
		'request' => array(
			'body'    => $request->get_json_params(),
			'params'  => $request->get_params(),
			'headers' => $request->get_headers(),
		),
		'steps'   => array(),
	);

	do_action( 'vw_api_before_workflow', $workflow, $request );

	// 3. Step Execution
	$steps = isset( $workflow['steps'] ) ? $workflow['steps'] : array();
	usort( $steps, function( $a, $b ) {
		return (isset($a['order']) ? (int)$a['order'] : 0) - (isset($b['order']) ? (int)$b['order'] : 0);
	} );

	foreach ( $steps as $step ) {
		if ( ! empty( $step['async'] ) ) {
			if ( function_exists( 'as_enqueue_async_action' ) ) {
				as_enqueue_async_action( 'vw_api_process_async_step', array(
					'step'    => $step,
					'context' => $context,
				), 'vw-api-workflow' );
				$context['steps'][ $step['id'] ] = array( 'status' => 'queued' );
				continue;
			}
		}

		$result = vw_api_execute_step( $step, $context );
		$context['steps'][ $step['id'] ] = array( 'result' => $result );

		if ( is_wp_error( $result ) ) {
			break;
		}
	}

	do_action( 'vw_api_after_workflow', $workflow, $context );

	return rest_ensure_response( array(
		'success' => true,
		'workflow_id' => $workflow_id,
		'steps'   => $context['steps'],
	) );
}

/**
 * Execute a single step.
 */
function vw_api_execute_step( $step, &$context ) {
	$type   = $step['type'];
	$config = isset( $step['config'] ) ? $step['config'] : array();

	do_action( 'vw_api_before_step', $step, $context );

	$result = null;

	switch ( $type ) {
		case 'webhook':
			$url = vw_api_parse_template( isset($config['url']) ? $config['url'] : '', $context );
			$args = array(
				'method'  => isset( $config['method'] ) ? $config['method'] : 'POST',
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => json_encode( vw_api_parse_template_array( isset($config['payload']) ? $config['payload'] : array(), $context ) ),
			);
			$response = wp_remote_request( $url, $args );
			$result   = is_wp_error( $response ) ? $response : json_decode( wp_remote_retrieve_body( $response ), true );
			break;

		case 'php_action':
			$php_code = isset($config['php_code']) ? $config['php_code'] : '';
			try {
				$execute = function( $__code, $request, $context ) {
					// Add helpful globals to scope
					return eval( '?>' . $__code );
				};
				$result = $execute( $php_code, $context['request'], $context );
			} catch ( Throwable $e ) {
				$result = new WP_Error( 'php_error', $e->getMessage() );
			}
			break;

		case 'ingest':
			$post_data = array(
				'post_type'   => isset($config['post_type']) ? $config['post_type'] : 'post',
				'post_title'  => vw_api_parse_template( isset($config['title']) ? $config['title'] : 'Untitled', $context ),
				'post_status' => 'publish',
			);
			$post_id = wp_insert_post( $post_data );
			if ( ! is_wp_error( $post_id ) ) {
				if ( isset( $config['meta'] ) && is_array( $config['meta'] ) ) {
					foreach ( $config['meta'] as $key => $template ) {
						update_post_meta( $post_id, $key, vw_api_parse_template( $template, $context ) );
					}
				}
				$result = array( 'post_id' => $post_id );
			} else {
				$result = $post_id;
			}
			break;
	}

	do_action( 'vw_api_after_step', $step, $result, $context );

	return $result;
}

add_action( 'vw_api_process_async_step', 'vw_api_run_async_step', 10, 2 );
function vw_api_run_async_step( $step, $context ) {
	vw_api_execute_step( $step, $context );
}

function vw_api_parse_template( $string, $context ) {
    if ( ! is_string( $string ) ) return $string;
	return preg_replace_callback( '/\{\{(.*?)\}\}/', function( $matches ) use ( $context ) {
		$path = explode( '.', trim( $matches[1] ) );
		$value = $context;
		foreach ( $path as $segment ) {
			if ( is_array( $value ) && isset( $value[ $segment ] ) ) {
				$value = $value[ $segment ];
			} else {
				return $matches[0];
			}
		}
		return is_scalar( $value ) ? $value : json_encode( $value );
	}, $string );
}

function vw_api_parse_template_array( $array, $context ) {
	if ( ! is_array( $array ) ) {
		return vw_api_parse_template( $array, $context );
	}
	foreach ( $array as $key => $value ) {
		$array[ $key ] = vw_api_parse_template_array( $value, $context );
	}
	return $array;
}

// Admin UI Integration
add_action( 'admin_menu', function() {
    add_menu_page(
        'API Workflows',
        'API Workflows',
        'manage_options',
        'vw-api-workflows',
        function() { echo '<div id="vw-api-workflow-admin"></div>'; },
        'dashicons-rest-api',
        30
    );
} );

add_action( 'admin_enqueue_scripts', function( $hook ) {
    if ( 'toplevel_page_vw-api-workflows' !== $hook ) {
        return;
    }

    $asset_file = __DIR__ . '/build/index.asset.php';

    if ( file_exists( $asset_file ) ) {
        $assets = require $asset_file;
        wp_enqueue_script(
            'vw-api-workflow-admin',
            plugins_url( 'build/index.js', __FILE__ ),
            $assets['dependencies'],
            $assets['version'],
            true
        );

        if ( file_exists( __DIR__ . '/build/index.css' ) ) {
            wp_enqueue_style(
                'vw-api-workflow-admin',
                plugins_url( 'build/index.css', __FILE__ ),
                array(),
                $assets['version']
            );
        }
    }
} );
