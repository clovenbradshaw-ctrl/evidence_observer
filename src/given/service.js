/**
 * Given-Log Ingestion Service
 * INS(△) to create — Mint immutable anchors from source files.
 *
 * Pipeline: File → SHA-256 hash → SIG (parse + type inference) → NUL (null detection) → INS (anchor)
 *
 * EO Rule 3 (Ineliminability): Once ingested, Given data cannot be modified or deleted.
 * Corrected versions create new Given-Log entries with derived_from pointers.
 */

import { persistToIndexedDB, storeBlob, getBlob, uuid, isIndexedDBAvailable } from '../db.js';
import { ins_createSource, ins_createAnchor, hashExists } from '../models/given_log.js';
import { sig_parseFile, sig_inferSchema } from './parser.js';
import { nul_nullifyRow, nul_audit } from './nul.js';
import { createIngestionEvent } from '../models/ingestion_events.js';

/**
 * SHA-256 hash a string using the Web Crypto API.
 * Returns hex string.
 */
async function sha256(content) {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * SHA-256 hash a single row (for content-addressed anchors).
 */
async function hashRow(rowData) {
  const canonical = JSON.stringify(rowData, Object.keys(rowData).sort());
  return await sha256(canonical);
}

/**
 * INS(△) — Full ingestion pipeline.
 * Reads a file, hashes it, parses it, detects nulls, and stores it in the Given-Log.
 *
 * @param {File|{name: string, content: string}} file - File to ingest
 * @param {Object} [options] - Ingestion options
 * @param {string} [options.sourceUrl] - Source URL
 * @param {string} [options.sourceDescription] - Description
 * @param {string} [options.scrapeTimestamp] - When the source was obtained
 * @param {string} [options.method='manual_upload'] - Ingestion method
 * @param {string} [options.analystId] - Analyst identity
 * @param {string} [options.derivedFrom] - ID of source this derives from
 * @param {Object[]} [options.schemaOverrides] - Manual type overrides [{name, type, justification}]
 * @returns {Promise<Object>} Ingestion result
 */
export async function ins_ingest(file, options = {}) {
  // Pre-generate source ID so we can log events from the start
  const sourceId = uuid();

  // Step 1: Read file content
  let content, filename;
  if (file instanceof File) {
    content = await file.text();
    filename = file.name;
  } else {
    content = file.content;
    filename = file.name;
  }

  // Audit: upload started
  createIngestionEvent(sourceId, 'upload_started', {
    filename,
    size: content.length,
    method: options.method || 'manual_upload',
    analystId: options.analystId || null,
    derivedFrom: options.derivedFrom || null
  });

  // Step 2: SHA-256 hash
  const hash = await sha256(content);

  // Audit: hash computed
  createIngestionEvent(sourceId, 'hash_computed', { hash });

  // Check for duplicate
  const existingId = hashExists(hash);
  if (existingId && !options.derivedFrom) {
    createIngestionEvent(sourceId, 'duplicate_detected', { existingId, hash });
    return {
      status: 'duplicate',
      existingId,
      hash,
      message: `File already exists with identical hash`
    };
  }

  // Step 3: SIG(⊡) — Parse and infer types
  let headers, rows, format;
  try {
    ({ headers, rows, format } = sig_parseFile(filename, content));
  } catch (parseErr) {
    createIngestionEvent(sourceId, 'ingestion_failed', {
      error: `Parse error: ${parseErr.message}`,
      stage: 'SIG'
    });
    throw new Error(`Could not parse file: ${parseErr.message}`);
  }

  if (!rows || rows.length === 0) {
    createIngestionEvent(sourceId, 'ingestion_failed', {
      error: 'No data rows found in file',
      stage: 'SIG'
    });
    throw new Error('No data rows found in file');
  }

  let schema = sig_inferSchema(headers, rows);

  // Apply manual overrides if provided
  if (options.schemaOverrides) {
    for (const override of options.schemaOverrides) {
      const col = schema.find(s => s.name === override.name);
      if (col) {
        col.override = override.type;
        col.overrideJustification = override.justification;
      }
    }
  }

  // Audit: SIG parse complete
  createIngestionEvent(sourceId, 'sig_parse_complete', {
    format,
    headerCount: headers.length,
    rowCount: rows.length,
    overrideCount: options.schemaOverrides?.length || 0
  });

  // Step 4: NUL(∅) — Detect null states across all rows
  const nullAudit = nul_audit(rows, headers);

  // Summarize null audit for the event
  let totalCleared = 0, totalUnknown = 0, totalNeverSet = 0, columnsWithNulls = 0;
  for (const [, counts] of Object.entries(nullAudit)) {
    const c = counts.CLEARED || 0;
    const u = counts.UNKNOWN || 0;
    const n = counts.NEVER_SET || 0;
    totalCleared += c;
    totalUnknown += u;
    totalNeverSet += n;
    if (c > 0 || u > 0 || n > 0) columnsWithNulls++;
  }

  // Audit: NUL audit complete
  createIngestionEvent(sourceId, 'nul_audit_complete', {
    columnsWithNulls,
    totalCleared,
    totalUnknown,
    totalNeverSet
  });

  // Step 5: Determine storage strategy
  const DATA_SIZE_THRESHOLD = 1024 * 1024; // 1MB
  let isLargeDataset = content.length > DATA_SIZE_THRESHOLD && isIndexedDBAvailable();
  let dataJson;

  if (isLargeDataset) {
    // Store raw content in IndexedDB, keep only metadata in SQLite
    dataJson = { _blob: true, rowCount: rows.length, format };
  } else {
    dataJson = rows;
  }

  // Audit: storage decision
  createIngestionEvent(sourceId, 'storage_decided', {
    strategy: isLargeDataset ? 'blob' : 'inline',
    contentSize: content.length
  });

  // Step 6: INS(△) — Create Given-Log entry
  const provenance = {
    format,
    originalSize: content.length,
    parsedHeaders: headers,
    nullAudit,
    ingestionPipeline: ['SHA-256', `SIG(⊡) ${format}`, 'NUL(∅)', 'INS(△)'],
    ...(options.sourceUrl && { sourceUrl: options.sourceUrl }),
    ...(options.scrapeTimestamp && { scrapeTimestamp: options.scrapeTimestamp }),
    ...(options.method && { method: options.method })
  };

  const { id: createdId, ingestedAt } = ins_createSource({
    id: sourceId,
    filename,
    sha256Hash: hash,
    sourceUrl: options.sourceUrl,
    sourceDescription: options.sourceDescription,
    scrapeTimestamp: options.scrapeTimestamp,
    method: options.method || 'manual_upload',
    analystId: options.analystId,
    rowCount: rows.length,
    columnCount: headers.length,
    schemaJson: schema,
    dataJson,
    provenanceJson: provenance,
    derivedFrom: options.derivedFrom
  });

  // Audit: source created
  createIngestionEvent(sourceId, 'source_created', {
    sourceId,
    ingestedAt
  });

  // Store large data in IndexedDB if needed
  if (isLargeDataset) {
    await storeBlob(`given_data_${sourceId}`, content);
  }

  // Step 7: INS(△) — Create anchors for each row
  const anchorIds = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const recordHash = await hashRow(row);
    const nullStates = nul_nullifyRow(row, headers);

    const anchorId = ins_createAnchor({
      sourceId,
      rowIndex: i,
      recordHash,
      rowDataJson: row,
      nullStatesJson: Object.keys(nullStates).length > 0 ? nullStates : null
    });
    anchorIds.push(anchorId);
  }

  // Audit: anchors created
  createIngestionEvent(sourceId, 'anchors_created', {
    anchorCount: anchorIds.length
  });

  // Audit: ingestion complete
  createIngestionEvent(sourceId, 'ingestion_complete', {
    sourceId,
    rowCount: rows.length,
    columnCount: headers.length,
    anchorCount: anchorIds.length,
    hash
  });

  // Persist to IndexedDB (best-effort — data is in SQLite regardless)
  await persistToIndexedDB().catch(err =>
    console.warn('[ins] IndexedDB persistence failed (data is in memory):', err.message)
  );

  return {
    status: 'ingested',
    sourceId,
    hash,
    filename,
    ingestedAt,
    rowCount: rows.length,
    columnCount: headers.length,
    schema,
    nullAudit,
    anchorCount: anchorIds.length,
    isLargeDataset
  };
}

/**
 * Get the parsed data for a Given-Log source.
 * Handles both inline (SQLite) and blob (IndexedDB) storage.
 */
export async function getSourceData(source) {
  const dataJson = typeof source.data_json === 'string'
    ? JSON.parse(source.data_json)
    : source.data_json;

  if (dataJson && dataJson._blob) {
    // Large dataset stored in IndexedDB
    const content = await getBlob(`given_data_${source.id}`);
    if (!content) return [];
    const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
    const { rows } = sig_parseFile(source.filename, text);
    return rows;
  }

  return dataJson || [];
}
