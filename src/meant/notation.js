/**
 * EO Notation Generator
 * Auto-generates Polish prefix notation from step metadata and execution results.
 *
 * Notation is generated, not authored (EO Rule 8: Determinacy).
 * Format: OPERATOR(glyph)(target, operand, key=...) → output_name
 *
 * Three-face notation where applicable: OPERATOR(Resolution, Site)
 */

import { OPERATORS, formatOperator } from '../models/operators.js';

/**
 * Generate EO notation for a step.
 *
 * @param {Object} step - The step record
 * @param {Object[]} inputs - Input sources/steps
 * @param {Object} [executionResult] - Execution results (row counts, etc.)
 * @param {Object} [horizon] - Current horizon state
 * @returns {Object} Notation object with text and structured data
 */
export function generateNotation(step, inputs, executionResult = null, horizon = null) {
  const op = OPERATORS[step.operator_type];
  if (!op) return { text: `UNKNOWN(${step.operator_type})`, structured: {} };

  const inputNames = inputs.map(i => i.name || i.id);
  const config = step.config_json ? JSON.parse(step.config_json) : {};

  // Build the notation parts
  const parts = {
    operator: step.operator_type,
    glyph: op.glyph,
    verb: op.verb,
    inputs: inputNames,
    config: {},
    output: null,
    execution: {},
    conformance: [],
    horizon: null
  };

  // Operator-specific notation
  switch (step.operator_type) {
    case 'NUL':
      parts.config = _nulNotation(step, inputs, executionResult);
      break;
    case 'SIG':
      parts.config = _sigNotation(step, inputs, executionResult);
      break;
    case 'INS':
      parts.config = _insNotation(step, inputs, executionResult);
      break;
    case 'SEG':
      parts.config = _segNotation(step, inputs, executionResult);
      break;
    case 'CON':
      parts.config = _conNotation(step, inputs, executionResult);
      break;
    case 'SYN':
      parts.config = _synNotation(step, inputs, executionResult);
      break;
    case 'ALT':
      parts.config = _altNotation(step, inputs, executionResult);
      break;
    case 'SUP':
      parts.config = _supNotation(step, inputs, executionResult);
      break;
    case 'REC':
      parts.config = _recNotation(step, inputs, executionResult);
      break;
  }

  // Execution stats
  if (executionResult) {
    parts.execution = {
      rowsIn: executionResult.rowsIn,
      rowsOut: executionResult.rowsOut,
      runtime_ms: executionResult.runtime_ms,
      warnings: executionResult.warnings || []
    };

    if (executionResult.outputName) {
      parts.output = executionResult.outputName;
    }
  }

  // Conformance checks
  parts.conformance = _checkConformance(step, inputs);

  // Horizon state
  if (horizon) {
    parts.horizon = horizon;
  }

  // Generate text representation
  const text = _formatNotationText(parts);

  return {
    text,
    structured: parts,
    technical: _formatTechnicalView(parts),
    public: _formatPublicView(parts, step)
  };
}

// ============ Operator-specific notation generators ============

function _nulNotation(step, inputs, result) {
  return {
    operation: 'null_audit',
    ...(result?.nullCounts && {
      cleared: result.nullCounts.CLEARED || 0,
      unknown: result.nullCounts.UNKNOWN || 0,
      never_set: result.nullCounts.NEVER_SET || 0
    })
  };
}

function _sigNotation(step, inputs, result) {
  return {
    operation: 'designation',
    ...(result?.designations && { types: result.designations })
  };
}

function _insNotation(step, inputs, result) {
  return {
    operation: 'instantiation',
    ...(result?.anchorsCreated && { anchors: result.anchorsCreated })
  };
}

function _segNotation(step, inputs, result) {
  return {
    operation: 'partition',
    ...(result?.filterExpression && { filter: result.filterExpression }),
    ...(result?.rowsFiltered && { filtered: result.rowsFiltered }),
    ...(result?.rowsRetained && { retained: result.rowsRetained })
  };
}

function _conNotation(step, inputs, result) {
  return {
    operation: 'join',
    ...(result?.joinKey && { key: result.joinKey }),
    ...(result?.joinType && { join: result.joinType }),
    ...(result?.unmatched !== undefined && { unmatched: result.unmatched })
  };
}

function _synNotation(step, inputs, result) {
  return {
    operation: 'aggregation',
    ...(result?.groupBy && { groupBy: result.groupBy }),
    ...(result?.aggregations && { agg: result.aggregations })
  };
}

function _altNotation(step, inputs, result) {
  return {
    operation: 'transformation',
    ...(result?.columnsChanged && { changed: result.columnsChanged })
  };
}

function _supNotation(step, inputs, result) {
  return {
    operation: 'superposition',
    ...(result?.branches && { branches: result.branches }),
    resolved: false
  };
}

function _recNotation(step, inputs, result) {
  return {
    operation: 'reframe',
    ...(result?.resolutionReason && { reason: result.resolutionReason }),
    ...(result?.priorFrame && { from: result.priorFrame }),
    ...(result?.newFrame && { to: result.newFrame })
  };
}

// ============ Conformance checks ============

function _checkConformance(step, inputs) {
  const checks = [];

  // Given-conformant: all inputs trace to vault
  const allGivenTraced = inputs.every(i => i.type === 'given' || i.type === 'step');
  if (allGivenTraced) {
    checks.push({ rule: 'Given-conformant', status: 'pass', detail: 'All inputs trace to Given-Log' });
  } else {
    checks.push({ rule: 'Given-conformant', status: 'fail', detail: 'UngroundedAssertion: inputs lack provenance' });
  }

  return checks;
}

// ============ Text formatting ============

function _formatNotationText(parts) {
  const op = `${parts.operator}(${parts.glyph})`;
  const inputStr = parts.inputs.join(', ');
  const configStr = Object.entries(parts.config)
    .filter(([k, v]) => k !== 'operation' && v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? `'${v}'` : v}`)
    .join(', ');

  let text = `${op}(${inputStr}`;
  if (configStr) text += `,\n  ${configStr}`;
  text += ')';

  if (parts.output) {
    text += ` → ${parts.output}`;
  }

  // Conformance annotations
  for (const check of parts.conformance) {
    text += `\n${check.rule}: ${check.detail}`;
  }

  // Horizon state
  if (parts.horizon) {
    const horizonParts = Object.entries(parts.horizon)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    text += `\nHorizon: ${horizonParts}`;
  }

  return text;
}

function _formatTechnicalView(parts) {
  let text = _formatNotationText(parts);

  // Add execution stats
  if (parts.execution.rowsIn !== undefined) {
    text += `\nExecution: ${parts.execution.rowsIn} rows in → ${parts.execution.rowsOut} rows out`;
    if (parts.execution.runtime_ms) {
      text += ` (${parts.execution.runtime_ms}ms)`;
    }
  }

  if (parts.execution.warnings?.length > 0) {
    text += `\nWarnings: ${parts.execution.warnings.join('; ')}`;
  }

  return text;
}

function _formatPublicView(parts, step) {
  const op = OPERATORS[parts.operator];
  const stepNum = step.sequence_number;
  const inputStr = parts.inputs.join(' and ');

  // Generate plain-language description based on operator
  switch (parts.operator) {
    case 'NUL':
      return `Step ${stepNum} — ${op.glyph} Null Audit\n${step.description || 'Audited which fields are blank, missing, or absent before analysis begins.'}`;
    case 'SIG':
      return `Step ${stepNum} — ${op.glyph} Designation\n${step.description || 'Identified and designated entity types in the data.'}`;
    case 'INS':
      return `Step ${stepNum} — ${op.glyph} Instantiation\n${step.description || 'Created concrete entity records from the source data.'}`;
    case 'SEG':
      return `Step ${stepNum} — ${op.glyph} Filter/Partition\n${step.description || `Filtered ${inputStr} to a subset of records.`}`;
    case 'CON': {
      const unmatched = parts.config.unmatched;
      let desc = `Step ${stepNum} — ${op.glyph} Join\n${step.description || `Joined ${inputStr} using ${parts.config.key || 'key'}.`}`;
      if (unmatched !== undefined) {
        desc += ` ${unmatched} records could not be matched and are flagged in the output.`;
      }
      return desc;
    }
    case 'SYN':
      return `Step ${stepNum} — ${op.glyph} Aggregation\n${step.description || `Aggregated ${inputStr} to produce summary statistics.`}`;
    case 'ALT':
      return `Step ${stepNum} — ${op.glyph} Transformation\n${step.description || `Transformed values in ${inputStr} without changing structure.`}`;
    case 'SUP':
      return `Step ${stepNum} — ${op.glyph} Parallel Analysis\n${step.description || `Two interpretations of ${inputStr} are held in parallel without resolution.`}`;
    case 'REC':
      return `Step ${stepNum} — ${op.glyph} Frame Change\n${step.description || `The analytical frame was restructured.`}${parts.config.reason ? ` Reason: ${parts.config.reason}.` : ''}`;
    default:
      return `Step ${stepNum} — ${step.description || 'Analysis step'}`;
  }
}
