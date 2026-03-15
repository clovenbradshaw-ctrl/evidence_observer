/**
 * Meant-Graph (M) — Significance Domain
 * Sessions, Steps, and Step Outputs.
 *
 * Every Meant record must trace to one or more Given records
 * through a documented chain of operations (EO Rule 7: Groundedness).
 */

import { run, query, queryOne, uuid, now } from '../db.js';
import { OPERATORS, StepStatus } from './operators.js';

// ============ Sessions ============

export function createSession({ name, description = null, horizonId = null, analystId = null, mode = 'explore' }) {
  const id = uuid();
  run(
    `INSERT INTO sessions (id, name, description, horizon_id, analyst_id, mode, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, name, description, horizonId, analystId, mode, now()]
  );
  return id;
}

export function getSession(id) {
  return queryOne('SELECT * FROM sessions WHERE id = ?', [id]);
}

export function getAllSessions() {
  return query('SELECT * FROM sessions ORDER BY created_at DESC');
}

export function updateSessionMode(id, mode) {
  run('UPDATE sessions SET mode = ? WHERE id = ?', [mode, id]);
}

// ============ Steps ============

export function createStep({
  sessionId,
  sequenceNumber,
  operatorType,
  description,
  inputIds = [],
  lensDependencyIds = [],
  code = null,
  executionMode = 'code',
  aiConfig = null,
  dataSelector = null
}) {
  if (!OPERATORS[operatorType]) {
    throw new Error(`Invalid operator type: ${operatorType}. Must be one of: ${Object.keys(OPERATORS).join(', ')}`);
  }

  const id = uuid();
  run(
    `INSERT INTO steps
      (id, session_id, sequence_number, operator_type, description,
       input_ids_json, lens_dependency_ids_json, code,
       execution_mode, ai_config_json, data_selector_json,
       status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, sessionId, sequenceNumber, operatorType, description,
     JSON.stringify(inputIds), JSON.stringify(lensDependencyIds),
     code, executionMode,
     aiConfig ? JSON.stringify(aiConfig) : null,
     dataSelector ? JSON.stringify(dataSelector) : null,
     StepStatus.PENDING, now()]
  );
  return id;
}

export function getStep(id) {
  return queryOne('SELECT * FROM steps WHERE id = ?', [id]);
}

export function getSessionSteps(sessionId) {
  return query(
    'SELECT * FROM steps WHERE session_id = ? ORDER BY sequence_number',
    [sessionId]
  );
}

export function updateStepStatus(id, status) {
  run('UPDATE steps SET status = ? WHERE id = ?', [status, id]);
}

export function updateStepCode(id, code) {
  run('UPDATE steps SET code = ? WHERE id = ?', [code, id]);
}

export function updateStepNotation(id, notationJson) {
  run('UPDATE steps SET notation_json = ? WHERE id = ?', [JSON.stringify(notationJson), id]);
}

export function updateStepExecutionLog(id, executionLog) {
  run('UPDATE steps SET execution_log_json = ? WHERE id = ?', [JSON.stringify(executionLog), id]);
}

export function getNextSequenceNumber(sessionId) {
  const result = queryOne(
    'SELECT MAX(sequence_number) as max_seq FROM steps WHERE session_id = ?',
    [sessionId]
  );
  return (result?.max_seq ?? 0) + 1;
}

// ============ Step Outputs ============

export function createStepOutput({ stepId, name, rowCount = null, dataJson = null }) {
  const id = uuid();
  run(
    `INSERT INTO step_outputs (id, step_id, name, row_count, data_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, stepId, name, rowCount,
     dataJson ? JSON.stringify(dataJson) : null, now()]
  );
  return id;
}

export function getStepOutputs(stepId) {
  return query('SELECT * FROM step_outputs WHERE step_id = ?', [stepId]);
}

export function getStepOutput(id) {
  return queryOne('SELECT * FROM step_outputs WHERE id = ?', [id]);
}

/**
 * Get the input data for a step.
 * Returns an array of { id, type, data } objects.
 * Type is either 'given' (from Given-Log) or 'step' (from prior step output).
 */
export function getStepInputs(step) {
  const inputIds = step.input_ids_json ? JSON.parse(step.input_ids_json) : [];
  const inputs = [];

  for (const inputId of inputIds) {
    // Check if it's a Given-Log source
    const givenSource = queryOne('SELECT * FROM given_log WHERE id = ?', [inputId]);
    if (givenSource) {
      inputs.push({
        id: inputId,
        type: 'given',
        name: givenSource.filename,
        data: givenSource
      });
      continue;
    }

    // Check if it's a step output
    const stepOutput = queryOne('SELECT * FROM step_outputs WHERE id = ?', [inputId]);
    if (stepOutput) {
      inputs.push({
        id: inputId,
        type: 'step',
        name: stepOutput.name,
        data: stepOutput
      });
      continue;
    }

    // Check if it's a step (use its outputs)
    const priorStep = queryOne('SELECT * FROM steps WHERE id = ?', [inputId]);
    if (priorStep) {
      const outputs = getStepOutputs(inputId);
      for (const output of outputs) {
        inputs.push({
          id: output.id,
          type: 'step',
          name: output.name,
          data: output,
          stepId: inputId
        });
      }
    }
  }

  return inputs;
}
