/**
 * SUP(∥) to hold — Superposition States
 * Holds multiple simultaneously valid states without forcing resolution.
 *
 * Both values are currently legitimate; neither overwrites the other.
 * Resolution happens only through explicit REC(↬) step.
 */

import { run, query, queryOne, uuid } from '../db.js';
import { ResolutionReasons } from './operators.js';

export function createBranchState({ stepId, branchName, outputId = null }) {
  const id = uuid();
  run(
    `INSERT INTO branch_states (id, step_id, branch_name, output_id, resolved)
     VALUES (?, ?, ?, ?, 0)`,
    [id, stepId, branchName, outputId]
  );
  return id;
}

export function getStepBranches(stepId) {
  return query('SELECT * FROM branch_states WHERE step_id = ?', [stepId]);
}

export function resolveBranch(branchId, { resolutionStepId, resolutionReason }) {
  // Validate resolution reason
  const validReasons = Object.values(ResolutionReasons);
  if (!validReasons.includes(resolutionReason)) {
    throw new Error(`Invalid resolution reason: ${resolutionReason}. Must be one of: ${validReasons.join(', ')}`);
  }

  run(
    `UPDATE branch_states SET resolved = 1, resolution_step_id = ?, resolution_reason = ? WHERE id = ?`,
    [resolutionStepId, resolutionReason, branchId]
  );
}

export function getUnresolvedBranches(sessionId) {
  return query(
    `SELECT b.* FROM branch_states b
     JOIN steps s ON b.step_id = s.id
     WHERE s.session_id = ? AND b.resolved = 0`,
    [sessionId]
  );
}
