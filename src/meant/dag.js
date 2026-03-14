/**
 * Meant-Graph DAG — Dependency Graph
 *
 * Builds a directed acyclic graph of step dependencies.
 * Supports topological sorting, cycle detection, and staleness propagation.
 *
 * Nodes: Given-Log sources and step outputs
 * Edges: input_ids dependencies
 */

import { query, run } from '../db.js';
import { StepStatus } from '../models/operators.js';

/**
 * Build the DAG for a session.
 * Returns { nodes, edges, adjacency }.
 */
export function buildDAG(sessionId) {
  const steps = query(
    'SELECT * FROM steps WHERE session_id = ? ORDER BY sequence_number',
    [sessionId]
  );

  const nodes = [];
  const edges = [];
  const adjacency = {}; // stepId -> [dependentStepIds]

  // Add Given-Log source nodes
  const givenSourceIds = new Set();
  for (const step of steps) {
    const inputIds = step.input_ids_json ? JSON.parse(step.input_ids_json) : [];
    for (const inputId of inputIds) {
      // Check if this is a Given-Log source
      const source = query('SELECT id, filename FROM given_log WHERE id = ?', [inputId]);
      if (source.length > 0 && !givenSourceIds.has(inputId)) {
        givenSourceIds.add(inputId);
        nodes.push({
          id: inputId,
          type: 'given',
          label: source[0].filename,
          status: 'immutable'
        });
      }
    }
  }

  // Add step nodes and edges
  for (const step of steps) {
    nodes.push({
      id: step.id,
      type: 'step',
      label: `${step.operator_type} #${step.sequence_number}`,
      operatorType: step.operator_type,
      status: step.status,
      sequenceNumber: step.sequence_number,
      description: step.description
    });

    adjacency[step.id] = [];

    const inputIds = step.input_ids_json ? JSON.parse(step.input_ids_json) : [];
    for (const inputId of inputIds) {
      edges.push({ from: inputId, to: step.id });

      // Build reverse adjacency for staleness propagation
      if (!adjacency[inputId]) adjacency[inputId] = [];
      adjacency[inputId].push(step.id);
    }
  }

  return { nodes, edges, adjacency };
}

/**
 * Topological sort of the DAG.
 * Returns step IDs in execution order.
 */
export function topologicalSort(sessionId) {
  const { nodes, edges } = buildDAG(sessionId);

  const inDegree = {};
  const adjList = {};

  for (const node of nodes) {
    inDegree[node.id] = 0;
    adjList[node.id] = [];
  }

  for (const edge of edges) {
    adjList[edge.from] = adjList[edge.from] || [];
    adjList[edge.from].push(edge.to);
    inDegree[edge.to] = (inDegree[edge.to] || 0) + 1;
  }

  // Kahn's algorithm
  const queue = [];
  for (const [id, deg] of Object.entries(inDegree)) {
    if (deg === 0) queue.push(id);
  }

  const sorted = [];
  while (queue.length > 0) {
    const node = queue.shift();
    sorted.push(node);

    for (const neighbor of (adjList[node] || [])) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Check for cycles
  if (sorted.length !== nodes.length) {
    const missing = nodes.filter(n => !sorted.includes(n.id));
    throw new Error(`Cycle detected in Meant-Graph DAG involving: ${missing.map(n => n.label).join(', ')}`);
  }

  return sorted;
}

/**
 * Propagate staleness from a changed step or lens.
 * Marks all downstream steps as stale.
 *
 * @param {string} sessionId - Session ID
 * @param {string} sourceId - ID of the changed step or lens
 * @returns {string[]} IDs of steps marked stale
 */
export function propagateStaleness(sessionId, sourceId) {
  const { adjacency } = buildDAG(sessionId);
  const staleIds = [];
  const visited = new Set();

  function dfs(nodeId) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const dependents = adjacency[nodeId] || [];
    for (const depId of dependents) {
      staleIds.push(depId);
      run('UPDATE steps SET status = ? WHERE id = ?', [StepStatus.STALE, depId]);
      dfs(depId);
    }
  }

  dfs(sourceId);
  return staleIds;
}

/**
 * Get all stale steps in execution order (for re-run).
 */
export function getStaleSteps(sessionId) {
  const sorted = topologicalSort(sessionId);
  const staleSteps = query(
    'SELECT * FROM steps WHERE session_id = ? AND status = ?',
    [sessionId, StepStatus.STALE]
  );

  const staleIds = new Set(staleSteps.map(s => s.id));

  // Return in topological order
  return sorted
    .filter(id => staleIds.has(id))
    .map(id => staleSteps.find(s => s.id === id))
    .filter(Boolean);
}

/**
 * Get the provenance chain for a step output.
 * Walks backward through the DAG to Given-Log sources.
 *
 * @returns {{ chain: Object[], givenSources: Object[] }}
 */
export function getProvenanceChain(stepId) {
  const chain = [];
  const givenSources = [];
  const visited = new Set();

  function walkBack(id) {
    if (visited.has(id)) return;
    visited.add(id);

    // Check if it's a Given-Log source
    const source = query('SELECT * FROM given_log WHERE id = ?', [id]);
    if (source.length > 0) {
      givenSources.push(source[0]);
      return;
    }

    // It's a step — get its inputs
    const step = query('SELECT * FROM steps WHERE id = ?', [id]);
    if (step.length > 0) {
      chain.push(step[0]);
      const inputIds = step[0].input_ids_json ? JSON.parse(step[0].input_ids_json) : [];
      for (const inputId of inputIds) {
        walkBack(inputId);
      }
    }
  }

  walkBack(stepId);

  return {
    chain: chain.reverse(), // From Given to current step
    givenSources
  };
}
