/**
 * Workbench Styles
 * Given records get immutable visual treatment — distinct from Meant.
 */

export const STYLES = `
:root {
  --given-bg: #e8f4f8;
  --given-border: #0891b2;
  --given-text: #155e75;
  --meant-bg: #fef3c7;
  --meant-border: #d97706;
  --meant-text: #92400e;
  --stale-bg: #fef9c3;
  --stale-border: #eab308;
  --failed-bg: #fee2e2;
  --failed-border: #dc2626;
  --completed-bg: #dcfce7;
  --completed-border: #16a34a;
  --sup-bg: #f3e8ff;
  --sup-border: #9333ea;
  --bg: #0f172a;
  --bg-surface: #1e293b;
  --bg-elevated: #334155;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --accent: #38bdf8;
  --accent-hover: #7dd3fc;
  --border: #475569;
  --border-subtle: #334155;
  --glyph-size: 1.4em;
  --radius: 8px;
  --shadow: 0 4px 6px -1px rgba(0,0,0,0.3);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'IBM Plex Mono', 'SF Mono', 'Fira Code', monospace;
  background: var(--bg);
  color: var(--text-primary);
  line-height: 1.6;
  min-height: 100vh;
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
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

header h1 .glyph {
  font-size: var(--glyph-size);
  color: var(--accent);
}

nav {
  display: flex;
  gap: 4px;
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
  transition: all 0.15s;
}

nav button:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

nav button.active {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(56, 189, 248, 0.1);
}

main {
  flex: 1;
  padding: 24px;
  max-width: 1400px;
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
  border: 1px solid var(--given-border);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 0.75rem;
  font-weight: 600;
}

.given-badge::before {
  content: '🔒';
  font-size: 0.7em;
}

.given-row {
  background: rgba(8, 145, 178, 0.05);
  border-left: 3px solid var(--given-border);
}

/* ============ Meant (Derived) ============ */

.meant-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--meant-bg);
  color: var(--meant-text);
  border: 1px solid var(--meant-border);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 0.75rem;
  font-weight: 600;
}

/* ============ Operator Glyphs ============ */

.op-glyph {
  font-size: var(--glyph-size);
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-elevated);
  border: 2px solid var(--border);
}

.op-glyph.existence { border-color: var(--given-border); color: var(--given-border); }
.op-glyph.structure  { border-color: var(--completed-border); color: var(--completed-border); }
.op-glyph.significance { border-color: var(--meant-border); color: var(--meant-border); }

/* ============ Null State Indicators ============ */

.null-cleared  { color: #f59e0b; font-style: italic; }
.null-unknown  { color: #8b5cf6; font-style: italic; }
.null-neverset { color: #6b7280; font-style: italic; }

.null-cleared::before  { content: '∅'; margin-right: 2px; }
.null-unknown::before  { content: '∅'; margin-right: 2px; }
.null-neverset::before { content: '∅'; margin-right: 2px; }

/* ============ Cards ============ */

.card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: var(--shadow);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.card-title {
  font-size: 0.95rem;
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
  border-bottom: 2px solid var(--border);
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
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
  background: rgba(56, 189, 248, 0.05);
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
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.btn:hover {
  background: var(--border);
}

.btn-primary {
  background: var(--accent);
  color: var(--bg);
  border-color: var(--accent);
}

.btn-primary:hover {
  background: var(--accent-hover);
}

.btn-sm {
  padding: 4px 10px;
  font-size: 0.8rem;
}

/* ============ File Upload ============ */

.dropzone {
  border: 2px dashed var(--border);
  border-radius: var(--radius);
  padding: 40px;
  text-align: center;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.dropzone:hover, .dropzone.drag-over {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(56, 189, 248, 0.05);
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
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
  max-width: 800px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: var(--shadow);
}

.modal-title {
  font-size: 1.1rem;
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
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-input, .form-select, .form-textarea {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 0.9rem;
}

.form-input:focus, .form-select:focus, .form-textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
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
  font-family: inherit;
  background: var(--bg);
  border: 1px solid var(--border-subtle);
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
  transition: border-color 0.15s;
}

.step-card:hover {
  border-color: var(--accent);
}

.step-card.stale {
  border-color: var(--stale-border);
  background: rgba(234, 179, 8, 0.05);
}

.step-card.sup-unresolved {
  border-color: var(--sup-border);
  background: rgba(147, 51, 234, 0.05);
}

/* ============ Code Editor ============ */

.code-editor {
  font-family: inherit;
  background: var(--bg);
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
}

.helix-step {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  background: var(--bg-elevated);
  color: var(--text-muted);
}

.helix-step.active {
  background: var(--accent);
  color: var(--bg);
  font-weight: 600;
}

.helix-arrow {
  color: var(--text-muted);
  font-size: 0.7rem;
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
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
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

.empty-state .glyph {
  font-size: 3rem;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  max-width: 400px;
  margin: 0 auto;
  line-height: 1.8;
}
`;

/**
 * Inject styles into the document.
 */
export function injectStyles() {
  const style = document.createElement('style');
  style.textContent = STYLES;
  document.head.appendChild(style);
}
