/**
 * EOQL Parser — Evidence Observation Query Language
 *
 * Parses and executes EOQL commands against tabular data sources.
 * Adapted from the Khora EOQL system to work with Evidence Observer's
 * Given-Log (immutable sources) and Meant-Graph (analysis sessions).
 *
 * Syntax: OPERATOR(args...)
 *   SEG(source, field="value")     — Filter/segment records
 *   SYN(source, field)             — Aggregate/synthesize a numeric field
 *   CON(source1, source2, key)     — Join two sources on a key
 *   ALT(source, field, expr)       — Transform/compute a column
 *   NUL(source)                    — Audit null states across all fields
 *   SIG(source)                    — Infer and display schema/types
 *   INS(source)                    — Snapshot result into a new source
 *   SUP(sourceA, sourceB, key)     — Hold two versions side-by-side
 *   REC(source, mapping)           — Reclassify values via a framework mapping
 *   SOURCE(source)                 — Show provenance for a source
 */

/**
 * Parse an EOQL command string into an AST node.
 * @param {string} raw - Raw command string
 * @returns {{ op: string, args: string[], raw: string, nested: Object|null }}
 */
export function parseEOQL(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Match OPERATOR(args...)
  const match = trimmed.match(/^([A-Z]+)\s*\((.*)\)$/s);
  if (!match) {
    throw new Error(`Invalid EOQL syntax: expected OPERATOR(args...) but got "${trimmed}"`);
  }

  const op = match[1];
  const validOps = ['SEG', 'SYN', 'CON', 'ALT', 'NUL', 'SIG', 'INS', 'SUP', 'REC', 'SOURCE'];
  if (!validOps.includes(op)) {
    throw new Error(`Unknown operator: ${op}. Valid operators: ${validOps.join(', ')}`);
  }

  const argsRaw = match[2];
  const args = _splitArgs(argsRaw);

  // Check for nested EOQL in first arg
  let nested = null;
  if (args.length > 0) {
    const nestedMatch = args[0].match(/^([A-Z]+)\s*\((.+)\)$/s);
    if (nestedMatch && validOps.includes(nestedMatch[1])) {
      nested = parseEOQL(args[0]);
    }
  }

  return { op, args, raw: trimmed, nested };
}

/**
 * Split comma-separated arguments, respecting quotes and nested parens.
 */
function _splitArgs(str) {
  const args = [];
  let current = '';
  let depth = 0;
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (inQuote) {
      current += ch;
      if (ch === quoteChar) inQuote = false;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
      current += ch;
      continue;
    }

    if (ch === '(') { depth++; current += ch; continue; }
    if (ch === ')') { depth--; current += ch; continue; }

    if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.trim()) args.push(current.trim());
  return args;
}

/**
 * Parse a filter expression like: field="value", field>100, field!="x"
 * @param {string} expr - Filter expression
 * @returns {{ field: string, op: string, value: string }}
 */
export function parseFilter(expr) {
  const m = expr.match(/^(\w+)\s*(!=|>=|<=|=|>|<|LIKE|CONTAINS)\s*"?([^"]*)"?$/i);
  if (!m) throw new Error(`Invalid filter: "${expr}". Use field="value" or field>100`);
  return { field: m[1], op: m[2].toUpperCase(), value: m[3] };
}

/**
 * Execute an EOQL command against loaded data.
 *
 * @param {Object} ast - Parsed EOQL AST from parseEOQL
 * @param {Object} context - Execution context
 * @param {Object} context.sources - Map of source name → data rows
 * @param {Object} context.schemas - Map of source name → schema info
 * @param {Object[]} context.derivedViews - Array to push derived views into
 * @returns {{ result: Object[], summary: string, op: string, meta: Object }}
 */
export function executeEOQL(ast, context) {
  if (!ast) throw new Error('No command to execute');
  const { sources, schemas, derivedViews } = context;

  switch (ast.op) {
    case 'SEG': return _execSEG(ast, context);
    case 'SYN': return _execSYN(ast, context);
    case 'CON': return _execCON(ast, context);
    case 'ALT': return _execALT(ast, context);
    case 'NUL': return _execNUL(ast, context);
    case 'SIG': return _execSIG(ast, context);
    case 'INS': return _execINS(ast, context);
    case 'SUP': return _execSUP(ast, context);
    case 'REC': return _execREC(ast, context);
    case 'SOURCE': return _execSOURCE(ast, context);
    default: throw new Error(`Unimplemented operator: ${ast.op}`);
  }
}

// ─── Operator Implementations ───────────────────────────────────

function _resolveSource(nameOrNested, context) {
  if (typeof nameOrNested === 'object' && nameOrNested.op) {
    // Nested EOQL — execute it first
    const inner = executeEOQL(nameOrNested, context);
    return inner.result;
  }
  const name = nameOrNested.replace(/"/g, '');
  const data = context.sources[name];
  if (!data) {
    // Try partial match
    const key = Object.keys(context.sources).find(k =>
      k.toLowerCase().includes(name.toLowerCase())
    );
    if (key) return context.sources[key];
    throw new Error(`Source "${name}" not found. Available: ${Object.keys(context.sources).join(', ')}`);
  }
  return data;
}

function _execSEG(ast, context) {
  let records;
  if (ast.nested) {
    records = _resolveSource(ast.nested, context);
  } else {
    records = _resolveSource(ast.args[0], context);
  }

  if (ast.args.length < 2) {
    throw new Error('SEG requires a filter: SEG(source, field="value")');
  }

  const filterExpr = ast.args[ast.args.length - 1];
  const pf = parseFilter(filterExpr);

  const filtered = records.filter(r => {
    const v = r[pf.field];
    if (v === null || v === undefined) return pf.op === '=' && pf.value === '';

    const sv = String(v);
    const nv = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    const pv = parseFloat(pf.value);

    switch (pf.op) {
      case '=': return sv === pf.value;
      case '!=': return sv !== pf.value;
      case '>': return !isNaN(nv) && !isNaN(pv) && nv > pv;
      case '<': return !isNaN(nv) && !isNaN(pv) && nv < pv;
      case '>=': return !isNaN(nv) && !isNaN(pv) && nv >= pv;
      case '<=': return !isNaN(nv) && !isNaN(pv) && nv <= pv;
      case 'LIKE': return sv.toLowerCase().includes(pf.value.toLowerCase());
      case 'CONTAINS': return sv.toLowerCase().includes(pf.value.toLowerCase());
      default: return false;
    }
  });

  return {
    result: filtered,
    summary: `${filtered.length} of ${records.length} records match "${filterExpr}"`,
    op: 'SEG',
    meta: { filterExpr, totalRecords: records.length, matchedRecords: filtered.length }
  };
}

function _execSYN(ast, context) {
  let records;
  if (ast.nested) {
    records = _resolveSource(ast.nested, context);
  } else {
    records = _resolveSource(ast.args[0], context);
  }

  const field = ast.args[ast.args.length - 1].replace(/"/g, '');

  // Check for GROUP BY syntax: SYN(source, field, GROUP BY groupField)
  const groupByIdx = ast.args.findIndex(a => a.trim().toUpperCase().startsWith('GROUP BY'));
  let groupField = null;
  if (groupByIdx !== -1) {
    groupField = ast.args[groupByIdx].replace(/GROUP BY\s*/i, '').trim().replace(/"/g, '');
  }

  if (groupField) {
    // Grouped aggregation
    const groups = {};
    for (const r of records) {
      const gv = String(r[groupField] ?? '(null)');
      if (!groups[gv]) groups[gv] = [];
      groups[gv].push(r);
    }

    const result = Object.entries(groups).map(([groupVal, rows]) => {
      const vals = rows.map(r => parseFloat(String(r[field] || '').replace(/[^0-9.\-]/g, ''))).filter(n => !isNaN(n));
      const sum = vals.reduce((a, b) => a + b, 0);
      return {
        [groupField]: groupVal,
        count: rows.length,
        sum: Math.round(sum * 100) / 100,
        avg: vals.length ? Math.round((sum / vals.length) * 100) / 100 : 0,
        min: vals.length ? Math.min(...vals) : null,
        max: vals.length ? Math.max(...vals) : null
      };
    });

    return {
      result,
      summary: `Grouped ${records.length} records by "${groupField}", aggregated "${field}" into ${result.length} groups`,
      op: 'SYN',
      meta: { field, groupField, groupCount: result.length }
    };
  }

  // Simple aggregation
  const vals = records.map(r => parseFloat(String(r[field] || '').replace(/[^0-9.\-]/g, ''))).filter(n => !isNaN(n));
  const sum = vals.reduce((a, b) => a + b, 0);
  const avg = vals.length ? Math.round((sum / vals.length) * 100) / 100 : 0;
  const min = vals.length ? Math.min(...vals) : null;
  const max = vals.length ? Math.max(...vals) : null;

  const summaryRow = { field, count: vals.length, sum: Math.round(sum * 100) / 100, avg, min, max };

  return {
    result: [summaryRow],
    summary: `${field}: count=${vals.length}, sum=${sum.toLocaleString()}, avg=${avg.toLocaleString()}, min=${min}, max=${max}`,
    op: 'SYN',
    meta: summaryRow
  };
}

function _execCON(ast, context) {
  if (ast.args.length < 3) throw new Error('CON requires: CON(source1, source2, joinKey)');

  const left = _resolveSource(ast.args[0], context);
  const right = _resolveSource(ast.args[1], context);
  const joinKey = ast.args[2].replace(/"/g, '').trim();

  // Check for left.key=right.key syntax
  let leftKey = joinKey, rightKey = joinKey;
  const keyMatch = joinKey.match(/^(\w+)\s*=\s*(\w+)$/);
  if (keyMatch) {
    leftKey = keyMatch[1];
    rightKey = keyMatch[2];
  }

  // Hash join
  const rightIndex = {};
  for (const r of right) {
    const k = String(r[rightKey] ?? '');
    if (!rightIndex[k]) rightIndex[k] = [];
    rightIndex[k].push(r);
  }

  const joined = [];
  for (const l of left) {
    const k = String(l[leftKey] ?? '');
    const matches = rightIndex[k];
    if (matches) {
      for (const r of matches) {
        // Merge with right-side columns prefixed if collision
        const merged = { ...l };
        for (const [col, val] of Object.entries(r)) {
          if (col === rightKey && leftKey === rightKey) continue; // Skip duplicate join key
          merged[col in l ? `${ast.args[1].replace(/"/g, '')}_${col}` : col] = val;
        }
        joined.push(merged);
      }
    }
  }

  return {
    result: joined,
    summary: `Joined ${left.length} × ${right.length} → ${joined.length} rows on "${joinKey}"`,
    op: 'CON',
    meta: { leftCount: left.length, rightCount: right.length, joinedCount: joined.length, joinKey }
  };
}

function _execALT(ast, context) {
  if (ast.args.length < 3) throw new Error('ALT requires: ALT(source, field, expression)');

  const records = _resolveSource(ast.args[0], context);
  const field = ast.args[1].replace(/"/g, '').trim();
  const expr = ast.args[2].replace(/^"|"$/g, '').trim();

  const result = records.map(r => {
    const row = { ...r };

    // Simple expression evaluation
    if (expr.toUpperCase() === 'UPPER') {
      row[field] = String(r[field] || '').toUpperCase();
    } else if (expr.toUpperCase() === 'LOWER') {
      row[field] = String(r[field] || '').toLowerCase();
    } else if (expr.toUpperCase() === 'TRIM') {
      row[field] = String(r[field] || '').trim();
    } else if (expr.match(/^ROUND\s*$/i)) {
      row[field] = Math.round(parseFloat(r[field]) || 0);
    } else if (expr.match(/^REPLACE\s*\(/i)) {
      const replMatch = expr.match(/^REPLACE\s*\(\s*"([^"]*)"\s*,\s*"([^"]*)"\s*\)/i);
      if (replMatch) {
        row[field] = String(r[field] || '').split(replMatch[1]).join(replMatch[2]);
      }
    } else if (expr.match(/^\w+\s*[\+\-\*\/]\s*\w+/)) {
      // Arithmetic: fieldA + fieldB, field * 2, etc
      try {
        const val = _evalArith(expr, r);
        row[field] = val;
      } catch (e) {
        row[field] = r[field];
      }
    } else if (expr.match(/^IF\s*\(/i)) {
      // IF(condition, thenVal, elseVal)
      const ifMatch = expr.match(/^IF\s*\(\s*(\w+)\s*(=|!=|>|<)\s*"?([^",]*)"?\s*,\s*"?([^",]*)"?\s*,\s*"?([^",]*)"?\s*\)/i);
      if (ifMatch) {
        const [, condField, condOp, condVal, thenVal, elseVal] = ifMatch;
        const cv = String(r[condField] || '');
        let matches = false;
        if (condOp === '=') matches = cv === condVal;
        else if (condOp === '!=') matches = cv !== condVal;
        else if (condOp === '>') matches = parseFloat(cv) > parseFloat(condVal);
        else if (condOp === '<') matches = parseFloat(cv) < parseFloat(condVal);
        row[field] = matches ? thenVal : elseVal;
      }
    } else {
      // Literal replacement
      row[field] = expr;
    }

    return row;
  });

  return {
    result,
    summary: `Transformed "${field}" across ${result.length} records using: ${expr}`,
    op: 'ALT',
    meta: { field, expression: expr, recordCount: result.length }
  };
}

function _evalArith(expr, row) {
  // Replace field references with values
  let evalStr = expr;
  const fieldRefs = expr.match(/[a-zA-Z_]\w*/g) || [];
  for (const ref of fieldRefs) {
    if (ref in row) {
      const val = parseFloat(String(row[ref]).replace(/[^0-9.\-]/g, '')) || 0;
      evalStr = evalStr.replace(new RegExp(`\\b${ref}\\b`), String(val));
    }
  }
  // Only allow safe arithmetic
  if (!/^[\d\s\+\-\*\/\.\(\)]+$/.test(evalStr)) return NaN;
  return Function(`"use strict"; return (${evalStr})`)();
}

function _execNUL(ast, context) {
  const records = _resolveSource(ast.args[0], context);
  if (records.length === 0) return { result: [], summary: 'No records to audit', op: 'NUL', meta: {} };

  const columns = Object.keys(records[0]);
  const audit = columns.map(col => {
    let nullCount = 0, emptyCount = 0, presentCount = 0;
    for (const r of records) {
      const v = r[col];
      if (v === null || v === undefined) nullCount++;
      else if (String(v).trim() === '') emptyCount++;
      else presentCount++;
    }
    const total = records.length;
    return {
      field: col,
      present: presentCount,
      null_count: nullCount,
      empty: emptyCount,
      null_pct: Math.round(((nullCount + emptyCount) / total) * 100 * 10) / 10,
      state: nullCount + emptyCount === 0 ? 'COMPLETE' :
             nullCount + emptyCount === total ? 'NEVER_SET' :
             'PARTIAL'
    };
  });

  return {
    result: audit,
    summary: `Null audit: ${audit.filter(a => a.null_pct > 0).length} of ${columns.length} fields have missing values`,
    op: 'NUL',
    meta: { totalFields: columns.length, fieldsWithNulls: audit.filter(a => a.null_pct > 0).length }
  };
}

function _execSIG(ast, context) {
  const records = _resolveSource(ast.args[0], context);
  if (records.length === 0) return { result: [], summary: 'No records to type-check', op: 'SIG', meta: {} };

  const columns = Object.keys(records[0]);
  const schema = columns.map(col => {
    const sample = records.slice(0, 100);
    let numCount = 0, dateCount = 0, boolCount = 0, nullCount = 0;

    for (const r of sample) {
      const v = r[col];
      if (v === null || v === undefined || String(v).trim() === '') { nullCount++; continue; }
      const s = String(v);
      if (!isNaN(parseFloat(s)) && isFinite(s.replace(/[,$]/g, ''))) numCount++;
      else if (s.match(/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/) || s.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}/)) dateCount++;
      else if (['true', 'false', 'yes', 'no', '1', '0'].includes(s.toLowerCase())) boolCount++;
    }

    const validCount = sample.length - nullCount;
    let type = 'string';
    if (validCount > 0) {
      if (numCount / validCount > 0.8) type = 'number';
      else if (dateCount / validCount > 0.8) type = 'date';
      else if (boolCount / validCount > 0.8) type = 'boolean';
    }

    // Unique values for cardinality
    const uniques = new Set(records.map(r => String(r[col] ?? '')));

    return {
      field: col,
      inferred_type: type,
      cardinality: uniques.size,
      null_pct: Math.round((nullCount / sample.length) * 100 * 10) / 10,
      sample: records.slice(0, 3).map(r => r[col])
    };
  });

  return {
    result: schema,
    summary: `Schema: ${schema.length} fields — ${schema.filter(s => s.inferred_type === 'number').length} numeric, ${schema.filter(s => s.inferred_type === 'date').length} date, ${schema.filter(s => s.inferred_type === 'string').length} text`,
    op: 'SIG',
    meta: { fieldCount: schema.length }
  };
}

function _execINS(ast, context) {
  // INS snapshots the result of a nested command or just marks the source
  if (ast.nested) {
    const inner = executeEOQL(ast.nested, context);
    const name = ast.args.length > 1 ? ast.args[1].replace(/"/g, '') : `derived_${Date.now()}`;
    context.sources[name] = inner.result;

    // Collect the full derivation history from the nested command chain
    const derivationHistory = _collectDerivationHistory(ast.nested, context);

    return {
      result: inner.result,
      summary: `Inserted ${inner.result.length} rows as "${name}"`,
      op: 'INS',
      meta: {
        name,
        rowCount: inner.result.length,
        isDerived: true,
        derivationHistory,
        derivedFromSources: _collectSourceNames(ast.nested),
        fullCommand: ast.raw
      }
    };
  }

  const sourceName = ast.args[0].replace(/"/g, '');
  const records = _resolveSource(ast.args[0], context);

  // Even for a direct source reference, capture the snapshot provenance
  const name = ast.args.length > 1 ? ast.args[1].replace(/"/g, '') : null;
  if (name) {
    context.sources[name] = records;
    return {
      result: records,
      summary: `Snapshot of "${sourceName}" saved as "${name}" (${records.length} rows)`,
      op: 'INS',
      meta: {
        name,
        rowCount: records.length,
        isDerived: true,
        derivationHistory: [{ op: 'INS', command: ast.raw, description: `Snapshot of ${sourceName}` }],
        derivedFromSources: [sourceName],
        fullCommand: ast.raw
      }
    };
  }

  return {
    result: records,
    summary: `Source loaded: ${records.length} rows`,
    op: 'INS',
    meta: { rowCount: records.length }
  };
}

/**
 * Recursively collect the derivation history from nested EOQL commands.
 * Returns an array of { op, command, description } entries tracing the full transformation chain.
 */
function _collectDerivationHistory(ast, context) {
  const history = [];

  if (ast.nested) {
    history.push(..._collectDerivationHistory(ast.nested, context));
  }

  history.push({
    op: ast.op,
    command: ast.raw,
    args: ast.args,
    description: `${ast.op}(${ast.args.join(', ')})`
  });

  return history;
}

/**
 * Recursively collect original source names referenced in the EOQL command tree.
 */
function _collectSourceNames(ast) {
  const names = new Set();

  if (ast.nested) {
    for (const name of _collectSourceNames(ast.nested)) {
      names.add(name);
    }
  } else if (ast.args.length > 0) {
    // First arg is typically a source name (unless it's a nested command)
    const firstName = ast.args[0].replace(/"/g, '').trim();
    if (firstName && !firstName.match(/^[A-Z]+\s*\(/)) {
      names.add(firstName);
    }
  }

  // For CON/SUP, second arg is also a source
  if ((ast.op === 'CON' || ast.op === 'SUP') && ast.args.length > 1) {
    const secondName = ast.args[1].replace(/"/g, '').trim();
    if (secondName && !secondName.match(/^[A-Z]+\s*\(/)) {
      names.add(secondName);
    }
  }

  return [...names];
}

function _execSUP(ast, context) {
  if (ast.args.length < 2) throw new Error('SUP requires: SUP(sourceA, sourceB, key)');

  const left = _resolveSource(ast.args[0], context);
  const right = _resolveSource(ast.args[1], context);
  const key = ast.args.length > 2 ? ast.args[2].replace(/"/g, '').trim() : null;

  if (key) {
    // Side-by-side comparison on key
    const rightIndex = {};
    for (const r of right) rightIndex[String(r[key] ?? '')] = r;

    const compared = left.map(l => {
      const k = String(l[key] ?? '');
      const r = rightIndex[k];
      const row = { _key: k, _status: r ? 'matched' : 'left_only' };
      for (const [col, val] of Object.entries(l)) {
        row[`A_${col}`] = val;
        if (r) {
          row[`B_${col}`] = r[col];
          if (String(val) !== String(r[col])) row[`_diff_${col}`] = true;
        }
      }
      return row;
    });

    // Add right-only
    const leftKeys = new Set(left.map(l => String(l[key] ?? '')));
    for (const r of right) {
      const k = String(r[key] ?? '');
      if (!leftKeys.has(k)) {
        const row = { _key: k, _status: 'right_only' };
        for (const [col, val] of Object.entries(r)) {
          row[`B_${col}`] = val;
        }
        compared.push(row);
      }
    }

    return {
      result: compared,
      summary: `Superposition: ${compared.filter(c => c._status === 'matched').length} matched, ${compared.filter(c => c._status === 'left_only').length} left-only, ${compared.filter(c => c._status === 'right_only').length} right-only`,
      op: 'SUP',
      meta: { leftCount: left.length, rightCount: right.length }
    };
  }

  // Without key — simple vertical stack with source labels
  const stacked = [
    ...left.map(r => ({ ...r, _source: 'A' })),
    ...right.map(r => ({ ...r, _source: 'B' }))
  ];

  return {
    result: stacked,
    summary: `Superposition: ${left.length} (A) + ${right.length} (B) = ${stacked.length} held side-by-side`,
    op: 'SUP',
    meta: { leftCount: left.length, rightCount: right.length }
  };
}

function _execREC(ast, context) {
  if (ast.args.length < 2) throw new Error('REC requires: REC(source, mapping) where mapping is newField=sourceField or a JSON mapping');

  const records = _resolveSource(ast.args[0], context);
  const mappingArg = ast.args.slice(1).join(',').trim();

  // Parse mapping: "newField=sourceField:value1->label1,value2->label2"
  const eqMatch = mappingArg.match(/^(\w+)\s*=\s*(\w+)\s*:\s*(.+)$/);
  if (eqMatch) {
    const [, newField, sourceField, mappingStr] = eqMatch;
    const mapping = {};
    for (const pair of mappingStr.split(/\s*,\s*/)) {
      const [from, to] = pair.split('->').map(s => s.trim().replace(/"/g, ''));
      if (from && to) mapping[from] = to;
    }

    const result = records.map(r => {
      const row = { ...r };
      const val = String(r[sourceField] || '');
      row[newField] = mapping[val] || val;
      return row;
    });

    const remapped = result.filter(r => r[newField] !== String(r[sourceField] || ''));
    return {
      result,
      summary: `Reclassified "${sourceField}" → "${newField}": ${remapped.length} of ${result.length} records remapped`,
      op: 'REC',
      meta: { sourceField, newField, mapping, remappedCount: remapped.length }
    };
  }

  throw new Error('REC mapping format: REC(source, newField=sourceField:val1->label1,val2->label2)');
}

function _execSOURCE(ast, context) {
  const name = ast.args[0].replace(/"/g, '').trim();

  // Look up in schemas
  const schema = context.schemas?.[name];
  const data = context.sources[name];

  const info = {
    name,
    available: !!data,
    rows: data ? data.length : 0,
    columns: data && data.length > 0 ? Object.keys(data[0]) : [],
    schema: schema || null
  };

  return {
    result: [info],
    summary: data
      ? `Source "${name}": ${info.rows} rows, ${info.columns.length} columns [${info.columns.slice(0, 5).join(', ')}${info.columns.length > 5 ? '...' : ''}]`
      : `Source "${name}" not found`,
    op: 'SOURCE',
    meta: info
  };
}
