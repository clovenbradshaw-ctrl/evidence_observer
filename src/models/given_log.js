/**
 * Given-Log (G) — Existence Domain
 * INS(△)-minted immutable records anchored in the Given-Log.
 *
 * EO Rules enforced:
 *   Rule 1 (Distinction): Given and Meant are exhaustive and exclusive
 *   Rule 2 (Impenetrability): Given derives only from Given
 *   Rule 3 (Ineliminability): Given-Log is append-only
 */

import { run, query, queryOne, uuid, now, storeBlob, getBlob } from '../db.js';
import { NullState } from './operators.js';

/**
 * INS(△) — Create a new Given-Log entry (source record).
 * Mints an immutable anchor for the ingested source.
 */
export function ins_createSource({
  id: presetId = null,
  filename,
  sha256Hash,
  sourceUrl = null,
  sourceDescription = null,
  scrapeTimestamp = null,
  method = 'manual_upload',
  analystId = null,
  rowCount = null,
  columnCount = null,
  schemaJson = null,
  dataJson,
  provenanceJson = null,
  derivedFrom = null
}) {
  const id = presetId || uuid();
  const ingestedAt = now();

  run(
    `INSERT INTO given_log
      (id, filename, sha256_hash, source_url, source_description,
       scrape_timestamp, method, analyst_id, ingested_at, derived_from,
       row_count, column_count, schema_json, data_json, provenance_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, filename, sha256Hash, sourceUrl, sourceDescription,
     scrapeTimestamp, method, analystId, ingestedAt, derivedFrom,
     rowCount, columnCount,
     schemaJson ? JSON.stringify(schemaJson) : null,
     JSON.stringify(dataJson),
     provenanceJson ? JSON.stringify(provenanceJson) : null]
  );

  return { id, ingestedAt };
}

/**
 * INS(△) — Create a Given anchor for a single row.
 * Content-addressed by record_hash.
 */
export function ins_createAnchor({
  sourceId,
  rowIndex,
  recordHash,
  rowDataJson,
  nullStatesJson = null
}) {
  const id = uuid();

  run(
    `INSERT INTO given_anchors
      (id, source_id, row_index, record_hash, row_data_json, null_states_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, sourceId, rowIndex, recordHash,
     JSON.stringify(rowDataJson),
     nullStatesJson ? JSON.stringify(nullStatesJson) : null]
  );

  return id;
}

/**
 * Query all Given-Log sources.
 */
export function getAllSources() {
  return query('SELECT * FROM given_log ORDER BY ingested_at DESC');
}

/**
 * Query a single Given-Log source by ID.
 */
export function getSource(id) {
  return queryOne('SELECT * FROM given_log WHERE id = ?', [id]);
}

/**
 * Query all anchors for a Given-Log source.
 */
export function getAnchors(sourceId) {
  return query(
    'SELECT * FROM given_anchors WHERE source_id = ? ORDER BY row_index',
    [sourceId]
  );
}

/**
 * Query a single anchor by ID.
 */
export function getAnchor(id) {
  return queryOne('SELECT * FROM given_anchors WHERE id = ?', [id]);
}

/**
 * Get sources derived from a given source (lineage chain).
 */
export function getDerivedSources(sourceId) {
  return query(
    'SELECT * FROM given_log WHERE derived_from = ? ORDER BY ingested_at',
    [sourceId]
  );
}

/**
 * Check if a SHA-256 hash already exists in the Given-Log.
 */
export function hashExists(sha256Hash) {
  const result = queryOne(
    'SELECT id FROM given_log WHERE sha256_hash = ?',
    [sha256Hash]
  );
  return result ? result.id : null;
}

/**
 * Store large source data in IndexedDB instead of SQLite.
 * Returns the blob key.
 */
export async function ins_storeLargeData(sourceId, data) {
  const key = `given_data_${sourceId}`;
  await storeBlob(key, data);
  return key;
}

/**
 * Retrieve large source data from IndexedDB.
 */
export async function getLargeData(sourceId) {
  const key = `given_data_${sourceId}`;
  return await getBlob(key);
}
