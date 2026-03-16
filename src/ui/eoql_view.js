/**
 * EOQL View — Command Bar + Operator Stacks + Results
 *
 * Interactive EOQL command interface with:
 * - Command bar with context-aware autocomplete
 * - Pre-built operator stacks panel (categorized)
 * - Result display with data tables
 * - Command history
 */

import { parseEOQL, executeEOQL } from '../eoql/parser.js';
import { acSuggest, acIconClass } from '../eoql/autocomplete.js';
import { OPERATOR_STACKS, STACK_CATEGORIES, getStack, getStackInputs, searchStacks } from '../eoql/operator_stacks.js';
import { OPERATORS } from '../models/operators.js';
import { getAllSources } from '../models/given_log.js';
import { getSourceData, ins_ingest } from '../given/service.js';
import { renderMiniTable, renderDataTable, html, toast } from './components.js';
import { updateTopBar } from '../app.js';

// ─── State ──────────────────────────────────────────────────────

let _sources = {};         // name → data rows (loaded on init)
let _schemas = {};         // name → schema info
let _sourceFields = {};    // name → field names
let _fieldValues = {};     // name.field → unique values (lazy)
let _history = [];         // command history
let _results = [];         // result stack
let _acItems = [];         // current autocomplete items
let _acSel = 0;            // selected autocomplete index
let _stackSearch = '';     // stack search filter
let _activeCategory = null; // active stack category

// ─── Main Render ────────────────────────────────────────────────

export function renderEOQLView(container) {
  container.innerHTML = '';

  updateTopBar('EOQL', 'Evidence Observation Query Language', [
    {
      label: 'Load Sources',
      primary: true,
      onClick: () => _loadAllSources().then(() => {
        toast(`Loaded ${Object.keys(_sources).length} sources`, 'success');
        renderEOQLView(container);
      })
    }
  ]);

  // Auto-load sources on first render
  if (Object.keys(_sources).length === 0) {
    _loadAllSources().then(() => renderEOQLView(container));
    container.innerHTML = '<div class="loading"><div class="spinner"></div><div>Loading sources...</div></div>';
    return;
  }

  // ── Layout: Command area + Stacks panel ──
  const layout = document.createElement('div');
  layout.className = 'eoql-layout';

  // Left: Command bar + results
  const mainCol = document.createElement('div');
  mainCol.className = 'eoql-main';

  mainCol.appendChild(_renderCommandBar(container));
  mainCol.appendChild(_renderResults());

  // Right: Operator stacks
  const stacksCol = document.createElement('div');
  stacksCol.className = 'eoql-stacks-panel';
  stacksCol.appendChild(_renderStacksPanel(container));

  layout.appendChild(mainCol);
  layout.appendChild(stacksCol);
  container.appendChild(layout);
}

// ─── Command Bar ────────────────────────────────────────────────

function _renderCommandBar(viewContainer) {
  const wrapper = document.createElement('div');
  wrapper.className = 'eoql-cmd-wrapper';

  // Label
  const label = document.createElement('div');
  label.className = 'eoql-cmd-label';
  label.textContent = 'EOQL Command';
  wrapper.appendChild(label);

  // Input row
  const inputRow = document.createElement('div');
  inputRow.className = 'eoql-cmd-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'eoql-cmd-input';
  input.id = 'eoql-input';
  input.placeholder = 'Type a command... SEG(source, field="value") or press Tab for suggestions';
  input.autocomplete = 'off';
  input.spellcheck = false;

  // Autocomplete dropdown
  const acDrop = document.createElement('div');
  acDrop.className = 'eoql-ac-drop';
  acDrop.id = 'eoql-ac-drop';

  // Run button
  const runBtn = document.createElement('button');
  runBtn.className = 'btn btn-primary eoql-run-btn';
  runBtn.textContent = 'Run';
  runBtn.addEventListener('click', () => _executeCommand(input.value, viewContainer));

  // Events
  input.addEventListener('input', () => _acUpdate(input, acDrop));
  input.addEventListener('keydown', (e) => _acKey(e, input, acDrop, viewContainer));
  input.addEventListener('focus', () => _acUpdate(input, acDrop));
  input.addEventListener('blur', () => {
    setTimeout(() => acDrop.classList.remove('open'), 150);
  });

  inputRow.appendChild(input);
  inputRow.appendChild(runBtn);
  wrapper.appendChild(inputRow);
  wrapper.appendChild(acDrop);

  // Source chips
  const sourceChips = document.createElement('div');
  sourceChips.className = 'eoql-source-chips';
  const sourceNames = Object.keys(_sources);
  if (sourceNames.length > 0) {
    const chipLabel = document.createElement('span');
    chipLabel.className = 'eoql-chip-label';
    chipLabel.textContent = 'Sources:';
    sourceChips.appendChild(chipLabel);

    for (const name of sourceNames) {
      const chip = document.createElement('span');
      chip.className = 'eoql-source-chip';
      chip.textContent = `${name} (${_sources[name].length})`;
      chip.title = `Click to insert "${name}"`;
      chip.addEventListener('click', () => {
        input.value += name;
        input.focus();
        _acUpdate(input, acDrop);
      });
      sourceChips.appendChild(chip);
    }
  }
  wrapper.appendChild(sourceChips);

  // History
  if (_history.length > 0) {
    const histLabel = document.createElement('div');
    histLabel.className = 'eoql-hist-label';
    histLabel.textContent = 'History';
    wrapper.appendChild(histLabel);

    const histList = document.createElement('div');
    histList.className = 'eoql-hist-list';
    for (let i = _history.length - 1; i >= Math.max(0, _history.length - 5); i--) {
      const h = _history[i];
      const histItem = document.createElement('div');
      histItem.className = 'eoql-hist-item';
      histItem.innerHTML = `
        <span class="eoql-hist-op op-badge ${_getTriadClass(h.op)}">${h.op}</span>
        <span class="eoql-hist-cmd">${_esc(h.raw)}</span>
        <span class="eoql-hist-summary">${_esc(h.summary)}</span>
      `;
      histItem.addEventListener('click', () => {
        input.value = h.raw;
        input.focus();
      });
      histList.appendChild(histItem);
    }
    wrapper.appendChild(histList);
  }

  return wrapper;
}

// ─── Autocomplete Logic ─────────────────────────────────────────

function _acUpdate(input, drop) {
  const raw = input.value;
  const cursor = input.selectionStart;

  const dataContext = {
    sourceNames: Object.keys(_sources),
    sourceFields: _sourceFields,
    fieldValues: _fieldValues
  };

  const items = acSuggest(raw, cursor, dataContext);
  _acItems = items;
  _acSel = 0;
  _acRender(items, drop);
}

function _acRender(items, drop) {
  if (!items.length) {
    drop.classList.remove('open');
    _acItems = [];
    return;
  }

  _acItems = items;
  if (_acSel >= items.length) _acSel = 0;

  let htmlStr = '';
  let lastGroup = '';

  items.forEach((it, i) => {
    if (it.group && it.group !== lastGroup) {
      htmlStr += `<div class="eoql-ac-grp">${_esc(it.group)}</div>`;
      lastGroup = it.group;
    }

    const cls = acIconClass(it.type);
    htmlStr += `<div class="eoql-ac-item${i === _acSel ? ' sel' : ''}" data-idx="${i}">
      <div class="eoql-ac-ico ${cls}">${_esc(it.icon)}</div>
      <div class="eoql-ac-body">
        <div class="eoql-ac-name">${_esc(it.display)}</div>
        ${it.desc ? `<div class="eoql-ac-desc">${_esc(it.desc)}</div>` : ''}
      </div>
      ${it.hint ? `<span class="eoql-ac-hint">${_esc(it.hint)}</span>` : ''}
    </div>`;
  });

  drop.innerHTML = htmlStr;
  drop.classList.add('open');

  // Bind click handlers
  drop.querySelectorAll('.eoql-ac-item').forEach(el => {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      _acPick(parseInt(el.dataset.idx));
    });
  });
}

function _acPick(idx) {
  const item = _acItems[idx];
  if (!item) return;

  const input = document.getElementById('eoql-input');
  const raw = input.value;
  const cursor = input.selectionStart;
  const before = raw.slice(0, cursor);

  let replaceStart = cursor;
  const insert = item.insert;

  if (item.type === 'op' && !before.includes('(')) {
    replaceStart = 0;
  } else if (item.type === 'val') {
    const eqMatch = before.match(/(.*[=!><]+\s*"?)([^"]*)$/);
    if (eqMatch) replaceStart = eqMatch.index + eqMatch[1].length;
  } else {
    const wordMatch = before.match(/(.*[(\s,.])(\S*)$/);
    if (wordMatch) replaceStart = wordMatch.index + wordMatch[1].length;
    else replaceStart = 0;
  }

  const after = raw.slice(cursor);
  input.value = raw.slice(0, replaceStart) + insert + after;
  const newCursor = replaceStart + insert.length;
  input.setSelectionRange(newCursor, newCursor);
  input.focus();

  const drop = document.getElementById('eoql-ac-drop');
  _acUpdate(input, drop);
}

function _acKey(e, input, drop, viewContainer) {
  const isOpen = drop.classList.contains('open') && _acItems.length;

  if (isOpen) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _acSel = (_acSel + 1) % _acItems.length;
      _acRender(_acItems, drop);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      _acSel = (_acSel - 1 + _acItems.length) % _acItems.length;
      _acRender(_acItems, drop);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      _acPick(_acSel);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      _acPick(_acSel);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      drop.classList.remove('open');
      return;
    }
  }

  if (e.key === 'Enter' && !isOpen) {
    e.preventDefault();
    _executeCommand(input.value, viewContainer);
  }
}

// ─── Command Execution ──────────────────────────────────────────

async function _executeCommand(raw, viewContainer) {
  if (!raw.trim()) return;

  try {
    const ast = parseEOQL(raw);
    const context = {
      sources: { ..._sources },
      schemas: _schemas,
      derivedViews: []
    };

    // Add _last reference (previous result)
    if (_results.length > 0) {
      context.sources['_last'] = _results[_results.length - 1].result;
    }

    const result = executeEOQL(ast, context);

    // Update sources if INS created a new one
    if (ast.op === 'INS' && result.meta?.name) {
      _sources[result.meta.name] = result.result;
      _sourceFields[result.meta.name] = result.result.length > 0 ? Object.keys(result.result[0]) : [];

      // Persist as a derived source in the Given-Log with full history
      if (result.meta.isDerived) {
        _persistDerivedSource(result.meta.name, result.result, result.meta, raw);
      }
    }

    _history.push({ raw, op: ast.op, summary: result.summary, timestamp: new Date().toISOString() });
    _results.push(result);

    toast(result.summary, 'success');
    renderEOQLView(viewContainer);

    // Clear input after execution
    setTimeout(() => {
      const input = document.getElementById('eoql-input');
      if (input) { input.value = ''; input.focus(); }
    }, 50);

  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
}

// ─── Execute Operator Stack ─────────────────────────────────────

async function _executeStack(stackId, params, viewContainer) {
  const stack = getStack(stackId);
  if (!stack) { toast('Stack not found', 'error'); return; }

  const commands = stack.generate(params);
  const context = {
    sources: { ..._sources },
    schemas: _schemas,
    derivedViews: []
  };

  toast(`Running "${stack.name}" (${commands.length} step${commands.length !== 1 ? 's' : ''})...`, 'info');

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    try {
      // Replace _last with previous result
      let resolvedCmd = cmd;
      if (_results.length > 0) {
        context.sources['_last'] = _results[_results.length - 1].result;
      }

      // Handle _result_N references
      const resultRefMatch = resolvedCmd.match(/_result_(\d+)/g);
      if (resultRefMatch) {
        for (const ref of resultRefMatch) {
          const idx = parseInt(ref.replace('_result_', ''));
          const baseIdx = _results.length - commands.length + idx;
          if (baseIdx >= 0 && _results[baseIdx]) {
            const tempName = `_temp_${Date.now()}_${idx}`;
            context.sources[tempName] = _results[baseIdx].result;
            resolvedCmd = resolvedCmd.replace(ref, tempName);
          }
        }
      }

      const ast = parseEOQL(resolvedCmd);
      const result = executeEOQL(ast, context);

      // Chain: make this result available as _last
      context.sources['_last'] = result.result;
      if (result.meta?.name) {
        _sources[result.meta.name] = result.result;
        _sourceFields[result.meta.name] = result.result.length > 0 ? Object.keys(result.result[0]) : [];

        // Persist as a derived source in the Given-Log with full history
        if (result.meta.isDerived) {
          _persistDerivedSource(result.meta.name, result.result, result.meta, resolvedCmd);
        }
      }

      _history.push({ raw: resolvedCmd, op: ast.op, summary: result.summary, timestamp: new Date().toISOString() });
      _results.push(result);

    } catch (err) {
      toast(`Step ${i + 1} failed: ${err.message}`, 'error');
      break;
    }
  }

  toast(`"${stack.name}" completed`, 'success');
  renderEOQLView(viewContainer);
}

// ─── Results Display ────────────────────────────────────────────

function _renderResults() {
  const wrapper = document.createElement('div');
  wrapper.className = 'eoql-results';

  if (_results.length === 0) {
    wrapper.innerHTML = `
      <div class="empty-state" style="padding: 40px 20px;">
        <div class="empty-icon"><i class="ph ph-terminal" style="font-size: 2.5rem;"></i></div>
        <p>Type an EOQL command or select an operator stack to begin.<br>
        Try <code>SIG(source_name)</code> to inspect a source's schema.</p>
      </div>
    `;
    return wrapper;
  }

  // Show results in reverse (most recent first), max 10
  const display = _results.slice(-10).reverse();

  for (const res of display) {
    const card = document.createElement('div');
    card.className = 'eoql-result-card';

    // Header
    const header = document.createElement('div');
    header.className = 'eoql-result-header';

    const badge = document.createElement('span');
    badge.className = `op-badge ${_getTriadClass(res.op)}`;
    const op = OPERATORS[res.op];
    badge.innerHTML = op ? `<span class="glyph">${op.glyph}</span> ${res.op}` : res.op;

    const summary = document.createElement('span');
    summary.className = 'eoql-result-summary';
    summary.textContent = res.summary;

    const rowCount = document.createElement('span');
    rowCount.className = 'eoql-result-count';
    rowCount.textContent = `${res.result.length} row${res.result.length !== 1 ? 's' : ''}`;

    header.appendChild(badge);
    header.appendChild(summary);
    header.appendChild(rowCount);
    card.appendChild(header);

    // Data table
    if (res.result.length > 0) {
      const columns = Object.keys(res.result[0]).filter(c => !c.startsWith('_diff_'));
      const table = renderMiniTable(res.result, columns, 8);
      card.appendChild(table);
    }

    wrapper.appendChild(card);
  }

  // Clear button
  if (_results.length > 0) {
    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn btn-sm';
    clearBtn.style.marginTop = '8px';
    clearBtn.textContent = 'Clear results';
    clearBtn.addEventListener('click', () => {
      _results = [];
      const container = wrapper.closest('main');
      if (container) renderEOQLView(container);
    });
    wrapper.appendChild(clearBtn);
  }

  return wrapper;
}

// ─── Operator Stacks Panel ──────────────────────────────────────

function _renderStacksPanel(viewContainer) {
  const panel = document.createElement('div');

  // Header
  const header = document.createElement('div');
  header.className = 'eoql-stacks-header';
  header.textContent = 'Operator Stacks';
  panel.appendChild(header);

  // Search
  const search = document.createElement('input');
  search.className = 'eoql-stacks-search';
  search.placeholder = 'Search stacks...';
  search.value = _stackSearch;
  search.addEventListener('input', () => {
    _stackSearch = search.value;
    _rerenderStacks(stackList, viewContainer);
  });
  panel.appendChild(search);

  // Category tabs
  const tabs = document.createElement('div');
  tabs.className = 'eoql-stack-tabs';

  const allTab = document.createElement('button');
  allTab.className = `eoql-stack-tab ${!_activeCategory ? 'active' : ''}`;
  allTab.textContent = 'All';
  allTab.addEventListener('click', () => {
    _activeCategory = null;
    tabs.querySelectorAll('.eoql-stack-tab').forEach(t => t.classList.remove('active'));
    allTab.classList.add('active');
    _rerenderStacks(stackList, viewContainer);
  });
  tabs.appendChild(allTab);

  for (const [key, cat] of Object.entries(STACK_CATEGORIES)) {
    const tab = document.createElement('button');
    tab.className = `eoql-stack-tab ${_activeCategory === key ? 'active' : ''}`;
    tab.innerHTML = `${cat.icon} ${cat.label}`;
    tab.addEventListener('click', () => {
      _activeCategory = key;
      tabs.querySelectorAll('.eoql-stack-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      _rerenderStacks(stackList, viewContainer);
    });
    tabs.appendChild(tab);
  }
  panel.appendChild(tabs);

  // Stack list
  const stackList = document.createElement('div');
  stackList.className = 'eoql-stack-list';
  _rerenderStacks(stackList, viewContainer);
  panel.appendChild(stackList);

  return panel;
}

function _rerenderStacks(container, viewContainer) {
  container.innerHTML = '';

  let stacks = OPERATOR_STACKS;

  if (_activeCategory) {
    stacks = stacks.filter(s => s.category === _activeCategory);
  }

  if (_stackSearch) {
    stacks = searchStacks(_stackSearch);
    if (_activeCategory) stacks = stacks.filter(s => s.category === _activeCategory);
  }

  if (stacks.length === 0) {
    container.innerHTML = '<div style="padding: 16px; color: var(--text-muted); font-size: 0.82rem;">No matching stacks</div>';
    return;
  }

  // Group by category if showing all
  if (!_activeCategory) {
    for (const [catKey, cat] of Object.entries(STACK_CATEGORIES)) {
      const catStacks = stacks.filter(s => s.category === catKey);
      if (catStacks.length === 0) continue;

      const catHeader = document.createElement('div');
      catHeader.className = 'eoql-stack-cat-header';
      catHeader.innerHTML = `<span class="eoql-stack-cat-icon ${cat.color}">${cat.icon}</span> ${cat.label}`;
      container.appendChild(catHeader);

      for (const stack of catStacks) {
        container.appendChild(_renderStackCard(stack, viewContainer));
      }
    }
  } else {
    for (const stack of stacks) {
      container.appendChild(_renderStackCard(stack, viewContainer));
    }
  }
}

function _renderStackCard(stack, viewContainer) {
  const card = document.createElement('div');
  card.className = 'eoql-stack-card';

  // Operators flow
  const opFlow = stack.operators.map(op => {
    const opDef = OPERATORS[op];
    return opDef ? `<span class="eoql-stack-op ${_getTriadClass(op)}">${opDef.glyph}</span>` : op;
  }).join('<span class="eoql-stack-arrow">→</span>');

  card.innerHTML = `
    <div class="eoql-stack-card-header">
      <span class="eoql-stack-name">${_esc(stack.name)}</span>
      <span class="eoql-stack-ops">${opFlow}</span>
    </div>
    <div class="eoql-stack-desc">${_esc(stack.description)}</div>
  `;

  card.addEventListener('click', () => _showStackForm(stack, viewContainer));
  return card;
}

function _showStackForm(stack, viewContainer) {
  const inputs = getStackInputs(stack.id);
  const sourceNames = Object.keys(_sources);

  // Create overlay form
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.maxWidth = '500px';

  // Title
  const title = document.createElement('div');
  title.className = 'modal-title';
  const opFlow = stack.operators.map(op => {
    const opDef = OPERATORS[op];
    return opDef ? `${opDef.glyph}` : op;
  }).join(' → ');
  title.innerHTML = `${opFlow} ${_esc(stack.name)}`;
  modal.appendChild(title);

  // Description
  const desc = document.createElement('div');
  desc.style.cssText = 'font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.6;';
  desc.textContent = stack.description;
  modal.appendChild(desc);

  // Input fields
  const fieldEls = {};
  for (const input of inputs) {
    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = input.label;
    if (input.desc) {
      const hint = document.createElement('span');
      hint.style.cssText = 'color: var(--text-muted); font-weight: 400; margin-left: 6px;';
      hint.textContent = `— ${input.desc}`;
      label.appendChild(hint);
    }
    group.appendChild(label);

    if (input.type === 'source') {
      const select = document.createElement('select');
      select.className = 'form-select';
      select.innerHTML = '<option value="">Select source...</option>';
      for (const name of sourceNames) {
        select.innerHTML += `<option value="${_esc(name)}">${_esc(name)} (${_sources[name].length} rows)</option>`;
      }
      // Auto-select if only one source
      if (sourceNames.length === 1) select.value = sourceNames[0];
      group.appendChild(select);
      fieldEls[input.name] = select;

      // When source changes, update field dropdowns
      select.addEventListener('change', () => {
        const srcName = select.value;
        for (const inp2 of inputs) {
          if (inp2.type === 'field' && fieldEls[inp2.name]) {
            const fieldSelect = fieldEls[inp2.name];
            fieldSelect.innerHTML = '<option value="">Select field...</option>';
            const fields = _sourceFields[srcName] || [];
            for (const f of fields) {
              fieldSelect.innerHTML += `<option value="${_esc(f)}">${_esc(f)}</option>`;
            }
          }
        }
      });
    } else if (input.type === 'field') {
      const select = document.createElement('select');
      select.className = 'form-select';
      select.innerHTML = '<option value="">Select field...</option>';
      // Pre-populate if source already selected
      const srcInput = inputs.find(i => i.type === 'source');
      if (srcInput && fieldEls[srcInput.name]?.value) {
        const fields = _sourceFields[fieldEls[srcInput.name].value] || [];
        for (const f of fields) {
          select.innerHTML += `<option value="${_esc(f)}">${_esc(f)}</option>`;
        }
      }
      group.appendChild(select);
      fieldEls[input.name] = select;
    } else {
      const textInput = document.createElement('input');
      textInput.className = 'form-input';
      textInput.type = input.type === 'number' ? 'number' : 'text';
      textInput.placeholder = input.desc || '';
      group.appendChild(textInput);
      fieldEls[input.name] = textInput;
    }

    modal.appendChild(group);
  }

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => overlay.remove());

  const runBtn = document.createElement('button');
  runBtn.className = 'btn btn-primary';
  runBtn.textContent = `Run ${stack.name}`;
  runBtn.addEventListener('click', () => {
    const params = {};
    for (const [name, el] of Object.entries(fieldEls)) {
      params[name] = el.value;
    }

    // Validate required
    for (const input of inputs) {
      if (!params[input.name] && input.type !== 'text') {
        toast(`${input.label} is required`, 'error');
        return;
      }
    }

    overlay.remove();
    _executeStack(stack.id, params, viewContainer);
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(runBtn);
  modal.appendChild(btnRow);

  overlay.appendChild(modal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

// ─── Data Loading ───────────────────────────────────────────────

async function _loadAllSources() {
  const sources = getAllSources();
  _sources = {};
  _schemas = {};
  _sourceFields = {};
  _fieldValues = {};

  for (const source of sources) {
    try {
      const data = await getSourceData(source);
      const name = source.filename.replace(/\.[^.]+$/, ''); // Strip extension
      _sources[name] = data;

      // Schema
      const schema = source.schema_json ? (typeof source.schema_json === 'string' ? JSON.parse(source.schema_json) : source.schema_json) : null;
      _schemas[name] = schema;

      // Fields
      if (data.length > 0) {
        const fields = Object.keys(data[0]);
        _sourceFields[name] = fields;

        // Pre-compute field values for autocomplete (first 50 unique per field)
        for (const field of fields) {
          const uniques = new Set();
          for (const row of data) {
            if (row[field] !== null && row[field] !== undefined && String(row[field]).trim() !== '') {
              uniques.add(String(row[field]));
              if (uniques.size >= 50) break;
            }
          }
          _fieldValues[`${name}.${field}`] = [...uniques];
        }
      }
    } catch (e) {
      console.warn(`Failed to load source ${source.filename}:`, e);
    }
  }
}

// ─── Derived Source Persistence ──────────────────────────────────

/**
 * Persist an EOQL INS result as a derived source in the Given-Log.
 * Carries full derivation history (EOQL commands that produced it)
 * and links back to the original source(s) via derived_from.
 */
async function _persistDerivedSource(name, data, meta, rawCommand) {
  if (!data || data.length === 0) return;

  try {
    // Find the original source ID if we can match by name
    const allSources = getAllSources();
    const parentSourceNames = meta.derivedFromSources || [];
    const parentSource = parentSourceNames.length > 0
      ? allSources.find(s => {
          const sName = s.filename.replace(/\.[^.]+$/, '');
          return parentSourceNames.includes(sName);
        })
      : null;

    // Build the CSV content from the data for proper ingestion
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    for (const row of data) {
      const vals = headers.map(h => {
        const v = row[h];
        if (v === null || v === undefined) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      });
      csvRows.push(vals.join(','));
    }
    const csvContent = csvRows.join('\n');

    const filename = `${name}.csv`;

    const result = await ins_ingest(
      { name: filename, content: csvContent },
      {
        method: 'api',
        sourceDescription: `Derived source from EOQL: ${rawCommand}`,
        derivedFrom: parentSource?.id || null
      }
    );

    if (result.status === 'ingested') {
      toast(`Saved "${name}" as derived source (${result.rowCount} rows)`, 'success');
    }
  } catch (err) {
    // Don't block the EOQL workflow if persistence fails
    console.warn(`[eoql] Failed to persist derived source "${name}":`, err);
  }
}

// ─── Utilities ──────────────────────────────────────────────────

function _esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function _getTriadClass(operatorCode) {
  const op = OPERATORS[operatorCode];
  if (!op) return '';
  if (operatorCode === 'SUP') return 'sup';
  return op.triad.toLowerCase();
}
