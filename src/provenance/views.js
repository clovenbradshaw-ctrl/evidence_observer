/**
 * Provenance Views — Technical ↔ Public rendering
 *
 * Technical view: Full EO notation, π provenance citations, conformance rules
 * Public view: Plain-language auto-generated from notation
 *
 * The public view derives from the technical record (EO Rule 8: Determinacy).
 * If the step changes, the public view regenerates. They cannot diverge.
 */

import { OPERATORS, Violations } from '../models/operators.js';
import { getSessionSteps, getStepOutputs } from '../models/meant_graph.js';
import { getStepReconciliations } from '../models/reconciliation.js';
import { getStepBranches } from '../models/superposition.js';
import { traceProvenance } from './service.js';

/**
 * Generate the technical view for a step.
 */
export function renderTechnicalView(step) {
  const op = OPERATORS[step.operator_type];
  const notation = step.notation_json ? JSON.parse(step.notation_json) : null;
  const execLog = step.execution_log_json ? JSON.parse(step.execution_log_json) : null;
  const provenance = traceProvenance(step.id);

  const sections = [];

  // Notation
  sections.push({
    label: 'Formal Notation',
    content: notation?.text || `${op.friendlyName}(${step.description})`
  });

  // Provenance citations
  if (provenance.givenSources.length > 0) {
    sections.push({
      label: 'Lineage',
      content: provenance.givenSources.map(s =>
        `Source: ${s.filename} (SHA-256: ${s.hash?.substring(0, 12)}…, ${s.rowCount} rows, ingested ${s.ingestedAt})`
      ).join('\n')
    });
  }

  // Rule citations
  const rules = [];
  if (provenance.isGrounded) {
    rules.push('Groundedness: ✓ All outputs trace to original sources');
  } else {
    rules.push('Groundedness: ✗ Cannot trace to original sources');
  }
  sections.push({ label: 'Validation Rules', content: rules.join('\n') });

  // Execution statistics
  if (execLog) {
    const stats = [];
    if (execLog.rowsIn !== undefined) stats.push(`Rows in: ${execLog.rowsIn}`);
    if (execLog.rowsOut !== undefined) stats.push(`Rows out: ${execLog.rowsOut}`);
    if (execLog.runtime_ms !== undefined) stats.push(`Runtime: ${execLog.runtime_ms}ms`);
    if (execLog.warnings?.length > 0) stats.push(`Warnings: ${execLog.warnings.join('; ')}`);
    sections.push({ label: 'Execution Statistics', content: stats.join('\n') });
  }

  // Staleness
  if (step.status === 'stale') {
    sections.push({
      label: 'Staleness',
      content: '⚠ This step is STALE — a dependent filter or input has changed. Re-execute to update.'
    });
  }

  return sections;
}

/**
 * Generate the public view for a step.
 */
export function renderPublicView(step) {
  const op = OPERATORS[step.operator_type];
  const notation = step.notation_json ? JSON.parse(step.notation_json) : null;
  const outputs = getStepOutputs(step.id);

  // Generate plain-language description
  let description = '';

  switch (step.operator_type) {
    case 'NUL':
      description = `Audited data quality by checking for missing, blank, and absent fields. ` +
        `Three types of absence were distinguished: explicitly cleared values, unknown values, and fields that were never set.`;
      break;
    case 'SIG':
      description = `Identified and designated entity types in the data, establishing what each record represents.`;
      break;
    case 'INS':
      description = `Created concrete records from the source data, each with an immutable identifier.`;
      break;
    case 'SEG':
      description = `Filtered the data to a subset of records based on specified criteria.`;
      if (notation?.config?.filter) description += ` Filter: ${notation.config.filter}.`;
      break;
    case 'CON': {
      description = `Joined data sources together using a shared key.`;
      if (notation?.config?.key) description += ` Key: ${notation.config.key}.`;
      if (notation?.config?.unmatched !== undefined) {
        description += ` ${notation.config.unmatched} records could not be matched and are flagged in the output. No records were dropped.`;
      }
      break;
    }
    case 'SYN':
      description = `Aggregated data to produce summary statistics.`;
      if (notation?.config?.groupBy) description += ` Grouped by: ${notation.config.groupBy}.`;
      break;
    case 'ALT':
      description = `Transformed values within the existing data structure without changing the schema.`;
      break;
    case 'SUP': {
      const branches = getStepBranches(step.id);
      const branchNames = branches.map(b => b.branch_name).join(' and ');
      description = `Two parallel analyses were conducted: ${branchNames}. Both interpretations are held simultaneously without resolution.`;
      break;
    }
    case 'REC': {
      description = `The analytical frame was restructured.`;
      if (notation?.config?.reason) description += ` Reason: ${notation.config.reason}.`;
      break;
    }
  }

  // Use analyst's description if more specific
  if (step.description && step.description.length > description.length / 2) {
    description = step.description;
  }

  // Output summary
  let outputSummary = '';
  if (outputs.length > 0) {
    const output = outputs[0];
    outputSummary = `Output: ${output.row_count || '?'} rows.`;
  }

  return {
    stepNumber: step.sequence_number,
    title: `Step ${step.sequence_number} — ${op.friendlyName}`,
    description,
    outputSummary,
    canEdit: true // Analyst can customize public description
  };
}

function _operatorLabel(type) {
  switch (type) {
    case 'NUL': return 'Null Audit';
    case 'SIG': return 'Designation';
    case 'INS': return 'Instantiation';
    case 'SEG': return 'Filter/Partition';
    case 'CON': return 'Join';
    case 'SYN': return 'Aggregation';
    case 'ALT': return 'Transformation';
    case 'SUP': return 'Parallel Analysis';
    case 'REC': return 'Frame Change';
    default: return type;
  }
}
