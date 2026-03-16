/**
 * Session View — Notebook-Style Workbook
 * Inline notebook cells with collapsible code/output zones.
 * Inline step insertion with operator picker.
 */

import { getAllSessions } from '../models/meant_graph.js';
import { getAllSources } from '../models/given_log.js';
import { OPERATORS, formatOperator, formatOperatorFriendly } from '../models/operators.js';
import { startSession, addStep, executeStep, getSessionChain } from '../meant/service.js';
import { renderOperatorPicker, renderMiniTable, renderHelixBar, renderDataTable, renderModal, createOpBadge, getTriadClass, html, toast } from './components.js';
import { updateTopBar } from '../app.js';
import { getModulesForOperator } from '../ai/modules.js';
import { getCustomModules } from '../ai/module_builder.js';

let _currentSessionId = null;

/**
 * Render the session view.
 */
export function renderSessionView(container) {
  container.innerHTML = '';

  if (_currentSessionId) {
    _renderActiveSession(container, _currentSessionId);
  } else {
    _renderSessionList(container);
  }
}

function _renderSessionList(container) {
  container.innerHTML = '';
  const sessions = getAllSessions();

  updateTopBar('Workbook', `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`, [
    {
      label: 'New Session',
      primary: true,
      onClick: () => _showNewSessionModal(container)
    }
  ]);

  if (sessions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="ph ph-graph" style="font-size: 3rem;"></i></div>
        <p>No analysis sessions yet.<br>Create a session to begin your analysis.</p>
      </div>
    `;
    return;
  }

  for (const session of sessions) {
    const card = html`
      <div class="card" style="cursor: pointer;">
        <div class="card-header" style="margin-bottom: 0;">
          <span class="op-glyph significance" style="width:28px;height:28px;font-size:0.9rem;"><i class="ph ph-graph"></i></span>
          <div style="flex: 1;">
            <div class="card-title">${session.name}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">
              ${session.mode} mode \u00b7 ${new Date(session.created_at).toLocaleDateString()}
              ${session.description ? ` \u00b7 ${session.description}` : ''}
            </div>
          </div>
          <span class="meant-badge">${session.mode}</span>
        </div>
      </div>
    `;
    card.addEventListener('click', () => {
      _currentSessionId = session.id;
      _renderActiveSession(container, session.id);
    });
    container.appendChild(card);
  }
}

function _renderActiveSession(container, sessionId) {
  container.innerHTML = '';

  const chain = getSessionChain(sessionId);

  // Find session name from chain or sessions list
  const sessions = getAllSessions();
  const sessionObj = sessions.find(s => s.id === sessionId);
  const sessionName = sessionObj?.name || 'Session';
  const sessionMode = sessionObj?.mode || 'explore';
  const staleCount = chain.filter(s => s.status === 'stale').length;

  updateTopBar(sessionName, `${sessionMode} mode \u00b7 ${chain.length} step${chain.length !== 1 ? 's' : ''}`, [
    {
      label: '\u2190 Sessions',
      onClick: () => {
        _currentSessionId = null;
        _renderSessionList(container);
      }
    },
    ...(staleCount > 0 ? [{
      label: `Run ${staleCount} stale`,
      onClick: () => _runAllStale(chain, sessionId, container)
    }] : []),
    {
      label: 'Run all',
      primary: true,
      onClick: () => _runAll(chain, sessionId, container)
    }
  ]);

  // Render notebook cells
  if (chain.length === 0) {
    container.appendChild(html`
      <div class="empty-state" style="padding: 30px;">
        <p>No steps yet. Add a step below to begin analysis.</p>
      </div>
    `);
  } else {
    for (let i = 0; i < chain.length; i++) {
      const step = chain[i];

      // Render cell
      container.appendChild(_renderNotebookCell(step, i, sessionId, container));

      // Insertion target between cells (not after the last one — the bottom one covers that)
      if (i < chain.length - 1) {
        container.appendChild(_renderInsertionTarget(i + 1, sessionId, container, false));
      }
    }
  }

  // Bottom insertion target (always visible)
  container.appendChild(_renderInsertionTarget(chain.length, sessionId, container, true));
}

// ============ Notebook Cell ============

function _renderNotebookCell(step, index, sessionId, viewContainer) {
  const op = step.operator || OPERATORS[step.operator_type];
  const triadClass = getTriadClass(step.operator_type);
  const statusClass = (step.status === 'failed') ? 'nb-cell--failed' : (step.status === 'stale') ? 'nb-cell--stale' : '';

  const cell = document.createElement('div');
  cell.className = `nb-cell ${statusClass}`;
  cell.dataset.stepId = step.id;

  // ── Header (always visible) ──
  const header = document.createElement('div');
  header.className = 'cell-header';

  const badge = createOpBadge(step.operator_type);

  const desc = document.createElement('span');
  desc.className = 'cell-desc';
  desc.textContent = step.description;

  const meta = document.createElement('span');
  meta.className = 'cell-meta';

  const dot = document.createElement('span');
  dot.className = `status-dot ${step.status}`;
  meta.appendChild(dot);

  if (step.executionLog?.rowsOut !== undefined) {
    const rowInfo = document.createTextNode(` ${step.executionLog.rowsOut} rows`);
    meta.appendChild(rowInfo);
  }
  if (step.executionLog?.runtime_ms !== undefined) {
    const runtime = document.createTextNode(` \u00b7 ${step.executionLog.runtime_ms < 1000 ? step.executionLog.runtime_ms + 'ms' : (step.executionLog.runtime_ms / 1000).toFixed(1) + 's'}`);
    meta.appendChild(runtime);
  }
  if (step.status === 'stale') {
    meta.appendChild(document.createTextNode(' stale'));
  }
  if (step.status === 'failed') {
    meta.appendChild(document.createTextNode(' failed'));
  }

  header.appendChild(badge);

  // AI mode indicator
  if (step.execution_mode === 'ai') {
    const aiBadge = document.createElement('span');
    aiBadge.className = 'meant-badge';
    aiBadge.style.cssText = 'font-size: 0.68rem; padding: 2px 6px; background: var(--primary); color: white; border-radius: 4px; margin-right: 6px;';
    aiBadge.textContent = 'AI';
    header.appendChild(aiBadge);
  }

  header.appendChild(desc);
  header.appendChild(meta);

  // Toggle expand/collapse on header click
  header.addEventListener('click', () => {
    const codeEl = cell.querySelector('.cell-code');
    const outputEl = cell.querySelector('.cell-output');
    const errorEl = cell.querySelector('.cell-error');
    if (codeEl) codeEl.hidden = !codeEl.hidden;
    if (outputEl) outputEl.hidden = !outputEl.hidden;
    if (errorEl) errorEl.hidden = !errorEl.hidden;
  });

  cell.appendChild(header);

  // ── Code / AI body (collapsible) ──
  if (step.execution_mode === 'ai') {
    const aiBody = document.createElement('div');
    aiBody.className = 'cell-code';
    aiBody.style.whiteSpace = 'pre-wrap';

    const aiConfig = step.ai_config_json ? JSON.parse(step.ai_config_json) : {};
    const dataSelector = step.data_selector_json ? JSON.parse(step.data_selector_json) : null;

    let summaryLines = [];
    if (aiConfig.moduleId) summaryLines.push(`Module: ${aiConfig.moduleId}`);
    if (aiConfig.systemPrompt) {
      const truncated = aiConfig.systemPrompt.length > 120
        ? aiConfig.systemPrompt.slice(0, 120) + '...'
        : aiConfig.systemPrompt;
      summaryLines.push(`System: ${truncated}`);
    }
    if (aiConfig.userPromptTemplate) {
      const truncated = aiConfig.userPromptTemplate.length > 120
        ? aiConfig.userPromptTemplate.slice(0, 120) + '...'
        : aiConfig.userPromptTemplate;
      summaryLines.push(`Prompt: ${truncated}`);
    }
    if (dataSelector) {
      const parts = [];
      if (dataSelector.fields) parts.push(`${dataSelector.fields.length} fields`);
      if (dataSelector.filter) parts.push(`filter: ${dataSelector.filter}`);
      if (dataSelector.sampleSize) parts.push(`max ${dataSelector.sampleSize} rows`);
      if (dataSelector.groupBy) parts.push(`grouped by ${dataSelector.groupBy}`);
      if (parts.length > 0) summaryLines.push(`Data: ${parts.join(', ')}`);
    }
    if (aiConfig.outputFormat) summaryLines.push(`Output: ${aiConfig.outputFormat}`);

    aiBody.textContent = summaryLines.join('\n');
    aiBody.hidden = (step.status === 'completed' || step.status === 'stale');
    cell.appendChild(aiBody);

    // Show raw LLM response if available
    if (step.executionLog?.stdout) {
      const llmResponse = document.createElement('div');
      llmResponse.className = 'cell-code';
      llmResponse.style.cssText = 'white-space: pre-wrap; font-size: 0.75rem; max-height: 200px; overflow-y: auto; border-top: 1px solid var(--border);';
      llmResponse.textContent = step.executionLog.stdout;
      llmResponse.hidden = true;

      const toggleLink = document.createElement('div');
      toggleLink.style.cssText = 'padding: 2px 14px; font-size: 0.72rem; color: var(--primary); cursor: pointer;';
      toggleLink.textContent = 'Show LLM response';
      toggleLink.addEventListener('click', (e) => {
        e.stopPropagation();
        llmResponse.hidden = !llmResponse.hidden;
        toggleLink.textContent = llmResponse.hidden ? 'Show LLM response' : 'Hide LLM response';
      });

      cell.appendChild(toggleLink);
      cell.appendChild(llmResponse);
    }
  } else if (step.code) {
    const codeBody = document.createElement('div');
    codeBody.className = 'cell-code';
    codeBody.textContent = step.code;
    // Default: collapsed for completed, open for pending/failed
    codeBody.hidden = (step.status === 'completed' || step.status === 'stale');
    cell.appendChild(codeBody);
  }

  // ── Output panel (collapsible) ──
  if ((step.status === 'completed' || step.status === 'stale') && step.outputs && step.outputs.length > 0) {
    const outputPanel = document.createElement('div');
    outputPanel.className = 'cell-output';

    for (const output of step.outputs) {
      try {
        const data = output.data_json ? JSON.parse(output.data_json) : [];
        if (data.length > 0) {
          const columns = Object.keys(data[0]);

          const outputHeader = document.createElement('div');
          outputHeader.className = 'output-header';
          outputHeader.textContent = `Output \u00b7 ${data.length} row${data.length !== 1 ? 's' : ''}`;
          outputPanel.appendChild(outputHeader);

          const tableWrapper = renderMiniTable(data, columns, 5);
          outputPanel.appendChild(tableWrapper);
        }
      } catch (e) {
        // Skip if data can't be parsed
      }
    }

    cell.appendChild(outputPanel);
  }

  // ── Error display (for failed steps) ──
  if (step.status === 'failed') {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'cell-error';

    const errorMsg = step.executionLog?.error || step.error || 'Step failed';
    errorDiv.textContent = errorMsg;

    const rerunBtn = document.createElement('button');
    rerunBtn.className = 'btn btn-sm';
    rerunBtn.style.cssText = 'margin-top: 8px; border-color: var(--failed-border); color: var(--failed-border);';
    rerunBtn.textContent = 'Re-run';
    rerunBtn.dataset.action = 'run';
    rerunBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await _rerunStep(step.id, sessionId, viewContainer);
    });
    errorDiv.appendChild(rerunBtn);

    cell.appendChild(errorDiv);
  }

  // ── Notation (if present, shown small) ──
  if (step.notation) {
    const notationText = typeof step.notation === 'string' ? step.notation : (step.notation.text || '');
    if (notationText) {
      const notation = document.createElement('div');
      notation.style.cssText = 'padding: 4px 14px 6px; font-size: 0.72rem; color: var(--text-muted); font-family: "JetBrains Mono", monospace;';
      notation.textContent = notationText;
      cell.appendChild(notation);
    }
  }

  return cell;
}

// ============ Insertion Targets ============

function _renderInsertionTarget(insertIndex, sessionId, viewContainer, isBottom) {
  const wrapper = document.createElement('div');

  const target = document.createElement('div');
  target.className = `cell-insert ${isBottom ? 'always-visible' : ''}`;
  target.textContent = isBottom ? '+ Add step \u2014 or press /' : '+ insert step';

  if (isBottom) {
    target.innerHTML = '+ Add step \u2014 or press <kbd>/</kbd>';
  }

  target.addEventListener('click', () => {
    // Remove any existing pickers/forms
    document.querySelectorAll('.op-picker.open').forEach(p => {
      if (p.id !== 'op-picker-' + insertIndex) p.classList.remove('open');
    });
    document.querySelectorAll('.inline-step-form').forEach(f => f.remove());

    // Toggle picker
    let picker = wrapper.querySelector('.op-picker');
    if (picker) {
      picker.classList.toggle('open');
    } else {
      picker = renderOperatorPicker((code) => {
        picker.classList.remove('open');
        _showInlineStepForm(wrapper, code, insertIndex, sessionId, viewContainer);
      });
      picker.id = isBottom ? 'op-picker-bottom' : 'op-picker-' + insertIndex;
      wrapper.appendChild(picker);
    }
  });

  wrapper.appendChild(target);
  return wrapper;
}

function _showInlineStepForm(wrapper, operatorCode, insertIndex, sessionId, viewContainer) {
  // Remove any existing form
  wrapper.querySelectorAll('.inline-step-form').forEach(f => f.remove());

  const op = OPERATORS[operatorCode];
  const form = document.createElement('div');
  form.className = 'inline-step-form';

  const badge = createOpBadge(operatorCode);
  badge.style.marginBottom = '10px';
  form.appendChild(badge);

  // Description
  const descGroup = document.createElement('div');
  descGroup.className = 'form-group';
  const descLabel = document.createElement('label');
  descLabel.className = 'form-label';
  descLabel.textContent = 'Description';
  const descInput = document.createElement('input');
  descInput.className = 'form-input';
  descInput.placeholder = `What does this ${op.friendlyName} step do?`;
  descGroup.appendChild(descLabel);
  descGroup.appendChild(descInput);
  form.appendChild(descGroup);

  // Input selector
  const inputGroup = document.createElement('div');
  inputGroup.className = 'form-group';
  const inputLabel = document.createElement('label');
  inputLabel.className = 'form-label';
  inputLabel.textContent = 'Input';
  const inputSelect = document.createElement('select');
  inputSelect.className = 'form-select';
  inputSelect.multiple = true;
  inputSelect.style.minHeight = '60px';

  const sources = getAllSources();
  for (const source of sources) {
    const opt = document.createElement('option');
    opt.value = source.id;
    opt.textContent = `${source.filename} (${source.row_count} rows)`;
    inputSelect.appendChild(opt);
  }

  const chain = getSessionChain(sessionId);
  for (const step of chain) {
    if (step.outputs) {
      for (const output of step.outputs) {
        const opt = document.createElement('option');
        opt.value = step.id;
        opt.textContent = `Step ${step.sequence_number}: ${OPERATORS[step.operator_type].friendlyName} \u2014 ${output.name} (${output.row_count || '?'} rows)`;
        inputSelect.appendChild(opt);
      }
    }
  }

  inputGroup.appendChild(inputLabel);
  inputGroup.appendChild(inputSelect);
  form.appendChild(inputGroup);

  // ── Execution Mode Toggle ──
  let currentMode = 'code';

  const modeGroup = document.createElement('div');
  modeGroup.className = 'form-group';
  const modeLabel = document.createElement('label');
  modeLabel.className = 'form-label';
  modeLabel.textContent = 'Execution Mode';
  const modeToggle = document.createElement('div');
  modeToggle.style.cssText = 'display: flex; gap: 0; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; width: fit-content;';

  const codeBtn = document.createElement('button');
  codeBtn.type = 'button';
  codeBtn.textContent = 'Code';
  codeBtn.style.cssText = 'padding: 6px 16px; border: none; cursor: pointer; font-size: 0.82rem; background: var(--primary); color: white;';

  const aiBtn = document.createElement('button');
  aiBtn.type = 'button';
  aiBtn.textContent = 'AI';
  aiBtn.style.cssText = 'padding: 6px 16px; border: none; cursor: pointer; font-size: 0.82rem; background: var(--bg-secondary); color: var(--text-secondary);';

  modeToggle.appendChild(codeBtn);
  modeToggle.appendChild(aiBtn);
  modeGroup.appendChild(modeLabel);
  modeGroup.appendChild(modeToggle);
  form.appendChild(modeGroup);

  // ── Code Panel ──
  const codePanel = document.createElement('div');

  const codeGroup = document.createElement('div');
  codeGroup.className = 'form-group';
  const codePanelLabel = document.createElement('label');
  codePanelLabel.className = 'form-label';
  codePanelLabel.textContent = 'Code (optional)';
  const codeInput = document.createElement('textarea');
  codeInput.className = 'code-editor';
  codeInput.style.minHeight = '80px';
  codeInput.placeholder = '# Access inputs as DataFrames by filename\nresult = your_dataframe';
  codeGroup.appendChild(codePanelLabel);
  codeGroup.appendChild(codeInput);
  codePanel.appendChild(codeGroup);

  form.appendChild(codePanel);

  // ── AI Panel ──
  const aiPanel = document.createElement('div');
  aiPanel.hidden = true;

  // Module preset selector
  const presetGroup = document.createElement('div');
  presetGroup.className = 'form-group';
  const presetLabel = document.createElement('label');
  presetLabel.className = 'form-label';
  presetLabel.textContent = 'Module Preset';
  const presetSelect = document.createElement('select');
  presetSelect.className = 'form-select';

  const customOpt = document.createElement('option');
  customOpt.value = '';
  customOpt.textContent = 'Custom (write your own prompts)';
  presetSelect.appendChild(customOpt);

  const builtInModules = getModulesForOperator(operatorCode);
  for (const mod of builtInModules) {
    const opt = document.createElement('option');
    opt.value = mod.id;
    opt.textContent = `${mod.name} (built-in)`;
    opt.dataset.system = mod.systemPrompt;
    opt.dataset.template = mod.buildUserPrompt ? '' : '';
    presetSelect.appendChild(opt);
  }

  const customModules = getCustomModules().filter(m => m.operatorType === operatorCode);
  for (const mod of customModules) {
    const opt = document.createElement('option');
    opt.value = mod.id;
    opt.textContent = `${mod.name} (custom)`;
    presetSelect.appendChild(opt);
  }

  presetGroup.appendChild(presetLabel);
  presetGroup.appendChild(presetSelect);
  aiPanel.appendChild(presetGroup);

  // System prompt
  const sysGroup = document.createElement('div');
  sysGroup.className = 'form-group';
  const sysLabel = document.createElement('label');
  sysLabel.className = 'form-label';
  sysLabel.textContent = 'System Prompt';
  const sysInput = document.createElement('textarea');
  sysInput.className = 'code-editor';
  sysInput.style.minHeight = '60px';
  sysInput.placeholder = 'Instructions for the AI analyst...';
  sysGroup.appendChild(sysLabel);
  sysGroup.appendChild(sysInput);
  aiPanel.appendChild(sysGroup);

  // User prompt template
  const userGroup = document.createElement('div');
  userGroup.className = 'form-group';
  const userLabel = document.createElement('label');
  userLabel.className = 'form-label';
  userLabel.textContent = 'User Prompt Template';
  const userTemplateHelp = document.createElement('span');
  userTemplateHelp.style.cssText = 'font-size: 0.72rem; color: var(--text-muted); margin-left: 6px;';
  userTemplateHelp.textContent = 'Use {{data}}, {{fieldNames}}, {{rowCount}}';
  userLabel.appendChild(userTemplateHelp);
  const userInput = document.createElement('textarea');
  userInput.className = 'code-editor';
  userInput.style.minHeight = '60px';
  userInput.placeholder = 'Analyze this data:\n\n{{data}}';
  userGroup.appendChild(userLabel);
  userGroup.appendChild(userInput);
  aiPanel.appendChild(userGroup);

  // Data Selector section
  const dsSection = document.createElement('div');
  dsSection.className = 'form-group';
  const dsLabel = document.createElement('label');
  dsLabel.className = 'form-label';
  dsLabel.textContent = 'Data Selector (EOQL)';

  const dsGrid = document.createElement('div');
  dsGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 8px;';

  // Filter expression
  const filterWrap = document.createElement('div');
  const filterLabel = document.createElement('label');
  filterLabel.style.cssText = 'font-size: 0.75rem; color: var(--text-secondary);';
  filterLabel.textContent = 'Filter expression';
  const filterInput = document.createElement('input');
  filterInput.className = 'form-input';
  filterInput.placeholder = 'e.g. amount > 1000';
  filterInput.style.fontSize = '0.82rem';
  filterWrap.appendChild(filterLabel);
  filterWrap.appendChild(filterInput);

  // Sample size
  const sampleWrap = document.createElement('div');
  const sampleLabel = document.createElement('label');
  sampleLabel.style.cssText = 'font-size: 0.75rem; color: var(--text-secondary);';
  sampleLabel.textContent = 'Sample size (max rows)';
  const sampleInput = document.createElement('input');
  sampleInput.className = 'form-input';
  sampleInput.type = 'number';
  sampleInput.value = '50';
  sampleInput.min = '1';
  sampleInput.style.fontSize = '0.82rem';
  sampleWrap.appendChild(sampleLabel);
  sampleWrap.appendChild(sampleInput);

  dsGrid.appendChild(filterWrap);
  dsGrid.appendChild(sampleWrap);
  dsSection.appendChild(dsLabel);
  dsSection.appendChild(dsGrid);
  aiPanel.appendChild(dsSection);

  // Output format
  const outGroup = document.createElement('div');
  outGroup.className = 'form-group';
  const outLabel = document.createElement('label');
  outLabel.className = 'form-label';
  outLabel.textContent = 'Output Format';
  const outSelect = document.createElement('select');
  outSelect.className = 'form-select';
  for (const [val, label] of [['json_array', 'JSON Array'], ['json_object', 'JSON Object'], ['text', 'Text']]) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label;
    outSelect.appendChild(opt);
  }
  outGroup.appendChild(outLabel);
  outGroup.appendChild(outSelect);
  aiPanel.appendChild(outGroup);

  form.appendChild(aiPanel);

  // Module preset change handler — pre-fill prompts
  const allModules = [...builtInModules, ...customModules];
  presetSelect.addEventListener('change', () => {
    const moduleId = presetSelect.value;
    if (!moduleId) return;
    const mod = allModules.find(m => m.id === moduleId);
    if (mod) {
      sysInput.value = mod.systemPrompt || '';
      userInput.value = mod.userPromptTemplate || '';
    }
  });

  // Mode toggle handlers
  codeBtn.addEventListener('click', () => {
    currentMode = 'code';
    codeBtn.style.background = 'var(--primary)';
    codeBtn.style.color = 'white';
    aiBtn.style.background = 'var(--bg-secondary)';
    aiBtn.style.color = 'var(--text-secondary)';
    codePanel.hidden = false;
    aiPanel.hidden = true;
  });

  aiBtn.addEventListener('click', () => {
    currentMode = 'ai';
    aiBtn.style.background = 'var(--primary)';
    aiBtn.style.color = 'white';
    codeBtn.style.background = 'var(--bg-secondary)';
    codeBtn.style.color = 'var(--text-secondary)';
    codePanel.hidden = true;
    aiPanel.hidden = false;
  });

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => form.remove());

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary';
  addBtn.textContent = 'Add & run';
  addBtn.addEventListener('click', async () => {
    const desc = descInput.value.trim();
    if (!desc) { toast('Description is required', 'error'); return; }

    const selectedInputs = Array.from(inputSelect.selectedOptions).map(o => o.value);

    try {
      let stepParams;

      if (currentMode === 'ai') {
        const systemPrompt = sysInput.value.trim();
        const userPromptTemplate = userInput.value.trim();
        if (!systemPrompt && !userPromptTemplate) {
          toast('AI mode requires at least a system prompt or user prompt template', 'error');
          return;
        }

        stepParams = {
          sessionId,
          operatorType: operatorCode,
          description: desc,
          inputIds: selectedInputs,
          executionMode: 'ai',
          aiConfig: {
            systemPrompt: systemPrompt || undefined,
            userPromptTemplate: userPromptTemplate || undefined,
            moduleId: presetSelect.value || undefined,
            outputFormat: outSelect.value,
            maxTokens: 4096,
            temperature: 0.2
          },
          dataSelector: {
            filter: filterInput.value.trim() || undefined,
            sampleSize: parseInt(sampleInput.value, 10) || 50
          }
        };
      } else {
        stepParams = {
          sessionId,
          operatorType: operatorCode,
          description: desc,
          inputIds: selectedInputs,
          code: codeInput.value
        };
      }

      const { stepId, helixValidation } = addStep(stepParams);

      if (helixValidation.warnings.length > 0) {
        for (const w of helixValidation.warnings) {
          toast(`\u26A0 ${w}`, 'info');
        }
      }

      toast(`Executing ${op.friendlyName}...`, 'info');
      const result = await executeStep(stepId);

      if (result.success) {
        toast(`${op.friendlyName} completed: ${result.executionLog.rowsOut} rows`, 'success');
      } else {
        toast(`${op.friendlyName} failed: ${result.error}`, 'error');
      }

      _renderActiveSession(viewContainer, sessionId);
    } catch (err) {
      toast(`Error: ${err.message}`, 'error');
    }
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(addBtn);
  form.appendChild(btnRow);

  wrapper.appendChild(form);
  descInput.focus();
}

// ============ Actions ============

async function _rerunStep(stepId, sessionId, viewContainer) {
  toast('Re-running step...', 'info');
  try {
    const result = await executeStep(stepId);
    if (result.success) {
      toast(`Completed: ${result.executionLog.rowsOut} rows`, 'success');
    } else {
      toast(`Failed: ${result.error}`, 'error');
    }
    _renderActiveSession(viewContainer, sessionId);
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
}

async function _runAll(chain, sessionId, viewContainer) {
  const pending = chain.filter(s => s.status !== 'completed');
  if (pending.length === 0) {
    toast('All steps already completed', 'info');
    return;
  }

  toast(`Running ${pending.length} step${pending.length !== 1 ? 's' : ''}...`, 'info');
  let executed = 0;

  for (const step of chain) {
    if (step.status !== 'completed') {
      try {
        const result = await executeStep(step.id);
        if (result.success) {
          executed++;
        } else {
          toast(`Step ${step.sequence_number} failed: ${result.error}`, 'error');
          break;
        }
      } catch (e) {
        toast(`Step ${step.sequence_number} failed: ${e.message}`, 'error');
        break;
      }
    }
  }

  if (executed > 0) {
    toast(`Completed ${executed} step${executed !== 1 ? 's' : ''}`, 'success');
  }
  _renderActiveSession(viewContainer, sessionId);
}

async function _runAllStale(chain, sessionId, viewContainer) {
  const stale = chain.filter(s => s.status === 'stale');
  if (stale.length === 0) {
    toast('No stale steps to run', 'info');
    return;
  }

  toast(`Running ${stale.length} stale step${stale.length !== 1 ? 's' : ''}...`, 'info');
  let executed = 0;

  for (const step of chain) {
    if (step.status === 'stale') {
      try {
        const result = await executeStep(step.id);
        if (result.success) {
          executed++;
        } else {
          toast(`Step ${step.sequence_number} failed: ${result.error}`, 'error');
        }
      } catch (e) {
        toast(`Step ${step.sequence_number} failed: ${e.message}`, 'error');
      }
    }
  }

  if (executed > 0) {
    toast(`Completed ${executed} stale step${executed !== 1 ? 's' : ''}`, 'success');
  }
  _renderActiveSession(viewContainer, sessionId);
}

function _showNewSessionModal(container) {
  const form = html`
    <div>
      <div class="form-group">
        <label class="form-label">Session Name</label>
        <input class="form-input" id="session-name" placeholder="e.g., Campaign Finance Analysis 2023">
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="session-desc" rows="2" placeholder="What is this analysis investigating?"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Mode</label>
        <select class="form-select" id="session-mode">
          <option value="explore">Explore \u2014 ordering issues warned, not blocked</option>
          <option value="confirm">Confirm \u2014 ordering issues block export</option>
        </select>
      </div>
    </div>
  `;

  renderModal('New Analysis Session', form, [
    { label: 'Cancel' },
    {
      label: 'Create Session',
      primary: true,
      onClick: () => {
        const name = document.getElementById('session-name').value.trim();
        if (!name) { toast('Session name required', 'error'); return; }

        const sessionId = startSession({
          name,
          description: document.getElementById('session-desc').value.trim(),
          mode: document.getElementById('session-mode').value
        });

        _currentSessionId = sessionId;
        toast(`Session created: ${name}`, 'success');
        _renderActiveSession(container, sessionId);
      }
    }
  ]);
}

export function setCurrentSession(sessionId) {
  _currentSessionId = sessionId;
}
