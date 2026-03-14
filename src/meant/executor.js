/**
 * Step Executor — Pyodide Bridge
 * Executes analyst-authored Python code in a sandboxed Pyodide environment.
 *
 * Injects:
 *   - Read-only Given-Log data as pandas DataFrames
 *   - Prior step outputs as read-only DataFrames
 *   - Current horizon as a Python dict
 *
 * Captures: stdout, stderr, result DataFrame, execution stats.
 */

let _pyodide = null;
let _pyodideLoading = false;
let _pyodideReady = false;

/**
 * Initialize Pyodide (lazy — only on first execution).
 * Loads pandas and numpy.
 */
export async function initPyodide() {
  if (_pyodideReady) return _pyodide;
  if (_pyodideLoading) {
    // Wait for in-progress initialization
    while (_pyodideLoading) {
      await new Promise(r => setTimeout(r, 100));
    }
    return _pyodide;
  }

  _pyodideLoading = true;

  try {
    if (typeof loadPyodide === 'undefined') {
      // Pyodide not available — use fallback JavaScript execution
      console.warn('[executor] Pyodide not available. Using JavaScript fallback.');
      _pyodideReady = true;
      _pyodideLoading = false;
      return null;
    }

    _pyodide = await loadPyodide();
    await _pyodide.loadPackage(['pandas', 'numpy']);
    _pyodideReady = true;
    console.log('[executor] Pyodide initialized with pandas + numpy');
  } catch (err) {
    console.warn('[executor] Pyodide init failed, using JS fallback:', err.message);
    _pyodideReady = true;
  } finally {
    _pyodideLoading = false;
  }

  return _pyodide;
}

/**
 * Execute a step's code.
 *
 * @param {string} code - Python code to execute
 * @param {Object} context - Execution context
 * @param {Object[]} context.inputs - Input data as { name, data (array of objects) }
 * @param {Object} [context.horizon] - Current horizon variables
 * @returns {Object} Execution result
 */
export async function executeStepCode(code, context = {}) {
  const startTime = performance.now();
  const stdout = [];
  const stderr = [];

  try {
    const pyodide = await initPyodide();

    if (pyodide) {
      return await _executePython(pyodide, code, context, startTime);
    } else {
      return await _executeJavaScript(code, context, startTime);
    }
  } catch (err) {
    return {
      success: false,
      error: err.message,
      stdout: stdout.join('\n'),
      stderr: err.stack || err.message,
      runtime_ms: Math.round(performance.now() - startTime),
      result: null
    };
  }
}

/**
 * Execute Python code via Pyodide.
 */
async function _executePython(pyodide, code, context, startTime) {
  const { inputs = [], horizon = {} } = context;

  // Capture stdout/stderr
  pyodide.runPython(`
import sys
from io import StringIO
_stdout = StringIO()
_stderr = StringIO()
sys.stdout = _stdout
sys.stderr = _stderr
  `);

  // Inject inputs as pandas DataFrames
  for (const input of inputs) {
    const jsonData = JSON.stringify(input.data || []);
    pyodide.runPython(`
import pandas as pd
import json
${input.name} = pd.DataFrame(json.loads('${jsonData.replace(/'/g, "\\'")}'))
    `);
  }

  // Inject horizon as a dict
  if (horizon && Object.keys(horizon).length > 0) {
    const horizonJson = JSON.stringify(horizon);
    pyodide.runPython(`
class Horizon:
    def __init__(self, data):
        for k, v in data.items():
            setattr(self, k, v)
    def __repr__(self):
        return f"Horizon({vars(self)})"
horizon = Horizon(json.loads('${horizonJson.replace(/'/g, "\\'")}'))
    `);
  }

  // Execute the analyst's code
  pyodide.runPython(code);

  // Capture output
  const stdout = pyodide.runPython('_stdout.getvalue()');
  const stderr = pyodide.runPython('_stderr.getvalue()');

  // Try to extract result DataFrame
  let result = null;
  let rowsOut = 0;

  try {
    // Look for a 'result' variable
    const hasResult = pyodide.runPython("'result' in dir()");
    if (hasResult) {
      const resultJson = pyodide.runPython('result.to_json(orient="records")');
      result = JSON.parse(resultJson);
      rowsOut = result.length;
    }
  } catch (e) {
    // No result DataFrame — that's OK
  }

  // Reset stdout/stderr
  pyodide.runPython('sys.stdout = sys.__stdout__; sys.stderr = sys.__stderr__');

  const runtime_ms = Math.round(performance.now() - startTime);

  return {
    success: true,
    result,
    rowsIn: inputs.reduce((sum, i) => sum + (i.data?.length || 0), 0),
    rowsOut,
    stdout,
    stderr,
    runtime_ms,
    warnings: stderr ? [stderr] : []
  };
}

/**
 * JavaScript fallback execution.
 * Supports basic data operations using plain objects and arrays.
 */
async function _executeJavaScript(code, context, startTime) {
  const { inputs = [], horizon = {} } = context;

  // Create execution context with input data
  const scope = { horizon, console: { log: () => {}, warn: () => {} } };
  const logs = [];

  // Inject inputs
  for (const input of inputs) {
    scope[input.name] = input.data || [];
  }

  // Create a safe function wrapper
  const scopeKeys = Object.keys(scope);
  const scopeValues = scopeKeys.map(k => scope[k]);

  // Wrap code to capture 'result'
  const wrappedCode = `
    "use strict";
    let result = null;
    const _logs = [];
    const console = { log: (...args) => _logs.push(args.join(' ')), warn: (...args) => _logs.push('WARN: ' + args.join(' ')) };
    ${code}
    return { result, _logs };
  `;

  const fn = new Function(...scopeKeys, wrappedCode);
  const output = fn(...scopeValues);

  const runtime_ms = Math.round(performance.now() - startTime);

  return {
    success: true,
    result: output.result,
    rowsIn: inputs.reduce((sum, i) => sum + (i.data?.length || 0), 0),
    rowsOut: Array.isArray(output.result) ? output.result.length : 0,
    stdout: output._logs?.join('\n') || '',
    stderr: '',
    runtime_ms,
    warnings: []
  };
}

/**
 * Check if Pyodide is available.
 */
export function isPyodideAvailable() {
  return _pyodideReady && _pyodide !== null;
}
