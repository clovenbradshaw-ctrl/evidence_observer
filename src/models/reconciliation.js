/**
 * SIG(⊡) to point / INS(△) to create — Entity Resolution
 * Reconciliation decisions for IDENTIFY steps.
 *
 * Each decision is a Meant record with full provenance.
 * The reconciliation table records every merge/disambiguation decision explicitly.
 */

import { run, query, queryOne, uuid, now } from '../db.js';

export function createReconciliationDecision({
  stepId, sourceIdA, sourceIdB, decision, reason, analystId = null
}) {
  const id = uuid();
  run(
    `INSERT INTO reconciliation_decisions
      (id, step_id, source_id_a, source_id_b, decision, reason, analyst_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, stepId, sourceIdA, sourceIdB, decision, reason, analystId, now()]
  );
  return id;
}

export function getStepReconciliations(stepId) {
  return query(
    'SELECT * FROM reconciliation_decisions WHERE step_id = ? ORDER BY created_at',
    [stepId]
  );
}

export function getAllReconciliations() {
  return query('SELECT * FROM reconciliation_decisions ORDER BY created_at DESC');
}
