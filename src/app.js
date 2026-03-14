/**
 * Analytical Workbench — Main Application
 * Experience Engine: 𝓔 = (G, S, M, π, γ, σ)
 *
 * G = Given-Log (vault)     — Existence Domain
 * S = Horizon-Lattice (lens) — Structure Domain
 * M = Meant-Graph (runtime)  — Significance Domain
 * π = Provenance function
 * γ = Availability function
 * σ = Supersession function
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
import { OPERATORS, HELIX_ORDER, formatOperator } from './models/operators.js';

// Track current view
let currentView = 'vault';

// Views registry
const VIEWS = {
  vault:    { label: 'Given-Log (G)', glyph: '△', render: renderVaultView },
  session:  { label: 'Meant-Graph (M)', glyph: '∿', render: renderSessionView },
  horizon:  { label: 'Horizon (S)', glyph: '⋈', render: renderHorizonView },
  ai:       { label: 'AI Analysis', glyph: '⊡', render: renderAIView },
  dag:      { label: 'DAG', glyph: '↬', render: renderDAGView },
  audit:    { label: 'Provenance (π)', glyph: 'π', render: renderAuditView },
  export:   { label: 'Export', glyph: '⊡', render: renderExportView }
};

/**
 * Initialize the application.
 */
export async function initApp() {
  // Inject styles
  injectStyles();

  // Show loading state
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="loading" style="min-height: 100vh;">
      <div class="spinner"></div>
      <div>Initializing Experience Engine 𝓔 = (G, S, M, π, γ, σ)</div>
    </div>
  `;

  try {
    // Load sql.js
    const sqlPromise = initSqlJs({ locateFile: file => `lib/${file}` });

    // Load schema
    const schemaResponse = await fetch('src/schema.sql');
    const schemaSQL = await schemaResponse.text();

    // Initialize database
    await initDB(sqlPromise, schemaSQL);

    // Render the app
    renderApp();

  } catch (err) {
    app.innerHTML = `
      <div class="loading" style="min-height: 100vh; color: var(--failed-border);">
        <div style="font-size: 2rem;">∅</div>
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
      <span class="glyph">𝓔</span>
      Evidence Observer
    </h1>
  `;

  // Navigation
  const nav = document.createElement('nav');
  for (const [key, view] of Object.entries(VIEWS)) {
    const btn = document.createElement('button');
    btn.textContent = `${view.glyph} ${view.label}`;
    btn.className = key === currentView ? 'active' : '';
    btn.addEventListener('click', () => navigateTo(key));
    nav.appendChild(btn);
  }
  header.appendChild(nav);
  app.appendChild(header);

  // Helix bar
  const helixContainer = document.createElement('div');
  helixContainer.style.cssText = 'padding: 4px 24px; background: var(--bg-surface); border-bottom: 1px solid var(--border-subtle);';
  const helixBar = document.createElement('div');
  helixBar.className = 'helix-bar';
  helixBar.style.justifyContent = 'center';
  for (let i = 0; i < HELIX_ORDER.length; i++) {
    const code = HELIX_ORDER[i];
    const op = OPERATORS[code];
    if (i > 0) {
      const arrow = document.createElement('span');
      arrow.className = 'helix-arrow';
      arrow.textContent = '→';
      helixBar.appendChild(arrow);
    }
    const step = document.createElement('span');
    step.className = 'helix-step';
    step.innerHTML = `${op.glyph} ${code}`;
    step.title = `${op.verb} — ${op.description}`;
    helixBar.appendChild(step);
  }
  helixContainer.appendChild(helixBar);
  app.appendChild(helixContainer);

  // Main content area
  const main = document.createElement('main');
  main.id = 'main-content';
  app.appendChild(main);

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

// Make navigateTo available globally for dynamic use
window.navigateTo = navigateTo;
