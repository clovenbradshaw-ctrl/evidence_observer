/**
 * Helix Ordering Validation
 * NUL → SIG → INS → SEG → CON → SYN → ALT → SUP → REC
 *
 * The helix ordering is the strict dependency sequence.
 * Each operator presupposes all operators before it.
 * In explore mode, violations are warned; in confirm mode, they block export.
 */

import { OPERATORS, HELIX_ORDER, isHelixValid, Violations } from '../models/operators.js';

/**
 * Validate that a new step's operator type is consistent with the helix ordering
 * given the existing steps in the session.
 *
 * @param {string} newOperatorType - The operator type of the new step
 * @param {Object[]} existingSteps - Steps already in the session
 * @param {string} mode - 'explore' or 'confirm'
 * @returns {{ valid: boolean, warnings: string[], errors: string[] }}
 */
export function validateHelixOrdering(newOperatorType, existingSteps, mode = 'explore') {
  const warnings = [];
  const errors = [];

  const newOp = OPERATORS[newOperatorType];
  if (!newOp) {
    errors.push(`Unknown operator type: ${newOperatorType}`);
    return { valid: false, warnings, errors };
  }

  // Check if dependencies exist in prior steps
  const priorOperators = new Set(existingSteps.map(s => s.operator_type));

  // For structure triad (SEG, CON, SYN) — need existence triad first
  if (newOp.triad === 'Structure') {
    if (!priorOperators.has('INS') && !_hasGivenInputs(existingSteps)) {
      const msg = `${newOp.glyph} ${newOp.code} (${newOp.verb}) requires prior INS(△) or Given-Log inputs — cannot ${newOp.verb} without created entities`;
      if (mode === 'confirm') errors.push(msg);
      else warnings.push(msg);
    }
  }

  // For significance triad (ALT, SUP, REC) — need structure triad first
  if (newOp.triad === 'Significance') {
    const hasStructure = ['SEG', 'CON', 'SYN'].some(op => priorOperators.has(op));
    if (!hasStructure) {
      const msg = `${newOp.glyph} ${newOp.code} (${newOp.verb}) requires prior structure operations (SEG/CON/SYN) — cannot ${newOp.verb} without structural context`;
      if (mode === 'confirm') errors.push(msg);
      else warnings.push(msg);
    }
  }

  // Specific dependencies within triads
  if (newOperatorType === 'CON' && !priorOperators.has('SEG')) {
    const msg = `CON(⋈) (to join) requires prior SEG(|) (to cut) — unsegmented join degenerates to Cartesian product`;
    if (mode === 'confirm') errors.push(msg);
    else warnings.push(msg);
  }

  if (newOperatorType === 'SYN' && !priorOperators.has('CON')) {
    const msg = `SYN(∨) (to merge) requires prior CON(⋈) (to join) — cannot derive transcendent structure without connections`;
    if (mode === 'confirm') errors.push(msg);
    else warnings.push(msg);
  }

  if (newOperatorType === 'SUP' && !priorOperators.has('ALT')) {
    const msg = `SUP(∥) (to hold) requires prior ALT(∿) (to change) — datum needs prior value changes to become superposed`;
    if (mode === 'confirm') errors.push(msg);
    else warnings.push(msg);
  }

  if (newOperatorType === 'REC' && !priorOperators.has('SUP')) {
    const msg = `REC(↬) (to reframe) requires prior SUP(∥) (to hold) — triggered by representational insufficiency SUP exposes`;
    if (mode === 'confirm') errors.push(msg);
    else warnings.push(msg);
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors
  };
}

/**
 * Check if there are any Given-Log sources as inputs in the step chain.
 */
function _hasGivenInputs(steps) {
  for (const step of steps) {
    const inputIds = step.input_ids_json ? JSON.parse(step.input_ids_json) : [];
    if (inputIds.length > 0) return true;
  }
  return false;
}

/**
 * Validate step code consistency with declared operator type.
 * Flags when code appears inconsistent with the operator.
 *
 * @param {string} operatorType - Declared operator type
 * @param {string} code - Python code
 * @returns {{ consistent: boolean, flags: string[] }}
 */
export function validateOperatorConsistency(operatorType, code) {
  const flags = [];
  if (!code) return { consistent: true, flags };

  const codeLower = code.toLowerCase();

  switch (operatorType) {
    case 'SEG':
      // SEG should filter/partition, not aggregate
      if (codeLower.includes('.groupby(') && codeLower.includes('.sum(')) {
        flags.push('SEG(|) step contains aggregation (groupby+sum) — this looks like SYN(∨)');
      }
      if (codeLower.includes('.merge(') || codeLower.includes('.join(')) {
        flags.push('SEG(|) step contains join/merge — this looks like CON(⋈)');
      }
      break;

    case 'CON':
      // CON should join, not aggregate
      if (codeLower.includes('.groupby(') && !codeLower.includes('.merge(') && !codeLower.includes('.join(')) {
        flags.push('CON(⋈) step contains aggregation without join — this looks like SYN(∨)');
      }
      break;

    case 'SYN':
      // SYN should aggregate/synthesize
      if (!codeLower.includes('.groupby(') && !codeLower.includes('.agg(') &&
          !codeLower.includes('.sum(') && !codeLower.includes('.mean(') &&
          !codeLower.includes('.count(') && !codeLower.includes('.pivot')) {
        flags.push('SYN(∨) step lacks aggregation — this may be SEG(|) or ALT(∿)');
      }
      break;

    case 'NUL':
      // NUL should detect nulls
      if (!codeLower.includes('null') && !codeLower.includes('isna') &&
          !codeLower.includes('isnull') && !codeLower.includes('notna') &&
          !codeLower.includes('none') && !codeLower.includes('missing')) {
        flags.push('NUL(∅) step lacks null detection — consider checking for CLEARED/UNKNOWN/NEVER_SET');
      }
      break;

    case 'ALT':
      // ALT should change values, not structure
      if (codeLower.includes('.drop(') || codeLower.includes('.rename(columns')) {
        flags.push('ALT(∿) step modifies structure (drop/rename) — this looks like REC(↬)');
      }
      break;
  }

  return {
    consistent: flags.length === 0,
    flags
  };
}

/**
 * Get a human-readable description of the helix position.
 */
export function describeHelixPosition(operatorType) {
  const op = OPERATORS[operatorType];
  if (!op) return 'Unknown operator';

  const position = op.helixPosition + 1;
  const deps = HELIX_ORDER.slice(0, op.helixPosition);

  return {
    position,
    total: 9,
    triad: op.triad,
    role: op.role,
    verb: op.verb,
    dependencies: deps,
    description: `Position ${position}/9 in helix. ${op.triad} triad, ${op.role} role. Presupposes: ${deps.length > 0 ? deps.join(' → ') : 'none (foundational)'}.`
  };
}
