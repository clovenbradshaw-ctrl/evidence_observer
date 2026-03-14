/**
 * Given-Log Ingestion Service
 * INS(△) to create — Mint immutable anchors from source files.
 *
 * Pipeline: File → SHA-256 hash → SIG (parse + type inference) → NUL (null detection) → INS (anchor)
 *
 * EO Rule 3 (Ineliminability): Once ingested, Given data cannot be modified or deleted.
 * Corrected versions create new Given-Log entries with derived_from pointers.
 */

import { persistToIndexedDB, storeBlob } from '../db.js';
import { ins_createSource, ins_createAnchor, hashExists } from '../models/given_log.js';
import { sig_parseFile, sig_inferSchema } from './parser.js';
import { nul_nullifyRow, nul_audit } from './nul.js';

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
  // Step 1: Read file content
  let content, filename;
  if (file instanceof File) {
    content = await file.text();
    filename = file.name;
  } else {
    content = file.content;
    filename = file.name;
  }

  // Step 2: SHA-256 hash
  const hash = await sha256(content);

  // Check for duplicate
  const existingId = hashExists(hash);
  if (existingId && !options.derivedFrom) {
    return {
      status: 'duplicate',
      existingId,
      hash,
      message: `SIG(⊡): File already exists in Given-Log with identical hash`
    };
  }

  // Step 3: SIG(⊡) — Parse and infer types
  const { headers, rows, format } = sig_parseFile(filename, content);
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

  // Step 4: NUL(∅) — Detect null states across all rows
  const nullAudit = nul_audit(rows, headers);

  // Step 5: Determine storage strategy
  const DATA_SIZE_THRESHOLD = 1024 * 1024; // 1MB
  const isLargeDataset = content.length > DATA_SIZE_THRESHOLD;
  let dataJson;

  if (isLargeDataset) {
    // Store raw content in IndexedDB, keep only metadata in SQLite
    dataJson = { _blob: true, rowCount: rows.length, format };
  } else {
    dataJson = rows;
  }

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

  const { id: sourceId, ingestedAt } = ins_createSource({
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

  // Persist to IndexedDB
  await persistToIndexedDB();

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
    const content = await import('../db.js').then(db => db.getBlob(`given_data_${source.id}`));
    if (!content) return [];
    const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
    const { rows } = sig_parseFile(source.filename, text);
    return rows;
  }

  return dataJson || [];
}
