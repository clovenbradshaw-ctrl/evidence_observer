/**
 * AI Step Executor — LLM-based pipeline step execution
 * Handles data selection (EOQL-style), prompt building, LLM calling,
 * and response parsing for steps with execution_mode = 'ai'.
 *
 * Returns the same result shape as executeStepCode() so the service
 * layer, notation, and DAG all work unchanged.
 */

import { callLLM } from '../ai/service.js';

/**
 * Apply EOQL-style data selection to input data before sending to the LLM.
 *
 * @param {Array<{name: string, data: Array}>} inputData - Step inputs
 * @param {Object} selectorConfig - { fields, filter, sampleSize, groupBy, sortBy, sortOrder }
 * @returns {Array|Object} Selected rows (array), or grouped rows ({ groupKey: rows[] })
 */
export function applyDataSelector(inputData, selectorConfig) {
  let rows = inputData.flatMap(i => i.data);

  // Field projection (SIG-style)
  if (selectorConfig.fields && selectorConfig.fields.length > 0) {
    rows = rows.map(row => {
      const projected = {};
      for (const f of selectorConfig.fields) {
        if (f in row) projected[f] = row[f];
      }
      return projected;
    });
  }

  // Filter (SEG-style) — evaluated as JS expression with row fields in scope
  if (selectorConfig.filter) {
    rows = rows.filter(row => {
      try {
        const keys = Object.keys(row);
        const vals = Object.values(row);
        const fn = new Function(...keys, `return (${selectorConfig.filter})`);
        return fn(...vals);
      } catch {
        return true; // keep row if filter expression fails
      }
    });
  }

  // Sort (ALT-style)
  if (selectorConfig.sortBy) {
    const field = selectorConfig.sortBy;
    const desc = selectorConfig.sortOrder === 'desc';
    rows.sort((a, b) => {
      const va = a[field], vb = b[field];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return desc ? 1 : -1;
      if (va > vb) return desc ? -1 : 1;
      return 0;
    });
  }

  // Sample — limit rows sent to LLM
  if (selectorConfig.sampleSize && rows.length > selectorConfig.sampleSize) {
    rows = rows.slice(0, selectorConfig.sampleSize);
  }

  // GroupBy — returns { groupKey: rows[] } for per-group LLM calls
  if (selectorConfig.groupBy) {
    const groups = {};
    for (const row of rows) {
      const key = String(row[selectorConfig.groupBy] ?? '_ungrouped');
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
    return groups;
  }

  return rows;
}

/**
 * Build a user prompt from a template and selected data.
 * Supports {{data}}, {{fieldNames}}, {{rowCount}} placeholders.
 *
 * @param {string} template - User prompt template
 * @param {Array} selectedData - Rows after data selection
 * @returns {string} Expanded prompt
 */
export function buildPrompt(template, selectedData) {
  const sample = JSON.stringify(selectedData.slice(0, 100), null, 2);
  const fieldNames = selectedData.length > 0
    ? Object.keys(selectedData[0]).join(', ')
    : 'none';

  return template
    .replace(/\{\{data\}\}/g, sample)
    .replace(/\{\{fieldNames\}\}/g, fieldNames)
    .replace(/\{\{rowCount\}\}/g, String(selectedData.length));
}

/**
 * Parse an AI response into structured tabular output.
 *
 * @param {string} text - Raw LLM response text
 * @param {string} outputFormat - 'json_array' | 'json_object' | 'text'
 * @returns {{ rows: Array<Object> }}
 */
export function parseAIResponse(text, outputFormat) {
  // Strip markdown code fences
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const parsed = JSON.parse(cleaned);

    if (outputFormat === 'json_array' && Array.isArray(parsed)) {
      return { rows: parsed };
    }
    if (outputFormat === 'json_array' && !Array.isArray(parsed)) {
      // Look for the first array property
      for (const val of Object.values(parsed)) {
        if (Array.isArray(val)) return { rows: val };
      }
    }
    // Wrap single object in array
    return { rows: Array.isArray(parsed) ? parsed : [parsed] };
  } catch {
    // Fallback: store as single-row text output
    return { rows: [{ ai_response: text }] };
  }
}

/**
 * Execute an AI step: apply data selector, build prompt, call LLM, parse response.
 *
 * @param {Object} aiConfig - { systemPrompt, userPromptTemplate, outputFormat, maxTokens, temperature }
 * @param {Array<{name: string, data: Array}>} inputData - Step inputs
 * @param {Object|null} dataSelector - EOQL data selector config
 * @returns {Promise<Object>} Same shape as executeStepCode() result
 */
export async function executeAIStep(aiConfig, inputData, dataSelector) {
  const startTime = performance.now();

  // 1. Apply EOQL data selection
  const selectedData = applyDataSelector(inputData, dataSelector || {});

  // 2. Handle grouped execution (groupBy produces an object of groups)
  if (selectedData && !Array.isArray(selectedData)) {
    // Per-group LLM calls
    const allRows = [];
    let totalUsage = { input_tokens: 0, output_tokens: 0 };
    let lastModel = null;
    const groupStdout = [];

    for (const [groupKey, groupRows] of Object.entries(selectedData)) {
      const userPrompt = buildPrompt(
        aiConfig.userPromptTemplate || 'Analyze this data:\n\n{{data}}',
        groupRows
      );

      const llmResult = await callLLM(
        aiConfig.systemPrompt || 'You are a data analyst. Respond with structured JSON.',
        userPrompt,
        { maxTokens: aiConfig.maxTokens || 4096, temperature: aiConfig.temperature ?? 0.2 }
      );

      if (!llmResult.success) {
        return {
          success: false,
          error: `LLM call failed for group "${groupKey}": ${llmResult.error}`,
          runtime_ms: Math.round(performance.now() - startTime)
        };
      }

      const parsed = parseAIResponse(llmResult.text, aiConfig.outputFormat || 'json_array');
      // Tag each row with its group
      for (const row of parsed.rows) {
        row._group = groupKey;
      }
      allRows.push(...parsed.rows);

      if (llmResult.usage) {
        totalUsage.input_tokens += llmResult.usage.input_tokens || 0;
        totalUsage.output_tokens += llmResult.usage.output_tokens || 0;
      }
      lastModel = llmResult.model || lastModel;
      groupStdout.push(`--- Group: ${groupKey} ---\n${llmResult.text}`);
    }

    const totalIn = Object.values(selectedData).reduce((s, g) => s + g.length, 0);
    return {
      success: true,
      result: allRows,
      rowsIn: totalIn,
      rowsOut: allRows.length,
      stdout: groupStdout.join('\n\n'),
      stderr: '',
      runtime_ms: Math.round(performance.now() - startTime),
      warnings: [],
      usage: totalUsage,
      model: lastModel
    };
  }

  // 3. Standard (non-grouped) execution
  const rows = selectedData;
  const userPrompt = buildPrompt(
    aiConfig.userPromptTemplate || 'Analyze this data:\n\n{{data}}',
    rows
  );

  const llmResult = await callLLM(
    aiConfig.systemPrompt || 'You are a data analyst. Respond with structured JSON.',
    userPrompt,
    { maxTokens: aiConfig.maxTokens || 4096, temperature: aiConfig.temperature ?? 0.2 }
  );

  if (!llmResult.success) {
    return {
      success: false,
      error: `LLM call failed: ${llmResult.error}`,
      runtime_ms: Math.round(performance.now() - startTime)
    };
  }

  // 4. Parse response into structured output
  const parsed = parseAIResponse(llmResult.text, aiConfig.outputFormat || 'json_array');

  return {
    success: true,
    result: parsed.rows,
    rowsIn: rows.length,
    rowsOut: parsed.rows.length,
    stdout: llmResult.text,
    stderr: '',
    runtime_ms: Math.round(performance.now() - startTime),
    warnings: [],
    usage: llmResult.usage,
    model: llmResult.model
  };
}
