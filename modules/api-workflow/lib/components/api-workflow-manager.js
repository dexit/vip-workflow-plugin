import { useState, useEffect } from '@wordpress/element';
import {
    Button,
    Panel,
    PanelBody,
    PanelRow,
    TextControl,
    SelectControl,
    Flex,
    FlexItem,
    __experimentalHeading as Heading,
    Spinner,
    Modal
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import ErrorNotice from '../../../shared/js/components/error-notice';
import SuccessNotice from '../../../shared/js/components/success-notice';

export default function APIWorkflowManager() {
    const [ workflows, setWorkflows ] = useState( [] );
    const [ isLoading, setIsLoading ] = useState( true );
    const [ error, setError ] = useState( null );
    const [ success, setSuccess ] = useState( null );
    const [ isEditing, setIsEditing ] = useState( false );
    const [ currentWorkflow, setCurrentWorkflow ] = useState( null );

    useEffect( () => {
        fetchWorkflows();
    }, [] );

    const fetchWorkflows = async () => {
        setIsLoading( true );
        try {
            const data = await apiFetch( { path: '/vip-workflow/v1/api-workflow' } );
            setWorkflows( data );
        } catch ( err ) {
            setError( err.message );
        } finally {
            setIsLoading( false );
        }
    };

    const handleCreate = () => {
        setCurrentWorkflow( {
            title: 'New Workflow',
            config: {
                endpoint: {
                    path: '/my-custom-endpoint',
                    method: 'POST',
                    api_key: ''
                },
                steps: []
            }
        } );
        setIsEditing( true );
    };

    const handleEdit = ( workflow ) => {
        setCurrentWorkflow( JSON.parse( JSON.stringify( workflow ) ) ); // Deep clone
        setIsEditing( true );
    };

    const handleDelete = async ( id ) => {
        if ( ! window.confirm( __( 'Are you sure you want to delete this workflow?', 'vip-workflow' ) ) ) {
            return;
        }
        try {
            await apiFetch( {
                path: `/vip-workflow/v1/api-workflow/${id}`,
                method: 'DELETE'
            } );
            setSuccess( __( 'Workflow deleted', 'vip-workflow' ) );
            fetchWorkflows();
        } catch ( err ) {
            setError( err.message );
        }
    };

    const handleSave = async () => {
        try {
            const method = currentWorkflow.id ? 'POST' : 'POST';
            const path = currentWorkflow.id
                ? `/vip-workflow/v1/api-workflow/${currentWorkflow.id}`
                : '/vip-workflow/v1/api-workflow';

            await apiFetch( {
                path,
                method,
                data: currentWorkflow
            } );

            setSuccess( __( 'Workflow saved', 'vip-workflow' ) );
            setIsEditing( false );
            fetchWorkflows();
        } catch ( err ) {
            setError( err.message );
        }
    };

    const addStep = ( type ) => {
        const newStep = { type, id: Date.now() };
        if ( type === 'webhook' ) {
            newStep.url = '';
            newStep.body = '';
        } else if ( type === 'ingest' ) {
            newStep.post_type = 'post';
            newStep.post_title = '';
            newStep.post_content = '';
        } else if ( type === 'php_action' ) {
            newStep.callback = '';
        }

        setCurrentWorkflow( {
            ...currentWorkflow,
            config: {
                ...currentWorkflow.config,
                steps: [ ...currentWorkflow.config.steps, newStep ]
            }
        } );
    };

    if ( isLoading ) {
        return <Spinner />;
    }

    return (
        <div className="api-workflow-manager">
            { error && <ErrorNotice errorMessage={ error } setError={ setError } /> }
            { success && <SuccessNotice successMessage={ success } setSuccess={ setSuccess } /> }

            <Flex justify="flex-end" style={{ marginBottom: '20px' }}>
                <Button variant="primary" onClick={ handleCreate }>
                    { __( 'Create New Workflow', 'vip-workflow' ) }
                </Button>
            </Flex>

            <Panel>
                { workflows.map( ( workflow ) => (
                    <PanelBody key={ workflow.id } title={ workflow.title } initialOpen={ false }>
                        <PanelRow>
                            <div>
                                <strong>{ __( 'Endpoint:', 'vip-workflow' ) }</strong> <code>/wp-json/vw-api/v1{ workflow.config?.endpoint?.path }</code>
                            </div>
                            <Flex>
                                <Button variant="secondary" onClick={ () => handleEdit( workflow ) }>
                                    { __( 'Edit', 'vip-workflow' ) }
                                </Button>
                                <Button variant="link" isDestructive onClick={ () => handleDelete( workflow.id ) }>
                                    { __( 'Delete', 'vip-workflow' ) }
                                </Button>
                            </Flex>
                        </PanelRow>
                    </PanelBody>
                ) ) }
            </Panel>

            { isEditing && (
                <Modal
                    title={ currentWorkflow.id ? __( 'Edit Workflow', 'vip-workflow' ) : __( 'Create Workflow', 'vip-workflow' ) }
                    onRequestClose={ () => setIsEditing( false ) }
                    style={{ width: '80%', maxWidth: '800px' }}
                >
                    <div style={{ padding: '20px' }}>
                        <TextControl
                            label={ __( 'Workflow Title', 'vip-workflow' ) }
                            value={ currentWorkflow.title }
                            onChange={ ( val ) => setCurrentWorkflow( { ...currentWorkflow, title: val } ) }
                        />

                        <Heading level={ 3 }>{ __( 'Endpoint Configuration', 'vip-workflow' ) }</Heading>
                        <Flex>
                            <FlexItem isBlock>
                                <TextControl
                                    label={ __( 'Path', 'vip-workflow' ) }
                                    value={ currentWorkflow.config.endpoint.path }
                                    onChange={ ( val ) => setCurrentWorkflow( {
                                        ...currentWorkflow,
                                        config: {
                                            ...currentWorkflow.config,
                                            endpoint: { ...currentWorkflow.config.endpoint, path: val }
                                        }
                                    } ) }
                                />
                            </FlexItem>
                            <FlexItem>
                                <SelectControl
                                    label={ __( 'Method', 'vip-workflow' ) }
                                    value={ currentWorkflow.config.endpoint.method }
                                    options={[
                                        { label: 'POST', value: 'POST' },
                                        { label: 'GET', value: 'GET' },
                                        { label: 'PUT', value: 'PUT' }
                                    ]}
                                    onChange={ ( val ) => setCurrentWorkflow( {
                                        ...currentWorkflow,
                                        config: {
                                            ...currentWorkflow.config,
                                            endpoint: { ...currentWorkflow.config.endpoint, method: val }
                                        }
                                    } ) }
                                />
                            </FlexItem>
                        </Flex>
                        <TextControl
                            label={ __( 'API Key (X-VW-API-KEY Header)', 'vip-workflow' ) }
                            value={ currentWorkflow.config.endpoint.api_key }
                            onChange={ ( val ) => setCurrentWorkflow( {
                                ...currentWorkflow,
                                config: {
                                    ...currentWorkflow.config,
                                    endpoint: { ...currentWorkflow.config.endpoint, api_key: val }
                                }
                            } ) }
                        />

                        <Heading level={ 3 }>{ __( 'Workflow Steps', 'vip-workflow' ) }</Heading>
                        { currentWorkflow.config.steps.map( ( step, index ) => (
                            <Panel key={ step.id } style={{ border: '1px solid #ccc', marginBottom: '10px', padding: '10px' }}>
                                <Flex justify="space-between" align="center">
                                    <Heading level={ 4 }>{ step.type.toUpperCase() }</Heading>
                                    <Button isDestructive onClick={ () => {
                                        const steps = [ ...currentWorkflow.config.steps ];
                                        steps.splice( index, 1 );
                                        setCurrentWorkflow({ ...currentWorkflow, config: { ...currentWorkflow.config, steps } });
                                    }}>
                                        { __( 'Remove Step', 'vip-workflow' ) }
                                    </Button>
                                </Flex>

                                { step.type === 'webhook' && (
                                    <>
                                        <TextControl
                                            label={ __( 'Webhook URL', 'vip-workflow' ) }
                                            value={ step.url }
                                            onChange={ ( val ) => {
                                                const steps = [ ...currentWorkflow.config.steps ];
                                                steps[ index ].url = val;
                                                setCurrentWorkflow({ ...currentWorkflow, config: { ...currentWorkflow.config, steps } });
                                            }}
                                            help={ __( 'Use {{request.param}} for template tags', 'vip-workflow' ) }
                                        />
                                        <TextControl
                                            label={ __( 'Body (JSON)', 'vip-workflow' ) }
                                            value={ step.body }
                                            onChange={ ( val ) => {
                                                const steps = [ ...currentWorkflow.config.steps ];
                                                steps[ index ].body = val;
                                                setCurrentWorkflow({ ...currentWorkflow, config: { ...currentWorkflow.config, steps } });
                                            }}
                                        />
                                    </>
                                )}

                                { step.type === 'ingest' && (
                                    <>
                                        <SelectControl
                                            label={ __( 'Post Type', 'vip-workflow' ) }
                                            value={ step.post_type }
                                            options={[
                                                { label: 'Post', value: 'post' },
                                                { label: 'Page', value: 'page' }
                                            ]}
                                            onChange={ ( val ) => {
                                                const steps = [ ...currentWorkflow.config.steps ];
                                                steps[ index ].post_type = val;
                                                setCurrentWorkflow({ ...currentWorkflow, config: { ...currentWorkflow.config, steps } });
                                            }}
                                        />
                                        <TextControl
                                            label={ __( 'Title Template', 'vip-workflow' ) }
                                            value={ step.post_title }
                                            onChange={ ( val ) => {
                                                const steps = [ ...currentWorkflow.config.steps ];
                                                steps[ index ].post_title = val;
                                                setCurrentWorkflow({ ...currentWorkflow, config: { ...currentWorkflow.config, steps } });
                                            }}
                                        />
                                    </>
                                )}

                                { step.type === 'php_action' && (
                                    <TextControl
                                        label={ __( 'PHP Callback Function', 'vip-workflow' ) }
                                        value={ step.callback }
                                        onChange={ ( val ) => {
                                            const steps = [ ...currentWorkflow.config.steps ];
                                            steps[ index ].callback = val;
                                            setCurrentWorkflow({ ...currentWorkflow, config: { ...currentWorkflow.config, steps } });
                                        }}
                                    />
                                )}
                            </Panel>
                        ))}

                        <Flex justify="center" style={{ marginTop: '20px' }}>
                            <Button variant="secondary" onClick={ () => addStep('webhook') }>{ __( 'Add Webhook', 'vip-workflow' ) }</Button>
                            <Button variant="secondary" onClick={ () => addStep('ingest') }>{ __( 'Add CPT Ingest', 'vip-workflow' ) }</Button>
                            <Button variant="secondary" onClick={ () => addStep('php_action') }>{ __( 'Add PHP Action', 'vip-workflow' ) }</Button>
                        </Flex>

                        <Flex justify="flex-end" style={{ marginTop: '40px' }}>
                            <Button variant="secondary" onClick={ () => setIsEditing( false ) } style={{ marginRight: '10px' }}>
                                { __( 'Cancel', 'vip-workflow' ) }
                            </Button>
                            <Button variant="primary" onClick={ handleSave }>
                                { __( 'Save Workflow', 'vip-workflow' ) }
                            </Button>
                        </Flex>
                    </div>
                </Modal>
            )}
        </div>
    );
}
