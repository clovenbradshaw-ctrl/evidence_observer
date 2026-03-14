/**
 * Linked Data Package
 * Output tables with per-row provenance key mapping back to Given source records.
 */

import { getSessionSteps, getStepOutputs } from '../models/meant_graph.js';
import { getSource, getAnchors } from '../models/given_log.js';
import { getProvenanceChain } from '../meant/dag.js';
import { OPERATORS } from '../models/operators.js';

/**
 * Generate a linked data package for a session.
 * Each output row is annotated with a provenance key.
 */
export function generateLinkedDataPackage(sessionId) {
  const steps = getSessionSteps(sessionId);
  const tables = [];

  for (const step of steps) {
    if (step.status !== 'completed') continue;

    const outputs = getStepOutputs(step.id);
    for (const output of outputs) {
      const data = output.data_json ? JSON.parse(output.data_json) : [];
      if (data.length === 0) continue;

      // Get provenance for this step
      const { givenSources } = getProvenanceChain(step.id);
      const sourceIds = givenSources.map(s => s.id);

      // Annotate each row with provenance
      const annotatedRows = data.map((row, i) => ({
        ...row,
        _provenance_step_id: step.id,
        _provenance_operator: step.operator_type,
        _provenance_sequence: step.sequence_number,
        _provenance_given_source_ids: sourceIds,
        _provenance_row_index: i
      }));

      tables.push({
        name: output.name,
        step: {
          id: step.id,
          operator: step.operator_type,
          glyph: OPERATORS[step.operator_type]?.glyph,
          sequence: step.sequence_number,
          description: step.description
        },
        row_count: annotatedRows.length,
        columns: Object.keys(annotatedRows[0] || {}),
        data: annotatedRows,
        given_sources: sourceIds
      });
    }
  }

  return {
    _format: 'evidence_observer_linked_data',
    _version: '1.0.0',
    _exported_at: new Date().toISOString(),
    tables
  };
}
