import { useState } from '@wordpress/element';
import {
    Panel,
    PanelBody,
    PanelRow,
    TextControl,
    SelectControl,
    Flex,
    FlexItem,
    Button
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

export default function EndpointConfig() {
    const [ config, setConfig ] = useState( window.VW_CUSTOM_STATUS_CONFIGURE.api_config || {
        path: '/my-workflow-api',
        method: 'POST',
        api_key: ''
    } );
    const [ isSaving, setIsSaving ] = useState( false );

    const handleSave = async () => {
        setIsSaving( true );
        try {
            await apiFetch( {
                path: '/vip-workflow/v1/api-config',
                method: 'POST',
                data: config
            } );
            alert( __( 'Configuration saved', 'vip-workflow' ) );
        } catch ( err ) {
            alert( err.message );
        }
        setIsSaving( false );
    };

    return (
        <Panel>
            <PanelBody title={ __( 'Global API Endpoint Configuration', 'vip-workflow' ) } initialOpen={ true }>
                <PanelRow>
                    <Flex align="start" style={{ width: '100%' }}>
                        <FlexItem isBlock>
                            <TextControl
                                label={ __( 'Endpoint Path', 'vip-workflow' ) }
                                value={ config.path }
                                onChange={ ( val ) => setConfig( { ...config, path: val } ) }
                                help={ __( 'Path relative to /wp-json/vw-api/v1', 'vip-workflow' ) }
                            />
                        </FlexItem>
                        <FlexItem>
                            <SelectControl
                                label={ __( 'Method', 'vip-workflow' ) }
                                value={ config.method }
                                options={[
                                    { label: 'POST', value: 'POST' },
                                    { label: 'GET', value: 'GET' }
                                ]}
                                onChange={ ( val ) => setConfig( { ...config, method: val } ) }
                            />
                        </FlexItem>
                        <FlexItem isBlock>
                            <TextControl
                                label={ __( 'API Key (Optional)', 'vip-workflow' ) }
                                value={ config.api_key }
                                onChange={ ( val ) => setConfig( { ...config, api_key: val } ) }
                                help={ __( 'Required in X-VW-API-KEY header', 'vip-workflow' ) }
                            />
                        </FlexItem>
                        <FlexItem style={{ alignSelf: 'center', marginTop: '10px' }}>
                            <Button variant="primary" onClick={ handleSave } disabled={ isSaving }>
                                { isSaving ? __( 'Saving...', 'vip-workflow' ) : __( 'Save API Config', 'vip-workflow' ) }
                            </Button>
                        </FlexItem>
                    </Flex>
                </PanelRow>
            </PanelBody>
        </Panel>
    );
}
