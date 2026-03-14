/**
 * Shared UI Components
 * Reusable building blocks for the workbench interface.
 */

import { OPERATORS, OPERATOR_GLYPHS, formatOperator } from '../models/operators.js';

/**
 * Create an element from an HTML string.
 */
export function html(strings, ...values) {
  const template = document.createElement('template');
  template.innerHTML = String.raw(strings, ...values).trim();
  return template.content.firstElementChild || template.content;
}

/**
 * Render a data table from rows and columns.
 *
 * @param {Object[]} rows - Data rows
 * @param {string[]} columns - Column names to display
 * @param {Object} [options] - { onRowClick, nullStates, sortable }
 */
export function renderDataTable(rows, columns, options = {}) {
  const { onRowClick, nullStates, sortable = true } = options;

  const table = document.createElement('table');
  table.className = 'data-table';

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const col of columns) {
    const th = document.createElement('th');
    th.textContent = col;
    if (sortable) {
      th.addEventListener('click', () => _sortTable(table, columns.indexOf(col)));
    }
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const tr = document.createElement('tr');

    if (onRowClick) {
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', () => onRowClick(row, i));
    }

    for (const col of columns) {
      const td = document.createElement('td');
      const value = row[col];

      // Check null states
      const rowNulls = nullStates ? nullStates[i] : null;
      if (rowNulls && rowNulls[col]) {
        td.className = `null-${rowNulls[col].toLowerCase()}`;
        td.textContent = `[${rowNulls[col]}]`;
        td.title = `NUL(∅): ${rowNulls[col]}`;
      } else if (value === null || value === undefined) {
        td.className = 'null-unknown';
        td.textContent = '[UNKNOWN]';
      } else {
        td.textContent = String(value);
        td.title = String(value);
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  return table;
}

/**
 * Render a file upload dropzone.
 *
 * @param {Function} onFile - Callback receiving the File object
 * @returns {HTMLElement}
 */
export function renderDropzone(onFile) {
  const zone = html`
    <div class="dropzone">
      <span class="glyph">△</span>
      <p>INS(△) — Drop CSV or JSON file to ingest into Given-Log</p>
      <p style="font-size: 0.8rem; margin-top: 8px;">or click to browse</p>
    </div>
  `;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,.tsv,.json';
  input.style.display = 'none';

  zone.addEventListener('click', () => input.click());

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  });

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (file) onFile(file);
  });

  zone.appendChild(input);
  return zone;
}

/**
 * Render a modal dialog.
 *
 * @param {string} title - Modal title
 * @param {HTMLElement|string} content - Modal body
 * @param {Object[]} [actions] - [{label, onClick, primary}]
 * @returns {{ element: HTMLElement, close: Function }}
 */
export function renderModal(title, content, actions = []) {
  const overlay = html`<div class="modal-overlay"></div>`;
  const modal = html`<div class="modal"></div>`;

  const titleEl = html`<div class="modal-title">${title}</div>`;
  modal.appendChild(titleEl);

  if (typeof content === 'string') {
    const body = html`<div>${content}</div>`;
    modal.appendChild(body);
  } else {
    modal.appendChild(content);
  }

  if (actions.length > 0) {
    const footer = document.createElement('div');
    footer.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;';

    for (const action of actions) {
      const btn = document.createElement('button');
      btn.className = `btn ${action.primary ? 'btn-primary' : ''}`;
      btn.textContent = action.label;
      btn.addEventListener('click', () => {
        if (action.onClick) action.onClick();
        close();
      });
      footer.appendChild(btn);
    }
    modal.appendChild(footer);
  }

  overlay.appendChild(modal);

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  function close() {
    overlay.remove();
  }

  document.body.appendChild(overlay);
  return { element: overlay, close };
}

/**
 * Render an operator type selector with EO glyphs.
 *
 * @param {Function} onSelect - Callback with operator code
 * @param {string} [selected] - Currently selected operator code
 * @returns {HTMLElement}
 */
export function renderOperatorSelector(onSelect, selected = null) {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap;';

  for (const [code, op] of Object.entries(OPERATORS)) {
    const btn = document.createElement('button');
    btn.className = `btn btn-sm ${selected === code ? 'btn-primary' : ''}`;
    btn.innerHTML = `<span class="op-glyph ${op.triad.toLowerCase()}" style="width:24px;height:24px;font-size:1rem;">${op.glyph}</span> ${code}`;
    btn.title = `${op.verb} — ${op.description}`;

    btn.addEventListener('click', () => {
      container.querySelectorAll('.btn').forEach(b => b.classList.remove('btn-primary'));
      btn.classList.add('btn-primary');
      onSelect(code);
    });

    container.appendChild(btn);
  }

  return container;
}

/**
 * Render the helix ordering bar showing progress.
 *
 * @param {string} [activeOperator] - Currently active operator code
 * @returns {HTMLElement}
 */
export function renderHelixBar(activeOperator = null) {
  const bar = document.createElement('div');
  bar.className = 'helix-bar';

  const order = ['NUL', 'SIG', 'INS', 'SEG', 'CON', 'SYN', 'ALT', 'SUP', 'REC'];

  for (let i = 0; i < order.length; i++) {
    const code = order[i];
    const op = OPERATORS[code];

    if (i > 0) {
      const arrow = document.createElement('span');
      arrow.className = 'helix-arrow';
      arrow.textContent = '→';
      bar.appendChild(arrow);
    }

    const step = document.createElement('span');
    step.className = `helix-step ${activeOperator === code ? 'active' : ''}`;
    step.innerHTML = `${op.glyph} ${code}`;
    step.title = `${op.verb} — ${op.description}`;
    bar.appendChild(step);
  }

  return bar;
}

/**
 * Render a notification toast.
 */
export function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 2000;
    padding: 12px 20px; border-radius: 8px; font-size: 0.85rem;
    color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: fadeIn 0.2s ease;
    background: ${type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#0891b2'};
  `;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ============ Internal helpers ============

function _sortTable(table, colIndex) {
  const tbody = table.querySelector('tbody');
  const rows = Array.from(tbody.rows);

  const currentDir = table.dataset.sortDir === 'asc' ? 'desc' : 'asc';
  table.dataset.sortDir = currentDir;

  rows.sort((a, b) => {
    const aVal = a.cells[colIndex]?.textContent || '';
    const bVal = b.cells[colIndex]?.textContent || '';

    // Try numeric comparison
    const aNum = Number(aVal);
    const bNum = Number(bVal);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return currentDir === 'asc' ? aNum - bNum : bNum - aNum;
    }

    return currentDir === 'asc'
      ? aVal.localeCompare(bVal)
      : bVal.localeCompare(aVal);
  });

  for (const row of rows) {
    tbody.appendChild(row);
  }
}
