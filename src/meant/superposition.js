/**
 * SUP(∥) Superposition / REC(↬) Recursion Service
 *
 * SUP: Creates named branches for parallel analysis.
 *      Both interpretations are held simultaneously.
 * REC: Collapses superposition with explicit, documented reason.
 *      Resolution reason enters the provenance record.
 */

import { createBranchState, getStepBranches, resolveBranch, getUnresolvedBranches } from '../models/superposition.js';
import { createStep, createStepOutput, getStep, getStepOutputs } from '../models/meant_graph.js';
import { executeStepCode } from './executor.js';
import { ResolutionReasons, OPERATORS } from '../models/operators.js';
import { uuid, now } from '../db.js';

/**
 * SUP(∥) — Create a superposition step with named branches.
 *
 * @param {string} sessionId - Session ID
 * @param {string} stepId - The SUP step ID (already created)
 * @param {Object[]} branches - Array of { name, code } for each branch
 * @param {Object[]} inputs - Input data for execution
 * @param {Object} [horizon] - Current horizon state
 * @returns {Object} Branch execution results
 */
export async function executeSuperposition(stepId, branches, inputs, horizon = null) {
  if (branches.length < 2) {
    throw new Error('SUP(∥): Superposition requires at least two branches');
  }

  // Validate meaningful branch names
  for (const branch of branches) {
    if (!branch.name || branch.name.length < 3) {
      throw new Error(`SUP(∥): Branch names must be meaningful (not "A"/"B"). Got: "${branch.name}"`);
    }
  }

  const results = [];

  for (const branch of branches) {
    // Execute each branch
    let result = null;
    if (branch.code) {
      result = await executeStepCode(branch.code, { inputs, horizon: horizon || {} });
    }

    // Create output for this branch
    const outputId = createStepOutput({
      stepId,
      name: `sup_branch_${branch.name}`,
      rowCount: result?.rowsOut || 0,
      dataJson: result?.result || []
    });

    // Create branch state (unresolved)
    const branchId = createBranchState({
      stepId,
      branchName: branch.name,
      outputId
    });

    results.push({
      branchId,
      branchName: branch.name,
      outputId,
      result,
      resolved: false
    });
  }

  return results;
}

/**
 * REC(↬) — Resolve a superposition by collapsing branches.
 *
 * @param {string} branchId - Branch state ID to resolve
 * @param {string} resolutionStepId - The REC step that resolves this
 * @param {string} resolutionReason - Reason from controlled vocabulary
 */
export function resolveSuperpositon(branchId, resolutionStepId, resolutionReason) {
  // Validate reason is from controlled vocabulary
  const validReasons = Object.values(ResolutionReasons);
  if (!validReasons.includes(resolutionReason)) {
    throw new Error(
      `REC(↬): Resolution reason must be from controlled vocabulary: ${validReasons.join(', ')}. Got: "${resolutionReason}"`
    );
  }

  resolveBranch(branchId, { resolutionStepId, resolutionReason });
}

/**
 * Check if a session has unresolved superpositions.
 */
export function hasUnresolvedBranches(sessionId) {
  const unresolved = getUnresolvedBranches(sessionId);
  return unresolved.length > 0;
}

/**
 * Get a summary of all superposition states in a session.
 */
export function getSuperpositionSummary(sessionId) {
  const unresolved = getUnresolvedBranches(sessionId);
  const allBranches = [];

  // Group by step
  const byStep = {};
  for (const branch of unresolved) {
    if (!byStep[branch.step_id]) byStep[branch.step_id] = [];
    byStep[branch.step_id].push(branch);
  }

  return {
    unresolvedCount: unresolved.length,
    byStep,
    canExport: unresolved.length === 0
  };
}
