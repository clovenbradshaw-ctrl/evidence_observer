-- ================================================================
-- Analytical Workbench Schema
-- Experience Engine: 𝓔 = (G, S, M, π, γ, σ)
-- ================================================================

-- ============ GIVEN-LOG G (IMMUTABLE — Existence Domain) ============
-- NUL(∅) to nullify | SIG(⊡) to point | INS(△) to create

CREATE TABLE IF NOT EXISTS given_log (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  sha256_hash TEXT NOT NULL,
  source_url TEXT,
  source_description TEXT,
  scrape_timestamp TEXT,
  method TEXT CHECK(method IN ('manual_upload', 'api', 'web_scrape')),
  analyst_id TEXT,
  ingested_at TEXT NOT NULL,
  derived_from TEXT REFERENCES given_log(id),
  row_count INTEGER,
  column_count INTEGER,
  schema_json TEXT,
  data_json TEXT NOT NULL,
  provenance_json TEXT
);

CREATE TABLE IF NOT EXISTS given_anchors (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES given_log(id),
  row_index INTEGER NOT NULL,
  record_hash TEXT NOT NULL,
  row_data_json TEXT NOT NULL,
  null_states_json TEXT
);

-- Ineliminability triggers (EO Rule 3: Anti-Gaslighting)
-- The past actually happened. Given-Log is append-only.
CREATE TRIGGER IF NOT EXISTS no_update_given_log
  BEFORE UPDATE ON given_log
  BEGIN SELECT RAISE(ABORT, 'Gaslighting: Given-Log is append-only'); END;

CREATE TRIGGER IF NOT EXISTS no_delete_given_log
  BEFORE DELETE ON given_log
  BEGIN SELECT RAISE(ABORT, 'Gaslighting: Given-Log is append-only'); END;

CREATE TRIGGER IF NOT EXISTS no_update_given_anchors
  BEFORE UPDATE ON given_anchors
  BEGIN SELECT RAISE(ABORT, 'Gaslighting: Given anchors are immutable'); END;

CREATE TRIGGER IF NOT EXISTS no_delete_given_anchors
  BEFORE DELETE ON given_anchors
  BEGIN SELECT RAISE(ABORT, 'Gaslighting: Given anchors are immutable'); END;

-- ============ HORIZON-LATTICE S (Structure Domain) ============
-- SEG(|) to cut | CON(⋈) to join | SYN(∨) to merge

CREATE TABLE IF NOT EXISTS lenses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lens_type TEXT NOT NULL CHECK(lens_type IN ('temporal', 'geographic', 'categorical', 'methodological', 'observer')),
  parameters_json TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL,
  parent_id TEXT REFERENCES lenses(id),
  change_reason TEXT
);

CREATE TABLE IF NOT EXISTS horizons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lens_ids_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ============ MEANT-GRAPH M (Significance Domain) ============
-- ALT(∿) to change | SUP(∥) to hold | REC(↬) to reframe

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  horizon_id TEXT REFERENCES horizons(id),
  analyst_id TEXT,
  mode TEXT NOT NULL DEFAULT 'explore' CHECK(mode IN ('explore', 'confirm')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS steps (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  sequence_number INTEGER NOT NULL,
  operator_type TEXT NOT NULL CHECK(operator_type IN ('NUL', 'SIG', 'INS', 'SEG', 'CON', 'SYN', 'ALT', 'SUP', 'REC')),
  description TEXT NOT NULL,
  input_ids_json TEXT,
  lens_dependency_ids_json TEXT,
  code TEXT,
  execution_mode TEXT NOT NULL DEFAULT 'code' CHECK(execution_mode IN ('code', 'ai')),
  ai_config_json TEXT,
  data_selector_json TEXT,
  notation_json TEXT,
  execution_log_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed', 'stale')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS step_outputs (
  id TEXT PRIMARY KEY,
  step_id TEXT NOT NULL REFERENCES steps(id),
  name TEXT NOT NULL,
  row_count INTEGER,
  data_json TEXT,
  created_at TEXT NOT NULL
);

-- ============ SUP(∥) & REC(↬) — Superposition & Recursion ============

CREATE TABLE IF NOT EXISTS reconciliation_decisions (
  id TEXT PRIMARY KEY,
  step_id TEXT NOT NULL REFERENCES steps(id),
  source_id_a TEXT NOT NULL,
  source_id_b TEXT NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('merge', 'keep_separate', 'disambiguation')),
  reason TEXT NOT NULL,
  analyst_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS branch_states (
  id TEXT PRIMARY KEY,
  step_id TEXT NOT NULL REFERENCES steps(id),
  branch_name TEXT NOT NULL,
  output_id TEXT REFERENCES step_outputs(id),
  resolved INTEGER NOT NULL DEFAULT 0,
  resolution_step_id TEXT REFERENCES steps(id),
  resolution_reason TEXT CHECK(resolution_reason IS NULL OR resolution_reason IN (
    'methodological_preference', 'data_quality', 'scope_alignment',
    'stakeholder_requirement', 'empirical_superiority'
  ))
);

-- ============ PROVENANCE π — Audit Trail ============

-- Ingestion events — tracks every step of the INS(△) upload pipeline
CREATE TABLE IF NOT EXISTS ingestion_events (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN (
    'upload_started', 'hash_computed', 'duplicate_detected',
    'sig_parse_complete', 'nul_audit_complete',
    'storage_decided', 'source_created', 'anchors_created',
    'ingestion_complete', 'ingestion_failed'
  )),
  event_data_json TEXT,
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_entries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  step_id TEXT REFERENCES steps(id),
  view_type TEXT NOT NULL CHECK(view_type IN ('technical', 'public')),
  notation_text TEXT,
  plain_text TEXT,
  custom_description TEXT,
  generated_at TEXT NOT NULL
);

-- Ingestion events are append-only
CREATE TRIGGER IF NOT EXISTS no_update_ingestion_events
  BEFORE UPDATE ON ingestion_events
  BEGIN SELECT RAISE(ABORT, 'Gaslighting: Ingestion events are append-only'); END;

CREATE TRIGGER IF NOT EXISTS no_delete_ingestion_events
  BEFORE DELETE ON ingestion_events
  BEGIN SELECT RAISE(ABORT, 'Gaslighting: Ingestion events are append-only'); END;

-- Provenance is append-only (EO Rule 7: Groundedness)
CREATE TRIGGER IF NOT EXISTS no_update_audit
  BEFORE UPDATE ON audit_entries
  BEGIN SELECT RAISE(ABORT, 'UngroundedAssertion: Audit entries are append-only'); END;

CREATE TRIGGER IF NOT EXISTS no_delete_audit
  BEFORE DELETE ON audit_entries
  BEGIN SELECT RAISE(ABORT, 'UngroundedAssertion: Audit entries are append-only'); END;

-- ============ INDEXES ============

CREATE INDEX IF NOT EXISTS idx_given_anchors_source ON given_anchors(source_id);
CREATE INDEX IF NOT EXISTS idx_steps_session ON steps(session_id);
CREATE INDEX IF NOT EXISTS idx_step_outputs_step ON step_outputs(step_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_step ON reconciliation_decisions(step_id);
CREATE INDEX IF NOT EXISTS idx_branch_states_step ON branch_states(step_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_events_source ON ingestion_events(source_id);
CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_step ON audit_entries(step_id);
