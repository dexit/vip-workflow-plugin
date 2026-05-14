import './configure.scss';

import domReady from '@wordpress/dom-ready';
import { createRoot } from '@wordpress/element';

import WorkflowManager from './components/workflow-manager';
import EndpointConfig from './components/endpoint-config';

domReady( () => {
	const endpointConfigRoot = document.getElementById( 'endpoint-config-root' );
	if ( endpointConfigRoot ) {
		const root = createRoot( endpointConfigRoot );
		root.render( <EndpointConfig /> );
	}

	const workflowManagerRoot = document.getElementById( 'workflow-manager-root' );
	if ( workflowManagerRoot ) {
		const root = createRoot( workflowManagerRoot );
		root.render(
			<WorkflowManager
				customStatuses={ VW_CUSTOM_STATUS_CONFIGURE.custom_statuses }
				editorialMetadatas={ VW_CUSTOM_STATUS_CONFIGURE.editorial_metadatas }
			/>
		);
	}
} );

if ( module.hot ) {
	module.hot.accept();
}
