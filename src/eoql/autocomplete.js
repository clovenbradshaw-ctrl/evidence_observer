/**
 * EOQL Autocomplete — Context-Aware Auto-Fill
 *
 * Provides intelligent suggestions as the user types EOQL commands.
 * Suggestions are context-aware: operators at top level, source names
 * after opening paren, field names after source selection, values
 * after field selection.
 */

import { OPERATORS, HELIX_ORDER } from '../models/operators.js';

/**
 * Operator definitions for autocomplete.
 */
const EOQL_OPS = [
  { key: 'SEG', label: 'Segment/Filter', desc: 'Filter records by field conditions', hint: 'SEG(source, field="value")', glyph: '|' },
  { key: 'SYN', label: 'Synthesize/Aggregate', desc: 'Aggregate a numeric field across records', hint: 'SYN(source, field)', glyph: '∨' },
  { key: 'CON', label: 'Connect/Join', desc: 'Join two sources on a shared key', hint: 'CON(source1, source2, key)', glyph: '⋈' },
  { key: 'ALT', label: 'Alter/Transform', desc: 'Transform or compute a column', hint: 'ALT(source, field, expr)', glyph: '∿' },
  { key: 'NUL', label: 'Null Audit', desc: 'Audit null/missing values across all fields', hint: 'NUL(source)', glyph: '∅' },
  { key: 'SIG', label: 'Signal/Type Check', desc: 'Infer and display schema and types', hint: 'SIG(source)', glyph: '⊡' },
  { key: 'INS', label: 'Insert/Snapshot', desc: 'Snapshot a result into a new source', hint: 'INS(nested, "name")', glyph: '△' },
  { key: 'SUP', label: 'Superposition', desc: 'Hold two versions side-by-side for comparison', hint: 'SUP(sourceA, sourceB, key)', glyph: '∥' },
  { key: 'REC', label: 'Reclassify', desc: 'Remap values through a classification framework', hint: 'REC(source, newField=field:a->b)', glyph: '↬' },
  { key: 'SOURCE', label: 'Source Info', desc: 'Show provenance and metadata for a source', hint: 'SOURCE(name)', glyph: '◉' },
];

/**
 * ALT expression helpers for autocomplete.
 */
const ALT_EXPRESSIONS = [
  { insert: 'UPPER', display: 'UPPER', desc: 'Convert to uppercase' },
  { insert: 'LOWER', display: 'LOWER', desc: 'Convert to lowercase' },
  { insert: 'TRIM', display: 'TRIM', desc: 'Trim whitespace' },
  { insert: 'ROUND', display: 'ROUND', desc: 'Round numeric values' },
  { insert: 'REPLACE("", "")', display: 'REPLACE(old, new)', desc: 'Replace text' },
  { insert: 'IF(field=value, then, else)', display: 'IF(cond, then, else)', desc: 'Conditional value' },
];

/**
 * SYN modifiers for autocomplete.
 */
const SYN_MODIFIERS = [
  { insert: 'GROUP BY ', display: 'GROUP BY field', desc: 'Group aggregation by a field' },
];

/**
 * Generate autocomplete suggestions based on current input and cursor position.
 *
 * @param {string} raw - Current input text
 * @param {number} cursor - Cursor position
 * @param {Object} dataContext - Available data context
 * @param {string[]} dataContext.sourceNames - Available source names
 * @param {Object} dataContext.sourceFields - Map of source name → field names
 * @param {Object} dataContext.fieldValues - Map of source.field → unique values
 * @returns {Object[]} Array of suggestion items
 */
export function acSuggest(raw, cursor, dataContext = {}) {
  const { sourceNames = [], sourceFields = {}, fieldValues = {} } = dataContext;
  const before = raw.slice(0, cursor);
  const items = [];

  // ── 1. Top-level: suggest operators ──
  const opMatch = before.match(/^(\w*)$/i);
  if (opMatch) {
    const q = opMatch[1].toUpperCase();
    return EOQL_OPS
      .filter(o => q.length === 0 || o.key.startsWith(q) || o.key.includes(q) || o.label.toUpperCase().includes(q))
      .map(o => _acItem('op', o.key + '(', o.key, o.desc, o.hint, o.glyph, 'Operators'));
  }

  // ── Parse current operator context ──
  const opContext = before.match(/^([A-Z]+)\s*\((.*)$/is);
  if (!opContext) return [];

  const op = opContext[1].toUpperCase();
  const inner = opContext[2];

  // Count commas to determine argument position
  const argPos = _countArgs(inner);

  // ── 2. Source suggestions (first arg for most operators) ──
  if (argPos === 0 && !inner.includes(',')) {
    const q = inner.toLowerCase().replace(/"/g, '');

    // Sources
    const sourceSuggestions = sourceNames
      .filter(s => q.length === 0 || s.toLowerCase().includes(q))
      .map(s => _acItem('source', s + ', ', s, `Data source`, '', '⊞', 'Sources'));

    // Nested operators for SEG, SYN, INS
    if (['SEG', 'SYN', 'INS'].includes(op)) {
      const nestedOps = EOQL_OPS
        .filter(o => q.length === 0 || o.key.toLowerCase().includes(q))
        .map(o => _acItem('op', o.key + '(', `${o.key}(...)`, `Nested: ${o.desc}`, '', o.glyph, 'Nested'));
      return [...sourceSuggestions, ...nestedOps];
    }

    return sourceSuggestions;
  }

  // ── 3. Operator-specific suggestions ──
  switch (op) {
    case 'SEG':
      return _suggestSEG(inner, argPos, sourceNames, sourceFields, fieldValues);
    case 'SYN':
      return _suggestSYN(inner, argPos, sourceNames, sourceFields);
    case 'CON':
      return _suggestCON(inner, argPos, sourceNames, sourceFields);
    case 'ALT':
      return _suggestALT(inner, argPos, sourceNames, sourceFields);
    case 'NUL':
    case 'SIG':
    case 'SOURCE':
      return []; // Single-arg operators, no more suggestions
    case 'SUP':
      return _suggestSUP(inner, argPos, sourceNames, sourceFields);
    case 'REC':
      return _suggestREC(inner, argPos, sourceNames, sourceFields);
    default:
      return [];
  }
}

// ─── Per-operator suggestion builders ───────────────────────────

function _suggestSEG(inner, argPos, sourceNames, sourceFields, fieldValues) {
  if (argPos >= 1) {
    // Second arg: filter expression
    const afterComma = inner.match(/,\s*(.*)$/);
    if (!afterComma) return [];
    const filterPart = afterComma[1];

    // Check if user is typing a value after operator
    const valMatch = filterPart.match(/^(\w+)\s*[=!><]+\s*"?([^"]*)$/);
    if (valMatch) {
      const field = valMatch[1];
      const q = valMatch[2].toLowerCase();
      // Find which source is being used
      const sourceName = _extractFirstArg(inner);
      const key = `${sourceName}.${field}`;
      const vals = fieldValues[key] || [];
      return vals
        .filter(v => q.length === 0 || String(v).toLowerCase().includes(q))
        .slice(0, 20)
        .map(v => _acItem('val', `"${v}")`, String(v), '', '', '=', 'Values'));
    }

    // Suggest fields
    const fieldPart = filterPart.match(/^(\w*)$/);
    if (fieldPart) {
      const sourceName = _extractFirstArg(inner);
      const fields = sourceFields[sourceName] || [];
      const q = fieldPart[1].toLowerCase();
      return fields
        .filter(f => q.length === 0 || f.toLowerCase().includes(q))
        .map(f => _acItem('field', f + '=', f, 'Filter by this field', '', 'A', 'Fields'));
    }
  }
  return [];
}

function _suggestSYN(inner, argPos, sourceNames, sourceFields) {
  if (argPos >= 1) {
    const afterLastComma = inner.match(/,\s*([^,]*)$/);
    if (!afterLastComma) return [];
    const part = afterLastComma[1].trim();

    // GROUP BY suggestion
    if (part.toUpperCase().startsWith('GROUP')) {
      const afterGB = part.match(/GROUP\s+BY\s+(\w*)$/i);
      if (afterGB) {
        const sourceName = _extractFirstArg(inner);
        const fields = sourceFields[sourceName] || [];
        const q = afterGB[1].toLowerCase();
        return fields
          .filter(f => q.length === 0 || f.toLowerCase().includes(q))
          .map(f => _acItem('field', f, f, 'Group by this field', '', 'A', 'Group Fields'));
      }
      return [];
    }

    // Field or GROUP BY
    const sourceName = _extractFirstArg(inner);
    const fields = sourceFields[sourceName] || [];
    const q = part.toLowerCase();

    const fieldSuggestions = fields
      .filter(f => q.length === 0 || f.toLowerCase().includes(q))
      .map(f => _acItem('field', f, f, 'Aggregate this field', '', 'A', 'Fields'));

    const modSuggestions = SYN_MODIFIERS
      .filter(m => q.length === 0 || m.display.toLowerCase().includes(q))
      .map(m => _acItem('mod', m.insert, m.display, m.desc, '', '∨', 'Modifiers'));

    return [...fieldSuggestions, ...modSuggestions];
  }
  return [];
}

function _suggestCON(inner, argPos, sourceNames, sourceFields) {
  if (argPos === 1) {
    // Second source
    const q = _extractLastPartial(inner).toLowerCase();
    return sourceNames
      .filter(s => q.length === 0 || s.toLowerCase().includes(q))
      .map(s => _acItem('source', s + ', ', s, 'Join with this source', '', '⊞', 'Sources'));
  }
  if (argPos >= 2) {
    // Join key — suggest fields common to both sources
    const args = _splitByComma(inner);
    const src1 = args[0]?.replace(/"/g, '').trim();
    const src2 = args[1]?.replace(/"/g, '').trim();
    const fields1 = new Set(sourceFields[src1] || []);
    const fields2 = new Set(sourceFields[src2] || []);
    const common = [...fields1].filter(f => fields2.has(f));
    const q = _extractLastPartial(inner).toLowerCase();

    if (common.length > 0) {
      return common
        .filter(f => q.length === 0 || f.toLowerCase().includes(q))
        .map(f => _acItem('field', f, f, 'Common join key', '', '⋈', 'Join Keys'));
    }

    // If no common fields, show left=right syntax
    const allLeft = sourceFields[src1] || [];
    const allRight = sourceFields[src2] || [];
    return allLeft
      .filter(f => q.length === 0 || f.toLowerCase().includes(q))
      .map(f => _acItem('field', f + '=', f + '=...', `Left key (pair with right)`, '', '⋈', `${src1} Fields`));
  }
  return [];
}

function _suggestALT(inner, argPos, sourceNames, sourceFields) {
  if (argPos === 1) {
    // Field to transform
    const sourceName = _extractFirstArg(inner);
    const fields = sourceFields[sourceName] || [];
    const q = _extractLastPartial(inner).toLowerCase();
    return fields
      .filter(f => q.length === 0 || f.toLowerCase().includes(q))
      .map(f => _acItem('field', f + ', ', f, 'Transform this field', '', 'A', 'Fields'));
  }
  if (argPos >= 2) {
    // Expression
    const q = _extractLastPartial(inner).toLowerCase();

    // Suggest field names for arithmetic
    const sourceName = _extractFirstArg(inner);
    const fields = sourceFields[sourceName] || [];

    const exprSuggestions = ALT_EXPRESSIONS
      .filter(e => q.length === 0 || e.display.toLowerCase().includes(q))
      .map(e => _acItem('expr', e.insert, e.display, e.desc, '', '∿', 'Expressions'));

    const fieldSuggestions = fields
      .filter(f => q.length === 0 || f.toLowerCase().includes(q))
      .map(f => _acItem('field', f, f, 'Use in expression', '', 'A', 'Fields'));

    return [...exprSuggestions, ...fieldSuggestions];
  }
  return [];
}

function _suggestSUP(inner, argPos, sourceNames, sourceFields) {
  if (argPos === 1) {
    const q = _extractLastPartial(inner).toLowerCase();
    return sourceNames
      .filter(s => q.length === 0 || s.toLowerCase().includes(q))
      .map(s => _acItem('source', s + ', ', s, 'Compare with this source', '', '⊞', 'Sources'));
  }
  if (argPos >= 2) {
    // Key field
    const args = _splitByComma(inner);
    const src1 = args[0]?.replace(/"/g, '').trim();
    const fields = sourceFields[src1] || [];
    const q = _extractLastPartial(inner).toLowerCase();
    return fields
      .filter(f => q.length === 0 || f.toLowerCase().includes(q))
      .map(f => _acItem('field', f, f, 'Comparison key', '', '∥', 'Key Fields'));
  }
  return [];
}

function _suggestREC(inner, argPos, sourceNames, sourceFields) {
  if (argPos >= 1) {
    const sourceName = _extractFirstArg(inner);
    const fields = sourceFields[sourceName] || [];
    const q = _extractLastPartial(inner).toLowerCase();

    // If no = yet, suggest field=sourceField pattern
    if (!inner.includes('=')) {
      return fields
        .filter(f => q.length === 0 || f.toLowerCase().includes(q))
        .map(f => _acItem('field', f + '=', f, 'New classification field', '', '↬', 'New Field'));
    }
  }
  return [];
}

// ─── Suggestion item builder ────────────────────────────────────

function _acItem(type, insert, display, desc, hint, icon, group) {
  return { type, insert, display, desc, hint: hint || '', icon: icon || '', group: group || '' };
}

// ─── Utilities ──────────────────────────────────────────────────

function _countArgs(inner) {
  let depth = 0, count = 0;
  let inQuote = false;
  for (const ch of inner) {
    if (ch === '"' && !inQuote) { inQuote = true; continue; }
    if (ch === '"' && inQuote) { inQuote = false; continue; }
    if (inQuote) continue;
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) count++;
  }
  return count;
}

function _extractFirstArg(inner) {
  const match = inner.match(/^([^,(]+)/);
  return match ? match[1].replace(/"/g, '').trim() : '';
}

function _extractLastPartial(inner) {
  const match = inner.match(/,\s*([^,]*)$/);
  return match ? match[1].replace(/"/g, '').trim() : inner.replace(/"/g, '').trim();
}

function _splitByComma(inner) {
  const args = [];
  let current = '', depth = 0, inQuote = false;
  for (const ch of inner) {
    if (ch === '"') { inQuote = !inQuote; current += ch; continue; }
    if (inQuote) { current += ch; continue; }
    if (ch === '(') { depth++; current += ch; continue; }
    if (ch === ')') { depth--; current += ch; continue; }
    if (ch === ',' && depth === 0) { args.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

/**
 * Get the icon CSS class for a suggestion type.
 */
export function acIconClass(type) {
  switch (type) {
    case 'op': return 'ac-ico-op';
    case 'source': return 'ac-ico-source';
    case 'field': return 'ac-ico-field';
    case 'val': return 'ac-ico-val';
    case 'expr': return 'ac-ico-expr';
    case 'mod': return 'ac-ico-mod';
    case 'stack': return 'ac-ico-stack';
    default: return '';
  }
}
