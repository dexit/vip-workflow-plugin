import apiFetch from '@wordpress/api-fetch';
import {
	Button,
	__experimentalHStack as HStack,
	Modal,
	RadioControl,
	__experimentalSpacer as Spacer,
	TextControl,
	TextareaControl,
	Tooltip,
} from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

import ErrorNotice from '../../../../shared/js/components/error-notice';
import MetadataSelectFormTokenField from '../metadata-select-form-token-field';
import UserSelectFormTokenField from '../user-select-form-token-field';

export default function CreateEditCustomStatusModal( {
	customStatus,
	editorialMetadatas,
	onCancel,
	onSuccess,
} ) {
	const [ name, setName ] = useState( customStatus?.name || '' );
	const [ description, setDescription ] = useState( customStatus?.description || '' );
	const [ requiredUsers, setRequiredUsers ] = useState( customStatus?.meta?.required_users || [] );
	const [ requiredMetadatas, setRequiredMetadatas ] = useState( () => {
		if (
			customStatus?.meta?.required_metadata_ids &&
			customStatus?.meta?.required_metadata_ids.length > 0 &&
			editorialMetadatas.length > 0
		) {
			return customStatus.meta.required_metadata_ids
				.map( metadataId => {
					return editorialMetadatas.find(
						editorialMetadata => editorialMetadata.term_id === metadataId
					);
				} )
				.filter( metadata => metadata );
		}
		return [];
	} );

	const [ error, setError ] = useState( null );
	const [ isRequesting, setIsRequesting ] = useState( false );
	const [ areRestrictedUsersSet, setAreRestrictedUsersSet ] = useState(
		requiredUsers.length > 0 ? 'specific' : 'all'
	);

<<<<<<< HEAD
	let titleText = customStatus
=======
	let titleText = customStatus
>>>>>>> trunk
		? sprintf( __( 'Edit Step: "%s"', 'vip-workflow' ), customStatus.name )
		: __( 'Add New Workflow Step', 'vip-workflow' );

	const handleSave = async () => {
		const data = { name, description };
		if ( areRestrictedUsersSet === 'specific' ) {
			data.required_user_ids = requiredUsers.map( user => user.id );
		}
		data.required_metadata_ids = requiredMetadatas.map( metadata => metadata.term_id );

		try {
			setIsRequesting( true );
			const result = await apiFetch( {
				url: VW_CUSTOM_STATUS_CONFIGURE.url_edit_status + ( customStatus ? customStatus.term_id : '' ),
				method: customStatus ? 'PUT' : 'POST',
				data,
			} );
			onSuccess(
				customStatus
					? sprintf( __( 'Step "%s" updated successfully.', 'vip-workflow' ), name )
					: sprintf( __( 'Step "%s" added successfully.', 'vip-workflow' ), name ),
				result
			);
		} catch ( error ) {
			setError( error.message );
		}
		setIsRequesting( false );
	};

	return (
		<Modal
			title={ titleText }
			size="medium"
			onRequestClose={ onCancel }
			closeButtonLabel={ __( 'Cancel', 'vip-workflow' ) }
		>
			{ error && <ErrorNotice errorMessage={ error } setError={ setError } /> }
			<TextControl
				label={ __( 'Step Name', 'vip-workflow' ) }
				onChange={ setName }
				value={ name }
			/>
			<TextareaControl
				label={ __( 'Step Description', 'vip-workflow' ) }
				onChange={ setDescription }
				value={ description }
			/>
			<Spacer />
			<MetadataSelectFormTokenField
				label={ __( 'Assigned Workflow Components', 'vip-workflow' ) }
				editorialMetadatas={ editorialMetadatas }
				requiredMetadatas={ requiredMetadatas }
				onMetadatasChanged={ setRequiredMetadatas }
			/>
			<Spacer />
			<HStack justify="right" style={ { marginTop: '16px' } }>
				<Button variant="primary" onClick={ handleSave } disabled={ isRequesting }>
					{ customStatus ? __( 'Update Step', 'vip-workflow' ) : __( 'Save Step', 'vip-workflow' ) }
				</Button>
			</HStack>
		</Modal>
	);
}
