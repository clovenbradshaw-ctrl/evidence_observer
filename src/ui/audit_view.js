/**
 * Audit View — Provenance Surface
 * Dual-view toggle between technical and public views.
 * Click-to-drill-down from any output value to Given-Log source rows.
 */

import { getAllSessions, getSessionSteps, getStepOutputs } from '../models/meant_graph.js';
import { OPERATORS, formatOperator } from '../models/operators.js';
import { renderTechnicalView, renderPublicView } from '../provenance/views.js';
import { traceProvenance, drillDown, checkMeantConformance } from '../provenance/service.js';
import { renderDataTable, renderModal, html, toast } from './components.js';

let _viewMode = 'technical'; // technical | public

export function renderAuditView(container) {
  container.innerHTML = '';

  const view = html`
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="font-size: 1.2rem;">
          <span style="color: var(--accent);">π</span>
          Provenance Surface
        </h2>
      </div>
    </div>
  `;

  // Session selector
  const sessions = getAllSessions();
  if (sessions.length === 0) {
    view.appendChild(html`<div class="empty-state"><div class="glyph">π</div><p>No sessions to audit.</p></div>`);
    container.appendChild(view);
    return;
  }

  const controls = html`
    <div style="display: flex; gap: 12px; margin-bottom: 16px; align-items: center;">
      <select class="form-select" id="audit-session-select" style="max-width: 300px;"></select>
      <div class="tabs" style="margin-bottom: 0; border-bottom: none;">
        <button class="tab ${_viewMode === 'technical' ? 'active' : ''}" data-view="technical">Technical</button>
        <button class="tab ${_viewMode === 'public' ? 'active' : ''}" data-view="public">Public</button>
      </div>
    </div>
  `;

  const select = controls.querySelector('select');
  for (const session of sessions) {
    const opt = document.createElement('option');
    opt.value = session.id;
    opt.textContent = session.name;
    select.appendChild(opt);
  }

  // Tab switching
  controls.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      _viewMode = tab.dataset.view;
      controls.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      _renderAuditContent(auditContent, select.value);
    });
  });

  view.appendChild(controls);

  const auditContent = document.createElement('div');
  view.appendChild(auditContent);

  select.addEventListener('change', () => {
    _renderAuditContent(auditContent, select.value);
  });

  if (sessions.length > 0) {
    setTimeout(() => _renderAuditContent(auditContent, sessions[0].id), 0);
  }

  container.appendChild(view);
}

function _renderAuditContent(container, sessionId) {
  container.innerHTML = '';

  // Conformance check
  const conformance = checkMeantConformance(sessionId);
  if (!conformance.conformant) {
    const warning = html`
      <div class="card" style="border-color: var(--failed-border); margin-bottom: 16px;">
        <div style="color: var(--failed-border); font-weight: 600; margin-bottom: 8px;">
          ⚠ Meant-Conformance Violations
        </div>
        ${conformance.violations.map(v =>
          `<div style="font-size: 0.85rem; margin-left: 12px;">
            ${v.operator}: ${v.violation} — ${v.message}
          </div>`
        ).join('')}
      </div>
    `;
    container.appendChild(warning);
  }

  // Steps
  const steps = getSessionSteps(sessionId);

  for (const step of steps) {
    if (step.status === 'pending') continue;

    if (_viewMode === 'technical') {
      container.appendChild(_renderTechnicalStep(step));
    } else {
      container.appendChild(_renderPublicStep(step));
    }
  }
}

function _renderTechnicalStep(step) {
  const sections = renderTechnicalView(step);
  const op = OPERATORS[step.operator_type];

  const card = html`
    <div class="card" style="margin-bottom: 12px;">
      <div class="card-header">
        <span class="op-glyph ${op.triad.toLowerCase()}">${op.glyph}</span>
        <div class="card-title">Step ${step.sequence_number}: ${formatOperator(step.operator_type)}</div>
        <span class="status-${step.status}">${step.status}</span>
      </div>
    </div>
  `;

  for (const section of sections) {
    const sectionEl = html`
      <div style="margin-top: 8px;">
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">${section.label}</div>
        <pre class="notation" style="font-size: 0.8rem;">${section.content}</pre>
      </div>
    `;
    card.appendChild(sectionEl);
  }

  // Output with drill-down
  const outputs = getStepOutputs(step.id);
  if (outputs.length > 0) {
    const output = outputs[0];
    try {
      const data = output.data_json ? JSON.parse(output.data_json) : [];
      if (data.length > 0) {
        const outputSection = html`
          <div style="margin-top: 12px;">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
              Output (click any row for π drill-down)
            </div>
          </div>
        `;
        const columns = Object.keys(data[0]);
        const table = renderDataTable(data.slice(0, 10), columns, {
          onRowClick: (row, index) => {
            _showDrillDown(step.id, index);
          }
        });
        outputSection.appendChild(table);
        if (data.length > 10) {
          outputSection.appendChild(html`<div style="font-size: 0.8rem; color: var(--text-muted);">Showing 10 of ${data.length} rows</div>`);
        }
        card.appendChild(outputSection);
      }
    } catch (e) {}
  }

  return card;
}

function _renderPublicStep(step) {
  const publicView = renderPublicView(step);
  const op = OPERATORS[step.operator_type];

  const card = html`
    <div class="card" style="margin-bottom: 12px;">
      <div style="font-size: 1rem; font-weight: 600; margin-bottom: 8px;">
        ${publicView.title}
      </div>
      <div style="font-size: 0.9rem; line-height: 1.7; color: var(--text-secondary);">
        ${publicView.description}
      </div>
      ${publicView.outputSummary ? `<div style="font-size: 0.85rem; margin-top: 8px; color: var(--text-muted);">${publicView.outputSummary}</div>` : ''}
    </div>
  `;

  return card;
}

function _showDrillDown(stepId, rowIndex) {
  const result = drillDown(stepId, rowIndex);
  if (!result) {
    toast('Could not trace provenance for this row', 'error');
    return;
  }

  const content = html`<div></div>`;

  // Output row
  content.appendChild(html`
    <div style="margin-bottom: 16px;">
      <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Output Row ${rowIndex}</div>
      <pre class="notation" style="font-size: 0.8rem;">${JSON.stringify(result.outputRow, null, 2)}</pre>
    </div>
  `);

  // Step that produced it
  content.appendChild(html`
    <div style="margin-bottom: 16px;">
      <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Produced by</div>
      <div style="font-size: 0.9rem;">${result.step.operator} — ${result.step.description}</div>
      ${result.step.code ? `<pre class="notation" style="font-size: 0.8rem; margin-top: 4px;">${result.step.code}</pre>` : ''}
    </div>
  `);

  // Provenance chain
  if (result.provenanceChain.length > 0) {
    const chainEl = html`
      <div style="margin-bottom: 16px;">
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">π Provenance Chain</div>
      </div>
    `;
    for (const link of result.provenanceChain) {
      chainEl.appendChild(html`
        <div style="font-size: 0.85rem; padding: 4px 0; border-left: 2px solid var(--accent); padding-left: 12px; margin-bottom: 4px;">
          ${link.glyph} ${link.operator} — ${link.description}
        </div>
      `);
    }
    content.appendChild(chainEl);
  }

  // Given-Log sources
  if (result.givenSources.length > 0) {
    content.appendChild(html`
      <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Given-Log Sources (immutable)</div>
    `);
    for (const source of result.givenSources) {
      const sourceEl = html`
        <div class="card given-row" style="margin-bottom: 8px;">
          <div style="font-size: 0.85rem; margin-bottom: 4px;">
            <span class="given-badge">Given</span> ${source.source}
          </div>
        </div>
      `;
      if (source.rows && source.rows.length > 0) {
        const columns = Object.keys(source.rows[0]);
        const table = renderDataTable(source.rows.slice(0, 5), columns);
        sourceEl.appendChild(table);
      }
      content.appendChild(sourceEl);
    }
  }

  // Groundedness check
  content.appendChild(html`
    <div style="margin-top: 12px; font-size: 0.85rem; color: ${result.isGrounded ? 'var(--completed-border)' : 'var(--failed-border)'};">
      ${result.isGrounded ? '✓ Grounded: traces to Given-Log (Rule 7)' : '✗ UngroundedAssertion: no path to Given-Log'}
    </div>
  `);

  renderModal('π Provenance Drill-Down', content, [{ label: 'Close' }]);
}
