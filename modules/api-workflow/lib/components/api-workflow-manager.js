import './api-workflow-manager.css';
import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { php } from '@codemirror/lang-php';
import { autocompletion } from '@codemirror/autocomplete';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';

const TAG_SUGGESTIONS = [
  { label: '{{request.body}}', type: 'variable' },
  { label: '{{request.params}}', type: 'variable' },
  { label: '{{request.headers}}', type: 'variable' },
  { label: '{{steps.STEP_ID.result}}', type: 'variable' },
  { label: '{{vars.STEP_ID.key}}', type: 'variable' },
];

function myCompletions(context) {
  let word = context.matchBefore(/\{\{/);
  if (!word) return null;
  return {
    from: word.from,
    options: TAG_SUGGESTIONS
  };
}

const SortableStep = ({ step, workflow, onUpdateStep, onDeleteStep }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({id: step.id});

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const updateMapping = (key, value) => {
      const mapping = { ...(step.config.mapping || {}) };
      if (value === null) delete mapping[key];
      else mapping[key] = value;
      onUpdateStep(step.id, { config: { ...step.config, mapping } });
  };

  return (
    <div ref={setNodeRef} style={style} className="step-block">
      <div className="step-header">
        <div className="step-drag-handle" {...attributes} {...listeners}>
          <span className="dashicons dashicons-menu"></span>
        </div>
        <strong>{step.type.toUpperCase()} ({step.id})</strong>
        <div className="step-actions">
           <label>
            <input
              type="checkbox"
              checked={step.async}
              onChange={(e) => onUpdateStep(step.id, { async: e.target.checked })}
            /> Async
          </label>
          <button onClick={() => onDeleteStep(step.id)} className="button button-link-delete">Delete</button>
        </div>
      </div>

      <div className="step-content" style={{ padding: '15px' }}>
          {step.type === 'php_action' && (
            <CodeMirror
              value={step.config.php_code}
              height="150px"
              extensions={[php(), autocompletion({ override: [myCompletions] })]}
              onChange={(value) => onUpdateStep(step.id, { config: { ...step.config, php_code: value } })}
            />
          )}

          {step.type === 'dto_mapping' && (
             <div className="mapping-editor">
                <h4>DTO Mapping</h4>
                {Object.entries(step.config.mapping || {}).map(([key, val]) => (
                    <div key={key} style={{ display: 'flex', gap: '10px', marginBottom: '5px' }}>
                        <input value={key} readOnly style={{ width: '30%' }} />
                        <input
                            value={val}
                            onChange={e => updateMapping(key, e.target.value)}
                            style={{ flex: 1 }}
                            placeholder="Template tag or value"
                        />
                        <button onClick={() => updateMapping(key, null)} className="button">×</button>
                    </div>
                ))}
                <button
                    onClick={() => {
                        const key = prompt('Target Key Name:');
                        if (key) updateMapping(key, '');
                    }}
                    className="button"
                >
                    + Add Field
                </button>
             </div>
          )}

          {step.type === 'logic' && (
              <div className="logic-editor">
                  <label>Condition (Template tag evaluation):</label>
                  <input
                    className="widefat"
                    value={step.config.condition || ''}
                    onChange={e => onUpdateStep(step.id, { config: { ...step.config, condition: e.target.value } })}
                    placeholder="{{steps.id.result.status}} === 'active'"
                  />
                  <label>On False:</label>
                  <select
                    value={step.config.on_false || 'continue'}
                    onChange={e => onUpdateStep(step.id, { config: { ...step.config, on_false: e.target.value } })}
                  >
                      <option value="continue">Continue (skip logic result only)</option>
                      <option value="stop">Stop Workflow Execution</option>
                  </select>
              </div>
          )}

          {step.type === 'webhook' && (
             <div>
                <input
                    className="widefat"
                    placeholder="URL (supports templates)"
                    value={step.config.url || ''}
                    onChange={e => onUpdateStep(step.id, { config: { ...step.config, url: e.target.value } })}
                />
                <select
                    value={step.config.method || 'POST'}
                    onChange={e => onUpdateStep(step.id, { config: { ...step.config, method: e.target.value } })}
                >
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                    <option value="PUT">PUT</option>
                </select>
             </div>
          )}

          {step.type === 'ingest' && (
             <div>
                <select
                    value={step.config.post_type || 'post'}
                    onChange={e => onUpdateStep(step.id, { config: { ...step.config, post_type: e.target.value } })}
                >
                    <option value="post">Post</option>
                    <option value="page">Page</option>
                </select>
                <input
                    className="widefat"
                    placeholder="Post Title (supports templates)"
                    value={step.config.title || ''}
                    onChange={e => onUpdateStep(step.id, { config: { ...step.config, title: e.target.value } })}
                />
             </div>
          )}
      </div>
    </div>
  );
};

const APIWorkflowManager = () => {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetch('/wp-json/vip-workflow/v1/api-workflow/config')
      .then(res => res.json())
      .then(data => {
        setWorkflows(data.workflows || []);
        setLoading(false);
      });
  }, []);

  const saveConfig = async (newWorkflows) => {
    await fetch('/wp-json/vip-workflow/v1/api-workflow/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflows: newWorkflows })
    });
  };

  const handleDragEnd = (workflowId, event) => {
    const {active, over} = event;
    if (active.id !== over.id) {
      setWorkflows((items) => {
        const workflow = items.find(w => w.id === workflowId);
        const oldIndex = workflow.steps.findIndex(s => s.id === active.id);
        const newIndex = workflow.steps.findIndex(s => s.id === over.id);
        const newSteps = arrayMove(workflow.steps, oldIndex, newIndex).map((s, index) => ({...s, order: index}));
        const updated = items.map(w => w.id === workflowId ? { ...w, steps: newSteps } : w);
        saveConfig(updated);
        return updated;
      });
    }
  };

  const addWorkflow = () => {
    const newWorkflows = [...workflows, {
      id: Math.random().toString(36).substr(2, 9),
      entries: [{ type: 'rest', route: 'new-route', method: 'POST' }],
      steps: []
    }];
    setWorkflows(newWorkflows);
  };

  const addEntry = (workflowId) => {
      const updated = workflows.map(w => {
          if (w.id === workflowId) {
              return { ...w, entries: [...(w.entries || []), { type: 'rest', route: 'route-' + Date.now(), method: 'POST' }] };
          }
          return w;
      });
      setWorkflows(updated);
  };

  const addStep = (workflowId, type) => {
    const newWorkflows = workflows.map(w => {
      if (w.id === workflowId) {
        const newStep = {
            id: 'step_' + Math.random().toString(36).substr(2, 5),
            type,
            order: w.steps.length,
            async: false,
            config: {}
        };
        if (type === 'php_action') newStep.config = { php_code: '<?php\nreturn ["status" => "ok"];' };
        if (type === 'dto_mapping') newStep.config = { mapping: { 'id': '{{request.body.id}}' } };
        if (type === 'logic') newStep.config = { condition: '{{request.body.id}}', on_false: 'stop' };
        return { ...w, steps: [...w.steps, newStep] };
      }
      return w;
    });
    setWorkflows(newWorkflows);
  };

  const updateStep = (workflowId, stepId, updates) => {
      setWorkflows(prev => prev.map(w => {
          if (w.id === workflowId) {
              return { ...w, steps: w.steps.map(s => s.id === stepId ? { ...s, ...updates } : s) };
          }
          return w;
      }));
  };

  const loadDemo = () => {
      const demo = {
          id: 'demo_advanced',
          entries: [
              { type: 'rest', route: 'advanced-ingest', method: 'POST' },
              { type: 'hook', action: 'vw_custom_trigger' }
          ],
          steps: [
              { id: 'dto', type: 'dto_mapping', order: 0, config: { mapping: { 'title': '{{request.body.title}}', 'source': 'API' } } },
              { id: 'check', type: 'logic', order: 1, config: { condition: '{{vars.dto.title}}', on_false: 'stop' } },
              { id: 'save', type: 'ingest', order: 2, config: { post_type: 'post', title: '{{vars.dto.title}}' } }
          ]
      };
      setWorkflows([...workflows, demo]);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="vw-api-manager">
      <div className="manager-header">
          <h1>Workflow Builder</h1>
          <div>
              <button onClick={loadDemo} className="button">Load Advanced Demo</button>
              <button onClick={addWorkflow} className="button button-primary">Create Workflow</button>
          </div>
      </div>

      {workflows.map(workflow => (
        <div key={workflow.id} className="workflow-card">
          <div className="workflow-header">
              <h3>Workflow: {workflow.id}</h3>
              <button onClick={() => setWorkflows(workflows.filter(w => w.id !== workflow.id))} className="button button-link-delete">Delete Workflow</button>
          </div>

          <div className="entries-section">
              <h4>Entry Points</h4>
              {workflow.entries.map((entry, idx) => (
                  <div key={idx} className="entry-row">
                      <select
                        value={entry.type}
                        onChange={e => {
                            const updated = workflows.map(w => w.id === workflow.id ? { ...w, entries: w.entries.map((en, i) => i === idx ? { ...en, type: e.target.value } : en) } : w);
                            setWorkflows(updated);
                        }}
                      >
                          <option value="rest">REST API Route</option>
                          <option value="hook">WP Action Hook</option>
                      </select>
                      {entry.type === 'rest' ? (
                          <>
                            <input value={entry.route} onChange={e => {
                                const updated = workflows.map(w => w.id === workflow.id ? { ...w, entries: w.entries.map((en, i) => i === idx ? { ...en, route: e.target.value } : en) } : w);
                                setWorkflows(updated);
                            }} />
                            <select value={entry.method} onChange={e => {
                                const updated = workflows.map(w => w.id === workflow.id ? { ...w, entries: w.entries.map((en, i) => i === idx ? { ...en, method: e.target.value } : en) } : w);
                                setWorkflows(updated);
                            }}>
                                <option value="POST">POST</option>
                                <option value="GET">GET</option>
                            </select>
                          </>
                      ) : (
                        <input placeholder="Action Name (e.g. init)" value={entry.action} onChange={e => {
                            const updated = workflows.map(w => w.id === workflow.id ? { ...w, entries: w.entries.map((en, i) => i === idx ? { ...en, action: e.target.value } : en) } : w);
                            setWorkflows(updated);
                        }} />
                      )}
                  </div>
              ))}
              <button onClick={() => addEntry(workflow.id)} className="button">+ Add Entry Point</button>
          </div>

          <div className="steps-section">
              <h4>Steps</h4>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(workflow.id, e)}>
                <SortableContext items={workflow.steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  {workflow.steps.map(step => (
                    <SortableStep
                        key={step.id}
                        step={step}
                        workflow={workflow}
                        onUpdateStep={(sid, u) => updateStep(workflow.id, sid, u)}
                        onDeleteStep={(sid) => setWorkflows(workflows.map(w => w.id === workflow.id ? { ...w, steps: w.steps.filter(s => s.id !== sid) } : w))}
                    />
                  ))}
                </SortableContext>
              </DndContext>
          </div>

          <div className="workflow-footer">
            <button onClick={() => addStep(workflow.id, 'dto_mapping')} className="button">Add DTO Mapping</button>
            <button onClick={() => addStep(workflow.id, 'logic')} className="button">Add Logic</button>
            <button onClick={() => addStep(workflow.id, 'php_action')} className="button">Add PHP</button>
            <button onClick={() => addStep(workflow.id, 'webhook')} className="button">Add Webhook</button>
            <button onClick={() => addStep(workflow.id, 'ingest')} className="button">Add Ingest</button>
            <button onClick={() => saveConfig(workflows)} className="button button-primary" style={{ float: 'right' }}>Save Workflow</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default APIWorkflowManager;
