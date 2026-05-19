import { useState } from '@wordpress/element';
import {
    Panel,
    PanelBody,
    PanelRow,
    TextControl,
    SelectControl
} from '@wordpress/components';

const EndpointConfig = ({ config, onUpdate }) => {
    return (
        <Panel>
            <PanelBody title="REST API Endpoint Settings" initialOpen={ true }>
                <PanelRow>
                    <TextControl
                        label="Endpoint Path"
                        help="The URL path relative to /wp-json/vw-api/v1/"
                        value={ config.api_path || '' }
                        onChange={ (val) => onUpdate({ ...config, api_path: val }) }
                    />
                </PanelRow>
                <PanelRow>
                    <SelectControl
                        label="HTTP Method"
                        value={ config.api_method || 'POST' }
                        options={[
                            { label: 'POST', value: 'POST' },
                            { label: 'GET', value: 'GET' },
                            { label: 'PUT', value: 'PUT' },
                            { label: 'DELETE', value: 'DELETE' },
                        ]}
                        onChange={ (val) => onUpdate({ ...config, api_method: val }) }
                    />
                </PanelRow>
                <PanelRow>
                    <SelectControl
                        label="Authentication"
                        value={ config.api_auth_type || 'none' }
                        options={[
                            { label: 'None (Public)', value: 'none' },
                            { label: 'X-VW-API-KEY Header', value: 'api_key' },
                            { label: 'Bearer Token', value: 'bearer' },
                        ]}
                        onChange={ (val) => onUpdate({ ...config, api_auth_type: val }) }
                    />
                </PanelRow>
                { (config.api_auth_type === 'api_key' || config.api_auth_type === 'bearer') && (
                    <PanelRow>
                        <TextControl
                            label="API Key / Token"
                            value={ config.api_key || '' }
                            onChange={ (val) => onUpdate({ ...config, api_key: val }) }
                        />
                    </PanelRow>
                )}
            </PanelBody>
        </Panel>
    );
};

export default EndpointConfig;
