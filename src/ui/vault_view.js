/**
 * Vault View — Given-Log Browser
 * Two-panel Airtable-style layout with inline schema/null/preview tabs.
 * INS(△) anchors displayed with immutable visual treatment.
 */

import { getAllSources, getSource, getAnchors } from '../models/given_log.js';
import { ins_ingest, getSourceData } from '../given/service.js';
import { formatOperator, NullState, OPERATORS } from '../models/operators.js';
import { renderDataTable, renderMiniTable, renderDropzone, renderModal, html, toast } from './components.js';
import { updateTopBar } from '../app.js';
import { nul_audit } from '../given/nul.js';

let _selectedSourceId = null;

/**
 * Render the vault view.
 */
export function renderVaultView(container) {
  container.innerHTML = '';

  const sources = getAllSources();

  updateTopBar('Data Sources', `${sources.length} source${sources.length !== 1 ? 's' : ''} imported`);

  // Two-panel layout
  const layout = document.createElement('div');
  layout.className = 'sources-layout';

  // ── Left panel: dropzone + source grid ──
  const left = document.createElement('div');
  left.className = 'sources-left';

  // Compact dropzone
  const dropzone = renderDropzone(async (file) => {
    try {
      toast('Ingesting file...', 'info');
      const result = await ins_ingest(file);

      if (result.status === 'duplicate') {
        toast('Duplicate \u2014 this file has already been imported', 'error');
        return;
      }

      toast(`Ingested: ${result.rowCount} rows, ${result.columnCount} columns`, 'success');
      _showSchemaReview(result);
      renderVaultView(container);
    } catch (err) {
      toast(`Upload failed: ${err.message}`, 'error');
      console.error(err);
    }
  }, true);
  left.appendChild(dropzone);

  if (sources.length === 0) {
    const empty = html`
      <div class="empty-state" style="padding: 40px 20px;">
        <div class="empty-icon"><i class="ph ph-file-arrow-up" style="font-size: 3rem;"></i></div>
        <p>No data sources yet.<br>Upload a CSV or JSON file to begin.</p>
      </div>
    `;
    left.appendChild(empty);
  } else {
    // Source grid (2 columns)
    const grid = document.createElement('div');
    grid.className = 'source-grid';

    // Auto-select first source if none selected
    if (!_selectedSourceId && sources.length > 0) {
      _selectedSourceId = sources[0].id;
    }

    for (const source of sources) {
      const card = _renderSourceCard(source);
      grid.appendChild(card);
    }

    left.appendChild(grid);
  }

  layout.appendChild(left);

  // ── Right panel: schema viewer ──
  const right = document.createElement('div');
  right.className = 'sources-right';
  right.id = 'schema-panel';

  if (_selectedSourceId) {
    const selectedSource = sources.find(s => s.id === _selectedSourceId) || sources[0];
    if (selectedSource) {
      _renderSchemaPanel(right, selectedSource);
    }
  } else if (sources.length > 0) {
    _renderSchemaPanel(right, sources[0]);
  } else {
    right.innerHTML = '<div style="padding: 24px; color: var(--text-muted); text-align: center; font-size: 0.85rem;">Import a source to see its schema</div>';
  }

  layout.appendChild(right);
  container.appendChild(layout);
}

/**
 * Render a source card in the grid.
 */
function _renderSourceCard(source) {
  const card = document.createElement('div');
  card.className = `source-card ${source.id === _selectedSourceId ? 'selected' : ''}`;

  const name = document.createElement('div');
  name.className = 'source-name';
  name.textContent = source.filename;

  const meta = document.createElement('div');
  meta.className = 'source-meta';

  const rowCol = document.createElement('span');
  rowCol.textContent = `${source.row_count} rows \u00b7 ${source.column_count} columns`;
  meta.appendChild(rowCol);

  const date = document.createElement('span');
  date.textContent = `Ingested ${new Date(source.ingested_at).toLocaleDateString()}`;
  meta.appendChild(date);

  if (source.sha256_hash) {
    const sha = document.createElement('span');
    sha.style.cssText = "font-family: 'JetBrains Mono', monospace; font-size: 0.68rem;";
    sha.textContent = `SHA-256: ${source.sha256_hash.substring(0, 8)}\u2026`;
    meta.appendChild(sha);
  }

  card.appendChild(name);
  card.appendChild(meta);

  card.addEventListener('click', () => {
    _selectedSourceId = source.id;
    // Update selection UI
    document.querySelectorAll('.source-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    // Update schema panel
    const panel = document.getElementById('schema-panel');
    if (panel) _renderSchemaPanel(panel, source);
  });

  return card;
}

/**
 * Render the schema panel with tabs: Schema, Nulls, Preview.
 */
function _renderSchemaPanel(panel, source) {
  panel.innerHTML = '';

  const schema = source.schema_json ? JSON.parse(source.schema_json) : [];
  const provenance = source.provenance_json ? JSON.parse(source.provenance_json) : {};

  let activeTab = 'schema';

  // Tabs
  const tabBar = document.createElement('div');
  tabBar.className = 'schema-tabs';

  const tabs = ['Schema', 'Nulls', 'Preview'];
  for (const tabName of tabs) {
    const btn = document.createElement('button');
    btn.className = `schema-tab ${tabName.toLowerCase() === activeTab ? 'active' : ''}`;
    btn.textContent = tabName;
    btn.addEventListener('click', () => {
      activeTab = tabName.toLowerCase();
      tabBar.querySelectorAll('.schema-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      _renderTabContent(contentDiv, source, schema, provenance, activeTab);
    });
    tabBar.appendChild(btn);
  }
  panel.appendChild(tabBar);

  // Content
  const contentDiv = document.createElement('div');
  contentDiv.className = 'schema-content';
  _renderTabContent(contentDiv, source, schema, provenance, activeTab);
  panel.appendChild(contentDiv);
}

function _renderTabContent(container, source, schema, provenance, tab) {
  container.innerHTML = '';

  if (tab === 'schema') {
    _renderSchemaTab(container, schema, provenance);
  } else if (tab === 'nulls') {
    _renderNullsTab(container, provenance);
  } else if (tab === 'preview') {
    _renderPreviewTab(container, source, schema);
  }
}

function _renderSchemaTab(container, schema, provenance) {
  if (schema.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted);">No schema available</div>';
    return;
  }

  const nullAudit = provenance.nullAudit || {};

  for (const field of schema) {
    const row = document.createElement('div');
    row.className = 'schema-field';

    const nameEl = document.createElement('span');
    nameEl.className = 'field-name';
    nameEl.textContent = field.name;

    const typeEl = document.createElement('span');
    typeEl.className = 'field-type';
    typeEl.textContent = field.inferredType;

    // Null percentage bar
    const audit = nullAudit[field.name];
    let nullPct = 0;
    if (audit) {
      const totalNulls = (audit.CLEARED || 0) + (audit.UNKNOWN || 0) + (audit.NEVER_SET || 0);
      const total = audit.populated + totalNulls;
      nullPct = total > 0 ? Math.round((totalNulls / total) * 100) : 0;
    }

    const barContainer = document.createElement('div');
    barContainer.className = 'null-bar';
    const bar = document.createElement('div');
    bar.className = `null-bar-fill ${nullPct <= 5 ? 'green' : nullPct <= 20 ? 'amber' : 'red'}`;
    bar.style.width = `${Math.min(nullPct, 100)}%`;
    barContainer.appendChild(bar);

    const pctEl = document.createElement('span');
    pctEl.className = 'null-pct';
    pctEl.textContent = `${nullPct}%`;

    row.appendChild(nameEl);
    row.appendChild(typeEl);
    row.appendChild(barContainer);
    row.appendChild(pctEl);
    container.appendChild(row);
  }
}

function _renderNullsTab(container, provenance) {
  const nullAudit = provenance.nullAudit;
  if (!nullAudit || Object.keys(nullAudit).length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted);">No null audit data available</div>';
    return;
  }

  const rows = Object.entries(nullAudit).map(([col, counts]) => ({
    Column: col,
    Populated: counts.populated,
    Cleared: counts.CLEARED || 0,
    Unknown: counts.UNKNOWN || 0,
    'Never Set': counts.NEVER_SET || 0
  }));

  const table = renderDataTable(rows, ['Column', 'Populated', 'Cleared', 'Unknown', 'Never Set']);
  container.appendChild(table);
}

async function _renderPreviewTab(container, source, schema) {
  container.innerHTML = '<div class="loading" style="min-height: 100px;"><div class="spinner"></div></div>';

  try {
    const data = await getSourceData(source);
    container.innerHTML = '';

    const rows = Array.isArray(data) ? data : [];
    const previewRows = rows.slice(0, 20);
    const headers = schema.map(s => s.name);

    if (previewRows.length > 0 && headers.length > 0) {
      const table = renderMiniTable(previewRows, headers, 20);
      container.appendChild(table);

      if (rows.length > 20) {
        const more = document.createElement('div');
        more.style.cssText = 'font-size: 0.78rem; color: var(--text-muted); padding: 6px 0;';
        more.textContent = `Showing 20 of ${rows.length} rows`;
        container.appendChild(more);
      }
    } else {
      container.innerHTML = '<div style="color: var(--text-muted);">No data to preview</div>';
    }
  } catch (e) {
    container.innerHTML = '<div style="color: var(--text-muted);">Failed to load data preview</div>';
  }
}

/**
 * Show schema review modal after ingestion.
 */
function _showSchemaReview(result) {
  const content = document.createElement('div');

  content.appendChild(html`
    <div style="margin-bottom: 16px;">
      <p style="color: var(--completed-border); margin-bottom: 8px;">
        Successfully imported ${result.rowCount} rows from ${result.filename}
      </p>
      <p style="font-size: 0.85rem; color: var(--text-secondary);">
        Review the inferred schema below. Override types if needed (e.g., FIPS codes should be strings, not numbers).
      </p>
    </div>
  `);

  const schemaTable = renderDataTable(
    result.schema.map(s => ({
      Column: s.name,
      'Inferred Type': s.inferredType,
      Confidence: `${Math.round(s.confidence * 100)}%`,
      Samples: (s.sampleValues || []).map(v => v == null ? '(null)' : String(v)).join(', ')
    })),
    ['Column', 'Inferred Type', 'Confidence', 'Samples']
  );
  content.appendChild(schemaTable);

  // Null audit summary
  const nullSummary = html`<div style="margin-top: 16px;"><h4 style="font-size: 0.9rem; margin-bottom: 8px;">Null Value Summary</h4></div>`;
  const nullCols = Object.entries(result.nullAudit)
    .filter(([_, counts]) => counts.CLEARED > 0 || counts.UNKNOWN > 0 || counts.NEVER_SET > 0);

  if (nullCols.length > 0) {
    for (const [col, counts] of nullCols) {
      const line = html`<div style="font-size: 0.85rem; margin-left: 12px; color: var(--text-secondary);">
        <strong>${col}:</strong>
        ${counts.CLEARED > 0 ? `<span class="null-cleared">${counts.CLEARED} CLEARED</span> ` : ''}
        ${counts.UNKNOWN > 0 ? `<span class="null-unknown">${counts.UNKNOWN} UNKNOWN</span> ` : ''}
        ${counts.NEVER_SET > 0 ? `<span class="null-neverset">${counts.NEVER_SET} NEVER_SET</span>` : ''}
      </div>`;
      nullSummary.appendChild(line);
    }
  } else {
    nullSummary.appendChild(html`<div style="font-size: 0.85rem; color: var(--text-muted);">No null values detected.</div>`);
  }
  content.appendChild(nullSummary);

  renderModal('Schema Review', content, [
    { label: 'Accept Schema', onClick: () => {}, primary: true }
  ]);
}
