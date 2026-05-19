import { Modal, TextControl, SelectControl, Button, TextareaControl } from '@wordpress/components';
import { useState, useEffect } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';

const CreateEditEditorialMetadataModal = ( { isOpen, onRequestClose, onSave, editorialMetadata = {} } ) => {
	const [ name, setName ] = useState( editorialMetadata.name || '' );
	const [ description, setDescription ] = useState( editorialMetadata.description || '' );
	const [ type, setType ] = useState( ( editorialMetadata.meta && editorialMetadata.meta.type ) || 'text' );
	const [ config, setConfig ] = useState( ( editorialMetadata.meta && editorialMetadata.meta.config ) || {} );
	const [ workflows, setWorkflows ] = useState( [] );

	useEffect( () => {
		setName( editorialMetadata.name || '' );
		setDescription( editorialMetadata.description || '' );
		setType( ( editorialMetadata.meta && editorialMetadata.meta.type ) || 'text' );
		setConfig( ( editorialMetadata.meta && editorialMetadata.meta.config ) || {} );

		apiFetch( { path: '/vw-custom-status/v1/statuses' } ).then( setWorkflows ).catch( console.error );
	}, [ editorialMetadata ] );

	const handleSave = () => {
		onSave( {
			term_id: editorialMetadata.term_id,
			name,
			description,
			type,
			config,
		} );
	};

	const updateConfig = ( key, value ) => {
		setConfig( ( prev ) => ( { ...prev, [ key ]: value } ) );
	};

	const handleJsonConfigChange = ( key, value ) => {
		try {
			const parsed = JSON.parse( value );
			updateConfig( key, parsed );
		} catch ( e ) {
			updateConfig( key + '_raw', value );
		}
	};

	return (
		<Modal
			title={ editorialMetadata.term_id ? 'Edit Component' : 'Create Component' }
			onRequestClose={ onRequestClose }
		>
			<div style={ { minWidth: '400px' } }>
				<TextControl
					label="Name"
					value={ name }
					onChange={ setName }
				/>
				<TextareaControl
					label="Description"
					value={ description }
					onChange={ setDescription }
				/>

				<SelectControl
					label="Assign to Workflow"
					value={ config.workflow_id || '' }
					options={ [
						{ label: '-- Select Workflow --', value: '' },
						...workflows.map( w => ( { label: w.name, value: w.term_id } ) )
					] }
					onChange={ ( val ) => updateConfig( 'workflow_id', val ) }
				/>

				<SelectControl
					label="Type"
					value={ type }
					options={ [
						{ label: 'PHP Callback', value: 'php_callback' },
						{ label: 'Data Extractor (DTO)', value: 'data_extractor' },
						{ label: 'Data Transformer', value: 'data_transformer' },
						{ label: 'Data Ingestor (CPT)', value: 'data_ingestor' },
						{ label: 'Despatch Config (Webhook)', value: 'despatch_config' },
						{ label: 'Text Field', value: 'text' },
						{ label: 'Checkbox', value: 'checkbox' },
					] }
					onChange={ setType }
				/>

				{ type === 'php_callback' && (
					<TextControl
						label="Function Name"
						value={ config.function_name || '' }
						onChange={ ( val ) => updateConfig( 'function_name', val ) }
					/>
				) }

				{ type === 'data_extractor' && (
					<TextareaControl
						label="Mapping (JSON)"
						help="Example: { 'dto_key': 'request.body.path.to.val' }"
						value={ JSON.stringify( config.mapping || {}, null, 2 ) }
						onChange={ ( val ) => handleJsonConfigChange( 'mapping', val ) }
					/>
				) }

				{ type === 'data_transformer' && (
					<TextareaControl
						label="Rules (JSON)"
						help="Example: { 'dto_key': 'uppercase' }"
						value={ JSON.stringify( config.rules || {}, null, 2 ) }
						onChange={ ( val ) => handleJsonConfigChange( 'rules', val ) }
					/>
				) }

				{ type === 'data_ingestor' && (
					<>
						<TextControl
							label="Post Type"
							value={ config.post_type || 'post' }
							onChange={ ( val ) => updateConfig( 'post_type', val ) }
						/>
						<TextareaControl
							label="Field Mapping (JSON)"
							help="Example: { 'post_title': 'dto_key' }"
							value={ JSON.stringify( config.field_mapping || {}, null, 2 ) }
							onChange={ ( val ) => handleJsonConfigChange( 'field_mapping', val ) }
						/>
						<TextareaControl
							label="Meta Mapping (JSON)"
							help="Example: { '_custom_meta': 'dto_key' }"
							value={ JSON.stringify( config.meta_mapping || {}, null, 2 ) }
							onChange={ ( val ) => handleJsonConfigChange( 'meta_mapping', val ) }
						/>
					</>
				) }

				{ type === 'despatch_config' && (
					<>
						<TextControl
							label="Webhook URL"
							value={ config.url || '' }
							onChange={ ( val ) => updateConfig( 'url', val ) }
						/>
						<SelectControl
							label="Method"
							value={ config.method || 'POST' }
							options={ [
								{ label: 'POST', value: 'POST' },
								{ label: 'GET', value: 'GET' },
								{ label: 'PUT', value: 'PUT' },
							] }
							onChange={ ( val ) => updateConfig( 'method', val ) }
						/>
						<TextareaControl
							label="Body Mapping (JSON)"
							value={ JSON.stringify( config.body_mapping || {}, null, 2 ) }
							onChange={ ( val ) => handleJsonConfigChange( 'body_mapping', val ) }
						/>
					</>
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

export default CreateEditEditorialMetadataModal;
