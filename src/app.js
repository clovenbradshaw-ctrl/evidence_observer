/**
 * Analytical Workbench — Main Application
 * Experience Engine: G, S, M, π
 * Sidebar layout with contextual top bar.
 */

import { initDB, persistToIndexedDB } from './db.js';
import { injectStyles } from './ui/styles.js';
import { renderVaultView } from './ui/vault_view.js';
import { renderSessionView } from './ui/session_view.js';
import { renderHorizonView } from './ui/horizon_view.js';
import { renderDAGView } from './ui/dag_view.js';
import { renderAuditView } from './ui/audit_view.js';
import { renderExportView } from './ui/export_view.js';
import { renderAIView } from './ui/ai_view.js';
import { renderEOQLView } from './ui/eoql_view.js';
import { renderValidationView } from './ui/validation_view.js';
import { OPERATORS, HELIX_ORDER } from './models/operators.js';

let currentView = 'vault';

const VIEWS = {
  vault:      { label: 'Sources',         section: 'data',      icon: '\u25A1',  render: renderVaultView },
  eoql:       { label: 'EOQL',            section: 'data',      icon: '\u25B7',  render: renderEOQLView },
  validation: { label: 'Audit Dashboard', section: 'data',      icon: '\u2713',  render: renderValidationView },
  session:    { label: 'Workbook',        section: 'analysis',  icon: '\u2261',  render: renderSessionView },
  ai:         { label: 'AI Analysis',     section: 'analysis',  icon: '\u2726',  render: renderAIView },
  audit:      { label: 'Audit Trail',     section: 'analysis',  icon: '\u25D0',  render: renderAuditView },
  horizon:    { label: 'Perspectives',    section: 'more',      icon: '\u25C7',  render: renderHorizonView },
  dag:        { label: 'Lineage',         section: 'more',      icon: '\u2192',  render: renderDAGView },
  export:     { label: 'Export',           section: 'more',      icon: '\u21E5',  render: renderExportView }
};

/**
 * Initialize the application.
 */
export async function initApp() {
  injectStyles();

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="loading" style="min-height: 100vh;">
      <div class="spinner"></div>
      <div>Loading Evidence Observer</div>
    </div>
  `;

  try {
    const sqlPromise = initSqlJs({ locateFile: file => `lib/${file}` });
    const schemaResponse = await fetch('src/schema.sql');
    const schemaSQL = await schemaResponse.text();
    await initDB(sqlPromise, schemaSQL);
    renderApp();
    _initKeyboardShortcuts();
  } catch (err) {
    app.innerHTML = `
      <div class="loading" style="min-height: 100vh; color: var(--failed-border);">
        <div><i class="ph ph-warning-circle" style="font-size: 2rem;"></i></div>
        <div>Failed to initialize: ${err.message}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted); max-width: 500px; word-break: break-all;">${err.stack}</div>
      </div>
    `;
    console.error('Init failed:', err);
  }
}

/**
 * Render the full application with sidebar layout.
 */
function renderApp() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  // ── Sidebar ──
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';

  // Brand
  const brand = document.createElement('div');
  brand.className = 'sidebar-brand';
  brand.innerHTML = '<div class="diamond"></div> Evidence Observer';
  sidebar.appendChild(brand);

  // Sections
  const sections = {
    data: 'Data',
    analysis: 'Analysis',
    more: 'More'
  };

  for (const [sectionKey, sectionLabel] of Object.entries(sections)) {
    const sectionHeader = document.createElement('div');
    sectionHeader.className = 'sidebar-section';
    sectionHeader.textContent = sectionLabel;
    sidebar.appendChild(sectionHeader);

    for (const [key, view] of Object.entries(VIEWS)) {
      if (view.section !== sectionKey) continue;

      const item = document.createElement('div');
      item.className = `sidebar-item ${key === currentView ? 'active' : ''}`;
      item.dataset.view = key;
      item.innerHTML = `<span class="sidebar-icon">${view.icon}</span> ${view.label}`;
      item.addEventListener('click', () => navigateTo(key));
      sidebar.appendChild(item);
    }
  }

  // Sessions section
  const sessionsHeader = document.createElement('div');
  sessionsHeader.className = 'sidebar-section';
  sessionsHeader.textContent = 'Sessions';
  sidebar.appendChild(sessionsHeader);

  const newSessionItem = document.createElement('div');
  newSessionItem.className = 'sidebar-item';
  newSessionItem.style.color = 'var(--text-muted)';
  newSessionItem.innerHTML = '<span class="sidebar-icon">+</span> New session';
  newSessionItem.addEventListener('click', () => {
    navigateTo('session');
    // The session view handles new session creation
  });
  sidebar.appendChild(newSessionItem);

  // Spacer
  const spacer = document.createElement('div');
  spacer.className = 'sidebar-spacer';
  sidebar.appendChild(spacer);

  // Settings
  const settings = document.createElement('div');
  settings.className = 'sidebar-settings';
  settings.innerHTML = '<span>\u2699</span> Settings';
  settings.addEventListener('click', () => {
    navigateTo('ai'); // Settings are in the AI view
  });
  sidebar.appendChild(settings);

  app.appendChild(sidebar);

  // ── Main Panel ──
  const mainPanel = document.createElement('div');
  mainPanel.className = 'main-panel';

  // Top bar
  const topBar = document.createElement('div');
  topBar.className = 'top-bar';
  topBar.id = 'top-bar';

  const topBarLeft = document.createElement('div');
  topBarLeft.className = 'top-bar-left';
  topBarLeft.innerHTML = `
    <span class="top-bar-title" id="top-bar-title">${VIEWS[currentView].label}</span>
    <span class="top-bar-mode" id="top-bar-mode"></span>
  `;

  const topBarRight = document.createElement('div');
  topBarRight.className = 'top-bar-right';
  topBarRight.id = 'top-bar-right';

  topBar.appendChild(topBarLeft);
  topBar.appendChild(topBarRight);
  mainPanel.appendChild(topBar);

  // Main content area
  const main = document.createElement('main');
  main.id = 'main-content';
  mainPanel.appendChild(main);

  app.appendChild(mainPanel);

  // Render current view
  VIEWS[currentView].render(main);
}

/**
 * Navigate to a different view.
 */
function navigateTo(viewKey) {
  if (!VIEWS[viewKey]) return;
  currentView = viewKey;
  renderApp();
}

/**
 * Update the top bar title and mode text.
 * Views can call this to set contextual information.
 */
export function updateTopBar(title, mode, actions) {
  const titleEl = document.getElementById('top-bar-title');
  const modeEl = document.getElementById('top-bar-mode');
  const rightEl = document.getElementById('top-bar-right');

  if (titleEl && title) titleEl.textContent = title;
  if (modeEl && mode !== undefined) modeEl.textContent = mode;
  if (rightEl && actions) {
    rightEl.innerHTML = '';
    for (const action of actions) {
      const btn = document.createElement('button');
      btn.className = `btn ${action.primary ? 'btn-primary' : ''}`;
      btn.textContent = action.label;
      if (action.onClick) btn.addEventListener('click', action.onClick);
      rightEl.appendChild(btn);
    }
  }
}

/**
 * Initialize keyboard shortcuts.
 */
function _initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Don't intercept if user is typing in an input/textarea
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) {
      return;
    }

    // / — open operator picker (only in workbook view)
    if (e.key === '/' && currentView === 'session' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const picker = document.getElementById('op-picker-bottom');
      if (picker) picker.classList.toggle('open');
    }

    // Escape — close pickers
    if (e.key === 'Escape') {
      const picker = document.getElementById('op-picker-bottom');
      if (picker) picker.classList.remove('open');
      // Close any inline forms
      document.querySelectorAll('.inline-step-form').forEach(f => f.remove());
    }

    // Cmd/Ctrl+Enter — run focused cell
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
      if (currentView === 'session') {
        e.preventDefault();
        const focused = document.querySelector('.nb-cell.focused');
        if (focused) {
          const runBtn = focused.querySelector('[data-action="run"]');
          if (runBtn) runBtn.click();
        }
      }
    }

    // Cmd/Ctrl+Shift+Enter — run all stale
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
      if (currentView === 'session') {
        e.preventDefault();
        const runAllBtn = document.getElementById('btn-run-all-stale');
        if (runAllBtn) runAllBtn.click();
      }
    }

    // Arrow keys — navigate cells
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && currentView === 'session') {
      const cells = Array.from(document.querySelectorAll('.nb-cell'));
      if (cells.length === 0) return;
      const focused = document.querySelector('.nb-cell.focused');
      let idx = focused ? cells.indexOf(focused) : -1;
      if (e.key === 'ArrowUp') idx = Math.max(0, idx - 1);
      else idx = Math.min(cells.length - 1, idx + 1);
      cells.forEach(c => c.classList.remove('focused'));
      cells[idx].classList.add('focused');
      cells[idx].scrollIntoView({ block: 'nearest' });
      e.preventDefault();
    }
  });
}

window.navigateTo = navigateTo;
