/**
 * Workbench Styles
 * Light, clean aesthetic with Phosphor icon integration.
 * Given records get immutable visual treatment — distinct from Meant.
 */

export const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --given-bg: #eff8ff;
  --given-border: #3b82f6;
  --given-text: #1e40af;
  --meant-bg: #fffbeb;
  --meant-border: #f59e0b;
  --meant-text: #92400e;
  --stale-bg: #fefce8;
  --stale-border: #eab308;
  --failed-bg: #fef2f2;
  --failed-border: #ef4444;
  --completed-bg: #f0fdf4;
  --completed-border: #22c55e;
  --sup-bg: #faf5ff;
  --sup-border: #a855f7;
  --bg: #f8fafc;
  --bg-surface: #ffffff;
  --bg-elevated: #f1f5f9;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --accent: #3b82f6;
  --accent-hover: #2563eb;
  --border: #e2e8f0;
  --border-subtle: #f1f5f9;
  --glyph-size: 1.2em;
  --radius: 8px;
  --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text-primary);
  line-height: 1.6;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

code, .code-editor, .notation {
  font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
}

/* ============ Layout ============ */

#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

header {
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

header h1 {
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
}

header h1 .glyph {
  font-size: 1.3rem;
  color: var(--accent);
}

header h1 .header-icon {
  color: var(--accent);
  display: flex;
  align-items: center;
}

nav {
  display: flex;
  gap: 2px;
}

nav button {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary);
  padding: 6px 14px;
  border-radius: var(--radius);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

nav button:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

nav button.active {
  color: var(--accent);
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.2);
}

nav button i {
  font-size: 1.1rem;
  display: flex;
  align-items: center;
}

main {
  flex: 1;
  padding: 24px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
}

/* ============ Given (Immutable) ============ */

.given-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--given-bg);
  color: var(--given-text);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 6px;
  padding: 3px 10px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.given-row {
  background: var(--bg-surface);
  border-left: 3px solid var(--given-border);
}

/* ============ Meant (Derived) ============ */

.meant-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--meant-bg);
  color: var(--meant-text);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 6px;
  padding: 3px 10px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* ============ Operator Glyphs ============ */

.op-glyph {
  font-size: var(--glyph-size);
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
}

.op-glyph.existence { color: var(--given-border); background: var(--given-bg); border-color: rgba(59,130,246,0.15); }
.op-glyph.structure  { color: var(--completed-border); background: var(--completed-bg); border-color: rgba(34,197,94,0.15); }
.op-glyph.significance { color: var(--meant-border); background: var(--meant-bg); border-color: rgba(245,158,11,0.15); }

/* ============ Null State Indicators ============ */

.null-cleared  { color: #d97706; font-style: italic; }
.null-unknown  { color: #7c3aed; font-style: italic; }
.null-neverset { color: #94a3b8; font-style: italic; }

.null-cleared::before  { content: '\\2205'; margin-right: 3px; font-size: 0.8em; }
.null-unknown::before  { content: '\\2205'; margin-right: 3px; font-size: 0.8em; }
.null-neverset::before { content: '\\2205'; margin-right: 3px; font-size: 0.8em; }

/* ============ Cards ============ */

.card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: var(--shadow);
  transition: box-shadow 0.15s, border-color 0.15s;
}

.card:hover {
  box-shadow: var(--shadow-md);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.card-title {
  font-size: 0.9rem;
  font-weight: 600;
}

/* ============ Data Tables ============ */

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.data-table th {
  background: var(--bg-elevated);
  color: var(--text-secondary);
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  user-select: none;
}

.data-table th:hover {
  color: var(--text-primary);
}

.data-table td {
  padding: 6px 12px;
  border-bottom: 1px solid var(--border-subtle);
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.data-table tr:hover td {
  background: rgba(59, 130, 246, 0.03);
}

/* ============ Buttons ============ */

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius);
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-primary);
}

.btn:hover {
  background: var(--bg-elevated);
  border-color: #cbd5e1;
}

.btn-primary {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.btn-primary:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.btn-sm {
  padding: 4px 10px;
  font-size: 0.8rem;
}

/* ============ File Upload ============ */

.dropzone {
  border: 2px dashed var(--border);
  border-radius: 12px;
  padding: 48px 40px;
  text-align: center;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
  background: var(--bg-surface);
}

.dropzone:hover, .dropzone.drag-over {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(59, 130, 246, 0.03);
}

.dropzone .drop-icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 12px;
  color: var(--text-muted);
  line-height: 1;
}

.dropzone:hover .drop-icon,
.dropzone.drag-over .drop-icon {
  color: var(--accent);
}

.dropzone .glyph {
  font-size: 2rem;
  display: block;
  margin-bottom: 8px;
}

/* ============ Modal ============ */

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  max-width: 800px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
}

.modal-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ============ Form Elements ============ */

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 4px;
  font-weight: 500;
}

.form-input, .form-select, .form-textarea {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 0.9rem;
}

.form-input:focus, .form-select:focus, .form-textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  min-height: 120px;
  resize: vertical;
}

/* ============ Status Indicators ============ */

.status-pending   { color: var(--text-muted); }
.status-running   { color: var(--accent); }
.status-completed { color: var(--completed-border); }
.status-failed    { color: var(--failed-border); }
.status-stale     { color: var(--stale-border); }

/* ============ Notation Display ============ */

.notation {
  font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
  font-size: 0.85rem;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-x: auto;
}

.notation .op { color: var(--accent); font-weight: 600; }
.notation .given-ref { color: var(--given-border); }
.notation .arrow { color: var(--text-muted); }
.notation .conformance { color: var(--completed-border); font-size: 0.8rem; }

/* ============ Step Cards ============ */

.step-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 8px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.step-card:hover {
  border-color: #cbd5e1;
  box-shadow: var(--shadow);
}

.step-card.stale {
  border-color: var(--stale-border);
  background: var(--stale-bg);
}

.step-card.sup-unresolved {
  border-color: var(--sup-border);
  background: var(--sup-bg);
}

/* ============ Code Editor ============ */

.code-editor {
  font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
  width: 100%;
  min-height: 200px;
  resize: vertical;
  tab-size: 4;
  line-height: 1.5;
  font-size: 0.85rem;
}

/* ============ Helix Ordering ============ */

.helix-bar {
  display: flex;
  gap: 4px;
  padding: 8px 0;
  align-items: center;
}

.helix-step {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 500;
  background: var(--bg-elevated);
  color: var(--text-muted);
  border: 1px solid transparent;
}

.helix-step.active {
  background: var(--accent);
  color: white;
  font-weight: 600;
}

.helix-arrow {
  color: var(--text-muted);
  font-size: 0.65rem;
}

/* ============ Loading ============ */

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--text-muted);
  gap: 12px;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ============ Tabs ============ */

.tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}

.tab {
  padding: 8px 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.tab:hover { color: var(--text-primary); }
.tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

/* ============ Empty State ============ */

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);
}

.empty-state .empty-icon {
  font-size: 3rem;
  margin-bottom: 16px;
  opacity: 0.4;
  color: var(--text-muted);
  line-height: 1;
}

.empty-state .glyph {
  font-size: 3rem;
  margin-bottom: 16px;
  opacity: 0.4;
}

.empty-state p {
  max-width: 400px;
  margin: 0 auto;
  line-height: 1.8;
}

/* ============ AI Analysis ============ */

.ai-module-desc {
  background: var(--bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  padding: 12px;
  margin-bottom: 16px;
  min-height: 40px;
}

.ai-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px;
  color: var(--text-muted);
}

.ai-result-card {
  border-color: var(--accent);
  background: linear-gradient(135deg, var(--bg-surface) 0%, rgba(59, 130, 246, 0.03) 100%);
}

.ai-json-result {
  margin-top: 12px;
  padding: 12px;
  background: var(--bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  font-size: 0.85rem;
  max-height: 500px;
  overflow-y: auto;
}

.ai-json-row {
  display: flex;
  gap: 8px;
  padding: 2px 0;
  line-height: 1.5;
}

.ai-json-key {
  color: var(--accent);
  font-weight: 600;
  flex-shrink: 0;
}

.ai-json-value {
  color: var(--text-secondary);
}

.ai-json-item {
  border-left: 2px solid var(--border-subtle);
  padding: 8px 0 8px 12px;
  margin: 4px 0;
}

.ai-json-item:hover {
  border-left-color: var(--accent);
}

.ai-custom-badge {
  display: inline-flex;
  align-items: center;
  background: rgba(59, 130, 246, 0.1);
  color: var(--accent);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ai-builtin-badge {
  display: inline-flex;
  align-items: center;
  background: rgba(100, 116, 139, 0.1);
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
}

/* ============ Toast ============ */

.toast {
  font-family: inherit;
}

/* ============ Phosphor Icon Helpers ============ */

.ph-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
`;

/**
 * Inject styles into the document.
 */
export function injectStyles() {
  // Inject Phosphor Icons
  const phosphorLink = document.createElement('link');
  phosphorLink.rel = 'stylesheet';
  phosphorLink.href = 'https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css';
  document.head.appendChild(phosphorLink);

  // Also load bold weight
  const phosphorBoldLink = document.createElement('link');
  phosphorBoldLink.rel = 'stylesheet';
  phosphorBoldLink.href = 'https://unpkg.com/@phosphor-icons/web@2.1.1/src/bold/style.css';
  document.head.appendChild(phosphorBoldLink);

  const style = document.createElement('style');
  style.textContent = STYLES;
  document.head.appendChild(style);
}
