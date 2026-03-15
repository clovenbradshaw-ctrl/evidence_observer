/**
 * Meant-Graph Service — Step Orchestration
 * Creates sessions, adds typed steps, executes code, generates notation.
 *
 * Every step in the Meant-Graph produces a Meant record that traces
 * back to Given-Log records through the provenance function π.
 */

import { persistToIndexedDB } from '../db.js';
import {
  createSession, getSession, getAllSessions,
  createStep, getStep, getSessionSteps, getNextSequenceNumber,
  updateStepStatus, updateStepNotation, updateStepExecutionLog,
  createStepOutput, getStepOutputs, getStepInputs
} from '../models/meant_graph.js';
import { OPERATORS, StepStatus } from '../models/operators.js';
import { getSource } from '../models/given_log.js';
import { getSourceData } from '../given/service.js';
import { validateHelixOrdering, validateOperatorConsistency } from './helix.js';
import { generateNotation } from './notation.js';
import { executeStepCode } from './executor.js';

/**
 * Create a new analysis session.
 */
export function startSession({ name, description, horizonId, analystId, mode }) {
  return createSession({ name, description, horizonId, analystId, mode });
}

/**
 * Add a new step to a session.
 * Validates helix ordering and returns warnings/errors.
 *
 * @param {Object} params - Step parameters
 * @returns {{ stepId: string, helixValidation: Object }}
 */
export function addStep({ sessionId, operatorType, description, inputIds = [], lensDependencyIds = [], code = null }) {
  const session = getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  // Validate helix ordering
  const existingSteps = getSessionSteps(sessionId);
  const helixValidation = validateHelixOrdering(operatorType, existingSteps, session.mode);

  // In confirm mode, block if helix invalid
  if (!helixValidation.valid && session.mode === 'confirm') {
    throw new Error(`Helix ordering violation (confirm mode):\n${helixValidation.errors.join('\n')}`);
  }

  const sequenceNumber = getNextSequenceNumber(sessionId);

  const stepId = createStep({
    sessionId,
    sequenceNumber,
    operatorType,
    description,
    inputIds,
    lensDependencyIds,
    code
  });

  return { stepId, helixValidation };
}

/**
 * Execute a step's code and generate notation.
 *
 * @param {string} stepId - Step ID
 * @param {Object} [horizonState] - Current horizon variables
 * @returns {Object} Execution result with notation
 */
export async function executeStep(stepId, horizonState = null) {
  const step = getStep(stepId);
  if (!step) throw new Error(`Step ${stepId} not found`);

  // Update status to running
  updateStepStatus(stepId, StepStatus.RUNNING);

  try {
    // Gather inputs
    const inputs = getStepInputs(step);
    const inputData = [];

    for (const input of inputs) {
      let data = [];

      if (input.type === 'given') {
        // Load Given-Log data (handles both inline and blob storage)
        const source = input.data;
        try {
          data = await getSourceData(source);
        } catch (e) {
          data = [];
        }
      } else if (input.type === 'step') {
        // Load prior step output
        try {
          data = input.data.data_json ? JSON.parse(input.data.data_json) : [];
        } catch (e) {
          data = [];
        }
      }

      const safeName = (input.name || 'input')
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/^[^a-zA-Z]/, '_');

      inputData.push({
        name: safeName,
        data: Array.isArray(data) ? data : []
      });
    }

    // Validate operator consistency
    const consistency = validateOperatorConsistency(step.operator_type, step.code);

    // Execute code
    let executionResult;
    if (step.code) {
      executionResult = await executeStepCode(step.code, {
        inputs: inputData,
        horizon: horizonState || {}
      });
    } else {
      // No code — pass-through (for UI-based steps like entity resolution)
      executionResult = {
        success: true,
        result: inputData.length > 0 ? inputData[0].data : [],
        rowsIn: inputData.reduce((sum, i) => sum + i.data.length, 0),
        rowsOut: inputData.length > 0 ? inputData[0].data.length : 0,
        stdout: '',
        stderr: '',
        runtime_ms: 0,
        warnings: []
      };
    }

    // Add consistency warnings
    if (!consistency.consistent) {
      executionResult.warnings = [
        ...(executionResult.warnings || []),
        ...consistency.flags
      ];
    }

    if (!executionResult.success) {
      updateStepStatus(stepId, StepStatus.FAILED);
      updateStepExecutionLog(stepId, {
        timestamp: new Date().toISOString(),
        runtime_ms: executionResult.runtime_ms,
        error: executionResult.error,
        stdout: executionResult.stdout,
        stderr: executionResult.stderr
      });

      return { success: false, error: executionResult.error, notation: null };
    }

    // Store output
    if (executionResult.result) {
      const outputName = `${step.operator_type.toLowerCase()}_${step.sequence_number}_output`;
      createStepOutput({
        stepId,
        name: outputName,
        rowCount: executionResult.rowsOut,
        dataJson: executionResult.result
      });
      executionResult.outputName = outputName;
    }

    // Generate EO notation
    const notation = generateNotation(step, inputs, executionResult, horizonState);

    // Update step
    updateStepStatus(stepId, StepStatus.COMPLETED);
    updateStepNotation(stepId, notation.structured);
    updateStepExecutionLog(stepId, {
      timestamp: new Date().toISOString(),
      runtime_ms: executionResult.runtime_ms,
      rowsIn: executionResult.rowsIn,
      rowsOut: executionResult.rowsOut,
      stdout: executionResult.stdout,
      stderr: executionResult.stderr,
      warnings: executionResult.warnings
    });

    // Persist to IndexedDB
    await persistToIndexedDB();

    return {
      success: true,
      result: executionResult.result,
      notation,
      executionLog: {
        rowsIn: executionResult.rowsIn,
        rowsOut: executionResult.rowsOut,
        runtime_ms: executionResult.runtime_ms,
        warnings: executionResult.warnings
      }
    };

  } catch (err) {
    updateStepStatus(stepId, StepStatus.FAILED);
    updateStepExecutionLog(stepId, {
      timestamp: new Date().toISOString(),
      error: err.message,
      stack: err.stack
    });

    return { success: false, error: err.message, notation: null };
  }
}

/**
 * Get the full step chain for a session with notation.
 */
export function getSessionChain(sessionId) {
  const steps = getSessionSteps(sessionId);
  return steps.map(step => {
    const outputs = getStepOutputs(step.id);
    const notation = step.notation_json ? JSON.parse(step.notation_json) : null;
    const executionLog = step.execution_log_json ? JSON.parse(step.execution_log_json) : null;

    return {
      ...step,
      outputs,
      notation,
      executionLog,
      operator: OPERATORS[step.operator_type]
    };
  });
}
