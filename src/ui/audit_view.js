/**
 * Audit View — Provenance Thread
 * Gmail-style vertical thread with colored status line.
 * Segmented control for technical/public toggle.
 * Click-to-drill-down expands inline rather than opening a modal.
 */

import { getAllSessions, getSessionSteps, getStepOutputs } from '../models/meant_graph.js';
import { getAllSources } from '../models/given_log.js';
import { OPERATORS, formatOperator, formatOperatorFriendly } from '../models/operators.js';
import { renderTechnicalView, renderPublicView } from '../provenance/views.js';
import { traceProvenance, drillDown, checkMeantConformance, getIngestionAuditTrail } from '../provenance/service.js';
import { renderDataTable, createOpBadge, getTriadClass, html, toast } from './components.js';
import { updateTopBar } from '../app.js';

let _viewMode = 'public'; // public | technical

export function renderAuditView(container) {
  container.innerHTML = '';

  const sessions = getAllSessions();
  const sources = getAllSources();

  if (sessions.length === 0 && sources.length === 0) {
    updateTopBar('Audit Trail', 'No activity');
    container.appendChild(html`
      <div class="empty-state">
        <div class="empty-icon"><i class="ph ph-fingerprint" style="font-size: 3rem;"></i></div>
        <p>No activity to audit. Upload data to begin.</p>
      </div>
    `);
    return;
  }

  const view = html`<div></div>`;

  // Session selector (if multiple sessions)
  let selectedSessionId = sessions.length > 0 ? sessions[0].id : null;

  if (sessions.length > 1) {
    const selectGroup = document.createElement('div');
    selectGroup.style.cssText = 'margin-bottom: 16px;';
    const select = document.createElement('select');
    select.className = 'form-select';
    select.style.maxWidth = '300px';
    for (const session of sessions) {
      const opt = document.createElement('option');
      opt.value = session.id;
      opt.textContent = session.name;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => {
      selectedSessionId = select.value;
      _renderAuditContent(threadContainer, selectedSessionId);
      const session = sessions.find(s => s.id === selectedSessionId);
      updateTopBar('Audit Trail', session ? session.name : '');
    });
    selectGroup.appendChild(select);
    view.appendChild(selectGroup);
  }

  // Segmented control: Public / Technical
  const controls = document.createElement('div');
  controls.className = 'audit-controls';

  const publicBtn = document.createElement('button');
  publicBtn.className = `audit-toggle ${_viewMode === 'public' ? 'active' : ''}`;
  publicBtn.textContent = 'Public';
  publicBtn.addEventListener('click', () => {
    _viewMode = 'public';
    controls.querySelectorAll('.audit-toggle').forEach(b => b.classList.remove('active'));
    publicBtn.classList.add('active');
    _renderAuditContent(threadContainer, selectedSessionId);
  });

  const techBtn = document.createElement('button');
  techBtn.className = `audit-toggle ${_viewMode === 'technical' ? 'active' : ''}`;
  techBtn.textContent = 'Technical';
  techBtn.addEventListener('click', () => {
    _viewMode = 'technical';
    controls.querySelectorAll('.audit-toggle').forEach(b => b.classList.remove('active'));
    techBtn.classList.add('active');
    _renderAuditContent(threadContainer, selectedSessionId);
  });

  controls.appendChild(publicBtn);
  controls.appendChild(techBtn);
  view.appendChild(controls);

  // Thread container
  const threadContainer = document.createElement('div');
  threadContainer.className = 'audit-thread';
  view.appendChild(threadContainer);

  container.appendChild(view);

  // Initial render
  const session = sessions.find(s => s.id === selectedSessionId);
  updateTopBar('Audit Trail', session ? session.name : '');
  _renderAuditContent(threadContainer, selectedSessionId);
}

function _renderAuditContent(container, sessionId) {
  container.innerHTML = '';

  // ── Ingestion events: show the INS upload trail for all sources used ──
  const sources = getAllSources();
  if (sources.length > 0) {
    _renderIngestionSection(container, sources);
  }

  // Conformance check
  if (sessionId) {
    const conformance = checkMeantConformance(sessionId);
    if (!conformance.conformant) {
      const warning = document.createElement('div');
      warning.className = 'finding-card severity-high';
      warning.style.marginBottom = '16px';

      let warningHTML = '<div class="finding-header"><span class="finding-title">Validation Issues</span><span class="severity-badge high">Warning</span></div>';
      warningHTML += '<div class="finding-body">';
      for (const v of conformance.violations) {
        warningHTML += `${v.operator}: ${v.violation} \u2014 ${v.message}<br>`;
      }
      warningHTML += '</div>';
      warning.innerHTML = warningHTML;
      container.appendChild(warning);
    }

    // Steps as thread
    const steps = getSessionSteps(sessionId);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.status === 'pending') continue;

      const isLast = (i === steps.length - 1);
      container.appendChild(_renderAuditRow(step, isLast, sessionId));
    }
  }
}

/**
 * Render the ingestion audit trail section — shows every INS upload pipeline event.
 */
function _renderIngestionSection(container, sources) {
  const sectionHeader = document.createElement('div');
  sectionHeader.style.cssText = 'font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid var(--border);';
  sectionHeader.textContent = `Data Ingestion \u2014 INS(\u25B3) Pipeline`;
  container.appendChild(sectionHeader);

  for (const source of sources) {
    const trail = getIngestionAuditTrail(source.id);
    if (trail.length === 0) continue;

    // Source header
    const sourceHeader = document.createElement('div');
    sourceHeader.style.cssText = 'font-size: 0.85rem; font-weight: 600; margin: 12px 0 8px; display: flex; align-items: center; gap: 8px;';

    const badge = document.createElement('span');
    badge.style.cssText = 'background: var(--given-bg, #e8f5e9); color: var(--given-border, #388e3c); padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.04em;';
    badge.textContent = 'INS(\u25B3)';
    sourceHeader.appendChild(badge);

    const nameText = document.createTextNode(source.filename);
    sourceHeader.appendChild(nameText);

    container.appendChild(sourceHeader);

    // Render each ingestion event
    for (let i = 0; i < trail.length; i++) {
      const event = trail[i];
      const isLast = (i === trail.length - 1);
      container.appendChild(_renderIngestionEventRow(event, isLast));
    }
  }

  // Divider before session steps
  const divider = document.createElement('div');
  divider.style.cssText = 'font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin: 20px 0 12px; padding-bottom: 6px; border-bottom: 1px solid var(--border);';
  divider.textContent = 'Analysis Steps';
  container.appendChild(divider);
}

/**
 * Render a single ingestion event row in the audit thread.
 */
function _renderIngestionEventRow(event, isLast) {
  const row = document.createElement('div');
  row.className = 'audit-row';

  // ── Left: colored line ──
  const lineContainer = document.createElement('div');
  lineContainer.className = 'audit-line-container';

  const dot = document.createElement('div');
  dot.className = 'audit-line-dot completed';
  dot.style.cssText = event.eventType === 'ingestion_failed'
    ? 'background: var(--failed-border);'
    : event.eventType === 'duplicate_detected'
      ? 'background: var(--stale-border);'
      : '';
  lineContainer.appendChild(dot);

  if (!isLast) {
    const bar = document.createElement('div');
    bar.className = 'audit-line-bar completed';
    lineContainer.appendChild(bar);
  }

  row.appendChild(lineContainer);

  // ── Right: content ──
  const content = document.createElement('div');
  content.className = 'audit-content';

  // Header: glyph + event type
  const header = document.createElement('div');
  header.className = 'audit-step-header';
  header.style.cssText = 'display: flex; align-items: center; gap: 6px;';

  const glyphEl = document.createElement('span');
  glyphEl.style.cssText = 'font-size: 0.9rem; opacity: 0.7;';
  glyphEl.textContent = event.glyph;
  header.appendChild(glyphEl);

  const desc = document.createElement('span');
  desc.textContent = _viewMode === 'public' ? event.public : event.technical;
  header.appendChild(desc);

  content.appendChild(header);

  // Timestamp
  const timestamp = document.createElement('div');
  timestamp.style.cssText = 'font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;';
  timestamp.textContent = new Date(event.occurredAt).toLocaleString();
  content.appendChild(timestamp);

  row.appendChild(content);
  return row;
}

function _renderAuditRow(step, isLast, sessionId) {
  const op = OPERATORS[step.operator_type];
  const status = step.status;

  const row = document.createElement('div');
  row.className = 'audit-row';

  // ── Left: colored line ──
  const lineContainer = document.createElement('div');
  lineContainer.className = 'audit-line-container';

  const dot = document.createElement('div');
  dot.className = `audit-line-dot ${status}`;
  lineContainer.appendChild(dot);

  if (!isLast) {
    const bar = document.createElement('div');
    bar.className = `audit-line-bar ${status}`;
    lineContainer.appendChild(bar);
  }

  row.appendChild(lineContainer);

  // ── Right: content ──
  const content = document.createElement('div');
  content.className = 'audit-content';

  // Header: badge + step number + description
  const header = document.createElement('div');
  header.className = 'audit-step-header';

  const badge = createOpBadge(step.operator_type);
  badge.style.cssText = 'font-size: 0.65rem; padding: 2px 6px;';
  header.appendChild(badge);

  const headerText = document.createTextNode(`${step.sequence_number}. ${step.description}`);
  header.appendChild(headerText);

  content.appendChild(header);

  // Description / narrative
  if (_viewMode === 'public') {
    const publicView = renderPublicView(step);
    const desc = document.createElement('div');
    desc.className = 'audit-step-desc';
    desc.textContent = publicView.description;
    content.appendChild(desc);

    if (publicView.outputSummary) {
      const cite = document.createElement('div');
      cite.className = 'audit-source-cite';
      cite.textContent = publicView.outputSummary;
      content.appendChild(cite);
    }
  } else {
    // Technical view: show formal notation inline
    const sections = renderTechnicalView(step);

    // Source citation
    if (step.inputs && step.inputs.length > 0) {
      const cite = document.createElement('div');
      cite.className = 'audit-source-cite';
      const inputNames = step.inputs.map(inp => inp.filename || inp.name || `step-${inp.sequence_number}`).join(', ');
      cite.textContent = `Source: ${inputNames}`;
      content.appendChild(cite);
    }

    // Notation blocks
    for (const section of sections) {
      const notation = document.createElement('div');
      notation.className = 'audit-notation';
      notation.textContent = section.content;
      content.appendChild(notation);
    }

    // Status note for stale/failed
    if (status === 'stale') {
      const note = document.createElement('div');
      note.className = 'audit-step-desc';
      note.style.color = 'var(--stale-border)';
      note.textContent = '\u26A0 Upstream data has changed since this step was last run. Results may be outdated.';
      content.appendChild(note);
    }
    if (status === 'failed') {
      const note = document.createElement('div');
      note.className = 'audit-step-desc';
      note.style.color = 'var(--failed-border)';
      note.textContent = `\u2717 Failed: ${step.executionLog?.error || 'unknown error'}`;
      content.appendChild(note);
    }
  }

  // Drilldown area (expanded inline on click)
  const drilldownArea = document.createElement('div');
  drilldownArea.id = `drilldown-${step.id}`;
  content.appendChild(drilldownArea);

  row.appendChild(content);

  // Click to toggle drilldown
  row.addEventListener('click', () => {
    const area = document.getElementById(`drilldown-${step.id}`);
    if (!area) return;

    if (area.children.length > 0) {
      // Collapse
      area.innerHTML = '';
      return;
    }

    // Expand: show output with drill-down capability
    const outputs = getStepOutputs(step.id);
    if (outputs.length > 0) {
      const output = outputs[0];
      try {
        const data = output.data_json ? JSON.parse(output.data_json) : [];
        if (data.length > 0) {
          const drillDiv = document.createElement('div');
          drillDiv.className = 'audit-drilldown';

          const drillLabel = document.createElement('div');
          drillLabel.style.cssText = 'font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; font-weight: 600;';
          drillLabel.textContent = `Output (${data.length} rows) \u2014 click any row to trace lineage`;
          drillDiv.appendChild(drillLabel);

          const columns = Object.keys(data[0]);
          const table = renderDataTable(data.slice(0, 10), columns, {
            onRowClick: (rowData, index) => {
              _showInlineDrillDown(drillDiv, step.id, index);
            }
          });
          drillDiv.appendChild(table);

          if (data.length > 10) {
            const moreEl = document.createElement('div');
            moreEl.style.cssText = 'font-size: 0.78rem; color: var(--text-muted); margin-top: 4px;';
            moreEl.textContent = `Showing 10 of ${data.length} rows`;
            drillDiv.appendChild(moreEl);
          }

          area.appendChild(drillDiv);
        }
      } catch (e) {}
    }
  });

  return row;
}

function _showInlineDrillDown(parentDiv, stepId, rowIndex) {
  // Remove any existing drilldown detail
  const existing = parentDiv.querySelector('.drilldown-detail');
  if (existing) existing.remove();

  const result = drillDown(stepId, rowIndex);
  if (!result) {
    toast('Could not trace provenance for this row', 'error');
    return;
  }

  const detail = document.createElement('div');
  detail.className = 'drilldown-detail';
  detail.style.cssText = 'margin-top: 12px; padding: 12px; background: var(--bg-surface); border: 0.5px solid var(--border); border-radius: var(--radius);';

  // Output row
  detail.appendChild(html`
    <div style="margin-bottom: 8px;">
      <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Output Row ${rowIndex}</div>
      <pre class="notation" style="font-size: 0.78rem; padding: 8px;">${JSON.stringify(result.outputRow, null, 2)}</pre>
    </div>
  `);

  // Provenance chain
  if (result.provenanceChain.length > 0) {
    const chainLabel = document.createElement('div');
    chainLabel.style.cssText = 'font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; margin: 8px 0 4px;';
    chainLabel.textContent = 'Trace Path';
    detail.appendChild(chainLabel);

    for (const link of result.provenanceChain) {
      detail.appendChild(html`
        <div style="font-size: 0.82rem; padding: 4px 0; border-left: 2px solid var(--accent); padding-left: 12px; margin-bottom: 4px;">
          ${link.glyph} ${link.operator} \u2014 ${link.description}
        </div>
      `);
    }
  }

  // Given-Log sources with ingestion trail
  if (result.givenSources.length > 0) {
    const sourceLabel = document.createElement('div');
    sourceLabel.style.cssText = 'font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; margin: 8px 0 4px;';
    sourceLabel.textContent = 'Original Sources';
    detail.appendChild(sourceLabel);

    for (const source of result.givenSources) {
      const sourceDiv = html`
        <div style="font-size: 0.82rem; padding: 4px 12px; background: var(--given-bg); border-left: 2px solid var(--given-border); margin-bottom: 4px; border-radius: 0 4px 4px 0; cursor: pointer;">
          ${source.source}
        </div>
      `;

      // Click to expand ingestion trail inline
      sourceDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        const existing = sourceDiv.querySelector('.ingestion-trail-detail');
        if (existing) {
          existing.remove();
          return;
        }

        const trail = getIngestionAuditTrail(source.sourceId);
        if (trail.length === 0) return;

        const trailDiv = document.createElement('div');
        trailDiv.className = 'ingestion-trail-detail';
        trailDiv.style.cssText = 'margin-top: 6px; padding-left: 8px; border-left: 1px solid var(--border);';

        const trailLabel = document.createElement('div');
        trailLabel.style.cssText = 'font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px;';
        trailLabel.textContent = 'Ingestion Pipeline Trail';
        trailDiv.appendChild(trailLabel);

        for (const event of trail) {
          const eventEl = document.createElement('div');
          eventEl.style.cssText = 'font-size: 0.78rem; padding: 2px 0; color: var(--text-secondary);';
          eventEl.textContent = `${event.glyph} ${_viewMode === 'public' ? event.public : event.technical}`;
          trailDiv.appendChild(eventEl);
        }

        sourceDiv.appendChild(trailDiv);
      });

      detail.appendChild(sourceDiv);
    }
  }

  // Groundedness
  const grounded = document.createElement('div');
  grounded.style.cssText = `margin-top: 8px; font-size: 0.82rem; color: ${result.isGrounded ? 'var(--completed-border)' : 'var(--failed-border)'};`;
  grounded.textContent = result.isGrounded ? '\u2713 Verified: traces back to original source data' : '\u2717 Warning: no path to original source data';
  detail.appendChild(grounded);

  parentDiv.appendChild(detail);
}
