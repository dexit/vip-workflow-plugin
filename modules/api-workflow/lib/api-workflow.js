import { render } from '@wordpress/element';
import domReady from '@wordpress/dom-ready';
import APIWorkflowManager from './components/api-workflow-manager';

domReady( () => {
	const root = document.getElementById( 'api-workflow-manager-root' );
	if ( root ) {
		render( <APIWorkflowManager />, root );
	}
} );
