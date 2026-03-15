/**
 * Session View — Meant-Graph Browser
 * Create sessions, manage steps, view execution results.
 */

import { getAllSessions } from '../models/meant_graph.js';
import { getAllSources } from '../models/given_log.js';
import { OPERATORS, formatOperator } from '../models/operators.js';
import { startSession, addStep, executeStep, getSessionChain } from '../meant/service.js';
import { renderOperatorSelector, renderHelixBar, renderDataTable, renderModal, html, toast } from './components.js';

let _currentSessionId = null;

/**
 * Render the session view.
 */
export function renderSessionView(container) {
  container.innerHTML = '';

  const view = html`
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
          <i class="ph ph-graph" style="color: var(--meant-border); font-size: 1.3rem;"></i>
          Meant-Graph
        </h2>
        <button class="btn btn-primary" id="btn-new-session"><i class="ph ph-plus"></i> New Session</button>
      </div>
    </div>
  `;

  // Session list or active session
  const contentArea = document.createElement('div');

  if (_currentSessionId) {
    _renderActiveSession(contentArea, _currentSessionId);
  } else {
    _renderSessionList(contentArea);
  }

  view.appendChild(contentArea);

  // Bind new session button
  view.querySelector('#btn-new-session').addEventListener('click', () => {
    _showNewSessionModal(contentArea);
  });

  container.appendChild(view);
}

function _renderSessionList(container) {
  container.innerHTML = '';
  const sessions = getAllSessions();

  if (sessions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="ph ph-graph" style="font-size: 3rem;"></i></div>
        <p>No analysis sessions yet.<br>Create a session to begin building the Meant-Graph.</p>
      </div>
    `;
    return;
  }

  for (const session of sessions) {
    const card = html`
      <div class="card" style="cursor: pointer;">
        <div class="card-header">
          <span class="op-glyph significance"><i class="ph ph-graph" style="font-size: 1rem;"></i></span>
          <div style="flex: 1;">
            <div class="card-title">${session.name}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">
              Mode: ${session.mode} · ${new Date(session.created_at).toLocaleString()}
              ${session.description ? ` · ${session.description}` : ''}
            </div>
          </div>
          <span class="meant-badge">${session.mode}</span>
        </div>
      </div>
    `;
    card.addEventListener('click', () => {
      _currentSessionId = session.id;
      _renderActiveSession(container, session.id);
    });
    container.appendChild(card);
  }
}

function _renderActiveSession(container, sessionId) {
  container.innerHTML = '';

  const chain = getSessionChain(sessionId);
  const session = chain.length > 0 ? { id: sessionId } : null;

  // Back button
  const backBtn = html`<button class="btn btn-sm" style="margin-bottom: 16px;"><i class="ph ph-arrow-left"></i> Back to sessions</button>`;
  backBtn.addEventListener('click', () => {
    _currentSessionId = null;
    _renderSessionList(container);
  });
  container.appendChild(backBtn);

  // Helix bar showing which operators have been used
  const usedOps = new Set(chain.map(s => s.operator_type));
  const helixBar = renderHelixBar();
  helixBar.querySelectorAll('.helix-step').forEach(el => {
    const code = el.textContent.trim().split(' ')[1];
    if (usedOps.has(code)) {
      el.classList.add('active');
    }
  });
  container.appendChild(helixBar);

  // Steps
  if (chain.length === 0) {
    container.appendChild(html`
      <div class="empty-state" style="padding: 30px;">
        <p>No steps yet. Add a step to begin analysis.</p>
      </div>
    `);
  } else {
    for (const step of chain) {
      container.appendChild(_renderStepCard(step, container, sessionId));
    }
  }

  // Add step button
  const addBtn = html`<button class="btn btn-primary" style="margin-top: 12px;"><i class="ph ph-plus"></i> Add Step</button>`;
  addBtn.addEventListener('click', () => {
    _showAddStepModal(sessionId, container);
  });
  container.appendChild(addBtn);
}

function _renderStepCard(step, container, sessionId) {
  const op = step.operator;
  const card = html`
    <div class="step-card ${step.status === 'stale' ? 'stale' : ''} ${step.operator_type === 'SUP' ? 'sup-unresolved' : ''}">
      <div class="card-header">
        <span class="op-glyph ${op.triad.toLowerCase()}">${op.glyph}</span>
        <div style="flex: 1;">
          <div class="card-title">
            Step ${step.sequence_number}: ${formatOperator(step.operator_type)} — ${step.description}
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">
            ${op.verb} · Status: <span class="status-${step.status}">${step.status}</span>
            ${step.executionLog ? ` · ${step.executionLog.rowsIn || 0} → ${step.executionLog.rowsOut || 0} rows · ${step.executionLog.runtime_ms || 0}ms` : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  // Click to show detail
  card.addEventListener('click', () => {
    _showStepDetail(step, sessionId, container);
  });

  // Show warnings
  if (step.executionLog?.warnings?.length > 0) {
    const warnings = html`<div style="margin-top: 8px; font-size: 0.8rem; color: var(--stale-border); padding-left: 44px;"></div>`;
    for (const w of step.executionLog.warnings) {
      warnings.appendChild(html`<div>⚠ ${w}</div>`);
    }
    card.appendChild(warnings);
  }

  // Show notation
  if (step.notation) {
    const notation = html`
      <div class="notation" style="margin-top: 8px; margin-left: 44px; font-size: 0.8rem;">
        ${step.notation.text || JSON.stringify(step.notation)}
      </div>
    `;
    card.appendChild(notation);
  }

  return card;
}

function _showNewSessionModal(container) {
  const form = html`
    <div>
      <div class="form-group">
        <label class="form-label">Session Name</label>
        <input class="form-input" id="session-name" placeholder="e.g., Campaign Finance Analysis 2023">
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="session-desc" rows="2" placeholder="What is this analysis investigating?"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Mode</label>
        <select class="form-select" id="session-mode">
          <option value="explore">Explore — helix violations warned, not blocked</option>
          <option value="confirm">Confirm — helix violations block export</option>
        </select>
      </div>
    </div>
  `;

  renderModal(`${OPERATORS.ALT.glyph} New Analysis Session`, form, [
    { label: 'Cancel' },
    {
      label: 'Create Session',
      primary: true,
      onClick: () => {
        const name = document.getElementById('session-name').value.trim();
        if (!name) { toast('Session name required', 'error'); return; }

        const sessionId = startSession({
          name,
          description: document.getElementById('session-desc').value.trim(),
          mode: document.getElementById('session-mode').value
        });

        _currentSessionId = sessionId;
        toast(`Session created: ${name}`, 'success');
        _renderActiveSession(container, sessionId);
      }
    }
  ]);
}

function _showAddStepModal(sessionId, container) {
  let selectedOp = null;

  const form = html`<div></div>`;

  // Operator selector
  const opLabel = html`<div class="form-group"><label class="form-label">Operator Type (Helix Position)</label></div>`;
  const opSelector = renderOperatorSelector((code) => { selectedOp = code; });
  opLabel.appendChild(opSelector);
  form.appendChild(opLabel);

  // Description
  form.appendChild(html`
    <div class="form-group">
      <label class="form-label">Description (required)</label>
      <input class="form-input" id="step-desc" placeholder="What does this step do and why?">
    </div>
  `);

  // Input selector
  const inputGroup = html`<div class="form-group"><label class="form-label">Inputs</label></div>`;
  const inputSelect = document.createElement('select');
  inputSelect.className = 'form-select';
  inputSelect.multiple = true;
  inputSelect.style.minHeight = '80px';
  inputSelect.id = 'step-inputs';

  // Add Given-Log sources
  const sources = getAllSources();
  for (const source of sources) {
    const opt = document.createElement('option');
    opt.value = source.id;
    opt.textContent = `[Given] ${OPERATORS.INS.glyph} ${source.filename} (${source.row_count} rows)`;
    inputSelect.appendChild(opt);
  }

  // Add prior step outputs
  const chain = getSessionChain(sessionId);
  for (const step of chain) {
    if (step.outputs) {
      for (const output of step.outputs) {
        const opt = document.createElement('option');
        opt.value = step.id;
        opt.textContent = `[Step ${step.sequence_number}] ${OPERATORS[step.operator_type].glyph} ${output.name} (${output.row_count || '?'} rows)`;
        inputSelect.appendChild(opt);
      }
    }
  }

  inputGroup.appendChild(inputSelect);
  form.appendChild(inputGroup);

  // Code
  form.appendChild(html`
    <div class="form-group">
      <label class="form-label">Code (Python or JavaScript)</label>
      <textarea class="code-editor" id="step-code" placeholder="# Access inputs as DataFrames by filename (e.g., campaign_finance)
# Set result = your_dataframe to capture output

result = campaign_finance[campaign_finance['district'] == 'District 1']"></textarea>
    </div>
  `);

  renderModal(`Add Step to Meant-Graph`, form, [
    { label: 'Cancel' },
    {
      label: 'Add & Execute',
      primary: true,
      onClick: async () => {
        if (!selectedOp) { toast('Select an operator type', 'error'); return; }
        const desc = document.getElementById('step-desc').value.trim();
        if (!desc) { toast('Description is required', 'error'); return; }

        const selectedInputs = Array.from(document.getElementById('step-inputs').selectedOptions).map(o => o.value);
        const code = document.getElementById('step-code').value;

        try {
          const { stepId, helixValidation } = addStep({
            sessionId,
            operatorType: selectedOp,
            description: desc,
            inputIds: selectedInputs,
            code
          });

          // Show helix warnings
          if (helixValidation.warnings.length > 0) {
            for (const w of helixValidation.warnings) {
              toast(`⚠ ${w}`, 'info');
            }
          }

          // Execute
          toast(`Executing ${formatOperator(selectedOp)}...`, 'info');
          const result = await executeStep(stepId);

          if (result.success) {
            toast(`${formatOperator(selectedOp)} completed: ${result.executionLog.rowsOut} rows`, 'success');
          } else {
            toast(`${formatOperator(selectedOp)} failed: ${result.error}`, 'error');
          }

          _renderActiveSession(container, sessionId);
        } catch (err) {
          toast(`Error: ${err.message}`, 'error');
        }
      }
    }
  ]);
}

function _showStepDetail(step, sessionId, container) {
  const content = html`<div></div>`;

  // Metadata
  const op = OPERATORS[step.operator_type];
  content.appendChild(html`
    <div style="margin-bottom: 16px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem;">
        <div><strong>Operator:</strong> ${formatOperator(step.operator_type)} (${op.verb})</div>
        <div><strong>Status:</strong> <span class="status-${step.status}">${step.status}</span></div>
        <div><strong>Triad:</strong> ${op.triad}</div>
        <div><strong>Role:</strong> ${op.role}</div>
      </div>
    </div>
  `);

  // Code
  if (step.code) {
    content.appendChild(html`
      <div class="form-group">
        <label class="form-label">Code</label>
        <pre class="notation">${step.code}</pre>
      </div>
    `);
  }

  // Notation
  if (step.notation) {
    const notationText = typeof step.notation === 'string' ? step.notation : (step.notation.text || JSON.stringify(step.notation, null, 2));
    content.appendChild(html`
      <div class="form-group">
        <label class="form-label">${op.glyph} EO Notation (auto-generated)</label>
        <pre class="notation">${notationText}</pre>
      </div>
    `);
  }

  // Execution log
  if (step.executionLog) {
    content.appendChild(html`
      <div class="form-group">
        <label class="form-label">Execution Log</label>
        <pre class="notation">${JSON.stringify(step.executionLog, null, 2)}</pre>
      </div>
    `);
  }

  // Output preview
  if (step.outputs && step.outputs.length > 0) {
    for (const output of step.outputs) {
      const outputDiv = html`<div class="form-group"><label class="form-label">Output: ${output.name} (${output.row_count || '?'} rows)</label></div>`;
      try {
        const data = output.data_json ? JSON.parse(output.data_json) : [];
        if (data.length > 0) {
          const columns = Object.keys(data[0]);
          const table = renderDataTable(data.slice(0, 20), columns);
          outputDiv.appendChild(table);
          if (data.length > 20) {
            outputDiv.appendChild(html`<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">Showing 20 of ${data.length} rows</div>`);
          }
        }
      } catch (e) {
        outputDiv.appendChild(html`<div style="color: var(--text-muted);">Could not parse output data</div>`);
      }
      content.appendChild(outputDiv);
    }
  }

  renderModal(`Step ${step.sequence_number}: ${formatOperator(step.operator_type)}`, content, [
    { label: 'Close' }
  ]);
}

export function setCurrentSession(sessionId) {
  _currentSessionId = sessionId;
}
