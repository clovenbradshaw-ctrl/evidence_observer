/**
 * Validation Report Export
 *
 * Generates structured audit reports from a validation session.
 * Can be called from the Export view to produce standalone reports
 * with full provenance references.
 */

import { getSession, getSessionSteps, getStepOutputs } from '../models/meant_graph.js';
import { getSource } from '../models/given_log.js';
import { getStepReconciliations } from '../models/reconciliation.js';
import { OPERATORS } from '../models/operators.js';
import { traceProvenance } from '../provenance/service.js';
import { generateMethodology } from './methodology.js';

/**
 * Generate a validation audit report from a session.
 * Extracts findings from step descriptions and outputs.
 *
 * @param {string} sessionId - The validation audit session ID
 * @param {Object} [options] - Report options
 * @param {string} [options.format='markdown'] - 'markdown' or 'json'
 * @returns {string} Report content
 */
export function generateValidationReport(sessionId, options = {}) {
  const { format = 'markdown' } = options;
  const session = getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const steps = getSessionSteps(sessionId);

  // Extract information from steps
  const insSteps = steps.filter(s => s.operator_type === 'INS');
  const segSteps = steps.filter(s => s.operator_type === 'SEG');
  const altSteps = steps.filter(s => s.operator_type === 'ALT');
  const supSteps = steps.filter(s => s.operator_type === 'SUP');
  const recSteps = steps.filter(s => s.operator_type === 'REC');

  // Collect source information
  const sources = [];
  for (const step of insSteps) {
    const inputIds = step.input_ids_json ? JSON.parse(step.input_ids_json) : [];
    for (const id of inputIds) {
      const source = getSource(id);
      if (source) sources.push(source);
    }
  }

  // Collect reconciliation decisions
  const allReconciliations = [];
  for (const step of steps) {
    const recs = getStepReconciliations(step.id);
    if (recs.length > 0) allReconciliations.push(...recs);
  }

  // Collect provenance chains
  const provenanceChains = [];
  for (const step of steps) {
    if (step.status === 'completed') {
      try {
        provenanceChains.push(traceProvenance(step.id));
      } catch (e) {
        // Skip steps without provenance
      }
    }
  }

  if (format === 'json') {
    return JSON.stringify({
      session: { id: session.id, name: session.name, description: session.description, createdAt: session.created_at },
      sources: sources.map(s => ({
        id: s.id, filename: s.filename, sha256: s.sha256_hash,
        rows: s.row_count, columns: s.column_count, ingested: s.ingested_at
      })),
      steps: steps.map(s => ({
        id: s.id, operator: s.operator_type, description: s.description,
        status: s.status, sequence: s.sequence_number
      })),
      reconciliations: allReconciliations,
      provenanceChains: provenanceChains.map(p => ({
        stepId: p.step?.id, chainLength: p.chainLength, isGrounded: p.isGrounded,
        givenSources: p.givenSources
      }))
    }, null, 2);
  }

  // Markdown format
  const sections = [];

  sections.push(`# Validation Audit Report: ${session.name}`);
  sections.push(`Generated: ${new Date().toISOString()}`);
  if (session.description) sections.push(`\n${session.description}`);
  sections.push('');

  // Data Sources
  sections.push('## Data Sources');
  sections.push('');
  for (const source of sources) {
    sections.push(`### ${source.filename}`);
    sections.push(`- **SHA-256**: \`${source.sha256_hash}\``);
    sections.push(`- **Rows**: ${source.row_count} | **Columns**: ${source.column_count}`);
    sections.push(`- **Ingested**: ${source.ingested_at}`);
    if (source.source_description) sections.push(`- **Description**: ${source.source_description}`);
    sections.push('');
  }

  // Analysis Steps
  sections.push('## Analysis Steps');
  sections.push('');
  for (const step of steps) {
    const op = OPERATORS[step.operator_type];
    sections.push(`### Step ${step.sequence_number}: ${op.glyph} ${op.friendlyName}`);
    sections.push(`${step.description}`);
    sections.push(`- Status: ${step.status}`);

    // Include output summary if available
    const outputs = getStepOutputs(step.id);
    for (const output of outputs) {
      sections.push(`- Output: ${output.name} (${output.row_count || '?'} rows)`);
    }
    sections.push('');
  }

  // Entity Resolution Log
  if (allReconciliations.length > 0) {
    sections.push('## Entity Resolution Decisions');
    sections.push('');
    sections.push('| Record A | Record B | Decision | Reason |');
    sections.push('|----------|----------|----------|--------|');
    for (const r of allReconciliations) {
      sections.push(`| ${r.source_id_a} | ${r.source_id_b} | ${r.decision} | ${r.reason} |`);
    }
    sections.push('');
  }

  // Provenance
  sections.push('## Provenance Verification');
  sections.push('');
  const grounded = provenanceChains.filter(p => p.isGrounded).length;
  sections.push(`${grounded} of ${provenanceChains.length} steps are fully grounded in Given-Log sources.`);
  sections.push('');

  // Methodology
  sections.push('---');
  sections.push('');
  try {
    sections.push(generateMethodology(sessionId));
  } catch (e) {
    sections.push('*Methodology generation failed*');
  }

  return sections.join('\n');
}
