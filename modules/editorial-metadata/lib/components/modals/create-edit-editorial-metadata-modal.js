import apiFetch from '@wordpress/api-fetch';
import { Button, Modal, SelectControl, TextControl, TextareaControl, Flex, FlexItem, __experimentalHeading as Heading } from '@wordpress/components';
import { useState, useEffect } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

import ErrorNotice from '../../../../shared/js/components/error-notice';

export default function CreateEditEditorialMetadataModal( {
	availableMetadataTypes,
	metadata,
	onCancel,
	onSuccess,
} ) {
	const [ error, setError ] = useState( null );
	const [ name, setName ] = useState( metadata?.name || '' );
	const [ description, setDescription ] = useState( metadata?.description || '' );
	const [ type, setType ] = useState( metadata?.meta?.type || availableMetadataTypes[ 0 ].value );
	const [ config, setConfig ] = useState( metadata?.meta?.config || {} );
	const [ isRequesting, setIsRequesting ] = useState( false );

	useEffect(() => {
		if (metadata?.meta?.config) {
			setConfig(metadata.meta.config);
		}
	}, [metadata]);

	let titleText = metadata
		? sprintf( __( 'Edit Component: "%s"', 'vip-workflow' ), metadata.name )
		: __( 'Add New API Component', 'vip-workflow' );

	const handleSave = async () => {
		const data = { name, description, type, config };
		try {
			setIsRequesting( true );
			const result = await apiFetch( {
				url: VW_EDITORIAL_METADATA_CONFIGURE.url_edit_editorial_metadata + ( metadata ? metadata.term_id : '' ),
				method: metadata ? 'PUT' : 'POST',
				data,
			} );
			onSuccess(
				metadata
					? sprintf( __( 'Component "%s" updated successfully.', 'vip-workflow' ), name )
					: sprintf( __( 'Component "%s" added successfully.', 'vip-workflow' ), name ),
				result
			);
		} catch ( error ) {
			setError( error.message );
		}
		setIsRequesting( false );
	};

	const updateConfig = (key, value) => {
		setConfig({ ...config, [key]: value });
	};

	return (
		<Modal
			title={ titleText }
			size="large"
			onRequestClose={ onCancel }
			closeButtonLabel={ __( 'Cancel', 'vip-workflow' ) }
		>
			{ error && <ErrorNotice errorMessage={ error } setError={ setError } /> }
			<Flex direction="row" align="start">
				<FlexItem style={{ width: '35%', paddingRight: '20px', borderRight: '1px solid #ddd' }}>
					<TextControl label={ __( 'Name', 'vip-workflow' ) } onChange={ setName } value={ name } />
					<TextareaControl label={ __( 'Description', 'vip-workflow' ) } onChange={ setDescription } value={ description } />
					<SelectControl
						label={ __( 'Component Type', 'vip-workflow' ) }
						value={ type }
						options={ availableMetadataTypes }
						onChange={ setType }
						disabled={ metadata !== null }
					/>
				</FlexItem>
				<FlexItem style={{ width: '65%', paddingLeft: '20px' }}>
					<Heading level={4}>{ __( 'Configuration', 'vip-workflow' ) }</Heading>

					{ type === 'php_callback' && (
						<TextControl
							label={ __( 'PHP Function Name', 'vip-workflow' ) }
							value={ config.function_name || '' }
							onChange={ (val) => updateConfig('function_name', val) }
						/>
					)}

					{ type === 'dto_schema' && (
						<TextareaControl
							label={ __( 'DTO Schema (JSON Schema)', 'vip-workflow' ) }
							value={ config.schema || '' }
							onChange={ (val) => updateConfig('schema', val) }
							help={ __( 'Define the structure and validation for the data object.', 'vip-workflow' ) }
							rows={ 12 }
						/>
					)}

					{ type === 'data_extractor' && (
						<>
							<SelectControl
								label={ __( 'Source Type', 'vip-workflow' ) }
								value={ config.source_type || 'post' }
								options={[
									{ label: 'WordPress Post/Meta', value: 'post' },
									{ label: 'External API', value: 'external' }
								]}
								onChange={ (val) => updateConfig('source_type', val) }
							/>
							<TextareaControl
								label={ __( 'Extractor Config (JSON)', 'vip-workflow' ) }
								value={ config.extractor_config || '' }
								onChange={ (val) => updateConfig('extractor_config', val) }
								help={ __( 'Define keys to extract.', 'vip-workflow' ) }
								rows={ 8 }
							/>
						</>
					)}

					{ type === 'data_transformer' && (
						<TextareaControl
							label={ __( 'Transformation Mapping (JSON)', 'vip-workflow' ) }
							value={ config.mapping || '' }
							onChange={ (val) => updateConfig('mapping', val) }
							help={ __( 'Map source fields to DTO fields using template tags.', 'vip-workflow' ) }
							rows={ 12 }
						/>
					)}

					{ type === 'despatch_config' && (
						<>
							<TextControl
								label={ __( 'Webhook URL', 'vip-workflow' ) }
								value={ config.url || '' }
								onChange={ (val) => updateConfig('url', val) }
							/>
							<SelectControl
								label={ __( 'Method', 'vip-workflow' ) }
								value={ config.method || 'POST' }
								options={[{ label: 'POST', value: 'POST' }, { label: 'GET', value: 'GET' }, { label: 'PUT', value: 'PUT' }]}
								onChange={ (val) => updateConfig('method', val) }
							/>
							<TextareaControl
								label={ __( 'Headers (JSON)', 'vip-workflow' ) }
								value={ config.headers || '' }
								onChange={ (val) => updateConfig('headers', val) }
								rows={ 4 }
							/>
						</>
					)}

					{ (type === 'text' || type === 'date' || type === 'checkbox') && (
						<p>{ __( 'Standard metadata field. No extra configuration needed.', 'vip-workflow' ) }</p>
					)}
				</FlexItem>
			</Flex>
			<div style={{ marginTop: '20px', textAlign: 'right' }}>
				<Button variant="primary" onClick={ handleSave } disabled={ isRequesting }>
					{ metadata ? __( 'Update Component', 'vip-workflow' ) : __( 'Save Component', 'vip-workflow' ) }
				</Button>
			</div>
		</Modal>
	);
}
