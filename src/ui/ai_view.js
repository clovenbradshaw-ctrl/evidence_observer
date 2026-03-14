/**
 * AI Analysis View — LLM-Powered EO Analysis
 *
 * Three tabs:
 *   1. Analyze — Run built-in or custom modules against Given-Log data
 *   2. Modules — Browse/manage analysis modules, import JSON instruction sets
 *   3. Settings — API key configuration
 */

import { OPERATORS, formatOperator } from '../models/operators.js';
import { getAllSources } from '../models/given_log.js';
import { DEFAULT_MODULES, getModulesByTriad } from '../ai/modules.js';
import { getCustomModules, importModules, deleteCustomModule, exportModules, generateModuleFromDescription } from '../ai/module_builder.js';
import { callLLM, isAIConfigured } from '../ai/service.js';
import { getProvider, setProvider, getAPIKey, setAPIKey, getModel, setModel } from '../ai/settings.js';
import { renderDataTable, renderModal, html, toast } from './components.js';

let _activeTab = 'analyze';
let _lastResult = null;

export function renderAIView(container) {
  container.innerHTML = '';

  const view = html`<div></div>`;

  // Header
  view.appendChild(html`
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2 style="font-size: 1.2rem;">
        <span style="color: var(--accent);">⊡</span>
        AI Analysis — LLM-Powered EO Operators
      </h2>
      <div style="font-size: 0.8rem; color: var(--text-muted);">
        ${isAIConfigured() ? `<span style="color: var(--completed-border);">● Connected</span> (${getProvider()})` : '<span style="color: var(--failed-border);">● Not configured</span>'}
      </div>
    </div>
  `);

  // Tabs
  const tabs = html`<div class="tabs"></div>`;
  for (const [key, label] of [['analyze', 'Analyze'], ['modules', 'Modules'], ['settings', 'Settings']]) {
    const tab = html`<button class="tab ${_activeTab === key ? 'active' : ''}">${label}</button>`;
    tab.addEventListener('click', () => {
      _activeTab = key;
      renderAIView(container);
    });
    tabs.appendChild(tab);
  }
  view.appendChild(tabs);

  // Tab content
  const content = html`<div></div>`;
  if (_activeTab === 'analyze') _renderAnalyzeTab(content);
  else if (_activeTab === 'modules') _renderModulesTab(content, container);
  else if (_activeTab === 'settings') _renderSettingsTab(content, container);

  view.appendChild(content);
  container.appendChild(view);
}

// ═══════════════════════════════════════════════
// ANALYZE TAB
// ═══════════════════════════════════════════════

function _renderAnalyzeTab(container) {
  if (!isAIConfigured()) {
    container.appendChild(html`
      <div class="empty-state">
        <div class="glyph">⊡</div>
        <p>Configure your API key in the Settings tab to begin AI-powered analysis.</p>
      </div>
    `);
    return;
  }

  const sources = getAllSources();
  if (sources.length === 0) {
    container.appendChild(html`
      <div class="empty-state">
        <div class="glyph">△</div>
        <p>No data in the Given-Log yet.<br>Upload data in the Given-Log view first.</p>
      </div>
    `);
    return;
  }

  // Source selector
  const sourceGroup = html`
    <div class="form-group">
      <label class="form-label">Data Source (Given-Log)</label>
    </div>
  `;
  const sourceSelect = document.createElement('select');
  sourceSelect.className = 'form-select';
  sourceSelect.id = 'ai-source-select';
  for (const source of sources) {
    const opt = document.createElement('option');
    opt.value = source.id;
    opt.textContent = `${OPERATORS.INS.glyph} ${source.filename} (${source.row_count} rows)`;
    sourceSelect.appendChild(opt);
  }
  sourceGroup.appendChild(sourceSelect);
  container.appendChild(sourceGroup);

  // Module selector — grouped by triad
  const moduleGroup = html`
    <div class="form-group">
      <label class="form-label">Analysis Module</label>
    </div>
  `;
  const moduleSelect = document.createElement('select');
  moduleSelect.className = 'form-select';
  moduleSelect.id = 'ai-module-select';

  const byTriad = getModulesByTriad();
  const customModules = getCustomModules();

  for (const [triad, modules] of Object.entries(byTriad)) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = `${triad} Triad`;
    for (const mod of modules) {
      const op = OPERATORS[mod.operatorType];
      const opt = document.createElement('option');
      opt.value = mod.id;
      opt.textContent = `${op.glyph} ${mod.name} (${mod.operatorType})`;
      optgroup.appendChild(opt);
    }
    moduleSelect.appendChild(optgroup);
  }

  if (customModules.length > 0) {
    const customGroup = document.createElement('optgroup');
    customGroup.label = 'Custom Modules';
    for (const mod of customModules) {
      const op = OPERATORS[mod.operatorType];
      const opt = document.createElement('option');
      opt.value = mod.id;
      opt.textContent = `${op?.glyph || '?'} ${mod.name} (${mod.operatorType}) [custom]`;
      customGroup.appendChild(opt);
    }
    moduleSelect.appendChild(customGroup);
  }

  moduleSelect.addEventListener('change', () => _updateModuleDescription());
  moduleGroup.appendChild(moduleSelect);
  container.appendChild(moduleGroup);

  // Module description display
  const descBox = html`<div id="ai-module-desc" class="ai-module-desc"></div>`;
  container.appendChild(descBox);

  // Parameters
  container.appendChild(html`
    <div class="form-group">
      <label class="form-label">Additional Parameters (optional)</label>
      <textarea class="form-textarea" id="ai-params" rows="2" placeholder='e.g., {"focus": "district spending", "timeField": "date"}'></textarea>
    </div>
  `);

  // Run button
  const runRow = html`<div style="display: flex; gap: 8px; margin-bottom: 16px;"></div>`;
  const runBtn = html`<button class="btn btn-primary" id="ai-run-btn">Run Analysis</button>`;
  runBtn.addEventListener('click', () => _runAnalysis(container));
  runRow.appendChild(runBtn);
  container.appendChild(runRow);

  // Results area
  container.appendChild(html`<div id="ai-results"></div>`);

  // Show last result if available
  if (_lastResult) {
    _displayResult(_lastResult, document.getElementById('ai-results') || container);
  }

  // Init description
  setTimeout(() => _updateModuleDescription(), 0);
}

function _updateModuleDescription() {
  const descBox = document.getElementById('ai-module-desc');
  const moduleSelect = document.getElementById('ai-module-select');
  if (!descBox || !moduleSelect) return;

  const moduleId = moduleSelect.value;
  const allModules = [...DEFAULT_MODULES, ...getCustomModules()];
  const mod = allModules.find(m => m.id === moduleId);

  if (mod) {
    const op = OPERATORS[mod.operatorType];
    descBox.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
        <span class="op-glyph ${op.triad.toLowerCase()}" style="width:24px;height:24px;font-size:1rem;">${op.glyph}</span>
        <strong>${mod.name}</strong>
        <span class="meant-badge">${mod.operatorType}</span>
        ${mod.custom ? '<span class="ai-custom-badge">custom</span>' : ''}
      </div>
      <div style="font-size: 0.85rem; color: var(--text-secondary);">${mod.description}</div>
    `;
  }
}

async function _runAnalysis(container) {
  const sourceSelect = document.getElementById('ai-source-select');
  const moduleSelect = document.getElementById('ai-module-select');
  const paramsInput = document.getElementById('ai-params');
  const runBtn = document.getElementById('ai-run-btn');
  const resultsDiv = document.getElementById('ai-results');

  if (!sourceSelect || !moduleSelect) return;

  const sourceId = sourceSelect.value;
  const moduleId = moduleSelect.value;

  // Find source data
  const sources = getAllSources();
  const source = sources.find(s => String(s.id) === String(sourceId));
  if (!source) { toast('Source not found', 'error'); return; }

  let data = [];
  try {
    data = JSON.parse(source.data_json);
  } catch (e) {
    toast('Failed to parse source data', 'error');
    return;
  }

  // Find module
  const allModules = [...DEFAULT_MODULES, ...getCustomModules()];
  const mod = allModules.find(m => m.id === moduleId);
  if (!mod) { toast('Module not found', 'error'); return; }

  // Parse params
  let params = {};
  const paramsText = paramsInput?.value?.trim();
  if (paramsText) {
    try {
      params = JSON.parse(paramsText);
    } catch (e) {
      toast('Invalid parameters JSON', 'error');
      return;
    }
  }

  // Show loading
  runBtn.disabled = true;
  runBtn.textContent = 'Analyzing...';
  resultsDiv.innerHTML = `
    <div class="ai-loading">
      <div class="spinner"></div>
      <div>Running ${formatOperator(mod.operatorType)} analysis via ${getProvider()}...</div>
    </div>
  `;

  const startTime = performance.now();

  // Build prompts and call LLM
  const userPrompt = mod.buildUserPrompt(data, params);
  const result = await callLLM(mod.systemPrompt, userPrompt, { maxTokens: 4096, temperature: 0.2 });

  const runtime_ms = Math.round(performance.now() - startTime);

  const analysisResult = {
    ...result,
    moduleId: mod.id,
    moduleName: mod.name,
    operatorType: mod.operatorType,
    sourceName: source.filename,
    rowCount: data.length,
    runtime_ms,
    timestamp: new Date().toISOString()
  };

  _lastResult = analysisResult;

  // Reset button
  runBtn.disabled = false;
  runBtn.textContent = 'Run Analysis';

  // Display result
  _displayResult(analysisResult, resultsDiv);
}

function _displayResult(result, container) {
  container.innerHTML = '';

  if (!result.success) {
    container.appendChild(html`
      <div class="card" style="border-color: var(--failed-border);">
        <div class="card-header">
          <span class="op-glyph" style="border-color: var(--failed-border); color: var(--failed-border);">✗</span>
          <div>
            <div class="card-title">Analysis Failed</div>
            <div style="font-size: 0.85rem; color: var(--failed-border);">${result.error}</div>
          </div>
        </div>
      </div>
    `);
    return;
  }

  const op = OPERATORS[result.operatorType];

  // Result card
  const card = html`
    <div class="card ai-result-card">
      <div class="card-header">
        <span class="op-glyph ${op.triad.toLowerCase()}">${op.glyph}</span>
        <div style="flex: 1;">
          <div class="card-title">${op.glyph} ${result.moduleName} — ${result.sourceName}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">
            ${result.rowCount} rows · ${result.runtime_ms}ms · ${result.model || getProvider()} · ${result.timestamp}
          </div>
        </div>
      </div>
    </div>
  `;

  // Try to parse as JSON for structured display
  let parsedJSON = null;
  try {
    // Strip markdown code fences if present
    let cleaned = result.text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    parsedJSON = JSON.parse(cleaned);
  } catch (e) {
    // Not JSON — display as text
  }

  if (parsedJSON) {
    // Structured JSON result
    const jsonDisplay = html`<div class="ai-json-result"></div>`;
    _renderJSONResult(jsonDisplay, parsedJSON);
    card.appendChild(jsonDisplay);
  } else {
    // Plain text result
    card.appendChild(html`<pre class="notation" style="margin-top: 12px;">${result.text}</pre>`);
  }

  // Usage info
  if (result.usage && Object.keys(result.usage).length > 0) {
    card.appendChild(html`
      <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px; text-align: right;">
        Tokens: ${result.usage.input_tokens || result.usage.prompt_tokens || '?'} in / ${result.usage.output_tokens || result.usage.completion_tokens || '?'} out
      </div>
    `);
  }

  // Copy raw button
  const copyBtn = html`<button class="btn btn-sm" style="margin-top: 8px;">Copy Raw Response</button>`;
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(result.text).then(() => toast('Copied to clipboard', 'success'));
  });
  card.appendChild(copyBtn);

  container.appendChild(card);
}

function _renderJSONResult(container, obj, depth = 0) {
  if (depth > 3) {
    container.appendChild(html`<pre class="notation">${JSON.stringify(obj, null, 2)}</pre>`);
    return;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const item = obj[i];
      if (typeof item === 'object' && item !== null) {
        const itemDiv = html`<div class="ai-json-item"></div>`;
        _renderJSONResult(itemDiv, item, depth + 1);
        container.appendChild(itemDiv);
      } else {
        container.appendChild(html`<div class="ai-json-value">${String(item)}</div>`);
      }
    }
    return;
  }

  if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      const row = html`<div class="ai-json-row"></div>`;
      const keyEl = html`<span class="ai-json-key">${key}:</span>`;
      row.appendChild(keyEl);

      if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === 'object') {
          container.appendChild(html`<div class="ai-json-key" style="margin-top: 8px;">${key}:</div>`);
          const listDiv = html`<div style="margin-left: 16px;"></div>`;
          _renderJSONResult(listDiv, value, depth + 1);
          container.appendChild(listDiv);
          continue;
        } else {
          const valEl = html`<span class="ai-json-value">${value.join(', ')}</span>`;
          row.appendChild(valEl);
        }
      } else if (typeof value === 'object' && value !== null) {
        container.appendChild(html`<div class="ai-json-key" style="margin-top: 8px;">${key}:</div>`);
        const nestedDiv = html`<div style="margin-left: 16px;"></div>`;
        _renderJSONResult(nestedDiv, value, depth + 1);
        container.appendChild(nestedDiv);
        continue;
      } else {
        const valEl = html`<span class="ai-json-value">${String(value)}</span>`;
        row.appendChild(valEl);
      }

      container.appendChild(row);
    }
  }
}

// ═══════════════════════════════════════════════
// MODULES TAB
// ═══════════════════════════════════════════════

function _renderModulesTab(container, viewContainer) {
  // Built-in modules
  const byTriad = getModulesByTriad();

  for (const [triad, modules] of Object.entries(byTriad)) {
    const triadColors = { Existence: 'given-border', Structure: 'completed-border', Significance: 'meant-border' };
    container.appendChild(html`
      <h3 style="font-size: 0.95rem; color: var(--${triadColors[triad]}); margin: 20px 0 8px;">
        ${triad} Triad
      </h3>
    `);

    for (const mod of modules) {
      const op = OPERATORS[mod.operatorType];
      container.appendChild(html`
        <div class="card" style="padding: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="op-glyph ${op.triad.toLowerCase()}" style="width:24px;height:24px;font-size:1rem;">${op.glyph}</span>
            <div style="flex: 1;">
              <strong>${mod.name}</strong> <span class="meant-badge">${mod.operatorType}</span>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${mod.description}</div>
            </div>
            <span class="ai-builtin-badge">built-in</span>
          </div>
        </div>
      `);
    }
  }

  // Custom modules
  const customModules = getCustomModules();
  container.appendChild(html`
    <h3 style="font-size: 0.95rem; color: var(--accent); margin: 24px 0 8px;">
      Custom Modules (${customModules.length})
    </h3>
  `);

  if (customModules.length > 0) {
    for (const mod of customModules) {
      const op = OPERATORS[mod.operatorType];
      const card = html`
        <div class="card" style="padding: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="op-glyph ${op?.triad?.toLowerCase() || ''}" style="width:24px;height:24px;font-size:1rem;">${op?.glyph || '?'}</span>
            <div style="flex: 1;">
              <strong>${mod.name}</strong> <span class="meant-badge">${mod.operatorType}</span>
              <span class="ai-custom-badge">custom</span>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${mod.description}</div>
            </div>
          </div>
        </div>
      `;
      // Delete on right-click or with a delete button
      const delBtn = html`<button class="btn btn-sm" style="color: var(--failed-border); margin-left: 8px;">Delete</button>`;
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCustomModule(mod.id);
        toast(`Deleted module: ${mod.name}`, 'info');
        renderAIView(viewContainer);
      });
      card.querySelector('div').appendChild(delBtn);
      container.appendChild(card);
    }
  } else {
    container.appendChild(html`
      <div style="font-size: 0.85rem; color: var(--text-muted); padding: 12px;">
        No custom modules yet. Import a JSON instruction set or generate one with AI below.
      </div>
    `);
  }

  // Import / Export / Generate section
  container.appendChild(html`<hr style="border-color: var(--border-subtle); margin: 20px 0;">`);

  // JSON Import
  container.appendChild(html`
    <div class="form-group">
      <label class="form-label">Import JSON Instruction Set</label>
      <textarea class="code-editor" id="ai-import-json" style="min-height: 160px;" placeholder='{
  "modules": [{
    "id": "my-custom-analysis",
    "name": "My Custom Analysis",
    "operatorType": "SEG",
    "description": "What this module does",
    "systemPrompt": "You are an analyst. Analyze the data and...",
    "userPromptTemplate": "Analyze this dataset ({{rowCount}} rows, fields: {{fieldNames}}):\n\n{{data}}"
  }]
}'></textarea>
    </div>
  `);

  const importBtnRow = html`<div style="display: flex; gap: 8px; margin-bottom: 20px;"></div>`;

  const importBtn = html`<button class="btn btn-primary">Import Modules</button>`;
  importBtn.addEventListener('click', () => {
    const jsonStr = document.getElementById('ai-import-json').value.trim();
    if (!jsonStr) { toast('Paste a JSON instruction set first', 'error'); return; }
    const { imported, errors } = importModules(jsonStr);
    if (imported > 0) toast(`Imported ${imported} module(s)`, 'success');
    if (errors.length > 0) toast(`Warnings: ${errors.join('; ')}`, 'error');
    renderAIView(viewContainer);
  });
  importBtnRow.appendChild(importBtn);

  if (customModules.length > 0) {
    const exportBtn = html`<button class="btn">Export All Custom</button>`;
    exportBtn.addEventListener('click', () => {
      const json = exportModules();
      navigator.clipboard.writeText(json).then(() => toast('Copied instruction set to clipboard', 'success'));
    });
    importBtnRow.appendChild(exportBtn);
  }

  container.appendChild(importBtnRow);

  // AI Module Generation
  if (isAIConfigured()) {
    container.appendChild(html`<hr style="border-color: var(--border-subtle); margin: 20px 0;">`);
    container.appendChild(html`
      <div class="form-group">
        <label class="form-label">Generate Module with AI</label>
        <textarea class="form-textarea" id="ai-gen-desc" rows="3" placeholder="Describe the analysis you want, e.g.: 'Analyze campaign finance data for potential conflicts of interest by cross-referencing donor organizations with committee voting records'"></textarea>
      </div>
    `);

    const genRow = html`<div style="display: flex; gap: 8px; align-items: center;"></div>`;

    // Operator type hint
    const opSelect = document.createElement('select');
    opSelect.className = 'form-select';
    opSelect.id = 'ai-gen-op';
    opSelect.style.maxWidth = '200px';
    const autoOpt = document.createElement('option');
    autoOpt.value = '';
    autoOpt.textContent = 'Auto-detect operator';
    opSelect.appendChild(autoOpt);
    for (const [code, op] of Object.entries(OPERATORS)) {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = `${op.glyph} ${code}`;
      opSelect.appendChild(opt);
    }
    genRow.appendChild(opSelect);

    const genBtn = html`<button class="btn btn-primary">Generate Module</button>`;
    genBtn.addEventListener('click', async () => {
      const desc = document.getElementById('ai-gen-desc').value.trim();
      if (!desc) { toast('Enter a description', 'error'); return; }
      const opType = document.getElementById('ai-gen-op').value || null;

      genBtn.disabled = true;
      genBtn.textContent = 'Generating...';

      const result = await generateModuleFromDescription(desc, opType);

      genBtn.disabled = false;
      genBtn.textContent = 'Generate Module';

      if (result.success) {
        // Save the generated module
        const { imported } = importModules(JSON.stringify({ modules: [{
          id: result.module.id,
          name: result.module.name,
          operatorType: result.module.operatorType,
          description: result.module.description,
          systemPrompt: result.module.systemPrompt,
          userPromptTemplate: result.module.userPromptTemplate
        }] }));
        toast(`Generated and saved module: ${result.module.name}`, 'success');
        renderAIView(viewContainer);
      } else {
        toast(`Generation failed: ${result.error}`, 'error');
      }
    });
    genRow.appendChild(genBtn);
    container.appendChild(genRow);
  }
}

// ═══════════════════════════════════════════════
// SETTINGS TAB
// ═══════════════════════════════════════════════

function _renderSettingsTab(container, viewContainer) {
  const currentProvider = getProvider();

  container.appendChild(html`
    <div style="max-width: 600px;">
      <div class="card" style="margin-top: 16px;">
        <div class="card-header" style="margin-bottom: 0;">
          <span class="op-glyph" style="border-color: var(--accent); color: var(--accent); width:28px; height:28px; font-size:1rem;">⊡</span>
          <div class="card-title">API Configuration</div>
        </div>
      </div>
    </div>
  `);

  // Provider selector
  container.appendChild(html`
    <div class="form-group" style="max-width: 600px; margin-top: 16px;">
      <label class="form-label">Provider</label>
    </div>
  `);
  const providerSelect = document.createElement('select');
  providerSelect.className = 'form-select';
  providerSelect.style.maxWidth = '600px';
  providerSelect.id = 'ai-provider';
  for (const [val, label] of [['anthropic', 'Anthropic (Claude)'], ['openai', 'OpenAI (GPT)']]) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label;
    opt.selected = val === currentProvider;
    providerSelect.appendChild(opt);
  }
  providerSelect.addEventListener('change', () => {
    setProvider(providerSelect.value);
    renderAIView(viewContainer);
  });
  container.lastElementChild.appendChild(providerSelect);

  // API Key
  const keyGroup = html`
    <div class="form-group" style="max-width: 600px;">
      <label class="form-label">API Key (${currentProvider})</label>
    </div>
  `;
  const keyInput = document.createElement('input');
  keyInput.type = 'password';
  keyInput.className = 'form-input';
  keyInput.id = 'ai-api-key';
  keyInput.placeholder = currentProvider === 'anthropic' ? 'sk-ant-...' : 'sk-...';
  keyInput.value = getAPIKey(currentProvider);
  keyInput.addEventListener('change', () => {
    setAPIKey(currentProvider, keyInput.value.trim());
    toast('API key saved', 'success');
    renderAIView(viewContainer);
  });
  keyGroup.appendChild(keyInput);
  container.appendChild(keyGroup);

  container.appendChild(html`
    <div style="font-size: 0.8rem; color: var(--text-muted); max-width: 600px; margin-bottom: 16px;">
      Your API key is stored in localStorage and sent only to ${currentProvider === 'anthropic' ? 'api.anthropic.com' : 'api.openai.com'}. It never leaves your browser otherwise.
    </div>
  `);

  // Model override
  const modelGroup = html`
    <div class="form-group" style="max-width: 600px;">
      <label class="form-label">Model Override (optional)</label>
    </div>
  `;
  const modelInput = document.createElement('input');
  modelInput.type = 'text';
  modelInput.className = 'form-input';
  modelInput.id = 'ai-model';
  modelInput.placeholder = currentProvider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o';
  modelInput.value = getModel(currentProvider);
  modelInput.addEventListener('change', () => {
    setModel(currentProvider, modelInput.value.trim());
    toast('Model saved', 'success');
  });
  modelGroup.appendChild(modelInput);
  container.appendChild(modelGroup);

  // Test connection
  const testBtn = html`<button class="btn" style="margin-top: 8px;">Test Connection</button>`;
  testBtn.addEventListener('click', async () => {
    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';
    const result = await callLLM('Respond with exactly: OK', 'Test', { maxTokens: 10 });
    testBtn.disabled = false;
    testBtn.textContent = 'Test Connection';
    if (result.success) {
      toast(`Connected to ${getProvider()} (${result.model || 'OK'})`, 'success');
    } else {
      toast(`Connection failed: ${result.error}`, 'error');
    }
  });
  container.appendChild(testBtn);
}
