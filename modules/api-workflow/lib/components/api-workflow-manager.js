import './api-workflow-manager.css';
import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { php } from '@codemirror/lang-php';
import { autocompletion } from '@codemirror/autocomplete';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';

const TAG_SUGGESTIONS = [
  { label: '{{request.body}}', type: 'variable' },
  { label: '{{request.params}}', type: 'variable' },
  { label: '{{steps.STEP_ID.result}}', type: 'variable' },
  { label: '{{vars.STEP_ID.key}}', type: 'variable' },
];

function myCompletions(context) {
  let word = context.matchBefore(/\{\{/);
  if (!word) return null;
  return { from: word.from, options: TAG_SUGGESTIONS };
}

const SortableStep = ({ step, onUpdateStep, onDeleteStep }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({id: step.id});
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="step-block">
      <div className="step-header">
        <div className="step-drag-handle" {...attributes} {...listeners}><span className="dashicons dashicons-menu"></span></div>
        <strong>{step.type.toUpperCase()} ({step.id})</strong>
        <div className="step-actions">
          <label><input type="checkbox" checked={step.async} onChange={(e) => onUpdateStep(step.id, { async: e.target.checked })} /> Async</label>
          <button onClick={() => onDeleteStep(step.id)} className="button button-link-delete">Delete</button>
        </div>
      </div>
      <div className="step-content" style={{ padding: '15px' }}>
          {step.type === 'transform' && (
              <div className="transform-editor">
                  <label>Input Value:</label>
                  <input className="widefat" value={step.config.input || ''} onChange={e => onUpdateStep(step.id, { config: { ...step.config, input: e.target.value } })} placeholder="{{request.body.name}}" />
                  <label>Operation:</label>
                  <select value={step.config.operation || 'none'} onChange={e => onUpdateStep(step.id, { config: { ...step.config, operation: e.target.value } })}>
                      <option value="none">None</option>
                      <option value="lowercase">Lowercase</option>
                      <option value="uppercase">Uppercase</option>
                      <option value="json_decode">JSON Decode</option>
                      <option value="date_format">Date Format</option>
                  </select>
                  {step.config.operation === 'date_format' && (
                      <input className="widefat" value={step.config.format || 'Y-m-d'} onChange={e => onUpdateStep(step.id, { config: { ...step.config, format: e.target.value } })} placeholder="Y-m-d H:i:s" />
                  )}
              </div>
          )}
          {step.type === 'php_action' && (
            <CodeMirror value={step.config.php_code} height="120px" extensions={[php(), autocompletion({ override: [myCompletions] })]} onChange={(value) => onUpdateStep(step.id, { config: { ...step.config, php_code: value } })} />
          )}
          {step.type === 'dto_mapping' && (
             <div className="mapping-editor">
                {Object.entries(step.config.mapping || {}).map(([key, val]) => (
                    <div key={key} style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                        <input value={key} readOnly style={{ width: '30%' }} />
                        <input value={val} onChange={e => {
                            const mapping = { ...step.config.mapping, [key]: e.target.value };
                            onUpdateStep(step.id, { config: { ...step.config, mapping } });
                        }} style={{ flex: 1 }} />
                        <button onClick={() => {
                            const mapping = { ...step.config.mapping }; delete mapping[key];
                            onUpdateStep(step.id, { config: { ...step.config, mapping } });
                        }} className="button">×</button>
                    </div>
                ))}
                <button onClick={() => {
                    const key = prompt('Field name:');
                    if (key) {
                        const mapping = { ...(step.config.mapping || {}), [key]: '' };
                        onUpdateStep(step.id, { config: { ...step.config, mapping } });
                    }
                }} className="button">+ Add Field</button>
             </div>
          )}
          {step.type === 'logic' && (
              <div className="logic-editor">
                  <input className="widefat" value={step.config.condition || ''} onChange={e => onUpdateStep(step.id, { config: { ...step.config, condition: e.target.value } })} placeholder="Condition (e.g. {{request.body.id}})" />
                  <select value={step.config.on_false || 'continue'} onChange={e => onUpdateStep(step.id, { config: { ...step.config, on_false: e.target.value } })}>
                      <option value="continue">Skip Result</option>
                      <option value="stop">Stop Workflow</option>
                  </select>
              </div>
          )}
          {step.type === 'webhook' && (
             <div>
                <input className="widefat" value={step.config.url || ''} onChange={e => onUpdateStep(step.id, { config: { ...step.config, url: e.target.value } })} placeholder="URL" />
                <select value={step.config.method || 'POST'} onChange={e => onUpdateStep(step.id, { config: { ...step.config, method: e.target.value } })}>
                    <option value="POST">POST</option><option value="GET">GET</option><option value="PUT">PUT</option>
                </select>
                <label style={{ display: 'block', marginTop: '5px' }}><input type="checkbox" checked={step.config.retry || false} onChange={e => onUpdateStep(step.id, { config: { ...step.config, retry: e.target.checked } })} /> Retry on Failure</label>
             </div>
          )}
          {step.type === 'ingest' && (
             <div>
                <input className="widefat" value={step.config.title || ''} onChange={e => onUpdateStep(step.id, { config: { ...step.config, title: e.target.value } })} placeholder="Post Title" />
             </div>
          )}
      </div>
    </div>
  );
};

const APIWorkflowManager = () => {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('builder');

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    fetch('/wp-json/vip-workflow/v1/api-workflow/config').then(res => res.json()).then(data => { setWorkflows(data.workflows || []); setLoading(false); });
  }, []);

  const saveConfig = async (newWorkflows) => {
    await fetch('/wp-json/vip-workflow/v1/api-workflow/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workflows: newWorkflows }) });
  };

  const handleDragEnd = (workflowId, event) => {
    const {active, over} = event;
    if (active.id !== over.id) {
      setWorkflows((items) => {
        const workflow = items.find(w => w.id === workflowId);
        const oldIndex = workflow.steps.findIndex(s => s.id === active.id);
        const newIndex = workflow.steps.findIndex(s => s.id === over.id);
        const newSteps = arrayMove(workflow.steps, oldIndex, newIndex).map((s, idx) => ({...s, order: idx}));
        const updated = items.map(w => w.id === workflowId ? { ...w, steps: newSteps } : w);
        saveConfig(updated);
        return updated;
      });
    }
  };

  const addWorkflow = () => {
    const newWorkflows = [...workflows, { id: 'wf_' + Math.random().toString(36).substr(2, 5), entries: [{ type: 'rest', route: 'new-route', method: 'POST' }], steps: [] }];
    setWorkflows(newWorkflows);
  };

  const addStep = (workflowId, type) => {
    const updated = workflows.map(w => {
      if (w.id === workflowId) {
        const newStep = { id: 'step_' + Math.random().toString(36).substr(2, 5), type, order: w.steps.length, async: false, config: {} };
        if (type === 'transform') newStep.config = { input: '{{request.body.name}}', operation: 'lowercase' };
        if (type === 'php_action') newStep.config = { php_code: '<?php\nreturn ["status" => "ok"];' };
        if (type === 'dto_mapping') newStep.config = { mapping: { 'title': '{{request.body.title}}' } };
        return { ...w, steps: [...w.steps, newStep] };
      }
      return w;
    });
    setWorkflows(updated);
  };

  const loadProductionDemo = () => {
      const demo = {
          id: 'prod_ingest_pipeline',
          entries: [{ type: 'rest', route: 'v1/external-data', method: 'POST' }],
          steps: [
              { id: 'clean_title', type: 'transform', order: 0, config: { input: '{{request.body.raw_title}}', operation: 'uppercase' } },
              { id: 'digest', type: 'dto_mapping', order: 1, config: { mapping: { 'clean_title': '{{steps.clean_title.result}}', 'source': 'Production API', 'received': '{{request.headers.date}}' } } },
              { id: 'is_valid', type: 'logic', order: 2, config: { condition: '{{vars.digest.clean_title}}', on_false: 'stop' } },
              { id: 'store', type: 'ingest', order: 3, config: { post_type: 'post', title: '{{vars.digest.clean_title}}', meta: { 'raw_data': '{{request.body}}' } } },
              { id: 'dispatch', type: 'webhook', order: 4, async: true, config: { url: 'https://webhook.site/demo', method: 'POST', retry: true, payload: { 'id': '{{steps.store.result.post_id}}', 'status': 'stored' } } }
          ]
      };
      setWorkflows([...workflows, demo]);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="vw-api-manager">
      <div className="manager-header">
          <h1>Vosia Workflow Engine</h1>
          <div className="nav-tabs" style={{ marginBottom: '10px' }}>
              <button onClick={() => setView('builder')} className={`button ${view === 'builder' ? 'button-primary' : ''}`}>Builder</button>
              <button onClick={() => setView('logs')} className={`button ${view === 'logs' ? 'button-primary' : ''}`} style={{ marginLeft: '5px' }}>Logs</button>
          </div>
      </div>

      {view === 'builder' ? (
          <div className="builder-view">
              <div style={{ marginBottom: '20px' }}>
                  <button onClick={addWorkflow} className="button button-primary">Create New Workflow</button>
                  <button onClick={loadProductionDemo} className="button" style={{ marginLeft: '10px' }}>Load Production Pipeline Demo</button>
              </div>
              {workflows.map(workflow => (
                <div key={workflow.id} className="workflow-card">
                  <div className="workflow-header">
                      <h3>Workflow: {workflow.id}</h3>
                      <button onClick={() => setWorkflows(workflows.filter(w => w.id !== workflow.id))} className="button button-link-delete">Delete</button>
                  </div>

                  <div className="entries-section">
                      {workflow.entries.map((entry, idx) => (
                          <div key={idx} className="entry-row">
                              <select value={entry.type} onChange={e => {
                                  const entries = [...workflow.entries]; entries[idx].type = e.target.value;
                                  setWorkflows(workflows.map(w => w.id === workflow.id ? { ...w, entries } : w));
                              }}>
                                  <option value="rest">REST API</option><option value="hook">WP Hook</option>
                              </select>
                              <input value={entry.type === 'rest' ? entry.route : entry.action} onChange={e => {
                                  const entries = [...workflow.entries];
                                  if (entry.type === 'rest') entries[idx].route = e.target.value; else entries[idx].action = e.target.value;
                                  setWorkflows(workflows.map(w => w.id === workflow.id ? { ...w, entries } : w));
                              }} />
                          </div>
                      ))}
                      <button onClick={() => {
                          const entries = [...(workflow.entries || []), { type: 'rest', route: 'new', method: 'POST' }];
                          setWorkflows(workflows.map(w => w.id === workflow.id ? { ...w, entries } : w));
                      }} className="button">+ Add Entry</button>
                  </div>

                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(workflow.id, e)}>
                    <SortableContext items={workflow.steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
                      {workflow.steps.map(step => (
                        <SortableStep key={step.id} step={step} onUpdateStep={(sid, u) => {
                            const steps = workflow.steps.map(s => s.id === sid ? { ...s, ...u } : s);
                            setWorkflows(workflows.map(w => w.id === workflow.id ? { ...w, steps } : w));
                        }} onDeleteStep={(sid) => {
                            const steps = workflow.steps.filter(s => s.id !== sid);
                            setWorkflows(workflows.map(w => w.id === workflow.id ? { ...w, steps } : w));
                        }} />
                      ))}
                    </SortableContext>
                  </DndContext>

                  <div className="workflow-footer">
                    <button onClick={() => addStep(workflow.id, 'transform')} className="button">Add Transform</button>
                    <button onClick={() => addStep(workflow.id, 'dto_mapping')} className="button">Add DTO</button>
                    <button onClick={() => addStep(workflow.id, 'logic')} className="button">Add Logic</button>
                    <button onClick={() => addStep(workflow.id, 'php_action')} className="button">Add PHP</button>
                    <button onClick={() => addStep(workflow.id, 'webhook')} className="button">Add Webhook</button>
                    <button onClick={() => addStep(workflow.id, 'ingest')} className="button">Add Ingest</button>
                    <button onClick={() => saveConfig(workflows)} className="button button-primary" style={{ float: 'right' }}>Save Workflow</button>
                  </div>
                </div>
              ))}
          </div>
      ) : (
          <div className="logs-view">
              <p>Workflow execution logs track every run of your pipelines, including input data, transformation results, and dispatch status. You can view, search, and audit them in the standard WordPress list table.</p>
              <a href="/wp-admin/edit.php?post_type=vw_workflow_log" className="button">Open Logs Table</a>
          </div>
      )}
    </div>
  );
};

export default APIWorkflowManager;
