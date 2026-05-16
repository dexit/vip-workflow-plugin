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

/**
 * Register dynamic hooks
 */
function vw_api_register_dynamic_hooks() {
    $config = get_option( 'vw_api_endpoint_config', array( 'workflows' => array() ) );
	$workflows = isset( $config['workflows'] ) ? $config['workflows'] : array();

	foreach ( $workflows as $workflow ) {
		$entries = isset( $workflow['entries'] ) ? $workflow['entries'] : array();
		foreach ( $entries as $entry ) {
            if ( $entry['type'] !== 'hook' || empty($entry['action']) ) continue;
            add_action( $entry['action'], function( $data = array() ) use ( $workflow ) {
                $request = new WP_REST_Request();
                $request->set_body_params( (array) $data );
                vw_api_handle_workflow_request( $workflow, $request );
            }, 10, 1 );
        }
	}
}

/**
 * Request handler
 */
function vw_api_handle_workflow_request( $workflow, $request ) {
	$workflow_id = $workflow['id'];
	$context = array(
		'request' => array(
			'body'    => $request instanceof WP_REST_Request ? $request->get_json_params() : $request->get_body_params(),
			'params'  => $request instanceof WP_REST_Request ? $request->get_params() : array(),
			'headers' => $request instanceof WP_REST_Request ? $request->get_headers() : array(),
		),
		'steps'   => array(),
        'vars'    => array(),
	);

    $execution_start = microtime(true);
	$steps = isset( $workflow['steps'] ) ? $workflow['steps'] : array();
	usort( $steps, function( $a, $b ) { return (isset($a['order']) ? (int)$a['order'] : 0) - (isset($b['order']) ? (int)$b['order'] : 0); } );

	foreach ( $steps as $step ) {
		if ( ! empty( $step['async'] ) && function_exists( 'as_enqueue_async_action' ) ) {
            as_enqueue_async_action( 'vw_api_process_async_step', array( 'step' => $step, 'context' => $context ), 'vw-api-workflow' );
            $context['steps'][ $step['id'] ] = array( 'status' => 'queued' );
            continue;
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

function vw_api_log_execution( $workflow, $context, $duration ) {
    $log_id = wp_insert_post( array(
        'post_type' => 'vw_workflow_log',
        'post_title' => sprintf( 'Run: %s (%s)', $workflow['id'], date('H:i:s') ),
        'post_status' => 'publish',
    ) );
    if ( ! is_wp_error( $log_id ) ) {
        update_post_meta( $log_id, 'workflow_id', $workflow['id'] );
        update_post_meta( $log_id, 'context', $context );
        update_post_meta( $log_id, 'duration', $duration );
    }
}

/**
 * Execute step logic
 */
function vw_api_execute_step( $step, &$context ) {
	$type = $step['type'];
	$config = isset( $step['config'] ) ? $step['config'] : array();
	$result = null;

	switch ( $type ) {
		case 'webhook':
			$url = vw_api_parse_template( isset($config['url']) ? $config['url'] : '', $context );
			$response = wp_remote_request( $url, array(
				'method'  => isset( $config['method'] ) ? $config['method'] : 'POST',
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => json_encode( vw_api_parse_template_array( isset($config['payload']) ? $config['payload'] : array(), $context ) ),
			) );

            if ( is_wp_error( $response ) && !empty($config['retry']) ) {
                if ( function_exists( 'as_enqueue_async_action' ) ) {
                    as_enqueue_async_action( 'vw_api_process_async_step', array( 'step' => $step, 'context' => $context ), 'vw-api-workflow' );
                    return array('status' => 'retry_queued', 'error' => $response->get_error_message());
                }
            }

			$result = is_wp_error( $response ) ? $response : json_decode( wp_remote_retrieve_body( $response ), true );
			break;

		case 'php_action':
			try {
				$execute = function( $__code, $request, $context ) { return eval( '?>' . $__code ); };
				$result = $execute( isset($config['php_code']) ? $config['php_code'] : '', $context['request'], $context );
			} catch ( Throwable $e ) { $result = new WP_Error( 'php_error', $e->getMessage() ); }
			break;

        case 'dto_mapping':
            $dto = array();
            foreach ( (isset($config['mapping']) ? $config['mapping'] : array()) as $key => $template ) {
                $dto[$key] = vw_api_parse_template( $template, $context );
            }
            $result = $dto;
            $context['vars'][$step['id']] = $dto;
            break;

        case 'transform':
            $input = vw_api_parse_template( isset($config['input']) ? $config['input'] : '', $context );
            $op = isset($config['operation']) ? $config['operation'] : 'none';
            $result = $input;
            if ( $op === 'lowercase' ) $result = strtolower($input);
            if ( $op === 'uppercase' ) $result = strtoupper($input);
            if ( $op === 'json_decode' ) $result = json_decode($input, true);
            if ( $op === 'date_format' ) $result = date(isset($config['format']) ? $config['format'] : 'Y-m-d', strtotime($input));
            break;

        case 'logic':
            $expr = vw_api_parse_template(isset($config['condition']) ? $config['condition'] : '', $context);
            if ( empty($expr) || in_array($expr, array('false', '0', 'null')) ) {
                if ( isset($config['on_false']) && $config['on_false'] === 'stop' ) return array('__skip_workflow' => true);
                $result = array('condition_met' => false);
            } else { $result = array('condition_met' => true); }
            break;

		case 'ingest':
			$post_id = wp_insert_post( array(
				'post_type'   => isset($config['post_type']) ? $config['post_type'] : 'post',
				'post_title'  => vw_api_parse_template( isset($config['title']) ? $config['title'] : 'Untitled', $context ),
				'post_status' => 'publish',
			) );
			if ( ! is_wp_error( $post_id ) ) {
				foreach ( (isset($config['meta']) ? $config['meta'] : array()) as $key => $template ) {
					update_post_meta( $post_id, $key, vw_api_parse_template( $template, $context ) );
				}
				$result = array( 'post_id' => $post_id );
			} else { $result = $post_id; }
			break;
	}
	return $result;
}

add_action( 'vw_api_process_async_step', 'vw_api_run_async_step', 10, 2 );
function vw_api_run_async_step( $step, $context ) { vw_api_execute_step( $step, $context ); }

function vw_api_parse_template( $string, $context ) {
    if ( ! is_string( $string ) ) return $string;
	return preg_replace_callback( '/\{\{(.*?)\}\}/', function( $matches ) use ( $context ) {
		$path = explode( '.', trim( $matches[1] ) );
		$value = $context;
		foreach ( $path as $segment ) {
			if ( (is_array( $value ) || $value instanceof ArrayAccess) && isset( $value[ $segment ] ) ) {
				$value = $value[ $segment ];
			} else { return $matches[0]; }
		}
		return is_scalar( $value ) ? $value : json_encode( $value );
	}, $string );
}

function vw_api_parse_template_array( $array, $context ) {
	if ( ! is_array( $array ) ) return vw_api_parse_template( $array, $context );
	foreach ( $array as $key => $value ) { $array[ $key ] = vw_api_parse_template_array( $value, $context ); }
	return $array;
}

// Admin UI Integration
add_action( 'admin_menu', function() {
    add_menu_page( 'API Workflows', 'API Workflows', 'manage_options', 'vw-api-workflows', function() { echo '<div id="vw-api-workflow-admin"></div>'; }, 'dashicons-rest-api', 30 );
} );

add_action( 'admin_enqueue_scripts', function( $hook ) {
    if ( 'toplevel_page_vw-api-workflows' !== $hook ) return;
    $asset_file = __DIR__ . '/build/index.asset.php';
    if ( file_exists( $asset_file ) ) {
        $assets = require $asset_file;
        wp_enqueue_script( 'vw-api-workflow-admin', plugins_url( 'build/index.js', __FILE__ ), $assets['dependencies'], $assets['version'], true );
        if ( file_exists( __DIR__ . '/build/index.css' ) ) {
            wp_enqueue_style( 'vw-api-workflow-admin', plugins_url( 'build/index.css', __FILE__ ), array(), $assets['version'] );
        }
    }
} );
