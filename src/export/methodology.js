/**
 * Plain-Language Methodology Document
 * Auto-generated from public-view step descriptions.
 *
 * Sections: data sources, analytical scope, step-by-step operations,
 * entity resolution decisions.
 */

import { getSession, getSessionSteps } from '../models/meant_graph.js';
import { getSource } from '../models/given_log.js';
import { getHorizon, getHorizonLenses } from '../models/horizon_lattice.js';
import { getStepReconciliations } from '../models/reconciliation.js';
import { OPERATORS } from '../models/operators.js';
import { renderPublicView } from '../provenance/views.js';

/**
 * Generate a plain-language methodology document.
 */
export function generateMethodology(sessionId) {
  const session = getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const steps = getSessionSteps(sessionId);
  const sections = [];

  // Title
  sections.push(`# Methodology: ${session.name}`);
  sections.push(`Generated: ${new Date().toISOString()}`);
  if (session.description) sections.push(`\n${session.description}`);
  sections.push('');

  // Data Sources
  sections.push('## Data Sources');
  const sourceIds = new Set();
  for (const step of steps) {
    const inputIds = step.input_ids_json ? JSON.parse(step.input_ids_json) : [];
    for (const id of inputIds) {
      const source = getSource(id);
      if (source && !sourceIds.has(id)) {
        sourceIds.add(id);
        sections.push(`- **${source.filename}**`);
        sections.push(`  - Rows: ${source.row_count}, Columns: ${source.column_count}`);
        sections.push(`  - SHA-256: \`${source.sha256_hash}\``);
        sections.push(`  - Ingested: ${source.ingested_at}`);
        if (source.method) sections.push(`  - Method: ${source.method}`);
        if (source.source_url) sections.push(`  - Source: ${source.source_url}`);
      }
    }
  }
  sections.push('');

  // Analytical Scope
  if (session.horizon_id) {
    sections.push('## Analytical Scope (Horizon)');
    const horizon = getHorizon(session.horizon_id);
    if (horizon) {
      const lenses = getHorizonLenses(session.horizon_id);
      for (const lens of lenses) {
        const params = JSON.parse(lens.parameters_json);
        sections.push(`- **${lens.name}** (${lens.lens_type}): ${JSON.stringify(params)}`);
      }
    }
    sections.push('');
  }

  // Step-by-step Operations
  sections.push('## Analysis Steps');
  for (const step of steps) {
    if (step.status === 'pending') continue;

    const publicView = renderPublicView(step);
    sections.push(`### ${publicView.title}`);
    sections.push(publicView.description);
    if (publicView.outputSummary) sections.push(publicView.outputSummary);
    sections.push('');
  }

  // Entity Resolution Decisions
  const allReconciliations = [];
  for (const step of steps) {
    const recs = getStepReconciliations(step.id);
    if (recs.length > 0) {
      allReconciliations.push({ step, reconciliations: recs });
    }
  }

  if (allReconciliations.length > 0) {
    sections.push('## Entity Resolution Decisions');
    for (const { step, reconciliations } of allReconciliations) {
      sections.push(`### Step ${step.sequence_number}: ${OPERATORS[step.operator_type].glyph} ${step.description}`);
      sections.push('| Record A | Record B | Decision | Reason |');
      sections.push('|----------|----------|----------|--------|');
      for (const r of reconciliations) {
        sections.push(`| ${r.source_id_a} | ${r.source_id_b} | ${r.decision} | ${r.reason} |`);
      }
      sections.push('');
    }
  }

  // Mode
  sections.push(`---`);
  sections.push(`Analysis mode: ${session.mode}`);
  sections.push(`Helix ordering: NUL(∅) → SIG(⊡) → INS(△) → SEG(|) → CON(⋈) → SYN(∨) → ALT(∿) → SUP(∥) → REC(↬)`);

  return sections.join('\n');
}
