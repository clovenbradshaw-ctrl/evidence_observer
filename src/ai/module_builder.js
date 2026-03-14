/**
 * Module Builder — JSON Instruction Set → Analysis Module
 *
 * Accepts JSON instruction sets that define custom analysis modules.
 * Can also use AI to generate module definitions from natural language descriptions.
 *
 * JSON Instruction Set Schema:
 * {
 *   "modules": [{
 *     "id": "unique-id",
 *     "name": "Display Name",
 *     "operatorType": "NUL|SIG|INS|SEG|CON|SYN|ALT|SUP|REC",
 *     "description": "What this module does",
 *     "systemPrompt": "System instructions for the LLM",
 *     "userPromptTemplate": "Template with {{data}} and {{params}} placeholders",
 *     "outputSchema": { ... },         // optional JSON schema for expected output
 *     "defaultParams": { ... }          // optional default parameters
 *   }]
 * }
 */

import { OPERATORS } from '../models/operators.js';
import { callLLM } from './service.js';
import { getSavedModules, saveSavedModules } from './settings.js';

/**
 * Parse and validate a JSON instruction set.
 *
 * @param {string} jsonString - Raw JSON string
 * @returns {{ valid: boolean, modules: Object[], errors: string[] }}
 */
export function parseInstructionSet(jsonString) {
  const errors = [];

  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    return { valid: false, modules: [], errors: [`Invalid JSON: ${e.message}`] };
  }

  // Accept both { modules: [...] } and bare [...]
  const rawModules = Array.isArray(parsed) ? parsed : (parsed.modules || []);

  if (!Array.isArray(rawModules) || rawModules.length === 0) {
    return { valid: false, modules: [], errors: ['No modules found. Expected { "modules": [...] } or an array.'] };
  }

  const validModules = [];

  for (let i = 0; i < rawModules.length; i++) {
    const m = rawModules[i];
    const prefix = `Module ${i + 1}`;

    if (!m.id) { errors.push(`${prefix}: missing "id"`); continue; }
    if (!m.name) { errors.push(`${prefix}: missing "name"`); continue; }
    if (!m.operatorType || !OPERATORS[m.operatorType]) {
      errors.push(`${prefix}: invalid "operatorType" "${m.operatorType}". Must be one of: ${Object.keys(OPERATORS).join(', ')}`);
      continue;
    }
    if (!m.systemPrompt && !m.userPromptTemplate) {
      errors.push(`${prefix}: needs at least "systemPrompt" or "userPromptTemplate"`);
      continue;
    }

    const op = OPERATORS[m.operatorType];

    validModules.push({
      id: m.id,
      name: m.name,
      operatorType: m.operatorType,
      triad: op.triad,
      description: m.description || `Custom ${m.operatorType} analysis module`,
      systemPrompt: m.systemPrompt || `You are an EO analyst performing a ${m.operatorType}(${op.glyph}) analysis. ${op.description}. Respond with structured JSON.`,
      userPromptTemplate: m.userPromptTemplate || null,
      outputSchema: m.outputSchema || null,
      defaultParams: m.defaultParams || {},
      custom: true,
      buildUserPrompt: _createBuildUserPrompt(m.userPromptTemplate)
    });
  }

  return {
    valid: errors.length === 0,
    modules: validModules,
    errors
  };
}

/**
 * Create a buildUserPrompt function from a template string.
 * Supports {{data}}, {{params}}, {{fieldNames}}, {{rowCount}}, {{sample}} placeholders.
 */
function _createBuildUserPrompt(template) {
  if (!template) {
    return (data, params) => {
      const sample = JSON.stringify(data.slice(0, 40), null, 2);
      return `Analyze this dataset (${data.length} rows):\n\n${sample}`;
    };
  }

  return (data, params) => {
    const sample = JSON.stringify(data.slice(0, 40), null, 2);
    const fieldNames = data.length > 0 ? Object.keys(data[0]).join(', ') : 'none';

    return template
      .replace(/\{\{data\}\}/g, sample)
      .replace(/\{\{sample\}\}/g, sample)
      .replace(/\{\{params\}\}/g, JSON.stringify(params || {}))
      .replace(/\{\{fieldNames\}\}/g, fieldNames)
      .replace(/\{\{rowCount\}\}/g, String(data.length))
      .replace(/\{\{focus\}\}/g, params?.focus || '');
  };
}

/**
 * Use AI to generate a module definition from a natural language description.
 *
 * @param {string} description - Natural language description of the analysis
 * @param {string} [operatorType] - Suggested operator type
 * @returns {Promise<{success: boolean, module?: Object, error?: string}>}
 */
export async function generateModuleFromDescription(description, operatorType = null) {
  const operatorList = Object.entries(OPERATORS)
    .map(([code, op]) => `${code}(${op.glyph}): ${op.verb} — ${op.description}`)
    .join('\n');

  const systemPrompt = `You are a module builder for the Evidence Observer analytical workbench.
The workbench uses Emergent Ontology (EO) with nine operators:
${operatorList}

Given a natural language description of an analysis, generate a JSON module definition.
The module must include:
- id: kebab-case unique identifier
- name: short display name
- operatorType: one of the nine operator codes
- description: what the module does
- systemPrompt: detailed instructions for the AI analyst
- userPromptTemplate: template using {{data}}, {{params}}, {{fieldNames}}, {{rowCount}} placeholders

Respond ONLY with valid JSON, no markdown fencing.`;

  const userPrompt = `Create an analysis module for this description:

"${description}"

${operatorType ? `Suggested operator type: ${operatorType}` : 'Choose the most appropriate operator type.'}`;

  const result = await callLLM(systemPrompt, userPrompt, { temperature: 0.3 });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  try {
    const moduleDef = JSON.parse(result.text.trim());
    const parsed = parseInstructionSet(JSON.stringify({ modules: [moduleDef] }));

    if (parsed.modules.length > 0) {
      return { success: true, module: parsed.modules[0] };
    } else {
      return { success: false, error: `Generated module invalid: ${parsed.errors.join(', ')}` };
    }
  } catch (e) {
    return { success: false, error: `Failed to parse AI response as JSON: ${e.message}` };
  }
}

/**
 * Import modules from a JSON instruction set and save to localStorage.
 *
 * @param {string} jsonString - Raw JSON instruction set
 * @returns {{ imported: number, errors: string[] }}
 */
export function importModules(jsonString) {
  const { modules, errors } = parseInstructionSet(jsonString);

  if (modules.length > 0) {
    const existing = getSavedModules();
    // Replace duplicates by ID, append new
    const existingIds = new Set(existing.map(m => m.id));
    const deduped = existing.filter(m => !modules.find(n => n.id === m.id));

    // Strip non-serializable buildUserPrompt before saving
    const toSave = modules.map(m => ({
      id: m.id,
      name: m.name,
      operatorType: m.operatorType,
      triad: m.triad,
      description: m.description,
      systemPrompt: m.systemPrompt,
      userPromptTemplate: m.userPromptTemplate,
      outputSchema: m.outputSchema,
      defaultParams: m.defaultParams,
      custom: true
    }));

    saveSavedModules([...deduped, ...toSave]);
  }

  return { imported: modules.length, errors };
}

/**
 * Get all custom modules (rehydrated with buildUserPrompt).
 */
export function getCustomModules() {
  const saved = getSavedModules();
  return saved.map(m => ({
    ...m,
    buildUserPrompt: _createBuildUserPrompt(m.userPromptTemplate)
  }));
}

/**
 * Delete a custom module by ID.
 */
export function deleteCustomModule(moduleId) {
  const saved = getSavedModules();
  saveSavedModules(saved.filter(m => m.id !== moduleId));
}

/**
 * Export all custom modules as a JSON instruction set string.
 */
export function exportModules() {
  const saved = getSavedModules();
  return JSON.stringify({ modules: saved }, null, 2);
}
