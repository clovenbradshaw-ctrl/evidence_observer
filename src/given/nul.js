/**
 * NUL(∅) — to nullify
 * Recognize absence as a positive, representable state.
 *
 * Three null readings (EO's tripartite null):
 *   CLEARED    — Was present, now removed (∅ explicit)
 *   UNKNOWN    — Applies but unregistered (∅ unmarked)
 *   NEVER_SET  — No history; type exists but never instantiated (∅ absent)
 *
 * Codd proposed A-mark and I-mark in 1990; industry rejected both.
 * EO reintroduces this three-way distinction as fundamental to the Existence triad.
 */

import { NullState } from '../models/operators.js';

/**
 * NUL(∅) — Detect the null state of a single cell value.
 *
 * @param {*} value - The cell value
 * @param {boolean} fieldExistsInSchema - Whether the column exists in this record's schema
 * @param {boolean} fieldExistsInRecord - Whether the field was present in this specific record
 * @returns {string|null} NullState or null if the value is populated
 */
export function nul_nullify(value, fieldExistsInSchema = true, fieldExistsInRecord = true) {
  // NEVER_SET: field doesn't exist in this record at all
  if (!fieldExistsInRecord) {
    return NullState.NEVER_SET;
  }

  // CLEARED: field exists and was explicitly set to empty
  if (value === '' || value === null) {
    return NullState.CLEARED;
  }

  // UNKNOWN: field exists in schema but value is undefined/missing
  if (value === undefined) {
    return NullState.UNKNOWN;
  }

  // Value is populated — not null
  return null;
}

/**
 * NUL(∅) — Detect null states for an entire row, given the full schema.
 *
 * @param {Object} rowData - The row data as key-value pairs
 * @param {string[]} schemaColumns - All column names in the full schema
 * @returns {Object} Map of column name → NullState (only for null columns)
 */
export function nul_nullifyRow(rowData, schemaColumns) {
  const nullStates = {};

  for (const column of schemaColumns) {
    const fieldExistsInRecord = column in rowData;
    const value = rowData[column];
    const state = nul_nullify(value, true, fieldExistsInRecord);

    if (state !== null) {
      nullStates[column] = state;
    }
  }

  return nullStates;
}

/**
 * NUL(∅) — Audit null states across an entire dataset.
 * Returns a summary of null occurrences by column and state.
 *
 * @param {Object[]} rows - Array of row data objects
 * @param {string[]} schemaColumns - All column names
 * @returns {Object} { columnName: { CLEARED: count, UNKNOWN: count, NEVER_SET: count, populated: count } }
 */
export function nul_audit(rows, schemaColumns) {
  const audit = {};

  for (const column of schemaColumns) {
    audit[column] = {
      [NullState.CLEARED]: 0,
      [NullState.UNKNOWN]: 0,
      [NullState.NEVER_SET]: 0,
      populated: 0
    };
  }

  for (const row of rows) {
    for (const column of schemaColumns) {
      const fieldExistsInRecord = column in row;
      const value = row[column];
      const state = nul_nullify(value, true, fieldExistsInRecord);

      if (state !== null) {
        audit[column][state]++;
      } else {
        audit[column].populated++;
      }
    }
  }

  return audit;
}

/**
 * Format a null state for display with EO glyph.
 */
export function formatNullState(state) {
  switch (state) {
    case NullState.CLEARED:   return '∅ CLEARED (was present, now removed)';
    case NullState.UNKNOWN:   return '∅ UNKNOWN (applies but unregistered)';
    case NullState.NEVER_SET: return '∅ NEVER_SET (no history)';
    default: return state;
  }
}
