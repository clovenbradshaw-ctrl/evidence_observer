/**
 * Analytical Workbench — Main Application
 * Experience Engine: G, S, M, π
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
import { OPERATORS, HELIX_ORDER } from './models/operators.js';

let currentView = 'vault';

const VIEWS = {
  vault:    { label: 'Sources',       icon: 'ph ph-vault',          render: renderVaultView },
  session:  { label: 'Workbook',      icon: 'ph ph-graph',          render: renderSessionView },
  horizon:  { label: 'Perspectives',  icon: 'ph ph-binoculars',     render: renderHorizonView },
  ai:       { label: 'AI Analysis',   icon: 'ph ph-sparkle',        render: renderAIView },
  dag:      { label: 'Lineage',       icon: 'ph ph-flow-arrow',     render: renderDAGView },
  audit:    { label: 'Audit Trail',   icon: 'ph ph-fingerprint',    render: renderAuditView },
  export:   { label: 'Export',         icon: 'ph ph-export',         render: renderExportView }
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
 * Render the full application.
 */
function renderApp() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  // Header
  const header = document.createElement('header');
  header.innerHTML = `
    <h1>
      <span class="header-icon"><i class="ph ph-atom" style="font-size: 1.3rem;"></i></span>
      Evidence Observer
    </h1>
  `;

  // Navigation
  const nav = document.createElement('nav');
  for (const [key, view] of Object.entries(VIEWS)) {
    const btn = document.createElement('button');
    btn.innerHTML = `<i class="${view.icon}"></i> ${view.label}`;
    btn.className = key === currentView ? 'active' : '';
    btn.addEventListener('click', () => navigateTo(key));
    nav.appendChild(btn);
  }
  header.appendChild(nav);
  app.appendChild(header);

  // Helix bar
  const helixContainer = document.createElement('div');
  helixContainer.style.cssText = 'padding: 4px 24px; background: var(--bg-surface); border-bottom: 1px solid var(--border);';
  const helixBar = document.createElement('div');
  helixBar.className = 'helix-bar';
  helixBar.style.justifyContent = 'center';
  for (let i = 0; i < HELIX_ORDER.length; i++) {
    const code = HELIX_ORDER[i];
    const op = OPERATORS[code];
    if (i > 0) {
      const arrow = document.createElement('span');
      arrow.className = 'helix-arrow';
      arrow.textContent = '·';
      helixBar.appendChild(arrow);
    }
    const step = document.createElement('span');
    step.className = 'helix-step';
    step.innerHTML = `${op.friendlyName}`;
    step.title = `${op.glyph} ${code} (${op.verb}) — ${op.description}`;
    helixBar.appendChild(step);
  }
  helixContainer.appendChild(helixBar);
  app.appendChild(helixContainer);

  // Main content area
  const main = document.createElement('main');
  main.id = 'main-content';
  app.appendChild(main);

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

window.navigateTo = navigateTo;
