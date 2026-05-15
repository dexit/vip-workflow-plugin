import './api-workflow-manager.css';
import React, { useState, useEffect, useCallback } from 'react';
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

  return (
    <div ref={setNodeRef} style={style} className="step-block">
      <div className="step-header">
        <div className="step-drag-handle" {...attributes} {...listeners}>
          <span className="dashicons dashicons-menu"></span>
        </div>
        <strong>{step.type} ({step.id})</strong>
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
              height="200px"
              extensions={[php(), autocompletion({ override: [myCompletions] })]}
              onChange={(value) => onUpdateStep(step.id, { config: { ...step.config, php_code: value } })}
            />
          )}
          {step.type === 'webhook' && (
             <div>
                <input
                    className="widefat"
                    placeholder="URL (supports templates)"
                    value={step.config.url || ''}
                    onChange={e => onUpdateStep(step.id, { config: { ...step.config, url: e.target.value } })}
                />
             </div>
          )}
          {step.type === 'ingest' && (
             <div>
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
      route: 'new-route',
      method: 'POST',
      rate_limit: 100,
      rate_window: 3600,
      steps: []
    }];
    setWorkflows(newWorkflows);
    saveConfig(newWorkflows);
  };

  const deleteWorkflow = (id) => {
      const updated = workflows.filter(w => w.id !== id);
      setWorkflows(updated);
      saveConfig(updated);
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
        if (type === 'php_action') {
            newStep.config = { php_code: '<?php\n// Available: $request, $context\nreturn ["status" => "processed"];' };
        } else if (type === 'webhook') {
            newStep.config = { url: 'https://example.com/endpoint', method: 'POST', payload: {} };
        } else if (type === 'ingest') {
            newStep.config = { post_type: 'post', title: '{{request.body.title}}', meta: {} };
        }
        return { ...w, steps: [...w.steps, newStep] };
      }
      return w;
    });
    setWorkflows(newWorkflows);
    saveConfig(newWorkflows);
  };

  const updateStep = (workflowId, stepId, updates) => {
      const updated = workflows.map(w => {
          if (w.id === workflowId) {
              return { ...w, steps: w.steps.map(s => s.id === stepId ? { ...s, ...updates } : s) };
          }
          return w;
      });
      setWorkflows(updated);
      // Debounce save or save on blur/explicit save
  };

  const deleteStep = (workflowId, stepId) => {
      const updated = workflows.map(w => {
          if (w.id === workflowId) {
              return { ...w, steps: w.steps.filter(s => s.id !== stepId) };
          }
          return w;
      });
      setWorkflows(updated);
      saveConfig(updated);
  };

  const loadDemo = () => {
      const demo = {
          id: 'demo_ingestion',
          route: 'demo-ingest',
          method: 'POST',
          rate_limit: 10,
          rate_window: 60,
          steps: [
              {
                  id: 'validate',
                  type: 'php_action',
                  order: 0,
                  async: false,
                  config: { php_code: '<?php\nif (empty($request["body"]["title"])) {\n  return new WP_Error("invalid", "Title is required");\n}\nreturn true;' }
              },
              {
                  id: 'save_post',
                  type: 'ingest',
                  order: 1,
                  async: false,
                  config: { post_type: 'post', title: 'Demo: {{request.body.title}}', meta: { 'external_id': '{{request.body.id}}' } }
              },
              {
                  id: 'notify',
                  type: 'webhook',
                  order: 2,
                  async: true,
                  config: { url: 'https://hooks.example.com/demo', method: 'POST', payload: { 'post_id': '{{steps.save_post.result.post_id}}' } }
              }
          ]
      };
      const updated = [...workflows, demo];
      setWorkflows(updated);
      saveConfig(updated);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="vw-api-manager">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>API Ingestion Workflows</h1>
          <div>
              <button onClick={loadDemo} className="button" style={{ marginRight: '10px' }}>Load Demo Workflow</button>
              <button onClick={addWorkflow} className="button button-primary">Add New Workflow</button>
          </div>
      </div>

      {workflows.map(workflow => (
        <div key={workflow.id} className="workflow-card">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h2>Route: /vw-ingest/v1/{workflow.route}</h2>
              <button onClick={() => deleteWorkflow(workflow.id)} className="button button-link-delete">Delete Workflow</button>
          </div>

          <div className="workflow-settings" style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
            <input
              value={workflow.route}
              onChange={(e) => {
                const updated = workflows.map(w => w.id === workflow.id ? { ...w, route: e.target.value } : w);
                setWorkflows(updated);
              }}
              placeholder="Route Name"
            />
            <select
                value={workflow.method}
                onChange={e => {
                    const updated = workflows.map(w => w.id === workflow.id ? { ...w, method: e.target.value } : w);
                    setWorkflows(updated);
                }}
            >
                <option value="POST">POST</option>
                <option value="GET">GET</option>
                <option value="PUT">PUT</option>
            </select>
          </div>

          <h3>Steps</h3>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => handleDragEnd(workflow.id, event)}
          >
            <SortableContext
              items={workflow.steps.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {workflow.steps.map(step => (
                <SortableStep
                    key={step.id}
                    step={step}
                    workflow={workflow}
                    onUpdateStep={(sid, updates) => updateStep(workflow.id, sid, updates)}
                    onDeleteStep={(sid) => deleteStep(workflow.id, sid)}
                />
              ))}
            </SortableContext>
          </DndContext>

          <div style={{ marginTop: '15px' }}>
            <button onClick={() => addStep(workflow.id, 'php_action')} className="button">Add PHP Action</button>
            <button onClick={() => addStep(workflow.id, 'webhook')} className="button">Add Webhook</button>
            <button onClick={() => addStep(workflow.id, 'ingest')} className="button">Add Ingest to CPT</button>
            <button onClick={() => saveConfig(workflows)} className="button button-primary" style={{ float: 'right' }}>Save Configuration</button>
          </div>
          <div style={{ clear: 'both' }}></div>
        </div>
      ))}
    </div>
  );
};

export default APIWorkflowManager;
