/**
 * Horizon-Lattice (S) — Structure Domain
 * Lenses and Horizons: named, composable analytical scopes.
 *
 * EO Rules enforced:
 *   Rule 4 (Perspectivality): No God's-eye view. All availability mediated by position.
 *   Rule 5 (Restrictivity): Refinement only restricts availability.
 *   Rule 6 (Coherence): Availability consistent across overlapping positions.
 */

import { run, query, queryOne, uuid, now } from '../db.js';
import { LensType } from './operators.js';

// ============ Lenses ============

export function createLens({ name, lensType, parameters, createdBy = null, changeReason = null, parentId = null }) {
  const id = uuid();
  run(
    `INSERT INTO lenses (id, name, lens_type, parameters_json, created_by, created_at, parent_id, change_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, lensType, JSON.stringify(parameters), createdBy, now(), parentId, changeReason]
  );
  return id;
}

export function getLens(id) {
  return queryOne('SELECT * FROM lenses WHERE id = ?', [id]);
}

export function getAllLenses() {
  return query('SELECT * FROM lenses ORDER BY created_at DESC');
}

/**
 * Update a lens by creating a new version (append-only history).
 * Returns the new lens ID. The parent_id links to the previous version.
 */
export function updateLens(lensId, { name, parameters, changeReason, createdBy = null }) {
  const existing = getLens(lensId);
  if (!existing) throw new Error(`Lens ${lensId} not found`);

  return createLens({
    name: name || existing.name,
    lensType: existing.lens_type,
    parameters: parameters || JSON.parse(existing.parameters_json),
    createdBy,
    changeReason: changeReason || 'Updated',
    parentId: lensId
  });
}

/**
 * Get the full version history of a lens (following parent_id chain).
 */
export function getLensHistory(lensId) {
  const history = [];
  let current = getLens(lensId);

  while (current) {
    history.push(current);
    current = current.parent_id ? getLens(current.parent_id) : null;
  }

  return history;
}

// ============ Horizons ============

export function createHorizon({ name, lensIds }) {
  const id = uuid();
  run(
    `INSERT INTO horizons (id, name, lens_ids_json, created_at)
     VALUES (?, ?, ?, ?)`,
    [id, name, JSON.stringify(lensIds), now()]
  );
  return id;
}

export function getHorizon(id) {
  return queryOne('SELECT * FROM horizons WHERE id = ?', [id]);
}

export function getAllHorizons() {
  return query('SELECT * FROM horizons ORDER BY created_at DESC');
}

/**
 * Get all lenses composing a horizon.
 */
export function getHorizonLenses(horizonId) {
  const horizon = getHorizon(horizonId);
  if (!horizon) return [];

  const lensIds = JSON.parse(horizon.lens_ids_json);
  return lensIds.map(id => getLens(id)).filter(Boolean);
}

/**
 * Get the horizon state as a flat key-value object.
 * Used for injecting into step execution context.
 */
export function getHorizonState(horizonId) {
  const lenses = getHorizonLenses(horizonId);
  const state = {};

  for (const lens of lenses) {
    const params = JSON.parse(lens.parameters_json);
    const prefix = lens.lens_type;

    for (const [key, value] of Object.entries(params)) {
      state[`${prefix}_${key}`] = value;
    }
  }

  return state;
}
