import { Modal, TextControl, SelectControl, Button, TextareaControl } from '@wordpress/components';
import { useState, useEffect } from '@wordpress/element';

const CreateEditCustomStatusModal = ( { isOpen, onRequestClose, onSave, status = {} } ) => {
	const [ name, setName ] = useState( status.name || '' );
	const [ description, setDescription ] = useState( status.description || '' );
	const [ config, setConfig ] = useState( ( status.meta && status.meta.workflow_config ) || {} );

	useEffect( () => {
		setName( status.name || '' );
		setDescription( status.description || '' );
		setConfig( ( status.meta && status.meta.workflow_config ) || {} );
	}, [ status ] );

	const handleSave = () => {
		onSave( {
			term_id: status.term_id,
			name,
			description,
			config,
		} );
	};

	const updateConfig = ( key, value ) => {
		setConfig( ( prev ) => ( { ...prev, [ key ]: value } ) );
	};

	return (
		<Modal
			title={ status.term_id ? 'Edit Workflow' : 'Create Workflow' }
			onRequestClose={ onRequestClose }
		>
			<div style={ { minWidth: '400px' } }>
				<TextControl
					label="Workflow Name"
					value={ name }
					onChange={ setName }
				/>
				<TextareaControl
					label="Workflow Description"
					value={ description }
					onChange={ setDescription }
				/>

				<header style={ { marginTop: '20px', borderBottom: '1px solid #ddd', paddingBottom: '5px', marginBottom: '15px' } }>
					<strong>API Endpoint Settings</strong>
				</header>

				<TextControl
					label="API Path"
					help="Registered under /wp-json/vw-api/v1/"
					value={ config.api_path || '' }
					onChange={ ( val ) => updateConfig( 'api_path', val ) }
				/>

				<SelectControl
					label="HTTP Method"
					value={ config.api_method || 'POST' }
					options={ [
						{ label: 'POST', value: 'POST' },
						{ label: 'GET', value: 'GET' },
						{ label: 'PUT', value: 'PUT' },
					] }
					onChange={ ( val ) => updateConfig( 'api_method', val ) }
				/>

				<SelectControl
					label="Auth Type"
					value={ config.api_auth_type || 'none' }
					options={ [
						{ label: 'None (Public)', value: 'none' },
						{ label: 'X-VW-API-KEY Header', value: 'api_key' },
						{ label: 'Bearer Token', value: 'bearer' },
					] }
					onChange={ ( val ) => updateConfig( 'api_auth_type', val ) }
				/>

				{ ( config.api_auth_type === 'api_key' || config.api_auth_type === 'bearer' ) && (
					<TextControl
						label="API Key / Token"
						value={ config.api_key || '' }
						onChange={ ( val ) => updateConfig( 'api_key', val ) }
					/>
				) }

				<div style={ { marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' } }>
					<Button isSecondary onClick={ onRequestClose }>
						Cancel
					</Button>
					<Button isPrimary onClick={ handleSave }>
						Save
					</Button>
				</div>
			</div>
		</Modal>
	);
};

export default CreateEditCustomStatusModal;
