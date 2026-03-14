/**
 * Provenance (π) — Audit Trail
 * Append-only audit entries linking Meant records to Given-Log sources.
 *
 * EO Rule 7 (Groundedness): Every interpretation traces to raw experience.
 */

import { run, query, queryOne, uuid, now } from '../db.js';

export function createAuditEntry({
  sessionId, stepId = null, viewType, notationText = null,
  plainText = null, customDescription = null
}) {
  const id = uuid();
  run(
    `INSERT INTO audit_entries
      (id, session_id, step_id, view_type, notation_text, plain_text, custom_description, generated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, sessionId, stepId, viewType, notationText, plainText, customDescription, now()]
  );
  return id;
}

export function getSessionAuditEntries(sessionId, viewType = null) {
  if (viewType) {
    return query(
      'SELECT * FROM audit_entries WHERE session_id = ? AND view_type = ? ORDER BY generated_at',
      [sessionId, viewType]
    );
  }
  return query(
    'SELECT * FROM audit_entries WHERE session_id = ? ORDER BY generated_at',
    [sessionId]
  );
}

export function getStepAuditEntries(stepId) {
  return query(
    'SELECT * FROM audit_entries WHERE step_id = ? ORDER BY generated_at',
    [stepId]
  );
}
