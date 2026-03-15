/**
 * AI Analysis View — LLM-Powered EO Analysis
 *
 * Top bar: Source selector + module selector + run button (always visible).
 * Results rendered as typed finding cards with severity.
 * Module management moved to slide-out / secondary area.
 */

import { OPERATORS, formatOperator, TRIAD_LABELS } from '../models/operators.js';
import { getAllSources } from '../models/given_log.js';
import { getSourceData } from '../given/service.js';
import { DEFAULT_MODULES, getModulesByTriad } from '../ai/modules.js';
import { getCustomModules, importModules, deleteCustomModule, exportModules, generateModuleFromDescription } from '../ai/module_builder.js';
import { callLLM, isAIConfigured } from '../ai/service.js';
import { getProvider, setProvider, getAPIKey, setAPIKey, getModel, setModel } from '../ai/settings.js';
import { renderDataTable, renderModal, createOpBadge, getTriadClass, html, toast } from './components.js';
import { updateTopBar } from '../app.js';

let _activeTab = 'analyze';
let _lastResult = null;

export function renderAIView(container) {
  container.innerHTML = '';

  const view = html`<div></div>`;

  // Tabs — Analyze is primary, Modules and Settings are secondary
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
  if (_activeTab === 'analyze') {
    updateTopBar('AI Analysis', isAIConfigured() ? `Connected (${getProvider()})` : 'Not configured');
    _renderAnalyzeTab(content);
  } else if (_activeTab === 'modules') {
    updateTopBar('AI Modules', `${DEFAULT_MODULES.length + getCustomModules().length} modules`);
    _renderModulesTab(content, container);
  } else if (_activeTab === 'settings') {
    updateTopBar('AI Settings', getProvider());
    _renderSettingsTab(content, container);
  }

  view.appendChild(content);
  container.appendChild(view);
}

// ═══════════════════════════════════════════════
// ANALYZE TAB — Finding cards layout
// ═══════════════════════════════════════════════

function _renderAnalyzeTab(container) {
  if (!isAIConfigured()) {
    container.appendChild(html`
      <div class="empty-state">
        <div class="glyph">\u22A1</div>
        <p>Configure your API key in the Settings tab to begin AI-powered analysis.</p>
      </div>
    `);
    return;
  }

  const sources = getAllSources();
  if (sources.length === 0) {
    container.appendChild(html`
      <div class="empty-state">
        <div class="glyph">\u25B3</div>
        <p>No data sources yet.<br>Import data in the Sources view first.</p>
      </div>
    `);
    return;
  }

  // ── Controls bar: Source + Module + Run ──
  const controls = document.createElement('div');
  controls.className = 'ai-controls';

  // Source selector
  const sourceField = document.createElement('div');
  sourceField.className = 'ai-field';
  const sourceLabel = document.createElement('label');
  sourceLabel.textContent = 'Source';
  const sourceSelect = document.createElement('select');
  sourceSelect.className = 'form-select';
  sourceSelect.id = 'ai-source-select';
  for (const source of sources) {
    const opt = document.createElement('option');
    opt.value = source.id;
    opt.textContent = `${source.filename} (${source.row_count} rows)`;
    sourceSelect.appendChild(opt);
  }
  sourceField.appendChild(sourceLabel);
  sourceField.appendChild(sourceSelect);
  controls.appendChild(sourceField);

  // Module selector
  const moduleField = document.createElement('div');
  moduleField.className = 'ai-field';
  const moduleLabel = document.createElement('label');
  moduleLabel.textContent = 'Module';
  const moduleSelect = document.createElement('select');
  moduleSelect.className = 'form-select';
  moduleSelect.id = 'ai-module-select';

  const byTriad = getModulesByTriad();
  const customModules = getCustomModules();

  for (const [triad, modules] of Object.entries(byTriad)) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = TRIAD_LABELS[triad] || triad;
    for (const mod of modules) {
      const op = OPERATORS[mod.operatorType];
      const opt = document.createElement('option');
      opt.value = mod.id;
      opt.textContent = `${op.glyph} ${mod.name} (${op.friendlyName})`;
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
      opt.textContent = `${op?.glyph || '?'} ${mod.name} [custom]`;
      customGroup.appendChild(opt);
    }
    moduleSelect.appendChild(customGroup);
  }

  moduleField.appendChild(moduleLabel);
  moduleField.appendChild(moduleSelect);
  controls.appendChild(moduleField);

  // Run button
  const runBtn = document.createElement('button');
  runBtn.className = 'btn btn-primary';
  runBtn.id = 'ai-run-btn';
  runBtn.textContent = 'Analyze';
  runBtn.addEventListener('click', () => _runAnalysis(container));
  controls.appendChild(runBtn);

  container.appendChild(controls);

  // Results area
  const resultsDiv = document.createElement('div');
  resultsDiv.id = 'ai-results';
  container.appendChild(resultsDiv);

  // Show last result if available
  if (_lastResult) {
    _displayResult(_lastResult, resultsDiv);
  }
}

async function _runAnalysis(container) {
  const sourceSelect = document.getElementById('ai-source-select');
  const moduleSelect = document.getElementById('ai-module-select');
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
    data = await getSourceData(source);
  } catch (e) {
    toast('Failed to load source data', 'error');
    return;
  }

  // Find module
  const allModules = [...DEFAULT_MODULES, ...getCustomModules()];
  const mod = allModules.find(m => m.id === moduleId);
  if (!mod) { toast('Module not found', 'error'); return; }

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

  const userPrompt = mod.buildUserPrompt(data, {});
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

  runBtn.disabled = false;
  runBtn.textContent = 'Analyze';

  _displayResult(analysisResult, resultsDiv);
}

function _displayResult(result, container) {
  container.innerHTML = '';

  if (!result.success) {
    container.appendChild(html`
      <div class="finding-card severity-high">
        <div class="finding-header">
          <span class="finding-title">Analysis Failed</span>
          <span class="severity-badge high">Error</span>
        </div>
        <div class="finding-body">${result.error}</div>
      </div>
    `);
    return;
  }

  const op = OPERATORS[result.operatorType];

  // Try to parse as structured JSON
  let parsedJSON = null;
  try {
    let cleaned = result.text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    parsedJSON = JSON.parse(cleaned);
  } catch (e) {
    // Not JSON
  }

  if (parsedJSON) {
    // Render as finding cards
    const findings = _extractFindings(parsedJSON, result.operatorType);

    if (findings.length > 0) {
      for (const finding of findings) {
        container.appendChild(_renderFindingCard(finding, result.operatorType));
      }
    } else {
      // Fallback: single finding card with the whole result
      container.appendChild(_renderFindingCard({
        title: `${op.glyph} ${result.moduleName} \u2014 ${result.sourceName}`,
        description: typeof parsedJSON === 'string' ? parsedJSON : JSON.stringify(parsedJSON, null, 2),
        severity: 'medium'
      }, result.operatorType));
    }
  } else {
    // Plain text result as a single card
    container.appendChild(_renderFindingCard({
      title: `${op.glyph} ${result.moduleName} \u2014 ${result.sourceName}`,
      description: result.text,
      severity: 'medium'
    }, result.operatorType));
  }

  // Meta info
  const metaDiv = document.createElement('div');
  metaDiv.style.cssText = 'font-size: 0.72rem; color: var(--text-muted); margin-top: 8px; display: flex; gap: 16px; align-items: center;';
  metaDiv.innerHTML = `
    <span>${result.rowCount} rows \u00b7 ${result.runtime_ms}ms \u00b7 ${result.model || getProvider()}</span>
  `;

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn btn-sm btn-ghost';
  copyBtn.textContent = 'Copy raw';
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(result.text).then(() => toast('Copied', 'success'));
  });
  metaDiv.appendChild(copyBtn);

  if (result.usage && Object.keys(result.usage).length > 0) {
    const tokens = document.createElement('span');
    tokens.textContent = `Tokens: ${result.usage.input_tokens || result.usage.prompt_tokens || '?'} in / ${result.usage.output_tokens || result.usage.completion_tokens || '?'} out`;
    metaDiv.appendChild(tokens);
  }

  container.appendChild(metaDiv);
}

function _extractFindings(json, operatorType) {
  // Try to extract an array of findings from various JSON shapes
  if (Array.isArray(json)) {
    return json.map(item => _normalizeFind(item, operatorType));
  }
  if (json.findings && Array.isArray(json.findings)) {
    return json.findings.map(item => _normalizeFind(item, operatorType));
  }
  if (json.results && Array.isArray(json.results)) {
    return json.results.map(item => _normalizeFind(item, operatorType));
  }
  if (json.analysis && Array.isArray(json.analysis)) {
    return json.analysis.map(item => _normalizeFind(item, operatorType));
  }
  // Single object with a title/description
  if (json.title || json.finding || json.description) {
    return [_normalizeFind(json, operatorType)];
  }
  return [];
}

function _normalizeFind(item, operatorType) {
  return {
    title: item.title || item.finding || item.name || 'Finding',
    description: item.description || item.detail || item.explanation || item.summary || JSON.stringify(item),
    severity: item.severity || item.priority || _inferSeverity(item),
    operatorType: item.operatorType || operatorType
  };
}

function _inferSeverity(item) {
  const text = JSON.stringify(item).toLowerCase();
  if (text.includes('critical') || text.includes('high') || text.includes('urgent')) return 'high';
  if (text.includes('warning') || text.includes('medium') || text.includes('moderate')) return 'medium';
  return 'low';
}

function _renderFindingCard(finding, defaultOpType) {
  const opType = finding.operatorType || defaultOpType;
  const severity = (finding.severity || 'medium').toLowerCase();

  const card = document.createElement('div');
  card.className = `finding-card severity-${severity}`;

  // Header
  const header = document.createElement('div');
  header.className = 'finding-header';

  const badge = createOpBadge(opType);
  badge.style.fontSize = '0.68rem';
  header.appendChild(badge);

  const title = document.createElement('span');
  title.className = 'finding-title';
  title.textContent = finding.title;
  header.appendChild(title);

  const sevBadge = document.createElement('span');
  sevBadge.className = `severity-badge ${severity}`;
  sevBadge.textContent = severity;
  header.appendChild(sevBadge);

  card.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'finding-body';
  body.textContent = finding.description;
  card.appendChild(body);

  // Save to session link
  const saveLink = document.createElement('div');
  saveLink.className = 'save-to-session';
  saveLink.textContent = `\u2192 Save to session as ${opType} step`;
  saveLink.addEventListener('click', () => {
    toast(`Saved finding as ${opType} step (select a session in Workbook to attach)`, 'info');
  });
  card.appendChild(saveLink);

  return card;
}

// ═══════════════════════════════════════════════
// MODULES TAB
// ═══════════════════════════════════════════════

function _renderModulesTab(container, viewContainer) {
  const byTriad = getModulesByTriad();

  for (const [triad, modules] of Object.entries(byTriad)) {
    const triadColors = { Existence: 'given-border', Structure: 'completed-border', Significance: 'meant-border' };
    container.appendChild(html`
      <h3 style="font-size: 0.95rem; color: var(--${triadColors[triad]}); margin: 20px 0 8px;">
        ${TRIAD_LABELS[triad] || triad}
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

  // Import section
  container.appendChild(html`<hr style="border-color: var(--border-subtle); margin: 20px 0;">`);

  container.appendChild(html`
    <div class="form-group">
      <label class="form-label">Import JSON Instruction Set</label>
      <textarea class="code-editor" id="ai-import-json" style="min-height: 160px;" placeholder='{
  "modules": [{
    "id": "my-custom-analysis",
    "name": "My Custom Analysis",
    "operatorType": "SEG",
    "description": "What this module does",
    "systemPrompt": "You are an analyst...",
    "userPromptTemplate": "Analyze this dataset..."
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
        <textarea class="form-textarea" id="ai-gen-desc" rows="3" placeholder="Describe the analysis you want..."></textarea>
      </div>
    `);

    const genRow = html`<div style="display: flex; gap: 8px; align-items: center;"></div>`;

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
          <span class="op-glyph" style="border-color: var(--accent); color: var(--accent); width:28px; height:28px; font-size:1rem;">\u22A1</span>
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
      Your API key is stored in localStorage and sent only to ${currentProvider === 'anthropic' ? 'api.anthropic.com' : 'api.openai.com'}.
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
