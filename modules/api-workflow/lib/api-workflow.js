import { render, useState, useEffect } from '@wordpress/element';
import { Button, Panel, PanelBody, PanelRow, Placeholder, Spinner, ExternalLink } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';

const APIWorkflowManager = () => {
	const [ workflows, setWorkflows ] = useState( [] );
	const [ loading, setLoading ] = useState( true );

	const fetchWorkflows = async () => {
		try {
			const response = await apiFetch( { path: '/vw-custom-status/v1/statuses' } );
			setWorkflows( response );
		} catch ( error ) {
			console.error( 'Error fetching workflows:', error );
		} finally {
			setLoading( false );
		}
	};

	useEffect( () => {
		fetchWorkflows();
	}, [] );

	if ( loading ) {
		return (
			<Placeholder>
				<Spinner />
			</Placeholder>
		);
	}

	return (
		<div className="vw-api-workflow-manager">
			<header>
				<h1>API Workflow Manager</h1>
				<p>Overview of all active REST API endpoints registered via Workflows.</p>
			</header>

			<div className="workflow-grid">
				{ workflows.map( ( workflow ) => {
					const config = workflow.meta.workflow_config || {};
					if ( ! config.api_path ) return null;

					const endpoint = ;

					return (
						<Panel key={ workflow.term_id }>
							<PanelBody title={ workflow.name } initialOpen={ true }>
								<PanelRow>
									<strong>Endpoint:</strong>
									<code>{ endpoint }</code>
								</PanelRow>
								<PanelRow>
									<strong>Method:</strong>
									<span>{ config.api_method || 'POST' }</span>
								</PanelRow>
								<PanelRow>
									<strong>Auth:</strong>
									<span>{ config.api_key ? 'X-VW-API-KEY required' : 'Public' }</span>
								</PanelRow>
								<PanelRow>
									<Button isPrimary onClick={ () => window.open( endpoint, '_blank' ) }>
										View Endpoint
									</Button>
								</PanelRow>
							</PanelBody>
						</Panel>
					);
				} ) }
			</div>
		</div>
	);
};

document.addEventListener( 'DOMContentLoaded', () => {
	const container = document.getElementById( 'vw-api-workflow-app' );
	if ( container ) {
		render( <APIWorkflowManager />, container );
	}
} );
