/**
 * Workbench Styles
 * Light, clean aesthetic with sidebar layout and notebook cells.
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
  --accent: #2563eb;
  --accent-hover: #1d4ed8;
  --border: #e2e8f0;
  --border-subtle: #f1f5f9;
  --glyph-size: 1.2em;
  --radius: 8px;
  --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05);

  /* Operator triad colors */
  --existence-bg: #eff8ff;
  --existence-text: #1e40af;
  --existence-border: rgba(59,130,246,0.15);
  --structure-bg: #f0fdf4;
  --structure-text: #166534;
  --structure-border: rgba(34,197,94,0.15);
  --significance-bg: #fffbeb;
  --significance-text: #92400e;
  --significance-border: rgba(245,158,11,0.15);
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

/* ============ Shell Layout — Sidebar + Main ============ */

#app {
  display: flex;
  flex-direction: row;
  height: 100vh;
  overflow: hidden;
}

/* ============ Sidebar ============ */

aside.sidebar {
  width: 220px;
  flex-shrink: 0;
  border-right: 0.5px solid var(--border);
  background: var(--bg-surface);
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  overflow-y: auto;
  gap: 2px;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 16px;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.sidebar-brand .diamond {
  width: 18px;
  height: 18px;
  background: var(--accent);
  transform: rotate(45deg);
  border-radius: 3px;
  flex-shrink: 0;
}

.sidebar-section {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  padding: 12px 10px 4px;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.87rem;
  font-weight: 500;
  color: var(--text-secondary);
  border: 1px solid transparent;
  transition: all 0.12s;
  user-select: none;
}

.sidebar-item:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.sidebar-item.active {
  background: var(--bg-surface);
  color: var(--text-primary);
  border-color: var(--border);
  box-shadow: var(--shadow);
}

.sidebar-icon {
  font-size: 0.85rem;
  width: 18px;
  text-align: center;
  opacity: 0.6;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.sidebar-item.active .sidebar-icon { opacity: 1; }

.sidebar-spacer { flex: 1; }

.sidebar-settings {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-top: 0.5px solid var(--border);
  margin-top: 8px;
  font-size: 0.85rem;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 6px;
}
.sidebar-settings:hover { color: var(--text-primary); background: var(--bg-elevated); }

/* ============ Main Panel ============ */

.main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.top-bar {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 0.5px solid var(--border);
  background: var(--bg-surface);
  flex-shrink: 0;
}

.top-bar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.9rem;
  min-width: 0;
}

.top-bar-title {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.top-bar-mode {
  font-size: 0.75rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.top-bar-right {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

main {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  max-width: 1000px;
  width: 100%;
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

/* ============ Operator Badges ============ */

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

.op-glyph.existence { color: var(--existence-text); background: var(--existence-bg); border-color: var(--existence-border); }
.op-glyph.structure  { color: var(--structure-text); background: var(--structure-bg); border-color: var(--structure-border); }
.op-glyph.significance { color: var(--significance-text); background: var(--significance-bg); border-color: var(--significance-border); }

.op-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 56px;
  padding: 3px 8px;
  border-radius: 5px;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.op-badge.existence {
  background: var(--existence-bg);
  color: var(--existence-text);
  border: 0.5px solid var(--existence-border);
}
.op-badge.structure {
  background: var(--structure-bg);
  color: var(--structure-text);
  border: 0.5px solid var(--structure-border);
}
.op-badge.significance {
  background: var(--significance-bg);
  color: var(--significance-text);
  border: 0.5px solid var(--significance-border);
}
.op-badge.sup {
  background: var(--sup-bg);
  color: #6b21a8;
  border: 0.5px solid rgba(168,85,247,0.15);
}

.op-badge .glyph {
  font-size: 0.9em;
}

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
  border: 0.5px solid var(--border);
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

/* ============ Notebook Cells ============ */

.nb-cell {
  background: var(--bg-surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 8px;
  overflow: hidden;
  transition: border-color 0.12s, box-shadow 0.12s;
}

.nb-cell:hover {
  box-shadow: var(--shadow);
}

.nb-cell--failed {
  border-color: var(--failed-border);
  background: var(--failed-bg);
}

.nb-cell--stale {
  border-color: var(--stale-border);
}

.cell-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  cursor: pointer;
  user-select: none;
}

.cell-desc {
  flex: 1;
  font-size: 0.87rem;
  font-weight: 500;
}

.cell-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  color: var(--text-muted);
  flex-shrink: 0;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.status-dot.completed { background: var(--completed-border); }
.status-dot.stale { background: var(--stale-border); }
.status-dot.failed { background: var(--failed-border); }
.status-dot.pending { background: var(--text-muted); }
.status-dot.running { background: var(--accent); }

.cell-code {
  border-top: 0.5px solid var(--border);
  padding: 12px 16px;
  background: var(--bg-elevated);
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  font-size: 0.82rem;
  line-height: 1.5;
  white-space: pre-wrap;
  color: var(--text-secondary);
}

.cell-output {
  border-top: 0.5px solid var(--border);
}

.output-header {
  padding: 6px 14px;
  font-size: 0.72rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
  background: var(--bg);
}

.cell-error {
  border-top: 0.5px solid rgba(239,68,68,0.2);
  padding: 10px 16px;
  background: var(--failed-bg);
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  font-size: 0.8rem;
  color: #991b1b;
}

/* Cell insertion targets */
.cell-insert {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  margin: 4px 0;
  border: 1.5px dashed transparent;
  border-radius: var(--radius);
  color: var(--text-muted);
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.12s;
  opacity: 0;
}
.cell-insert:hover, .cell-insert.always-visible {
  opacity: 1;
  border-color: var(--border);
  color: var(--text-secondary);
}
.cell-insert:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(37, 99, 235, 0.03);
}

/* Operator picker grid */
.op-picker {
  display: none;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 12px;
  background: var(--bg-surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  margin: 4px 0 8px;
}
.op-picker.open { display: grid; }

.op-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 0.5px solid var(--border);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 500;
  transition: all 0.1s;
  background: var(--bg-surface);
}
.op-chip:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow);
}
.op-chip .chip-glyph {
  font-size: 1rem;
  width: 20px;
  text-align: center;
}
.op-chip .chip-code {
  font-size: 0.68rem;
  color: var(--text-muted);
  font-weight: 600;
  margin-left: auto;
}

/* ============ Data Tables ============ */

.data-table, .mini-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.data-table th, .mini-table th {
  background: var(--bg-elevated);
  color: var(--text-secondary);
  text-align: left;
  padding: 6px 12px;
  border-bottom: 0.5px solid var(--border);
  font-weight: 600;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  user-select: none;
}

.data-table th:hover, .mini-table th:hover {
  color: var(--text-primary);
}

.data-table td, .mini-table td {
  padding: 5px 12px;
  border-bottom: 0.5px solid var(--border-subtle);
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.data-table tr:hover td, .mini-table tr:hover td {
  background: rgba(37, 99, 235, 0.03);
}
.mini-table tr:last-child td { border-bottom: none; }

/* ============ Buttons ============ */

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s;
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
  font-size: 0.78rem;
}

.btn-ghost {
  border: none;
  background: transparent;
  color: var(--text-secondary);
}
.btn-ghost:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
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

.source-dropzone {
  border: 1.5px dashed var(--border);
  border-radius: var(--radius);
  padding: 12px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.12s;
}
.source-dropzone:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(37, 99, 235, 0.03);
}

/* ============ Sources Layout ============ */

.sources-layout {
  display: flex;
  gap: 20px;
  min-height: 400px;
}

.sources-left {
  flex: 3;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sources-right {
  flex: 2;
  background: var(--bg-surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  align-self: flex-start;
}

.source-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.source-card {
  background: var(--bg-surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
  cursor: pointer;
  transition: all 0.12s;
}
.source-card:hover { box-shadow: var(--shadow); }
.source-card.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(37,99,235,0.1);
}

.source-name {
  font-weight: 600;
  font-size: 0.87rem;
  margin-bottom: 6px;
}
.source-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.schema-tabs {
  display: flex;
  border-bottom: 0.5px solid var(--border);
}
.schema-tab {
  flex: 1;
  padding: 8px;
  text-align: center;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  background: none;
  font-family: inherit;
}
.schema-tab:hover { color: var(--text-primary); }
.schema-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.schema-content {
  padding: 12px;
  font-size: 0.82rem;
  max-height: 500px;
  overflow-y: auto;
}

.schema-field {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 0.5px solid var(--border-subtle);
}
.schema-field:last-child { border-bottom: none; }

.field-name { font-weight: 500; flex: 1; }
.field-type {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
  background: var(--bg-elevated);
  padding: 1px 6px;
  border-radius: 3px;
}

.null-bar {
  width: 60px;
  height: 4px;
  border-radius: 2px;
  background: var(--bg-elevated);
  overflow: hidden;
  flex-shrink: 0;
}
.null-bar-fill {
  height: 100%;
  border-radius: 2px;
}
.null-bar-fill.green { background: #22c55e; }
.null-bar-fill.amber { background: #eab308; }
.null-bar-fill.red { background: #ef4444; }

.null-pct {
  font-size: 0.68rem;
  color: var(--text-muted);
  width: 28px;
  text-align: right;
  flex-shrink: 0;
}

/* ============ AI Finding Cards ============ */

.ai-controls {
  display: flex;
  gap: 10px;
  padding: 16px;
  background: var(--bg-surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 16px;
  align-items: flex-end;
}

.ai-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ai-field label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.finding-card {
  background: var(--bg-surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 10px;
  transition: box-shadow 0.12s;
}
.finding-card:hover { box-shadow: var(--shadow); }
.finding-card.severity-high {
  border-left: 3px solid var(--failed-border);
}
.finding-card.severity-medium {
  border-left: 3px solid var(--stale-border);
}
.finding-card.severity-low {
  border-left: 3px solid var(--completed-border);
}

.finding-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.finding-title {
  font-weight: 600;
  font-size: 0.9rem;
  flex: 1;
}
.severity-badge {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: 4px;
}
.severity-badge.high { background: #fef2f2; color: #991b1b; }
.severity-badge.medium { background: #fffbeb; color: #92400e; }
.severity-badge.low { background: #f0fdf4; color: #166534; }

.finding-body {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.7;
}

.save-to-session {
  margin-top: 8px;
  font-size: 0.78rem;
  color: var(--accent);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.save-to-session:hover { text-decoration: underline; }

/* ============ Audit Trail Thread ============ */

.audit-controls {
  display: flex;
  gap: 2px;
  margin-bottom: 16px;
  background: var(--bg-elevated);
  border-radius: 6px;
  padding: 2px;
  width: fit-content;
}
.audit-toggle {
  padding: 6px 14px;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  border-radius: 4px;
  color: var(--text-secondary);
}
.audit-toggle:hover { color: var(--text-primary); }
.audit-toggle.active {
  background: var(--bg-surface);
  color: var(--text-primary);
  box-shadow: var(--shadow);
}

.audit-thread {
  position: relative;
}

.audit-row {
  display: flex;
  gap: 14px;
  padding: 12px 8px;
  cursor: pointer;
  border-radius: var(--radius);
  transition: background 0.1s;
}
.audit-row:hover { background: rgba(37,99,235,0.02); }

.audit-line-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20px;
  flex-shrink: 0;
  padding-top: 4px;
}

.audit-line-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.audit-line-dot.completed { background: var(--completed-border); }
.audit-line-dot.stale { background: var(--stale-border); }
.audit-line-dot.failed { background: var(--failed-border); }
.audit-line-dot.pending { background: var(--text-muted); }

.audit-line-bar {
  width: 2px;
  flex: 1;
  margin-top: 4px;
  border-radius: 1px;
}
.audit-line-bar.completed { background: var(--completed-border); opacity: 0.3; }
.audit-line-bar.stale { background: var(--stale-border); opacity: 0.3; }
.audit-line-bar.failed { background: var(--failed-border); opacity: 0.3; }
.audit-line-bar.pending { background: var(--text-muted); opacity: 0.3; }

.audit-content {
  flex: 1;
  min-width: 0;
}

.audit-step-header {
  font-weight: 600;
  font-size: 0.87rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.audit-step-desc {
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin-top: 4px;
  line-height: 1.6;
}

.audit-source-cite {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 4px;
  font-family: 'JetBrains Mono', monospace;
}

.audit-notation {
  margin-top: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.78rem;
  background: var(--bg-elevated);
  padding: 8px 12px;
  border-radius: 6px;
  color: var(--text-secondary);
}

.audit-drilldown {
  margin-top: 8px;
  padding: 12px;
  background: var(--bg);
  border: 0.5px solid var(--border);
  border-radius: var(--radius);
  font-size: 0.82rem;
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

/* ============ Step Cards (legacy, kept for compat) ============ */

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

/* ============ Keyboard Hint ============ */

kbd {
  display: inline-block;
  padding: 1px 5px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  background: var(--bg-elevated);
  border: 0.5px solid var(--border);
  border-radius: 3px;
  color: var(--text-muted);
}

/* ============ Inline step form ============ */

.inline-step-form {
  background: var(--bg-surface);
  border: 0.5px solid var(--accent);
  border-radius: var(--radius);
  padding: 16px;
  margin: 4px 0 8px;
  box-shadow: var(--shadow-md);
}

.inline-step-form .form-group { margin-bottom: 12px; }
.inline-step-form .form-group:last-child { margin-bottom: 0; }
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
