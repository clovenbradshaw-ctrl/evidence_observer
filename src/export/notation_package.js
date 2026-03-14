/**
 * Replayable Notation Package
 * Exports the full step sequence as JSON with all steps in EO notation form,
 * inputs, lens states, and resolution decisions.
 *
 * Another analyst with access to the same Given sources can replay the analysis.
 */

import { getSession, getSessionSteps, getStepOutputs } from '../models/meant_graph.js';
import { getSource } from '../models/given_log.js';
import { getHorizon, getHorizonLenses } from '../models/horizon_lattice.js';
import { getStepReconciliations } from '../models/reconciliation.js';
import { getStepBranches } from '../models/superposition.js';
import { OPERATORS, formatOperator } from '../models/operators.js';
import { checkMeantConformance } from '../provenance/service.js';

/**
 * Export a session as a replayable notation package.
 */
export function exportNotationPackage(sessionId) {
  const session = getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const steps = getSessionSteps(sessionId);
  const conformance = checkMeantConformance(sessionId);

  // Build the package
  const pkg = {
    _format: 'evidence_observer_notation_package',
    _version: '1.0.0',
    _exported_at: new Date().toISOString(),
    _experience_engine: '𝓔 = (G, S, M, π, γ, σ)',

    session: {
      id: session.id,
      name: session.name,
      description: session.description,
      mode: session.mode,
      created_at: session.created_at
    },

    horizon: null,
    given_sources: [],
    steps: [],
    conformance: conformance,

    helix_ordering: 'NUL(∅) → SIG(⊡) → INS(△) → SEG(|) → CON(⋈) → SYN(∨) → ALT(∿) → SUP(∥) → REC(↬)'
  };

  // Horizon
  if (session.horizon_id) {
    const horizon = getHorizon(session.horizon_id);
    if (horizon) {
      const lenses = getHorizonLenses(session.horizon_id);
      pkg.horizon = {
        id: horizon.id,
        name: horizon.name,
        lenses: lenses.map(l => ({
          name: l.name,
          type: l.lens_type,
          parameters: JSON.parse(l.parameters_json)
        }))
      };
    }
  }

  // Given sources
  const givenSourceIds = new Set();
  for (const step of steps) {
    const inputIds = step.input_ids_json ? JSON.parse(step.input_ids_json) : [];
    for (const id of inputIds) {
      const source = getSource(id);
      if (source && !givenSourceIds.has(id)) {
        givenSourceIds.add(id);
        pkg.given_sources.push({
          id: source.id,
          filename: source.filename,
          sha256_hash: source.sha256_hash,
          row_count: source.row_count,
          column_count: source.column_count,
          ingested_at: source.ingested_at,
          method: source.method
        });
      }
    }
  }

  // Steps
  for (const step of steps) {
    const op = OPERATORS[step.operator_type];
    const notation = step.notation_json ? JSON.parse(step.notation_json) : null;
    const outputs = getStepOutputs(step.id);
    const reconciliations = getStepReconciliations(step.id);
    const branches = getStepBranches(step.id);

    pkg.steps.push({
      sequence: step.sequence_number,
      operator: {
        code: step.operator_type,
        glyph: op.glyph,
        verb: op.verb,
        triad: op.triad
      },
      description: step.description,
      inputs: step.input_ids_json ? JSON.parse(step.input_ids_json) : [],
      code: step.code,
      notation: notation?.text || null,
      status: step.status,

      outputs: outputs.map(o => ({
        name: o.name,
        row_count: o.row_count
      })),

      reconciliations: reconciliations.length > 0 ? reconciliations.map(r => ({
        source_a: r.source_id_a,
        source_b: r.source_id_b,
        decision: r.decision,
        reason: r.reason
      })) : undefined,

      branches: branches.length > 0 ? branches.map(b => ({
        name: b.branch_name,
        resolved: !!b.resolved,
        resolution_reason: b.resolution_reason
      })) : undefined
    });
  }

  return pkg;
}
