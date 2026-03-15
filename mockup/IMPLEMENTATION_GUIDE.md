# Evidence Observer — UX Overhaul Implementation Guide

Reference mockup: `mockup/ux-redesign-mockup.html` — open in a browser to interact with all four views.

---

## Priority Order

| # | Change | Files | Effort | Impact |
|---|--------|-------|--------|--------|
| 1 | Replace top nav with left sidebar | `src/app.js`, `src/ui/styles.js` | Medium | High |
| 2 | Workbook → notebook cells | `src/ui/session_view.js` | Large | Critical |
| 3 | Inline step insertion + operator picker | `src/ui/session_view.js`, `src/ui/components.js` | Medium | High |
| 4 | Sources → Airtable-style layout | `src/ui/vault_view.js` | Medium | High |
| 5 | AI Analysis → finding cards | `src/ui/ai_view.js` | Medium | Medium |
| 6 | Audit Trail → thread layout | `src/ui/audit_view.js` | Medium | Medium |
| 7 | CSS overhaul (light theme + triad colors) | `src/ui/styles.js` | Small | High |
| 8 | Keyboard shortcuts | `src/app.js` | Small | Medium |

---

## 1. Replace Top Nav with Left Sidebar

**Files:** `src/app.js`, `src/ui/styles.js`

### Current state
`renderApp()` in `app.js` creates a `<header>` with `<nav>` containing 7 horizontal buttons. Below that is a helix bar. The `#app` container uses `flex-direction: column`.

### What to change

**In `styles.js`**, replace the `#app` rule:

```css
#app {
  display: flex;
  flex-direction: row;    /* was column */
  height: 100vh;
  overflow: hidden;
}
```

Add sidebar styles:

```css
aside.sidebar {
  width: 220px;
  flex-shrink: 0;
  border-right: 0.5px solid var(--border);
  background: var(--bg-surface);
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  overflow-y: auto;
  gap: 4px;
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
```

Replace the `main` rule:

```css
main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}
```

**In `app.js`**, rewrite `renderApp()`:

1. Replace `<header>` + `<nav>` with `<aside class="sidebar">` containing:
   - Brand: diamond icon + "Evidence Observer"
   - Section: "DATA" → Sources item
   - Section: "ANALYSIS" → Workbook, AI Analysis, Audit Trail items
   - Section: "SESSIONS" → New session item
   - Spacer
   - Settings at bottom

2. Replace the `<main>` area with a two-part structure:
   - A 44px `.top-bar` with session name + mode on left, Export/Run all on right
   - A `.content-area` div that receives the view render

3. Remove the helix bar from the shell entirely (move it into session_view if needed for context).

4. Reduce the VIEWS object. Drop the `icon` field (sidebar uses text, not Phosphor icons). Group items by section:
   - Data: `vault` (Sources)
   - Analysis: `session` (Workbook), `ai` (AI Analysis), `audit` (Audit Trail)
   - The Lineage and Export views become secondary — accessible from the Workbook or top-bar actions, not primary nav.

### Navigation behavior
- Clicking a sidebar item calls `navigateTo(key)` same as today
- Active item gets `.active` class; all others lose it
- Top bar title updates to reflect current context (session name for workbook, "Data Sources" for vault, etc.)

---

## 2. Workbook → Notebook Cells

**File:** `src/ui/session_view.js`

This is the highest-impact change. The current pattern renders steps as card list items that open modals for editing/viewing.

### New cell structure

Each step renders as a self-contained notebook cell with three zones:

```
┌─────────────────────────────────────────────────────────┐
│  [∅ NUL]  Null audit — procurement_contracts.csv   ● 847 rows · 0.2s  │  ← Header (40px, always visible)
├─────────────────────────────────────────────────────────┤
│  result = contracts[...]                                │  ← Code body (collapsible)
├─────────────────────────────────────────────────────────┤
│  OUTPUT · 23 of 847 rows                                │  ← Output panel (collapsible)
│  ┌────────────┬──────────┬─────────────┬────────────┐  │
│  │vendor_name │ amount   │ category    │ date       │  │
│  ├────────────┼──────────┼─────────────┼────────────┤  │
│  │Motorola    │$4,200,000│surveillance │2023-03-14  │  │
│  └────────────┴──────────┴─────────────┴────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Implementation

Replace the current step rendering with:

```javascript
function renderNotebookCell(step, index) {
  const cell = document.createElement('div');
  cell.className = `nb-cell nb-cell--${step.status}`;
  cell.dataset.stepId = step.id;

  // Header — always visible
  const header = createCellHeader(step);
  cell.appendChild(header);

  // Code body — toggled (collapsed for completed, open for pending/failed)
  if (step.code) {
    const codeBody = document.createElement('div');
    codeBody.className = 'cell-code';
    codeBody.textContent = step.code;
    codeBody.hidden = step.status === 'completed';
    cell.appendChild(codeBody);
  }

  // Output — toggled (open for completed/stale)
  if (step.status === 'completed' || step.status === 'stale') {
    const output = createOutputPanel(step);
    cell.appendChild(output);
  }

  // Error — shown for failed steps
  if (step.status === 'failed' && step.error) {
    const error = document.createElement('div');
    error.className = 'cell-error';
    error.innerHTML = `${step.error}<div style="margin-top:8px;"><button class="btn btn-sm" onclick="rerunStep('${step.id}')">Re-run</button></div>`;
    cell.appendChild(error);
  }

  return cell;
}
```

### Header strip

```javascript
function createCellHeader(step) {
  const op = OPERATORS[step.operator_type];
  const triad = op.triad.toLowerCase();

  const header = document.createElement('div');
  header.className = 'cell-header';
  header.onclick = () => toggleCellExpansion(header.parentElement);

  // Operator badge
  const badge = document.createElement('span');
  badge.className = `op-badge ${triad === 'significance' && step.operator_type === 'SUP' ? 'sup' : triad}`;
  badge.innerHTML = `<span class="glyph">${op.glyph}</span> ${step.operator_type}`;

  // Description (editable on click)
  const desc = document.createElement('span');
  desc.className = 'cell-desc';
  desc.textContent = step.description;

  // Meta: status dot + row count + runtime
  const meta = document.createElement('span');
  meta.className = 'cell-meta';
  meta.innerHTML = `<span class="status-dot ${step.status}"></span>`;
  if (step.row_count) meta.innerHTML += ` ${step.row_count} rows`;
  if (step.runtime) meta.innerHTML += ` · ${step.runtime}`;
  if (step.status === 'stale') meta.innerHTML += ' stale';
  if (step.status === 'failed') meta.innerHTML += ' failed';

  header.append(badge, desc, meta);
  return header;
}
```

### Output panel

Render output based on operator type:
- **NUL**: Null map table with CLEARED/UNKNOWN/NEVER_SET counts
- **SEG**: Mini data table, max 5 rows shown, "show all N rows" link
- **CON**: Relationship/join result table
- **SUP**: Two side-by-side panels with branch headers
- **Default**: Mini data table

Show max 5 rows by default. Add a "show all N rows" link that expands inline (no modal).

### Collapse/expand behavior
- Clicking the header toggles code body and output panel visibility
- Default state: code collapsed for completed steps, output expanded for completed steps
- Failed steps show the error block by default

### CSS additions to `styles.js`

```css
.nb-cell {
  background: var(--bg-surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 8px;
  overflow: hidden;
}
.nb-cell:hover { box-shadow: var(--shadow); }
.nb-cell--failed { border-color: var(--failed-border); background: var(--failed-bg); }
.nb-cell--stale { border-color: var(--stale-border); }

.cell-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  cursor: pointer;
}

.cell-code {
  border-top: 0.5px solid var(--border);
  padding: 12px 16px;
  background: var(--bg-elevated);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.82rem;
  line-height: 1.5;
  white-space: pre-wrap;
}

.cell-output { border-top: 0.5px solid var(--border); }

.cell-error {
  border-top: 0.5px solid rgba(239,68,68,0.2);
  padding: 10px 16px;
  background: var(--failed-bg);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  color: #991b1b;
}

.status-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  display: inline-block;
}
.status-dot.completed { background: var(--completed-border); }
.status-dot.stale { background: var(--stale-border); }
.status-dot.failed { background: var(--failed-border); }
.status-dot.pending { background: var(--text-muted); }
```

### What to remove
- The current step card click → modal pattern
- The `renderModal` calls for step detail/editing from session_view.js
- The separate "run step" and "view output" modals

---

## 3. Inline Step Insertion + Operator Picker

**Files:** `src/ui/session_view.js`, `src/ui/components.js`

### Insertion targets

Between each cell and at the bottom, render an insertion target:

```javascript
function renderInsertionTarget(index, isBottom) {
  const target = document.createElement('div');
  target.className = `cell-insert ${isBottom ? 'always-visible' : ''}`;
  target.textContent = isBottom ? '+ Add step — or press /' : '+ insert step';
  target.onclick = () => openPickerAt(target, index);

  if (!isBottom) {
    // Only visible on hover
    target.style.opacity = '0';
    target.onmouseenter = () => target.style.opacity = '1';
    target.onmouseleave = () => { if (!target.querySelector('.op-picker')) target.style.opacity = '0'; };
  }

  return target;
}
```

### Operator picker

Replace `renderOperatorSelector` in `components.js` with a 3×3 grid:

```javascript
export function renderOperatorPicker(onSelect) {
  const picker = document.createElement('div');
  picker.className = 'op-picker';
  picker.style.display = 'grid';

  for (const [code, op] of Object.entries(OPERATORS)) {
    const chip = document.createElement('div');
    chip.className = 'op-chip';
    chip.innerHTML = `
      <span class="chip-glyph">${op.glyph}</span>
      ${op.friendlyName}
      <span class="chip-code">${code}</span>
    `;
    chip.onclick = () => onSelect(code);
    picker.appendChild(chip);
  }

  return picker;
}
```

### Slash command

In `app.js`, add a global keydown listener:

```javascript
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && currentView === 'session' && !isTyping(e)) {
    e.preventDefault();
    openPickerAtBottom();
  }
  if (e.key === 'Escape') {
    closeAnyOpenPicker();
  }
});
```

### After operator selection

When a chip is clicked:
1. The picker is replaced by a mini inline form:
   - Description field (single line, required)
   - Input selector (dropdown with available sources + prior step outputs)
   - Code textarea (optional)
   - "Add & run" button
2. On submit, the step is inserted at the target index and executed

---

## 4. Sources → Airtable-Style Layout

**File:** `src/ui/vault_view.js`

### Current state
Full-width dropzone at top, source list below as cards, click to open schema modal.

### New layout

Two-panel side-by-side:

```
┌──────────────────────────┬─────────────────────────┐
│  [+ Import source]       │  Schema │ Nulls │ Preview│
│  ┌──────┐ ┌──────┐      │  ─────────────────────── │
│  │ file │ │ file │      │  vendor_name  string  0% │
│  │ .csv │ │ .csv │      │  amount       number  2% │
│  └──────┘ └──────┘      │  category     string  1% │
│                          │  ...                     │
└──────────────────────────┴─────────────────────────┘
        60% width                   40% width
```

### Implementation

```javascript
export function renderVaultView(container) {
  container.innerHTML = '';

  const layout = document.createElement('div');
  layout.className = 'sources-layout';

  // Left panel: dropzone + source grid
  const left = document.createElement('div');
  left.className = 'sources-left';

  const dropzone = document.createElement('div');
  dropzone.className = 'source-dropzone';
  dropzone.textContent = '+ Import source';
  // ... drag/drop/click handlers same as current

  const grid = document.createElement('div');
  grid.className = 'source-grid';
  // Render 2-column grid of source cards

  left.append(dropzone, grid);

  // Right panel: schema viewer
  const right = document.createElement('div');
  right.className = 'sources-right';
  // Three inline tabs: Schema, Nulls, Preview
  // Default to Schema tab

  layout.append(left, right);
  container.appendChild(layout);
}
```

### Schema panel tabs

**Schema tab**: Field name + inferred type badge + null percentage bar
**Nulls tab**: Full NUL audit table with CLEARED/UNKNOWN/NEVER_SET counts and colored indicators
**Preview tab**: First 20 rows as a mini data table

### Null severity encoding

Each field gets a horizontal bar showing null percentage:
- 0–5%: green (`#22c55e`)
- 5–20%: amber (`#eab308`)
- 20%+: red (`#ef4444`)

```css
.null-bar {
  width: 60px; height: 4px;
  border-radius: 2px;
  background: var(--bg-elevated);
  overflow: hidden;
}
.null-bar-fill { height: 100%; border-radius: 2px; }
.null-bar-fill.green { background: #22c55e; }
.null-bar-fill.amber { background: #eab308; }
.null-bar-fill.red { background: #ef4444; }
```

### What to remove
- The full-screen dropzone
- The schema detail modal

---

## 5. AI Analysis → Finding Cards

**File:** `src/ui/ai_view.js`

### Current state
Three tabs (Analyze / Modules / Settings). Results rendered as generic JSON tree.

### New layout

Top: Source selector + module selector + run button (always visible, no tabs).

Below: Stacked finding cards. Each card has:
- Left border colored by severity (red = high, amber = medium, green = low)
- Operator badge showing which EO operator the finding relates to
- Title + severity badge
- Plain-language description
- "Save to session as [OP] step" link

### Result rendering by operator type

```javascript
function renderFinding(finding) {
  const card = document.createElement('div');
  card.className = `finding-card severity-${finding.severity || 'medium'}`;

  card.innerHTML = `
    <div class="finding-header">
      <span class="op-badge ${getTriadClass(finding.operatorType)}">${OPERATORS[finding.operatorType].glyph} ${finding.operatorType}</span>
      <span class="finding-title">${finding.title}</span>
      <span class="severity-badge ${finding.severity}">${finding.severity}</span>
    </div>
    <div class="finding-body">${finding.description}</div>
    <div class="save-to-session" onclick="saveToSession('${finding.operatorType}', ${JSON.stringify(finding)})">
      → Save to session as ${finding.operatorType} step
    </div>
  `;

  return card;
}
```

### Module management
Move to a gear icon that opens a slide-out panel or to the Settings section. Do not occupy primary screen real estate with module configuration.

### "Save to session" action
Creates a step in the current session with:
- `operator_type` from the finding
- `description` from the finding title
- AI analysis JSON attached as a notation/annotation on the step
- This makes AI work part of the auditable provenance chain

---

## 6. Audit Trail → Thread Layout

**File:** `src/ui/audit_view.js`

### New layout

Vertical thread with colored line on left:

```
  ●──  [∅ NUL]  1. Null audit on procurement data
  │    We checked the raw procurement contracts...
  │    Source: procurement_contracts.csv · SHA-256: a4f3c2e8…
  │
  ●──  [| SEG]  2. Filtered to surveillance equipment
  │    We isolated contracts related to surveillance...
  │
  ○──  [⋈ CON]  3. Join to official disclosure records
  │    ⚠ Stale — upstream data has changed
  │
  ●──  [∨ SYN]  4. Aggregate by official
       ✕ Failed: missing column 'official_id'
```

### Technical/Public toggle

Segmented control at top (not tabs). In public view: methodology narrative. In technical view: EO formal notation shown inline under each step:

```
∅(procurement_contracts) → {CLEARED: 289, UNKNOWN: 0} ✓γ
```

### Drill-down
Clicking a row expands it inline to show lineage detail rather than opening a modal.

---

## 7. CSS Overhaul

**File:** `src/ui/styles.js`

The current color scheme is already light. Confirm these variables are set:

```css
:root {
  --bg: #f8fafc;
  --bg-surface: #ffffff;
  --bg-elevated: #f1f5f9;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --border: #e2e8f0;
  --accent: #2563eb;
}
```

### Operator triad colors

These carry through all UI — badges, cell borders, finding cards:

```css
/* Existence (NUL/SIG/INS): blue */
.op-badge.existence, .nb-cell.existence {
  background: #eff8ff; color: #1e40af; border-color: rgba(59,130,246,0.15);
}

/* Structure (SEG/CON/SYN): green */
.op-badge.structure, .nb-cell.structure {
  background: #f0fdf4; color: #166534; border-color: rgba(34,197,94,0.15);
}

/* Significance (ALT/REC): amber */
.op-badge.significance, .nb-cell.significance {
  background: #fffbeb; color: #92400e; border-color: rgba(245,158,11,0.15);
}

/* SUP specifically: purple */
.op-badge.sup, .nb-cell.sup {
  background: #faf5ff; color: #6b21a8; border-color: rgba(168,85,247,0.15);
}
```

### Border detail
Use `0.5px` borders throughout. Most browsers render this as 1 physical pixel on retina displays.

### Status dots
Replace text status badges in dense contexts with 6px colored circles:
```css
.status-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  display: inline-block;
}
```

---

## 8. Keyboard Shortcuts

**File:** `src/app.js`

Add a global event listener in `initApp()`:

| Key | Action |
|-----|--------|
| `/` | Open operator picker at cursor position |
| `Cmd+Enter` | Run focused cell |
| `Cmd+Shift+Enter` | Run all stale cells |
| `Esc` | Collapse focused cell / close picker |
| `↑` / `↓` | Move focus between cells |
| `Cmd+[` / `Cmd+]` | Collapse / expand all cells |

Implementation:

```javascript
document.addEventListener('keydown', (e) => {
  if (currentView !== 'session') return;

  // / — open picker (only if not in an input)
  if (e.key === '/' && !isInputFocused()) {
    e.preventDefault();
    openPickerAtBottom();
  }

  // Cmd+Enter — run focused cell
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
    e.preventDefault();
    runFocusedCell();
  }

  // Cmd+Shift+Enter — run all stale
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
    e.preventDefault();
    runAllStaleCells();
  }

  // Esc — collapse/close
  if (e.key === 'Escape') {
    closeAnyOpenPicker();
    collapseFocusedCell();
  }

  // Arrow keys — navigate cells
  if (e.key === 'ArrowUp') { moveCellFocus(-1); e.preventDefault(); }
  if (e.key === 'ArrowDown') { moveCellFocus(1); e.preventDefault(); }
});
```

---

## 9. What NOT to Change

- The underlying data model, operator system, and SQLite schema
- The provenance tracking and audit entry system
- The formal notation — keep it visible, just don't make it the first thing shown
- The nine operators and helix ordering — these are the core abstraction
- The Given/Meant boundary enforcement
- Export formats (notation package, methodology, linked data, self-contained HTML)

---

## Implementation Order

1. **CSS first** (#7) — update `styles.js` with new variables, triad colors, cell styles, sidebar styles. This is low-risk and unblocks everything else.
2. **Shell layout** (#1) — rewrite `renderApp()` in `app.js` for sidebar + top bar. All views still render into main content area.
3. **Workbook cells** (#2 + #3) — rewrite `session_view.js`. This is the biggest change. Get cell rendering working first, then add insertion/picker.
4. **Sources layout** (#4) — rewrite `vault_view.js` for two-panel + inline schema.
5. **AI findings** (#5) — update `ai_view.js` result rendering.
6. **Audit thread** (#6) — update `audit_view.js` for thread layout.
7. **Keyboard shortcuts** (#8) — add to `app.js`, test with workbook view.

Each step can be shipped independently. The sidebar (#1) is the prerequisite for a coherent visual, but each view update (#2–6) is isolated and can be done in any order after the shell is in place.
