/**
 * Provenance Service — π function
 * Traverses the chain from any Meant output back to Given-Log sources.
 *
 * π: M → G  (maps interpretations to their grounding in raw experience)
 * γ: S → G  (maps positions in Horizon-Lattice to accessible entries)
 * σ: (S,M) → M  (maps position-interpretation pairs to superseded interpretations)
 */

import { createAuditEntry, getSessionAuditEntries } from '../models/provenance.js';
import { getProvenanceChain } from '../meant/dag.js';
import { getSessionSteps, getStepOutputs, getStep } from '../models/meant_graph.js';
import { getSource, getAnchors } from '../models/given_log.js';
import { OPERATORS, formatOperator } from '../models/operators.js';
import { generateNotation } from '../meant/notation.js';
import { getIngestionEvents, describeIngestionEvent } from '../models/ingestion_events.js';

/**
 * Generate audit entries for all steps in a session.
 * Creates both technical and public views.
 */
export function generateSessionAudit(sessionId) {
  const steps = getSessionSteps(sessionId);

  for (const step of steps) {
    if (step.status !== 'completed') continue;

    const notation = step.notation_json ? JSON.parse(step.notation_json) : null;

    // Technical view
    createAuditEntry({
      sessionId,
      stepId: step.id,
      viewType: 'technical',
      notationText: notation?.text || `${formatOperator(step.operator_type)}(...)`,
      plainText: null
    });

    // Public view
    createAuditEntry({
      sessionId,
      stepId: step.id,
      viewType: 'public',
      notationText: null,
      plainText: notation?.public || step.description
    });
  }
}

/**
 * π — Get the full provenance chain for any step output.
 * Walks backward through the Meant-Graph to Given-Log sources.
 *
 * @param {string} stepId - Step to trace
 * @returns {Object} Complete provenance record
 */
export function traceProvenance(stepId) {
  const { chain, givenSources } = getProvenanceChain(stepId);

  return {
    step: getStep(stepId),
    chain: chain.map(step => ({
      id: step.id,
      operator: formatOperator(step.operator_type),
      glyph: OPERATORS[step.operator_type]?.glyph,
      description: step.description,
      status: step.status,
      notation: step.notation_json ? JSON.parse(step.notation_json) : null,
      sequenceNumber: step.sequence_number
    })),
    givenSources: givenSources.map(source => ({
      id: source.id,
      filename: source.filename,
      hash: source.sha256_hash,
      rowCount: source.row_count,
      ingestedAt: source.ingested_at,
      ingestionTrail: getIngestionAuditTrail(source.id)
    })),
    isGrounded: givenSources.length > 0,
    chainLength: chain.length
  };
}

/**
 * Drill down into a specific output value.
 * Given a row index in a step's output, traces back to the Given-Log rows
 * that contributed to that value.
 *
 * @param {string} stepId - Step that produced the output
 * @param {number} rowIndex - Row index in the output
 * @returns {Object} Drill-down result
 */
export function drillDown(stepId, rowIndex) {
  const step = getStep(stepId);
  if (!step) return null;

  const outputs = getStepOutputs(stepId);
  const output = outputs[0]; // First output
  if (!output) return null;

  const outputData = output.data_json ? JSON.parse(output.data_json) : [];
  const row = outputData[rowIndex];
  if (!row) return null;

  // Trace provenance
  const provenance = traceProvenance(stepId);

  // Get the source Given rows
  const sourceRows = [];
  for (const source of provenance.givenSources) {
    const fullSource = getSource(source.id);
    if (fullSource) {
      try {
        const data = JSON.parse(fullSource.data_json);
        if (Array.isArray(data)) {
          sourceRows.push({
            source: source.filename,
            sourceId: source.id,
            rows: data
          });
        }
      } catch (e) {
        // Large dataset in IndexedDB
      }
    }
  }

  return {
    outputRow: row,
    outputRowIndex: rowIndex,
    step: {
      id: step.id,
      operator: formatOperator(step.operator_type),
      description: step.description,
      code: step.code
    },
    provenanceChain: provenance.chain,
    givenSources: sourceRows,
    isGrounded: provenance.isGrounded
  };
}

/**
 * Get the full ingestion audit trail for a Given-Log source.
 * Returns every pipeline event with human-readable descriptions.
 *
 * @param {string} sourceId - Given-Log source ID
 * @returns {Object[]} Array of described ingestion events
 */
export function getIngestionAuditTrail(sourceId) {
  const events = getIngestionEvents(sourceId);
  return events.map(event => {
    const described = describeIngestionEvent(event);
    return {
      id: event.id,
      sourceId: event.source_id,
      eventType: event.event_type,
      occurredAt: event.occurred_at,
      ...described,
      rawData: event.event_data_json
        ? (typeof event.event_data_json === 'string' ? JSON.parse(event.event_data_json) : event.event_data_json)
        : null
    };
  });
}

/**
 * Check Meant-conformance for a session.
 * Every output must trace to Given-Log sources.
 */
export function checkMeantConformance(sessionId) {
  const steps = getSessionSteps(sessionId);
  const violations = [];

  for (const step of steps) {
    if (step.status !== 'completed') continue;

    const provenance = traceProvenance(step.id);
    if (!provenance.isGrounded) {
      violations.push({
        stepId: step.id,
        operator: formatOperator(step.operator_type),
        violation: 'UngroundedAssertion',
        message: `Step ${step.sequence_number} (${formatOperator(step.operator_type)}) has no traceable path to Given-Log`
      });
    }
  }

  return {
    conformant: violations.length === 0,
    violations
  };
}
