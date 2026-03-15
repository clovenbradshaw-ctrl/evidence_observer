/**
 * Ingestion Events — INS(△) Pipeline Audit Trail
 * Append-only log of every step in the data upload pipeline.
 *
 * Tracks: upload start, SHA-256 hash, SIG parse, NUL audit,
 * storage decisions, source creation, anchor creation, and completion.
 */

import { run, query, uuid, now } from '../db.js';

/**
 * Record an ingestion pipeline event.
 *
 * @param {string} sourceId - The Given-Log source ID
 * @param {string} eventType - One of the allowed event types
 * @param {Object} [eventData] - Optional structured data for this event
 * @returns {string} The event ID
 */
export function createIngestionEvent(sourceId, eventType, eventData = null) {
  const id = uuid();
  run(
    `INSERT INTO ingestion_events (id, source_id, event_type, event_data_json, occurred_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, sourceId, eventType, eventData ? JSON.stringify(eventData) : null, now()]
  );
  return id;
}

/**
 * Get all ingestion events for a Given-Log source, ordered chronologically.
 */
export function getIngestionEvents(sourceId) {
  return query(
    'SELECT * FROM ingestion_events WHERE source_id = ? ORDER BY occurred_at ASC',
    [sourceId]
  );
}

/**
 * Get all ingestion events across all sources, ordered chronologically.
 */
export function getAllIngestionEvents() {
  return query(
    'SELECT ie.*, gl.filename FROM ingestion_events ie JOIN given_log gl ON ie.source_id = gl.id ORDER BY ie.occurred_at ASC'
  );
}

/**
 * Get a human-readable description for an ingestion event.
 */
export function describeIngestionEvent(event) {
  const data = event.event_data_json
    ? (typeof event.event_data_json === 'string' ? JSON.parse(event.event_data_json) : event.event_data_json)
    : {};

  switch (event.event_type) {
    case 'upload_started':
      return {
        technical: `INS(△) pipeline initiated for "${data.filename}" (${_formatBytes(data.size)}, ${data.method || 'manual_upload'})`,
        public: `Data file "${data.filename}" was uploaded for import.`,
        glyph: '△'
      };
    case 'hash_computed':
      return {
        technical: `SHA-256: ${data.hash}`,
        public: `File integrity verified with cryptographic hash.`,
        glyph: '#'
      };
    case 'duplicate_detected':
      return {
        technical: `Duplicate detected — hash matches existing source ${data.existingId}`,
        public: `This file was already imported previously. Upload rejected as duplicate.`,
        glyph: '⊘'
      };
    case 'sig_parse_complete':
      return {
        technical: `SIG(⊡) parse: ${data.format} format, ${data.headerCount} columns, ${data.rowCount} rows. Schema inferred with ${data.overrideCount || 0} manual override(s).`,
        public: `File parsed as ${data.format}. Found ${data.rowCount} records across ${data.headerCount} fields.`,
        glyph: '⊡'
      };
    case 'nul_audit_complete': {
      const totalNulls = (data.totalCleared || 0) + (data.totalUnknown || 0) + (data.totalNeverSet || 0);
      return {
        technical: `NUL(∅) audit: ${data.columnsWithNulls || 0} columns contain null states (CLEARED: ${data.totalCleared || 0}, UNKNOWN: ${data.totalUnknown || 0}, NEVER_SET: ${data.totalNeverSet || 0})`,
        public: totalNulls > 0
          ? `Data quality check found ${totalNulls} missing or empty values across ${data.columnsWithNulls || 0} fields.`
          : `Data quality check complete. No missing values detected.`,
        glyph: '∅'
      };
    }
    case 'storage_decided':
      return {
        technical: `Storage: ${data.strategy} (threshold: 1MB, actual: ${_formatBytes(data.contentSize)})`,
        public: data.strategy === 'inline'
          ? `Data stored directly in the database.`
          : `Large dataset stored as external blob with metadata reference.`,
        glyph: '⬡'
      };
    case 'source_created':
      return {
        technical: `INS(△) Given-Log entry created: ${data.sourceId} at ${data.ingestedAt}`,
        public: `Immutable source record created in the Given-Log.`,
        glyph: '△'
      };
    case 'anchors_created':
      return {
        technical: `INS(△) ${data.anchorCount} content-addressed row anchors minted (each with record_hash + null_states)`,
        public: `${data.anchorCount} individual records anchored with unique identifiers.`,
        glyph: '⚓'
      };
    case 'ingestion_complete':
      return {
        technical: `INS(△) pipeline complete — ${data.rowCount} rows, ${data.columnCount} columns, ${data.anchorCount} anchors. Source: ${data.sourceId}`,
        public: `Import complete. ${data.rowCount} records with ${data.columnCount} fields are now available for analysis.`,
        glyph: '✓'
      };
    case 'ingestion_failed':
      return {
        technical: `INS(△) pipeline FAILED: ${data.error}`,
        public: `Import failed: ${data.error}`,
        glyph: '✗'
      };
    default:
      return {
        technical: `Unknown event: ${event.event_type}`,
        public: `Unknown pipeline event.`,
        glyph: '?'
      };
  }
}

function _formatBytes(bytes) {
  if (bytes == null) return 'unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
