/**
 * SIG(⊡)/INS(△) Entity Resolution Service
 *
 * Generates reconciliation tables for IDENTIFY steps.
 * Each merge/disambiguation decision is explicitly recorded
 * with analyst identity and reason.
 */

import { createReconciliationDecision, getStepReconciliations } from '../models/reconciliation.js';

/**
 * Find potential entity matches in a dataset.
 * Uses simple string similarity for name matching.
 *
 * @param {Object[]} records - Array of record objects
 * @param {string} nameField - The field containing entity names
 * @param {number} [threshold=0.7] - Similarity threshold (0-1)
 * @returns {Object[]} Potential matches: { recordA, recordB, similarity, field }
 */
export function findPotentialMatches(records, nameField, threshold = 0.7) {
  const matches = [];

  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const nameA = String(records[i][nameField] || '').trim().toLowerCase();
      const nameB = String(records[j][nameField] || '').trim().toLowerCase();

      if (!nameA || !nameB) continue;
      if (nameA === nameB) {
        matches.push({
          recordA: records[i],
          recordB: records[j],
          indexA: i,
          indexB: j,
          similarity: 1.0,
          field: nameField,
          reason: 'exact_match'
        });
        continue;
      }

      const sim = _similarity(nameA, nameB);
      if (sim >= threshold) {
        matches.push({
          recordA: records[i],
          recordB: records[j],
          indexA: i,
          indexB: j,
          similarity: sim,
          field: nameField,
          reason: sim > 0.9 ? 'high_similarity' : 'possible_match'
        });
      }
    }
  }

  return matches.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Record a reconciliation decision.
 */
export function recordDecision({ stepId, sourceIdA, sourceIdB, decision, reason, analystId }) {
  return createReconciliationDecision({
    stepId, sourceIdA, sourceIdB, decision, reason, analystId
  });
}

/**
 * Apply reconciliation decisions to a dataset.
 * Creates a merged output based on merge decisions.
 *
 * @param {Object[]} records - Original records
 * @param {Object[]} decisions - Reconciliation decisions
 * @param {string} nameField - The entity name field
 * @returns {Object[]} Merged records
 */
export function applyReconciliation(records, decisions, nameField) {
  const mergeMap = {}; // sourceIdB -> sourceIdA (B merges into A)

  for (const decision of decisions) {
    if (decision.decision === 'merge') {
      mergeMap[decision.source_id_b] = decision.source_id_a;
    }
  }

  // Apply merges: records that are merged take the canonical name
  const result = records.map((record, i) => {
    const recordId = String(i);
    if (mergeMap[recordId]) {
      const canonicalIdx = parseInt(mergeMap[recordId]);
      return {
        ...record,
        [nameField]: records[canonicalIdx]?.[nameField] || record[nameField],
        _merged_from: recordId,
        _canonical_id: mergeMap[recordId]
      };
    }
    return { ...record };
  });

  return result;
}

// ============ Internal helpers ============

/**
 * Simple string similarity (Dice coefficient on bigrams).
 */
function _similarity(a, b) {
  if (a === b) return 1.0;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Set();
  for (let i = 0; i < a.length - 1; i++) {
    bigramsA.add(a.substring(i, i + 2));
  }

  const bigramsB = new Set();
  for (let i = 0; i < b.length - 1; i++) {
    bigramsB.add(b.substring(i, i + 2));
  }

  let intersection = 0;
  for (const bg of bigramsB) {
    if (bigramsA.has(bg)) intersection++;
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}
