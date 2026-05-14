import { useState, useEffect } from '@wordpress/element';
import {
    Button,
    Panel,
    PanelBody,
    PanelRow,
    TextControl,
    SelectControl,
    ToggleControl,
    Flex,
    FlexItem,
    __experimentalHeading as Heading,
    Spinner,
    Modal
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import CodeMirror from '@uiw/react-codemirror';
import { php } from '@codemirror/lang-php';
import { json } from '@codemirror/lang-json';
import { autocompletion } from '@codemirror/autocomplete';
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
            const data = await apiFetch( { path: '/vip-workflow/v1/api-config' } );
            setWorkflows( Array.isArray(data) ? data : [data] );
        } catch ( err ) {
            setError( err.message );
        } finally {
            setIsLoading( false );
        }
    };

    const handleCreate = () => {
        setCurrentWorkflow( {
            id: 'wf_' + Date.now(),
            name: 'New Workflow',
            path: '/my-custom-endpoint',
            method: 'POST',
            api_key: '',
            rate_limit: {
                enabled: false,
                limit: 60,
                window: 60
            },
            steps: []
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
        const updatedWorkflows = workflows.filter( w => w.id !== id );
        try {
            await apiFetch( {
                path: '/vip-workflow/v1/api-config',
                method: 'POST',
                data: updatedWorkflows
            } );
            setSuccess( __( 'Workflow deleted', 'vip-workflow' ) );
            fetchWorkflows();
        } catch ( err ) {
            setError( err.message );
        }
    };

    const handleSave = async () => {
        let updatedWorkflows;
        const index = workflows.findIndex( w => w.id === currentWorkflow.id );
        if ( index !== -1 ) {
            updatedWorkflows = [ ...workflows ];
            updatedWorkflows[ index ] = currentWorkflow;
        } else {
            updatedWorkflows = [ ...workflows, currentWorkflow ];
        }

        try {
            await apiFetch( {
                path: '/vip-workflow/v1/api-config',
                method: 'POST',
                data: updatedWorkflows
            } );

            setSuccess( __( 'Workflow saved', 'vip-workflow' ) );
            setIsEditing( false );
            fetchWorkflows();
        } catch ( err ) {
            setError( err.message );
        }
    };

    const addStep = ( type ) => {
        const newStep = { type, id: 'step_' + Date.now(), name: '', async: false };
        if ( type === 'webhook' ) {
            newStep.url = '';
            newStep.method = 'POST';
            newStep.headers = '{}';
            newStep.body = '{}';
        } else if ( type === 'ingest' ) {
            newStep.post_type = 'post';
            newStep.post_title = '';
            newStep.post_content = '';
            newStep.meta = '{}';
        } else if ( type === 'php_action' ) {
            newStep.code = '<?php\n\nreturn "Hello World";';
        } else if ( type === 'email' ) {
            newStep.to = '';
            newStep.subject = '';
            newStep.message = '';
        }

        setCurrentWorkflow( {
            ...currentWorkflow,
            steps: [ ...currentWorkflow.steps, newStep ]
        } );
    };

    const updateStep = ( index, data ) => {
        const steps = [ ...currentWorkflow.steps ];
        steps[ index ] = { ...steps[ index ], ...data };
        setCurrentWorkflow({
            ...currentWorkflow,
            steps
        });
    };

    const getCompletions = ( context ) => {
        const word = context.matchBefore(/\{\{\s*[\w.]*/);
        if ( !word ) return null;

        const options = [
            { label: 'request.params', type: 'variable' },
            { label: 'request.headers', type: 'variable' },
            { label: 'request.body', type: 'variable' },
            { label: 'workflow.id', type: 'constant' },
            { label: 'workflow.name', type: 'constant' },
        ];

        currentWorkflow.steps.forEach( step => {
            if ( step.name ) {
                options.push( { label: `steps.${step.name}.result`, type: 'variable' } );
            }
        } );

        return {
            from: word.from + 2, // Start after {{
            options: options.map( opt => ({ ...opt, label: opt.label.trim() }) )
        };
    };

    const completionExtension = autocompletion({ override: [getCompletions] });

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
                    <PanelBody key={ workflow.id } title={ workflow.name } initialOpen={ false }>
                        <PanelRow>
                            <div>
                                <strong>{ __( 'Endpoint:', 'vip-workflow' ) }</strong> <code>/wp-json/vw-api/v1{ workflow.path }</code>
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
                    style={{ width: '90%', maxWidth: '1000px' }}
                >
                    <div style={{ padding: '20px' }}>
                        <TextControl
                            label={ __( 'Workflow Name', 'vip-workflow' ) }
                            value={ currentWorkflow.name }
                            onChange={ ( val ) => setCurrentWorkflow( { ...currentWorkflow, name: val } ) }
                        />

                        <Heading level={ 3 }>{ __( 'Endpoint Configuration', 'vip-workflow' ) }</Heading>
                        <Flex>
                            <FlexItem isBlock>
                                <TextControl
                                    label={ __( 'Path', 'vip-workflow' ) }
                                    value={ currentWorkflow.path }
                                    onChange={ ( val ) => setCurrentWorkflow( { ...currentWorkflow, path: val } ) }
                                />
                            </FlexItem>
                            <FlexItem>
                                <SelectControl
                                    label={ __( 'Method', 'vip-workflow' ) }
                                    value={ currentWorkflow.method }
                                    options={[
                                        { label: 'POST', value: 'POST' },
                                        { label: 'GET', value: 'GET' },
                                        { label: 'PUT', value: 'PUT' }
                                    ]}
                                    onChange={ ( val ) => setCurrentWorkflow( { ...currentWorkflow, method: val } ) }
                                />
                            </FlexItem>
                        </Flex>
                        <TextControl
                            label={ __( 'API Key (X-VW-API-KEY Header)', 'vip-workflow' ) }
                            value={ currentWorkflow.api_key }
                            onChange={ ( val ) => setCurrentWorkflow( { ...currentWorkflow, api_key: val } ) }
                        />

                        <PanelBody title={ __( 'Rate Limiting', 'vip-workflow' ) } initialOpen={ false }>
                            <ToggleControl
                                label={ __( 'Enable Rate Limiting', 'vip-workflow' ) }
                                checked={ currentWorkflow.rate_limit.enabled }
                                onChange={ ( val ) => setCurrentWorkflow( {
                                    ...currentWorkflow,
                                    rate_limit: { ...currentWorkflow.rate_limit, enabled: val }
                                } ) }
                            />
                            { currentWorkflow.rate_limit.enabled && (
                                <Flex>
                                    <FlexItem>
                                        <TextControl
                                            label={ __( 'Requests', 'vip-workflow' ) }
                                            type="number"
                                            value={ currentWorkflow.rate_limit.limit }
                                            onChange={ ( val ) => setCurrentWorkflow( {
                                                ...currentWorkflow,
                                                rate_limit: { ...currentWorkflow.rate_limit, limit: parseInt(val) }
                                            } ) }
                                        />
                                    </FlexItem>
                                    <FlexItem>
                                        <TextControl
                                            label={ __( 'Window (seconds)', 'vip-workflow' ) }
                                            type="number"
                                            value={ currentWorkflow.rate_limit.window }
                                            onChange={ ( val ) => setCurrentWorkflow( {
                                                ...currentWorkflow,
                                                rate_limit: { ...currentWorkflow.rate_limit, window: parseInt(val) }
                                            } ) }
                                        />
                                    </FlexItem>
                                </Flex>
                            )}
                        </PanelBody>

                        <Heading level={ 3 } style={{ marginTop: '20px' }}>{ __( 'Workflow Steps', 'vip-workflow' ) }</Heading>
                        <p className="description">
                            { __( 'Available tags:', 'vip-workflow' ) } <code>{'{{request.body.key}}'}</code>, <code>{'{{steps.step_name.result_key}}'}</code>
                        </p>

                        { currentWorkflow.steps.map( ( step, index ) => (
                            <PanelBody key={ step.id } title={`${index + 1}. ${step.type.toUpperCase()} - ${step.name || '(unnamed)'}`} initialOpen={ true }>
                                <Flex justify="space-between" align="center" style={{ marginBottom: '15px' }}>
                                    <ToggleControl
                                        label={ __( 'Execute Asynchronously (Action Scheduler)', 'vip-workflow' ) }
                                        checked={ step.async }
                                        onChange={ ( val ) => updateStep( index, { async: val } ) }
                                    />
                                    <Button isDestructive onClick={ () => {
                                        const steps = [ ...currentWorkflow.steps ];
                                        steps.splice( index, 1 );
                                        setCurrentWorkflow({ ...currentWorkflow, steps });
                                    }}>
                                        { __( 'Remove Step', 'vip-workflow' ) }
                                    </Button>
                                </Flex>

                                <TextControl
                                    label={ __( 'Step Name (for referencing in templates)', 'vip-workflow' ) }
                                    value={ step.name }
                                    onChange={ ( val ) => updateStep( index, { name: val } ) }
                                />

                                { step.type === 'webhook' && (
                                    <>
                                        <TextControl
                                            label={ __( 'Webhook URL', 'vip-workflow' ) }
                                            value={ step.url }
                                            onChange={ ( val ) => updateStep( index, { url: val } ) }
                                        />
                                        <Heading level={ 4 }>{ __( 'Headers (JSON)', 'vip-workflow' ) }</Heading>
                                        <CodeMirror
                                            value={ step.headers }
                                            height="100px"
                                            extensions={[json(), completionExtension]}
                                            onChange={ ( val ) => updateStep( index, { headers: val } ) }
                                        />
                                        <Heading level={ 4 }>{ __( 'Body (JSON)', 'vip-workflow' ) }</Heading>
                                        <CodeMirror
                                            value={ step.body }
                                            height="200px"
                                            extensions={[json(), completionExtension]}
                                            onChange={ ( val ) => updateStep( index, { body: val } ) }
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
                                            onChange={ ( val ) => updateStep( index, { post_type: val } ) }
                                        />
                                        <TextControl
                                            label={ __( 'Title Template', 'vip-workflow' ) }
                                            value={ step.post_title }
                                            onChange={ ( val ) => updateStep( index, { post_title: val } ) }
                                        />
                                        <Heading level={ 4 }>{ __( 'Content Template', 'vip-workflow' ) }</Heading>
                                        <CodeMirror
                                            value={ step.post_content }
                                            height="200px"
                                            extensions={[completionExtension]}
                                            onChange={ ( val ) => updateStep( index, { post_content: val } ) }
                                        />
                                        <Heading level={ 4 }>{ __( 'Meta Data (JSON)', 'vip-workflow' ) }</Heading>
                                        <CodeMirror
                                            value={ step.meta }
                                            height="150px"
                                            extensions={[json(), completionExtension]}
                                            onChange={ ( val ) => updateStep( index, { meta: val } ) }
                                        />
                                    </>
                                )}

                                { step.type === 'php_action' && (
                                    <>
                                        <Heading level={ 4 }>{ __( 'PHP Code', 'vip-workflow' ) }</Heading>
                                        <CodeMirror
                                            value={ step.code }
                                            height="300px"
                                            extensions={[php(), completionExtension]}
                                            onChange={ ( val ) => updateStep( index, { code: val } ) }
                                        />
                                    </>
                                )}

                                { step.type === 'email' && (
                                    <>
                                        <TextControl
                                            label={ __( 'To', 'vip-workflow' ) }
                                            value={ step.to }
                                            onChange={ ( val ) => updateStep( index, { to: val } ) }
                                        />
                                        <TextControl
                                            label={ __( 'Subject', 'vip-workflow' ) }
                                            value={ step.subject }
                                            onChange={ ( val ) => updateStep( index, { subject: val } ) }
                                        />
                                        <Heading level={ 4 }>{ __( 'Message', 'vip-workflow' ) }</Heading>
                                        <CodeMirror
                                            value={ step.message }
                                            height="200px"
                                            extensions={[completionExtension]}
                                            onChange={ ( val ) => updateStep( index, { message: val } ) }
                                        />
                                    </>
                                )}
                            </PanelBody>
                        ))}

                        <Flex justify="center" style={{ marginTop: '20px' }}>
                            <Button variant="secondary" onClick={ () => addStep('webhook') }>{ __( 'Add Webhook', 'vip-workflow' ) }</Button>
                            <Button variant="secondary" onClick={ () => addStep('ingest') }>{ __( 'Add CPT Ingest', 'vip-workflow' ) }</Button>
                            <Button variant="secondary" onClick={ () => addStep('php_action') }>{ __( 'Add PHP Action', 'vip-workflow' ) }</Button>
                            <Button variant="secondary" onClick={ () => addStep('email') }>{ __( 'Add Email', 'vip-workflow' ) }</Button>
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
