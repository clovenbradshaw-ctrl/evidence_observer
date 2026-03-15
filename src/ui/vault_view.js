/**
 * Vault View — Given-Log Browser
 * INS(△) anchors displayed with immutable visual treatment.
 * Upload, inspect, and review Given data sources.
 */

import { getAllSources, getSource, getAnchors } from '../models/given_log.js';
import { ins_ingest, getSourceData } from '../given/service.js';
import { formatOperator, NullState, OPERATORS } from '../models/operators.js';
import { renderDataTable, renderDropzone, renderModal, html, toast } from './components.js';
import { nul_audit } from '../given/nul.js';

/**
 * Render the vault view.
 */
export function renderVaultView(container) {
  container.innerHTML = '';

  const view = html`
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
          <i class="ph ph-vault" style="color: var(--given-border); font-size: 1.3rem;"></i>
          Sources
        </h2>
        <span class="given-badge"><i class="ph ph-lock-simple" style="font-size: 0.7rem;"></i> Immutable</span>
      </div>
    </div>
  `;

  // File upload dropzone
  const dropzone = renderDropzone(async (file) => {
    try {
      toast('Ingesting file...', 'info');
      const result = await ins_ingest(file);

      if (result.status === 'duplicate') {
        toast('Duplicate — this file has already been imported', 'error');
        return;
      }

      toast(`Ingested: ${result.rowCount} rows, ${result.columnCount} columns`, 'success');

      // Show schema review modal
      _showSchemaReview(result);

      // Re-render source list
      _renderSourceList(sourceListContainer);
    } catch (err) {
      toast(`Upload failed: ${err.message}`, 'error');
      console.error(err);
    }
  });
  view.appendChild(dropzone);

  // Source list
  const sourceListContainer = document.createElement('div');
  sourceListContainer.style.marginTop = '24px';
  _renderSourceList(sourceListContainer);
  view.appendChild(sourceListContainer);

  container.appendChild(view);
}

/**
 * Render the list of Given-Log sources.
 */
function _renderSourceList(container) {
  container.innerHTML = '';

  const sources = getAllSources();

  if (sources.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="ph ph-empty" style="font-size: 3rem;"></i></div>
        <p>No data sources yet.<br>
        Upload a CSV or JSON file to begin.</p>
      </div>
    `;
    return;
  }

  const heading = html`
    <h3 style="font-size: 0.95rem; margin-bottom: 12px; color: var(--text-secondary);">
      ${sources.length} source${sources.length !== 1 ? 's' : ''} imported
    </h3>
  `;
  container.appendChild(heading);

  for (const source of sources) {
    const card = _renderSourceCard(source);
    container.appendChild(card);
  }
}

/**
 * Render a single source card.
 */
function _renderSourceCard(source) {
  const schema = source.schema_json ? JSON.parse(source.schema_json) : [];
  const provenance = source.provenance_json ? JSON.parse(source.provenance_json) : {};

  const card = html`
    <div class="card given-row" style="cursor: pointer;">
      <div class="card-header">
        <span class="op-glyph existence"><i class="ph ph-file-text" style="font-size: 1rem;"></i></span>
        <div style="flex: 1;">
          <div class="card-title">${source.filename}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">
            ${source.row_count} rows · ${source.column_count} columns
            · ${new Date(source.ingested_at).toLocaleDateString()}
          </div>
        </div>
        <span class="given-badge"><i class="ph ph-lock-simple" style="font-size: 0.65rem;"></i> Source</span>
      </div>
    </div>
  `;

  card.addEventListener('click', () => _showSourceDetail(source));
  return card;
}

/**
 * Show detailed view of a source.
 */
async function _showSourceDetail(source) {
  const content = document.createElement('div');

  // Metadata section
  const meta = html`
    <div style="margin-bottom: 16px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem;">
        <div><strong>Filename:</strong> ${source.filename}</div>
        <div><strong>Method:</strong> ${source.method || 'manual_upload'}</div>
        <div><strong>SHA-256:</strong> <code style="font-size: 0.75rem;">${source.sha256_hash}</code></div>
        <div><strong>Ingested:</strong> ${new Date(source.ingested_at).toLocaleString()}</div>
        <div><strong>Rows:</strong> ${source.row_count}</div>
        <div><strong>Columns:</strong> ${source.column_count}</div>
      </div>
      ${source.derived_from ? `<div style="margin-top: 8px; color: var(--meant-border);">Derived from: ${source.derived_from}</div>` : ''}
    </div>
  `;
  content.appendChild(meta);

  // Schema section
  const schema = source.schema_json ? JSON.parse(source.schema_json) : [];
  if (schema.length > 0) {
    const schemaSection = html`<div style="margin-bottom: 16px;"><h4 style="font-size: 0.9rem; margin-bottom: 8px;">Inferred Schema</h4></div>`;
    const schemaTable = renderDataTable(
      schema.map(s => ({
        Column: s.name,
        'Inferred Type': s.inferredType,
        Confidence: `${Math.round(s.confidence * 100)}%`,
        Override: s.override || '—',
        Justification: s.overrideJustification || '—'
      })),
      ['Column', 'Inferred Type', 'Confidence', 'Override', 'Justification']
    );
    schemaSection.appendChild(schemaTable);
    content.appendChild(schemaSection);
  }

  // NUL(∅) Audit section
  const provenance = source.provenance_json ? JSON.parse(source.provenance_json) : {};
  if (provenance.nullAudit) {
    const nullSection = html`<div style="margin-bottom: 16px;"><h4 style="font-size: 0.9rem; margin-bottom: 8px;">Null Value Audit</h4></div>`;
    const nullRows = Object.entries(provenance.nullAudit).map(([col, counts]) => ({
      Column: col,
      Populated: counts.populated,
      'Cleared': counts.CLEARED || 0,
      'Unknown': counts.UNKNOWN || 0,
      'Never Set': counts.NEVER_SET || 0
    }));
    const nullTable = renderDataTable(
      nullRows,
      ['Column', 'Populated', 'Cleared', 'Unknown', 'Never Set']
    );
    nullSection.appendChild(nullTable);
    content.appendChild(nullSection);
  }

  // Data preview
  const dataSection = html`<div><h4 style="font-size: 0.9rem; margin-bottom: 8px;">Data Preview</h4></div>`;

  try {
    const data = await getSourceData(source);
    const rows = Array.isArray(data) ? data : [];
    const previewRows = rows.slice(0, 50);
    const headers = schema.map(s => s.name);

    if (previewRows.length > 0 && headers.length > 0) {
      // Build null states map for display
      const nullStatesMap = {};
      const anchors = getAnchors(source.id);
      for (const anchor of anchors.slice(0, 50)) {
        if (anchor.null_states_json) {
          nullStatesMap[anchor.row_index] = JSON.parse(anchor.null_states_json);
        }
      }

      const table = renderDataTable(previewRows, headers, { nullStates: nullStatesMap });
      dataSection.appendChild(table);

      if (rows.length > 50) {
        const more = html`<div style="margin-top: 8px; font-size: 0.8rem; color: var(--text-muted);">Showing 50 of ${rows.length} rows</div>`;
        dataSection.appendChild(more);
      }
    }
  } catch (e) {
    dataSection.appendChild(html`<div style="color: var(--text-muted);">Failed to load data preview</div>`);
  }

  content.appendChild(dataSection);

  renderModal(source.filename, content, [
    { label: 'Close', onClick: () => {} }
  ]);
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
        Overrides are logged as provenance events — they do not modify Given data.
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
