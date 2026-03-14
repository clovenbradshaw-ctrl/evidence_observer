/**
 * Horizon-Lattice Service
 * SEG(|) to cut / CON(⋈) to join — Lens management and horizon composition.
 *
 * Manages the perspectival structure of analysis:
 * what is visible, from where, under what constraints.
 */

import { createLens, getLens, getAllLenses, updateLens, getLensHistory,
         createHorizon, getHorizon, getAllHorizons, getHorizonLenses,
         getHorizonState } from '../models/horizon_lattice.js';
import { LensType } from '../models/operators.js';
import { query, run } from '../db.js';

/**
 * Create a temporal lens (date range, cycle identifier).
 */
export function createTemporalLens({ name, dateStart, dateEnd, cycle = null, createdBy = null }) {
  return createLens({
    name,
    lensType: LensType.TEMPORAL,
    parameters: { date_start: dateStart, date_end: dateEnd, cycle },
    createdBy
  });
}

/**
 * Create a geographic lens (grain level, region filter).
 */
export function createGeographicLens({ name, grain, regions = null, createdBy = null }) {
  return createLens({
    name,
    lensType: LensType.GEOGRAPHIC,
    parameters: { grain, regions },
    createdBy
  });
}

/**
 * Create a categorical lens (entity type inclusion/exclusion).
 */
export function createCategoricalLens({ name, include = null, exclude = null, createdBy = null }) {
  return createLens({
    name,
    lensType: LensType.CATEGORICAL,
    parameters: { include, exclude },
    createdBy
  });
}

/**
 * Create a methodological lens (analytical frame).
 */
export function createMethodologicalLens({ name, method, description = null, createdBy = null }) {
  return createLens({
    name,
    lensType: LensType.METHODOLOGICAL,
    parameters: { method, description },
    createdBy
  });
}

/**
 * Create an observer lens (analyst identity, institutional affiliation).
 */
export function createObserverLens({ name, analyst, affiliation = null, mandate = null, createdBy = null }) {
  return createLens({
    name,
    lensType: LensType.OBSERVER,
    parameters: { analyst, affiliation, mandate },
    createdBy
  });
}

/**
 * Compose multiple lenses into a named horizon.
 */
export function composeHorizon({ name, lensIds }) {
  // Validate all lenses exist
  for (const id of lensIds) {
    if (!getLens(id)) {
      throw new Error(`Lens ${id} not found`);
    }
  }
  return createHorizon({ name, lensIds });
}

/**
 * Find all steps that depend on a specific lens.
 * Returns step IDs that need to be marked stale when the lens changes.
 */
export function findDependentSteps(lensId) {
  const steps = query(
    'SELECT * FROM steps WHERE lens_dependency_ids_json IS NOT NULL'
  );

  return steps.filter(step => {
    const deps = JSON.parse(step.lens_dependency_ids_json);
    return deps.includes(lensId);
  });
}

/**
 * Update a lens and propagate staleness to dependent steps.
 * Returns { newLensId, staleStepIds }.
 */
export function updateLensAndPropagate(lensId, { parameters, changeReason, createdBy }) {
  const newLensId = updateLens(lensId, { parameters, changeReason, createdBy });

  // Find and mark dependent steps as stale
  const dependentSteps = findDependentSteps(lensId);
  const staleStepIds = dependentSteps.map(s => s.id);

  // Mark stale
  for (const stepId of staleStepIds) {
    run('UPDATE steps SET status = ? WHERE id = ?', ['stale', stepId]);
  }

  return { newLensId, staleStepIds };
}

// Re-export for convenience
export { getAllLenses, getAllHorizons, getHorizonState, getLensHistory };
