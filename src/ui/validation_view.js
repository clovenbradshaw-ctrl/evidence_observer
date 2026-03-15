/**
 * Validation Audit View — Guided Dashboard Audit Wizard
 *
 * A 6-phase wizard that walks the analyst through comparing a
 * dashboard's published data against raw source data. Each phase
 * creates real Meant-Graph steps so all provenance, audit trail,
 * and export features work automatically.
 *
 * Phases:
 *   1. Import Sources (NUL, SIG, INS)
 *   2. Automated Checks (SEG, CON)
 *   3. Compare Aggregations (SYN, ALT)
 *   4. Parallel Interpretations (SUP)
 *   5. Document Findings (REC)
 *   6. Export Report
 */

import { ins_ingest, getSourceData } from '../given/service.js';
import { getSource, getAllSources } from '../models/given_log.js';
import { startSession, addStep, executeStep } from '../meant/service.js';
import { recordDecision } from '../meant/reconciliation.js';
import { executeSuperposition, resolveSuperpositon } from '../meant/superposition.js';
import { ResolutionReasons } from '../models/operators.js';
import {
  detectDuplicateEntities,
  detectCategoryErrors,
  getCampaignFinanceRules,
  compareAggregations,
  findMissingRecords,
  generateFindings,
  generateAuditSummary
} from '../validation/service.js';
import { renderDataTable, renderDropzone, renderModal, html, toast } from './components.js';

// ============ Wizard State ============

let _state = {
  phase: 1,
  sessionId: null,
  dashboardSourceId: null,
  rawSourceId: null,
  dashboardData: null,
  rawData: null,
  dashboardSchema: null,
  rawSchema: null,
  duplicates: [],
  categoryErrors: [],
  aggregationResults: [],
  missingRecords: {},
  findings: [],
  customRules: [],
  fieldMapping: {},
  supStepId: null,
  branchResults: null
};

function _resetState() {
  _state = {
    phase: 1, sessionId: null, dashboardSourceId: null, rawSourceId: null,
    dashboardData: null, rawData: null, dashboardSchema: null, rawSchema: null,
    duplicates: [], categoryErrors: [], aggregationResults: [], missingRecords: {},
    findings: [], customRules: [], fieldMapping: {}, supStepId: null, branchResults: null
  };
}

// ============ Main Render ============

/**
 * Render the validation audit view.
 */
export function renderValidationView(container) {
  container.innerHTML = '';

  const view = html`
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
          <i class="ph ph-check-square" style="color: var(--accent); font-size: 1.3rem;"></i>
          Audit Dashboard
        </h2>
        <button class="btn btn-sm" id="btn-reset-audit">
          <i class="ph ph-arrow-counter-clockwise"></i> New Audit
        </button>
      </div>
    </div>
  `;

  // Phase indicator
  view.appendChild(_renderPhaseBar());

  // Phase content
  const contentArea = document.createElement('div');
  contentArea.style.marginTop = '20px';
  _renderPhase(contentArea);
  view.appendChild(contentArea);

  // Reset button
  view.querySelector('#btn-reset-audit').addEventListener('click', () => {
    _resetState();
    renderValidationView(container);
  });

  container.appendChild(view);
}

// ============ Phase Bar ============

function _renderPhaseBar() {
  const phases = [
    { num: 1, label: 'Import', icon: 'ph-upload-simple' },
    { num: 2, label: 'Checks', icon: 'ph-magnifying-glass' },
    { num: 3, label: 'Compare', icon: 'ph-arrows-left-right' },
    { num: 4, label: 'Branch', icon: 'ph-git-branch' },
    { num: 5, label: 'Document', icon: 'ph-pencil-simple' },
    { num: 6, label: 'Export', icon: 'ph-export' }
  ];

  const bar = html`<div style="display: flex; gap: 4px; align-items: center;"></div>`;

  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    const isActive = p.num === _state.phase;
    const isComplete = p.num < _state.phase;

    if (i > 0) {
      bar.appendChild(html`<span style="color: var(--text-muted); font-size: 0.75rem;">—</span>`);
    }

    const step = html`
      <div style="
        display: flex; align-items: center; gap: 4px; padding: 6px 12px;
        border-radius: 6px; font-size: 0.8rem; font-weight: 500;
        ${isActive ? 'background: var(--accent); color: white;' : ''}
        ${isComplete ? 'background: var(--completed-bg); color: var(--completed-border);' : ''}
        ${!isActive && !isComplete ? 'color: var(--text-muted);' : ''}
        cursor: ${isComplete ? 'pointer' : 'default'};
      ">
        <i class="ph ${isComplete ? 'ph-check-circle' : p.icon}" style="font-size: 0.9rem;"></i>
        ${p.label}
      </div>
    `;

    if (isComplete) {
      step.addEventListener('click', () => {
        _state.phase = p.num;
        const main = document.getElementById('main-content');
        if (main) renderValidationView(main);
      });
    }

    bar.appendChild(step);
  }

  return bar;
}

// ============ Phase Router ============

function _renderPhase(container) {
  switch (_state.phase) {
    case 1: return _renderPhase1Import(container);
    case 2: return _renderPhase2Checks(container);
    case 3: return _renderPhase3Compare(container);
    case 4: return _renderPhase4Branch(container);
    case 5: return _renderPhase5Document(container);
    case 6: return _renderPhase6Export(container);
  }
}

// ============ Phase 1: Import Sources ============

function _renderPhase1Import(container) {
  container.innerHTML = '';

  const intro = html`
    <div class="card" style="margin-bottom: 20px;">
      <div style="padding: 16px;">
        <h3 style="font-size: 0.95rem; margin-bottom: 8px;">Step 1: Import Data Sources</h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary);">
          Upload two CSV files: the dashboard's published data and the raw source data.
          Both files will be ingested immutably with SHA-256 hashing, schema inference,
          and null detection.
        </p>
      </div>
    </div>
  `;
  container.appendChild(intro);

  // Two-column dropzone layout
  const grid = html`<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;"></div>`;

  // Dashboard source
  const dashCol = html`<div></div>`;
  dashCol.appendChild(html`<h4 style="font-size: 0.9rem; margin-bottom: 8px; color: var(--meant-text);">
    <i class="ph ph-chart-bar"></i> Dashboard Published Data
  </h4>`);

  if (_state.dashboardSourceId) {
    const source = getSource(_state.dashboardSourceId);
    dashCol.appendChild(_renderImportedCard(source, 'Dashboard'));
  } else {
    const dz = renderDropzone(async (file) => {
      try {
        toast('Ingesting dashboard data...', 'info');
        const result = await ins_ingest(file, {
          sourceDescription: 'Dashboard published data (under audit)',
          method: 'manual_upload'
        });
        if (result.status === 'duplicate') {
          toast('This file has already been imported', 'error');
          return;
        }
        _state.dashboardSourceId = result.sourceId;
        _state.dashboardSchema = result.schema;
        toast(`Dashboard data: ${result.rowCount} rows, ${result.columnCount} columns`, 'success');
        const main = document.getElementById('main-content');
        if (main) renderValidationView(main);
      } catch (err) {
        toast(`Import failed: ${err.message}`, 'error');
      }
    });
    dashCol.appendChild(dz);
  }
  grid.appendChild(dashCol);

  // Raw source
  const rawCol = html`<div></div>`;
  rawCol.appendChild(html`<h4 style="font-size: 0.9rem; margin-bottom: 8px; color: var(--given-text);">
    <i class="ph ph-database"></i> Raw Source Data
  </h4>`);

  if (_state.rawSourceId) {
    const source = getSource(_state.rawSourceId);
    rawCol.appendChild(_renderImportedCard(source, 'Raw Source'));
  } else {
    const dz = renderDropzone(async (file) => {
      try {
        toast('Ingesting raw source data...', 'info');
        const result = await ins_ingest(file, {
          sourceDescription: 'Raw source data for validation',
          method: 'manual_upload'
        });
        if (result.status === 'duplicate') {
          toast('This file has already been imported', 'error');
          return;
        }
        _state.rawSourceId = result.sourceId;
        _state.rawSchema = result.schema;
        toast(`Raw data: ${result.rowCount} rows, ${result.columnCount} columns`, 'success');
        const main = document.getElementById('main-content');
        if (main) renderValidationView(main);
      } catch (err) {
        toast(`Import failed: ${err.message}`, 'error');
      }
    });
    rawCol.appendChild(dz);
  }
  grid.appendChild(rawCol);
  container.appendChild(grid);

  // Continue button
  if (_state.dashboardSourceId && _state.rawSourceId) {
    const actions = html`<div style="margin-top: 20px; display: flex; justify-content: flex-end;"></div>`;
    const continueBtn = html`<button class="btn btn-primary"><i class="ph ph-arrow-right"></i> Continue to Automated Checks</button>`;
    continueBtn.addEventListener('click', async () => {
      // Create analysis session
      _state.sessionId = startSession({
        name: 'Dashboard Validation Audit',
        description: 'Systematic comparison of dashboard claims against raw source data',
        mode: 'explore'
      });

      // Create INS step for documentation
      addStep({
        sessionId: _state.sessionId,
        operatorType: 'INS',
        description: 'Import dashboard and raw source data for validation audit',
        inputIds: [_state.dashboardSourceId, _state.rawSourceId]
      });

      // Load data for subsequent phases
      const dashSource = getSource(_state.dashboardSourceId);
      const rawSource = getSource(_state.rawSourceId);
      _state.dashboardData = await getSourceData(dashSource);
      _state.rawData = await getSourceData(rawSource);

      _state.phase = 2;
      const main = document.getElementById('main-content');
      if (main) renderValidationView(main);
    });
    actions.appendChild(continueBtn);
    container.appendChild(actions);
  }
}

function _renderImportedCard(source, label) {
  if (!source) return html`<div style="color: var(--text-muted);">Source not found</div>`;
  const schema = source.schema_json ? JSON.parse(source.schema_json) : [];

  return html`
    <div class="card given-row" style="padding: 12px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <i class="ph ph-check-circle" style="color: var(--completed-border);"></i>
        <strong style="font-size: 0.85rem;">${source.filename}</strong>
        <span class="given-badge" style="font-size: 0.7rem;">${label}</span>
      </div>
      <div style="font-size: 0.8rem; color: var(--text-secondary);">
        ${source.row_count} rows · ${source.column_count} columns ·
        <code style="font-size: 0.7rem;">${source.sha256_hash?.substring(0, 16)}...</code>
      </div>
      <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
        Columns: ${schema.map(s => s.name).join(', ')}
      </div>
    </div>
  `;
}

// ============ Phase 2: Automated Checks ============

function _renderPhase2Checks(container) {
  container.innerHTML = '';

  const intro = html`
    <div class="card" style="margin-bottom: 20px;">
      <div style="padding: 16px;">
        <h3 style="font-size: 0.95rem; margin-bottom: 8px;">Step 2: Automated Reliability Checks</h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary);">
          Scanning the raw source data for duplicate entities and category coding errors.
          Review each finding and accept or reject it.
        </p>
      </div>
    </div>
  `;
  container.appendChild(intro);

  // Run checks if not already done
  if (_state.duplicates.length === 0 && _state.categoryErrors.length === 0 && _state.rawData) {
    _runAutomatedChecks();
  }

  // Duplicate Entities
  const dupSection = html`
    <div style="margin-bottom: 24px;">
      <h4 style="font-size: 0.9rem; margin-bottom: 12px;">
        <i class="ph ph-users-three"></i>
        Potential Duplicate Entities (${_state.duplicates.length})
      </h4>
    </div>
  `;

  if (_state.duplicates.length > 0) {
    const dupTable = renderDataTable(
      _state.duplicates.slice(0, 50).map((d, i) => ({
        '#': i + 1,
        'Name A': d.recordA?.donor_name || d.recordA?.name || '?',
        'Name B': d.recordB?.donor_name || d.recordB?.name || '?',
        'Type': d.duplicateType,
        'Similarity': `${(d.similarity * 100).toFixed(0)}%`,
        'Address Match': d.addressMatch || '—'
      })),
      ['#', 'Name A', 'Name B', 'Type', 'Similarity', 'Address Match']
    );
    dupSection.appendChild(dupTable);
    if (_state.duplicates.length > 50) {
      dupSection.appendChild(html`<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
        Showing 50 of ${_state.duplicates.length} potential duplicates
      </div>`);
    }
  } else {
    dupSection.appendChild(html`<div style="color: var(--text-muted); font-size: 0.85rem;">No duplicates detected at current threshold.</div>`);
  }
  container.appendChild(dupSection);

  // Category Errors
  const catSection = html`
    <div style="margin-bottom: 24px;">
      <h4 style="font-size: 0.9rem; margin-bottom: 12px;">
        <i class="ph ph-warning-circle"></i>
        Category/Coding Errors (${_state.categoryErrors.length})
      </h4>
    </div>
  `;

  if (_state.categoryErrors.length > 0) {
    const catTable = renderDataTable(
      _state.categoryErrors.slice(0, 50).map((e, i) => ({
        '#': i + 1,
        'Row': e.rowIndex + 1,
        'Field': e.field || '—',
        'Issue': e.message,
        'Severity': e.severity,
        'Donor': e.row?.donor_name || '—'
      })),
      ['#', 'Row', 'Field', 'Issue', 'Severity', 'Donor']
    );
    catSection.appendChild(catTable);
  } else {
    catSection.appendChild(html`<div style="color: var(--text-muted); font-size: 0.85rem;">No category errors detected.</div>`);
  }
  container.appendChild(catSection);

  // Custom rule builder
  container.appendChild(_renderRuleBuilder());

  // Continue
  const actions = html`<div style="margin-top: 20px; display: flex; justify-content: space-between;"></div>`;
  const backBtn = html`<button class="btn"><i class="ph ph-arrow-left"></i> Back</button>`;
  backBtn.addEventListener('click', () => { _state.phase = 1; const m = document.getElementById('main-content'); if (m) renderValidationView(m); });
  actions.appendChild(backBtn);

  const continueBtn = html`<button class="btn btn-primary"><i class="ph ph-arrow-right"></i> Continue to Comparison</button>`;
  continueBtn.addEventListener('click', () => {
    // Record findings as a SEG step
    if (_state.sessionId) {
      addStep({
        sessionId: _state.sessionId,
        operatorType: 'SEG',
        description: `Automated checks: ${_state.duplicates.length} potential duplicates, ${_state.categoryErrors.length} category errors`,
        inputIds: [_state.rawSourceId]
      });
    }
    _state.phase = 3;
    const main = document.getElementById('main-content');
    if (main) renderValidationView(main);
  });
  actions.appendChild(continueBtn);
  container.appendChild(actions);
}

function _runAutomatedChecks() {
  if (!_state.rawData || _state.rawData.length === 0) return;

  // Detect name field
  const nameField = _detectField(_state.rawData[0], ['donor_name', 'name', 'contributor']);
  const addressField = _detectField(_state.rawData[0], ['address', 'addr']);

  if (nameField) {
    _state.duplicates = detectDuplicateEntities(_state.rawData, nameField, {
      threshold: 0.7,
      addressField
    });
  }

  // Run built-in campaign finance rules
  const rules = getCampaignFinanceRules();
  _state.categoryErrors = detectCategoryErrors(_state.rawData, rules);
}

function _renderRuleBuilder() {
  const section = html`
    <div class="card" style="padding: 16px; margin-bottom: 16px;">
      <h4 style="font-size: 0.9rem; margin-bottom: 12px;">
        <i class="ph ph-plus-circle"></i> Add Custom Rule
      </h4>
      <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: end;">
        <div>
          <label class="form-label" style="font-size: 0.8rem;">Field</label>
          <input class="form-input" id="rule-field" placeholder="e.g., donor_type" style="font-size: 0.85rem;">
        </div>
        <div>
          <label class="form-label" style="font-size: 0.8rem;">Contains value</label>
          <input class="form-input" id="rule-value" placeholder="e.g., Individual" style="font-size: 0.85rem;">
        </div>
        <button class="btn btn-sm" id="btn-add-rule" style="height: 36px;">Add</button>
      </div>
      <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px;">
        Flags rows where the specified field contains the given value. Use this to check for known coding errors.
      </p>
    </div>
  `;

  section.querySelector('#btn-add-rule').addEventListener('click', () => {
    const field = document.getElementById('rule-field').value.trim();
    const value = document.getElementById('rule-value').value.trim();
    if (!field || !value) { toast('Both field and value are required', 'error'); return; }

    const rule = {
      id: `custom_${_state.customRules.length + 1}`,
      test: (row) => String(row[field] || '').toLowerCase().includes(value.toLowerCase()),
      message: `Field "${field}" contains "${value}"`,
      severity: 'warning',
      field
    };
    _state.customRules.push(rule);

    // Re-run with custom rules
    const newErrors = detectCategoryErrors(_state.rawData, [rule]);
    _state.categoryErrors = [..._state.categoryErrors, ...newErrors];

    toast(`Rule added: found ${newErrors.length} matches`, 'success');
    const main = document.getElementById('main-content');
    if (main) renderValidationView(main);
  });

  return section;
}

// ============ Phase 3: Compare Aggregations ============

function _renderPhase3Compare(container) {
  container.innerHTML = '';

  const intro = html`
    <div class="card" style="margin-bottom: 20px;">
      <div style="padding: 16px;">
        <h3 style="font-size: 0.95rem; margin-bottom: 8px;">Step 3: Compare Aggregations</h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary);">
          Map the dashboard's columns to the raw data columns, then compare aggregated values.
          This re-derives the dashboard's numbers from the raw source data and shows where they diverge.
        </p>
      </div>
    </div>
  `;
  container.appendChild(intro);

  // Field mapping UI
  const mappingSection = html`
    <div class="card" style="padding: 16px; margin-bottom: 20px;">
      <h4 style="font-size: 0.9rem; margin-bottom: 12px;">Field Mapping</h4>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;"></div>
    </div>
  `;

  const mappingGrid = mappingSection.querySelector('div > div');

  // Dashboard fields
  const dashFields = _state.dashboardSchema ? _state.dashboardSchema.map(s => s.name) : Object.keys(_state.dashboardData?.[0] || {});
  const rawFields = _state.rawSchema ? _state.rawSchema.map(s => s.name) : Object.keys(_state.rawData?.[0] || {});

  // Group by field (dashboard)
  const groupByDiv = html`<div>
    <label class="form-label" style="font-size: 0.8rem;">Dashboard: Group By</label>
    <select class="form-select" id="map-dash-group" style="font-size: 0.85rem;"></select>
  </div>`;
  const groupSelect = groupByDiv.querySelector('select');
  for (const f of dashFields) {
    groupSelect.appendChild(html`<option value="${f}">${f}</option>`);
  }
  // Pre-select likely candidate
  const likelyGroup = dashFields.find(f => /filer|name|district|candidate/i.test(f)) || dashFields[0];
  if (likelyGroup) groupSelect.value = likelyGroup;
  mappingGrid.appendChild(groupByDiv);

  // Group by field (raw)
  const rawGroupDiv = html`<div>
    <label class="form-label" style="font-size: 0.8rem;">Raw Data: Group By</label>
    <select class="form-select" id="map-raw-group" style="font-size: 0.85rem;"></select>
  </div>`;
  const rawGroupSelect = rawGroupDiv.querySelector('select');
  for (const f of rawFields) {
    rawGroupSelect.appendChild(html`<option value="${f}">${f}</option>`);
  }
  const likelyRawGroup = rawFields.find(f => /filer|name|district|candidate/i.test(f)) || rawFields[0];
  if (likelyRawGroup) rawGroupSelect.value = likelyRawGroup;
  mappingGrid.appendChild(rawGroupDiv);

  // Value field (dashboard)
  const dashValDiv = html`<div>
    <label class="form-label" style="font-size: 0.8rem;">Dashboard: Value Field</label>
    <select class="form-select" id="map-dash-value" style="font-size: 0.85rem;"></select>
  </div>`;
  const dashValSelect = dashValDiv.querySelector('select');
  for (const f of dashFields) {
    dashValSelect.appendChild(html`<option value="${f}">${f}</option>`);
  }
  const likelyDashVal = dashFields.find(f => /amount|total|sum|value|count/i.test(f)) || dashFields[1];
  if (likelyDashVal) dashValSelect.value = likelyDashVal;
  mappingGrid.appendChild(dashValDiv);

  // Value field (raw)
  const rawValDiv = html`<div>
    <label class="form-label" style="font-size: 0.8rem;">Raw Data: Sum Field</label>
    <select class="form-select" id="map-raw-value" style="font-size: 0.85rem;"></select>
  </div>`;
  const rawValSelect = rawValDiv.querySelector('select');
  for (const f of rawFields) {
    rawValSelect.appendChild(html`<option value="${f}">${f}</option>`);
  }
  const likelyRawVal = rawFields.find(f => /amount|total|sum|value/i.test(f)) || rawFields[1];
  if (likelyRawVal) rawValSelect.value = likelyRawVal;
  mappingGrid.appendChild(rawValDiv);

  container.appendChild(mappingSection);

  // Run comparison button
  const runBtn = html`<button class="btn btn-primary" style="margin-bottom: 20px;">
    <i class="ph ph-play"></i> Run Comparison
  </button>`;
  runBtn.addEventListener('click', () => {
    const mapping = {
      groupByFields: [document.getElementById('map-raw-group').value],
      sumField: document.getElementById('map-raw-value').value,
      dashboardGroupField: document.getElementById('map-dash-group').value,
      dashboardValueField: document.getElementById('map-dash-value').value
    };
    _state.fieldMapping = mapping;

    _state.aggregationResults = compareAggregations(
      _state.dashboardData, _state.rawData, mapping
    );

    // Also find missing records
    const matchFields = [mapping.dashboardGroupField];
    _state.missingRecords = findMissingRecords(
      _state.dashboardData, _state.rawData,
      [mapping.dashboardGroupField],
      { [mapping.dashboardGroupField]: mapping.groupByFields[0] }
    );

    toast(`Comparison complete: ${_state.aggregationResults.filter(r => !r.match).length} mismatches found`, 'success');
    const main = document.getElementById('main-content');
    if (main) renderValidationView(main);
  });
  container.appendChild(runBtn);

  // Results
  if (_state.aggregationResults.length > 0) {
    container.appendChild(_renderComparisonResults());
  }

  // Missing records
  if (_state.missingRecords.onlyInA?.length > 0 || _state.missingRecords.onlyInB?.length > 0) {
    container.appendChild(_renderMissingRecords());
  }

  // Navigation
  const actions = html`<div style="margin-top: 20px; display: flex; justify-content: space-between;"></div>`;
  const backBtn = html`<button class="btn"><i class="ph ph-arrow-left"></i> Back</button>`;
  backBtn.addEventListener('click', () => { _state.phase = 2; const m = document.getElementById('main-content'); if (m) renderValidationView(m); });
  actions.appendChild(backBtn);

  if (_state.aggregationResults.length > 0) {
    const continueBtn = html`<button class="btn btn-primary"><i class="ph ph-arrow-right"></i> Continue to Interpretations</button>`;
    continueBtn.addEventListener('click', () => {
      // Record as ALT step
      if (_state.sessionId) {
        const mismatches = _state.aggregationResults.filter(r => !r.match);
        addStep({
          sessionId: _state.sessionId,
          operatorType: 'ALT',
          description: `Aggregation comparison: ${mismatches.length} of ${_state.aggregationResults.length} groups show discrepancies`,
          inputIds: [_state.dashboardSourceId, _state.rawSourceId]
        });
      }
      _state.phase = 4;
      const main = document.getElementById('main-content');
      if (main) renderValidationView(main);
    });
    actions.appendChild(continueBtn);
  }
  container.appendChild(actions);
}

function _renderComparisonResults() {
  const mismatches = _state.aggregationResults.filter(r => !r.match);
  const matches = _state.aggregationResults.filter(r => r.match);

  const section = html`
    <div style="margin-bottom: 20px;">
      <h4 style="font-size: 0.9rem; margin-bottom: 4px;">
        <i class="ph ph-arrows-left-right"></i>
        Aggregation Comparison Results
      </h4>
      <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 12px;">
        ${matches.length} matching · ${mismatches.length} mismatched
      </div>
    </div>
  `;

  if (_state.aggregationResults.length > 0) {
    const table = renderDataTable(
      _state.aggregationResults.map(r => ({
        'Group': r.group,
        'Dashboard': r.dashboardValue.toLocaleString(),
        'Re-derived': r.derivedValue.toLocaleString(),
        'Difference': r.difference !== 0 ? (r.difference > 0 ? '+' : '') + r.difference.toLocaleString() : '—',
        '% Diff': r.percentDifference !== 0 ? r.percentDifference.toFixed(1) + '%' : '—',
        'Status': r.match ? 'Match' : 'MISMATCH'
      })),
      ['Group', 'Dashboard', 'Re-derived', 'Difference', '% Diff', 'Status']
    );
    section.appendChild(table);
  }

  return section;
}

function _renderMissingRecords() {
  const section = html`
    <div style="margin-bottom: 20px;">
      <h4 style="font-size: 0.9rem; margin-bottom: 12px;">
        <i class="ph ph-warning"></i>
        Missing Records
      </h4>
    </div>
  `;

  if (_state.missingRecords.onlyInA?.length > 0) {
    section.appendChild(html`<div style="font-size: 0.85rem; margin-bottom: 8px; color: var(--meant-text);">
      <strong>${_state.missingRecords.onlyInA.length}</strong> entries in dashboard but not in raw data
    </div>`);
  }

  if (_state.missingRecords.onlyInB?.length > 0) {
    section.appendChild(html`<div style="font-size: 0.85rem; margin-bottom: 8px; color: var(--given-text);">
      <strong>${_state.missingRecords.onlyInB.length}</strong> entries in raw data but not in dashboard
    </div>`);
  }

  if (_state.missingRecords.matched) {
    section.appendChild(html`<div style="font-size: 0.85rem; color: var(--completed-border);">
      <strong>${_state.missingRecords.matched}</strong> entries matched between both
    </div>`);
  }

  return section;
}

// ============ Phase 4: Parallel Interpretations ============

function _renderPhase4Branch(container) {
  container.innerHTML = '';

  const intro = html`
    <div class="card" style="margin-bottom: 20px;">
      <div style="padding: 16px;">
        <h3 style="font-size: 0.95rem; margin-bottom: 8px;">Step 4: Parallel Interpretations</h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary);">
          The dashboard's methodology and the re-derived numbers are held in parallel
          using SUP(||). Neither is privileged until you resolve them in the next step.
        </p>
      </div>
    </div>
  `;
  container.appendChild(intro);

  // Generate summary
  const summary = generateAuditSummary({
    duplicates: _state.duplicates,
    categoryErrors: _state.categoryErrors,
    aggregationComparisons: _state.aggregationResults,
    missingRecords: _state.missingRecords
  });

  // Side-by-side comparison
  const grid = html`<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;"></div>`;

  // Dashboard interpretation
  const dashCard = html`
    <div class="card" style="border-left: 3px solid var(--meant-border);">
      <div style="padding: 16px;">
        <h4 style="font-size: 0.9rem; color: var(--meant-text); margin-bottom: 12px;">
          <i class="ph ph-chart-bar"></i> Dashboard's Methodology
        </h4>
        <ul style="font-size: 0.85rem; color: var(--text-secondary); list-style: disc; padding-left: 20px; line-height: 1.8;">
          <li>Published aggregations as-is</li>
          <li>Location-based weighting system</li>
          <li>Treats all donor types equally</li>
          <li>Grade/score assignment methodology</li>
        </ul>
      </div>
    </div>
  `;
  grid.appendChild(dashCard);

  // Re-derived interpretation
  const rawCard = html`
    <div class="card" style="border-left: 3px solid var(--given-border);">
      <div style="padding: 16px;">
        <h4 style="font-size: 0.9rem; color: var(--given-text); margin-bottom: 12px;">
          <i class="ph ph-database"></i> Re-derived from Raw Data
        </h4>
        <ul style="font-size: 0.85rem; color: var(--text-secondary); list-style: disc; padding-left: 20px; line-height: 1.8;">
          <li>${summary.reliability.duplicateEntities} potential duplicate entities found</li>
          <li>${summary.reliability.categoryErrors} category coding errors</li>
          <li>${summary.validity.aggregationMismatches} aggregation mismatches</li>
          <li>${summary.validity.missingFromDashboard + summary.validity.missingFromSource} unmatched records</li>
        </ul>
      </div>
    </div>
  `;
  grid.appendChild(rawCard);
  container.appendChild(grid);

  // Summary stats
  const statsCard = html`
    <div class="card" style="padding: 16px; margin-bottom: 20px;">
      <h4 style="font-size: 0.9rem; margin-bottom: 12px;">Audit Summary</h4>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; text-align: center;">
        <div style="background: var(--bg-elevated); padding: 12px; border-radius: 6px;">
          <div style="font-size: 1.5rem; font-weight: 600; color: var(--accent);">${summary.totalFindings}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Total Findings</div>
        </div>
        <div style="background: var(--failed-bg); padding: 12px; border-radius: 6px;">
          <div style="font-size: 1.5rem; font-weight: 600; color: var(--failed-border);">${summary.reliability.bySeverity.error}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Errors</div>
        </div>
        <div style="background: var(--stale-bg); padding: 12px; border-radius: 6px;">
          <div style="font-size: 1.5rem; font-weight: 600; color: var(--stale-border);">${summary.reliability.bySeverity.warning}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Warnings</div>
        </div>
        <div style="background: var(--completed-bg); padding: 12px; border-radius: 6px;">
          <div style="font-size: 1.5rem; font-weight: 600; color: var(--completed-border);">${summary.validity.matchedRecords}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Matched</div>
        </div>
      </div>
    </div>
  `;
  container.appendChild(statsCard);

  // Navigation
  const actions = html`<div style="margin-top: 20px; display: flex; justify-content: space-between;"></div>`;
  const backBtn = html`<button class="btn"><i class="ph ph-arrow-left"></i> Back</button>`;
  backBtn.addEventListener('click', () => { _state.phase = 3; const m = document.getElementById('main-content'); if (m) renderValidationView(m); });
  actions.appendChild(backBtn);

  const continueBtn = html`<button class="btn btn-primary"><i class="ph ph-arrow-right"></i> Continue to Document Findings</button>`;
  continueBtn.addEventListener('click', () => {
    // Record SUP step
    if (_state.sessionId) {
      const { stepId } = addStep({
        sessionId: _state.sessionId,
        operatorType: 'SUP',
        description: 'Hold dashboard methodology and re-derived analysis in parallel',
        inputIds: [_state.dashboardSourceId, _state.rawSourceId]
      });
      _state.supStepId = stepId;
    }
    _state.phase = 5;
    const main = document.getElementById('main-content');
    if (main) renderValidationView(main);
  });
  actions.appendChild(continueBtn);
  container.appendChild(actions);
}

// ============ Phase 5: Document Findings ============

function _renderPhase5Document(container) {
  container.innerHTML = '';

  const intro = html`
    <div class="card" style="margin-bottom: 20px;">
      <div style="padding: 16px;">
        <h3 style="font-size: 0.95rem; margin-bottom: 8px;">Step 5: Document Findings</h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary);">
          Write your assessment for each category of findings. Select a resolution reason
          from the controlled vocabulary. This creates REC(recur) steps that resolve the
          parallel interpretations.
        </p>
      </div>
    </div>
  `;
  container.appendChild(intro);

  // Reliability assessment
  const reliabilitySection = html`
    <div class="card" style="padding: 16px; margin-bottom: 16px; border-left: 3px solid var(--failed-border);">
      <h4 style="font-size: 0.9rem; margin-bottom: 12px;">Reliability Assessment</h4>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px;">
        Document issues with data reliability: duplicate entities, coding errors, missing data.
      </p>
      <textarea class="form-textarea" id="reliability-assessment" rows="4"
        placeholder="Describe the reliability issues found. E.g.: 'Multiple donor name variations (Tom Cash, Thomas Cash, T. Cash) inflate the apparent number of unique donors. Business entities are miscoded as individuals. These reliability issues mean the dashboard's donor counts and location-based grades cannot be trusted.'"
        style="width: 100%; font-size: 0.85rem;">${_state.reliabilityText || ''}</textarea>
    </div>
  `;
  container.appendChild(reliabilitySection);

  // Validity assessment
  const validitySection = html`
    <div class="card" style="padding: 16px; margin-bottom: 16px; border-left: 3px solid var(--meant-border);">
      <h4 style="font-size: 0.9rem; margin-bottom: 12px;">Validity Assessment</h4>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px;">
        Document issues with the dashboard's methodology and validity of its conclusions.
      </p>
      <textarea class="form-textarea" id="validity-assessment" rows="4"
        placeholder="Describe the validity issues found. E.g.: 'The location-based weighting system is an arbitrary metric not grounded in political science methodology. Treating institutional giving (PACs) the same as small-dollar individual donations obscures the actual funding picture.'"
        style="width: 100%; font-size: 0.85rem;">${_state.validityText || ''}</textarea>
    </div>
  `;
  container.appendChild(validitySection);

  // Resolution reason
  const resolutionSection = html`
    <div class="card" style="padding: 16px; margin-bottom: 16px;">
      <h4 style="font-size: 0.9rem; margin-bottom: 12px;">Resolution Reason</h4>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px;">
        Why should the re-derived analysis be preferred over the dashboard's methodology?
      </p>
      <select class="form-select" id="resolution-reason" style="font-size: 0.85rem;">
        <option value="data_quality">Data Quality — Raw source data has fewer errors</option>
        <option value="methodological_preference">Methodological Preference — Better analytical approach</option>
        <option value="empirical_superiority">Empirical Superiority — Results are more accurate</option>
        <option value="scope_alignment">Scope Alignment — Better fits the question being asked</option>
      </select>
    </div>
  `;
  container.appendChild(resolutionSection);

  // Navigation
  const actions = html`<div style="margin-top: 20px; display: flex; justify-content: space-between;"></div>`;
  const backBtn = html`<button class="btn"><i class="ph ph-arrow-left"></i> Back</button>`;
  backBtn.addEventListener('click', () => { _state.phase = 4; const m = document.getElementById('main-content'); if (m) renderValidationView(m); });
  actions.appendChild(backBtn);

  const continueBtn = html`<button class="btn btn-primary"><i class="ph ph-arrow-right"></i> Finalize & Export</button>`;
  continueBtn.addEventListener('click', () => {
    // Save text
    _state.reliabilityText = document.getElementById('reliability-assessment').value;
    _state.validityText = document.getElementById('validity-assessment').value;
    _state.resolutionReason = document.getElementById('resolution-reason').value;

    // Create REC step
    if (_state.sessionId) {
      addStep({
        sessionId: _state.sessionId,
        operatorType: 'REC',
        description: `Resolution: ${_state.resolutionReason}. Reliability: ${_state.reliabilityText?.substring(0, 100) || '(none)'}... Validity: ${_state.validityText?.substring(0, 100) || '(none)'}...`
      });
    }

    // Generate findings
    const dupFindings = generateFindings(
      _state.duplicates.map(d => ({ ...d, severity: 'warning' })),
      'reliability', 'Duplicate Entities'
    );
    const catFindings = generateFindings(
      _state.categoryErrors,
      'reliability', 'Category Errors'
    );
    const aggFindings = generateFindings(
      _state.aggregationResults.filter(r => !r.match).map(r => ({
        ...r, severity: 'error', message: `Aggregation mismatch for "${r.group}"`
      })),
      'validity', 'Aggregation Discrepancies'
    );
    _state.findings = [...dupFindings, ...catFindings, ...aggFindings];

    _state.phase = 6;
    const main = document.getElementById('main-content');
    if (main) renderValidationView(main);
  });
  actions.appendChild(continueBtn);
  container.appendChild(actions);
}

// ============ Phase 6: Export ============

function _renderPhase6Export(container) {
  container.innerHTML = '';

  const summary = generateAuditSummary({
    duplicates: _state.duplicates,
    categoryErrors: _state.categoryErrors,
    aggregationComparisons: _state.aggregationResults,
    missingRecords: _state.missingRecords
  });

  const intro = html`
    <div class="card" style="margin-bottom: 20px; border-left: 3px solid var(--completed-border);">
      <div style="padding: 16px;">
        <h3 style="font-size: 0.95rem; margin-bottom: 8px;">
          <i class="ph ph-check-circle" style="color: var(--completed-border);"></i>
          Audit Complete
        </h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary);">
          ${summary.totalFindings} findings across ${_state.findings.length} documented items.
          All findings are traced back to source data through the provenance chain.
        </p>
      </div>
    </div>
  `;
  container.appendChild(intro);

  // Findings summary table
  if (_state.findings.length > 0) {
    const findingsSection = html`
      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 0.9rem; margin-bottom: 12px;">All Findings</h4>
      </div>
    `;
    const table = renderDataTable(
      _state.findings.map(f => ({
        'ID': f.id,
        'Category': f.category,
        'Severity': f.severity,
        'Title': f.title,
        'Description': f.description.length > 80 ? f.description.substring(0, 80) + '...' : f.description
      })),
      ['ID', 'Category', 'Severity', 'Title', 'Description']
    );
    findingsSection.appendChild(table);
    container.appendChild(findingsSection);
  }

  // Export buttons
  const exportSection = html`
    <div style="display: flex; gap: 12px; margin-bottom: 20px;">
      <button class="btn btn-primary" id="btn-export-md">
        <i class="ph ph-file-text"></i> Export Markdown Report
      </button>
      <button class="btn" id="btn-export-json">
        <i class="ph ph-file-code"></i> Export JSON Data
      </button>
    </div>
  `;

  exportSection.querySelector('#btn-export-md').addEventListener('click', () => {
    const report = _generateMarkdownReport();
    _downloadFile('validation_audit_report.md', report, 'text/markdown');
    toast('Markdown report downloaded', 'success');
  });

  exportSection.querySelector('#btn-export-json').addEventListener('click', () => {
    const data = {
      auditTimestamp: new Date().toISOString(),
      summary,
      findings: _state.findings,
      duplicates: _state.duplicates.map(d => ({
        nameA: d.recordA?.donor_name, nameB: d.recordB?.donor_name,
        type: d.duplicateType, similarity: d.similarity
      })),
      categoryErrors: _state.categoryErrors.map(e => ({
        row: e.rowIndex, field: e.field, message: e.message, severity: e.severity
      })),
      aggregationResults: _state.aggregationResults,
      missingRecords: {
        onlyInDashboard: _state.missingRecords.onlyInA?.length || 0,
        onlyInRawData: _state.missingRecords.onlyInB?.length || 0,
        matched: _state.missingRecords.matched || 0
      },
      assessments: {
        reliability: _state.reliabilityText || '',
        validity: _state.validityText || '',
        resolutionReason: _state.resolutionReason || ''
      },
      sources: {
        dashboard: { id: _state.dashboardSourceId },
        rawData: { id: _state.rawSourceId }
      }
    };
    _downloadFile('validation_audit_data.json', JSON.stringify(data, null, 2), 'application/json');
    toast('JSON data downloaded', 'success');
  });

  container.appendChild(exportSection);

  // Note about other export formats
  container.appendChild(html`
    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 20px;">
      <i class="ph ph-info"></i>
      The full analysis session is also available in the <strong>Audit Trail</strong> and
      <strong>Export</strong> views, which include EO notation, provenance chains, and
      self-contained HTML packages.
    </div>
  `);

  // Navigation
  const actions = html`<div style="display: flex; justify-content: space-between;"></div>`;
  const backBtn = html`<button class="btn"><i class="ph ph-arrow-left"></i> Back</button>`;
  backBtn.addEventListener('click', () => { _state.phase = 5; const m = document.getElementById('main-content'); if (m) renderValidationView(m); });
  actions.appendChild(backBtn);

  const newAuditBtn = html`<button class="btn"><i class="ph ph-plus"></i> New Audit</button>`;
  newAuditBtn.addEventListener('click', () => { _resetState(); const m = document.getElementById('main-content'); if (m) renderValidationView(m); });
  actions.appendChild(newAuditBtn);
  container.appendChild(actions);
}

// ============ Report Generation ============

function _generateMarkdownReport() {
  const summary = generateAuditSummary({
    duplicates: _state.duplicates,
    categoryErrors: _state.categoryErrors,
    aggregationComparisons: _state.aggregationResults,
    missingRecords: _state.missingRecords
  });

  const dashSource = _state.dashboardSourceId ? getSource(_state.dashboardSourceId) : null;
  const rawSource = _state.rawSourceId ? getSource(_state.rawSourceId) : null;

  const sections = [];

  sections.push('# Data Validation Audit Report');
  sections.push(`Generated: ${new Date().toISOString()}`);
  sections.push('');

  // Executive Summary
  sections.push('## Executive Summary');
  sections.push('');
  sections.push(`This audit identified **${summary.totalFindings} findings** across two categories:`);
  sections.push('');
  sections.push(`- **Reliability**: ${summary.reliability.duplicateEntities} duplicate entities, ${summary.reliability.categoryErrors} coding errors`);
  sections.push(`- **Validity**: ${summary.validity.aggregationMismatches} aggregation mismatches, ${summary.validity.missingFromDashboard + summary.validity.missingFromSource} unmatched records`);
  sections.push('');

  // Data Sources
  sections.push('## Data Sources');
  sections.push('');
  if (dashSource) {
    sections.push(`### Dashboard Published Data`);
    sections.push(`- **File**: ${dashSource.filename}`);
    sections.push(`- **SHA-256**: \`${dashSource.sha256_hash}\``);
    sections.push(`- **Rows**: ${dashSource.row_count} | **Columns**: ${dashSource.column_count}`);
    sections.push(`- **Ingested**: ${dashSource.ingested_at}`);
    sections.push('');
  }
  if (rawSource) {
    sections.push(`### Raw Source Data`);
    sections.push(`- **File**: ${rawSource.filename}`);
    sections.push(`- **SHA-256**: \`${rawSource.sha256_hash}\``);
    sections.push(`- **Rows**: ${rawSource.row_count} | **Columns**: ${rawSource.column_count}`);
    sections.push(`- **Ingested**: ${rawSource.ingested_at}`);
    sections.push('');
  }

  // Reliability Findings
  sections.push('## Reliability Findings');
  sections.push('');

  if (_state.reliabilityText) {
    sections.push(`### Assessment`);
    sections.push(_state.reliabilityText);
    sections.push('');
  }

  if (_state.duplicates.length > 0) {
    sections.push('### Duplicate Entities');
    sections.push('');
    sections.push(`${_state.duplicates.length} potential duplicate entities detected:`);
    sections.push('');
    sections.push('| Name A | Name B | Type | Similarity |');
    sections.push('|--------|--------|------|------------|');
    for (const d of _state.duplicates.slice(0, 30)) {
      const nameA = d.recordA?.donor_name || d.recordA?.name || '?';
      const nameB = d.recordB?.donor_name || d.recordB?.name || '?';
      sections.push(`| ${nameA} | ${nameB} | ${d.duplicateType} | ${(d.similarity * 100).toFixed(0)}% |`);
    }
    if (_state.duplicates.length > 30) {
      sections.push(`\n*...and ${_state.duplicates.length - 30} more*`);
    }
    sections.push('');
  }

  if (_state.categoryErrors.length > 0) {
    sections.push('### Category Coding Errors');
    sections.push('');
    sections.push('| Row | Field | Issue | Severity | Donor |');
    sections.push('|-----|-------|-------|----------|-------|');
    for (const e of _state.categoryErrors.slice(0, 30)) {
      sections.push(`| ${e.rowIndex + 1} | ${e.field || '—'} | ${e.message} | ${e.severity} | ${e.row?.donor_name || '—'} |`);
    }
    if (_state.categoryErrors.length > 30) {
      sections.push(`\n*...and ${_state.categoryErrors.length - 30} more*`);
    }
    sections.push('');
  }

  // Validity Findings
  sections.push('## Validity Findings');
  sections.push('');

  if (_state.validityText) {
    sections.push('### Assessment');
    sections.push(_state.validityText);
    sections.push('');
  }

  if (_state.aggregationResults.length > 0) {
    const mismatches = _state.aggregationResults.filter(r => !r.match);
    sections.push('### Aggregation Comparison');
    sections.push('');
    sections.push(`${mismatches.length} of ${_state.aggregationResults.length} groups show discrepancies:`);
    sections.push('');
    sections.push('| Group | Dashboard | Re-derived | Difference | % Diff |');
    sections.push('|-------|-----------|------------|------------|--------|');
    for (const r of _state.aggregationResults) {
      const diff = r.difference !== 0 ? (r.difference > 0 ? '+' : '') + r.difference.toLocaleString() : '—';
      const pct = r.percentDifference !== 0 ? r.percentDifference.toFixed(1) + '%' : '—';
      const marker = r.match ? '' : ' **';
      sections.push(`| ${marker}${r.group}${marker} | ${r.dashboardValue.toLocaleString()} | ${r.derivedValue.toLocaleString()} | ${diff} | ${pct} |`);
    }
    sections.push('');
  }

  // Resolution
  if (_state.resolutionReason) {
    sections.push('## Resolution');
    sections.push('');
    sections.push(`**Reason**: ${_state.resolutionReason}`);
    sections.push('');
    sections.push('The re-derived analysis from raw source data is preferred based on the findings above.');
    sections.push('');
  }

  // Provenance
  sections.push('## Provenance');
  sections.push('');
  sections.push('This audit was conducted using Evidence Observer, following the Emergent Ontology (EO) framework.');
  sections.push('Every finding traces back to immutable source data through content-addressed SHA-256 hashes.');
  sections.push('The complete analysis session, including all intermediate steps, is available in the audit trail.');
  sections.push('');
  sections.push('---');
  sections.push('Helix ordering: NUL(∅) → SIG(⊡) → INS(△) → SEG(|) → CON(⋈) → SYN(∨) → ALT(∿) → SUP(∥) → REC(↬)');

  return sections.join('\n');
}

// ============ Helpers ============

function _detectField(row, candidates) {
  if (!row) return null;
  const keys = Object.keys(row);
  for (const c of candidates) {
    const match = keys.find(k => k.toLowerCase() === c.toLowerCase());
    if (match) return match;
  }
  return null;
}

function _downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
