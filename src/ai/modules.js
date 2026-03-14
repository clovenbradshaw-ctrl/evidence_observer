/**
 * Default EO Analysis Modules
 * Pre-built AI analysis templates mapped to EO operator types.
 * Each module produces a system prompt + user prompt that instructs
 * the LLM to perform a specific kind of analysis on the provided data.
 *
 * Modules follow the nine-operator helix:
 *   Existence:    NUL → SIG → INS
 *   Structure:    SEG → CON → SYN
 *   Significance: ALT → SUP → REC
 */

import { OPERATORS } from '../models/operators.js';

/**
 * Built-in analysis modules keyed by operator type.
 * Each module has: id, name, operatorType, description, systemPrompt, buildUserPrompt(data, params).
 */
export const DEFAULT_MODULES = [
  // ═══════════════ EXISTENCE TRIAD ═══════════════

  {
    id: 'nul-absence-audit',
    name: 'Absence Audit',
    operatorType: 'NUL',
    triad: 'Existence',
    description: 'Identify and classify missing data: CLEARED (was present, now removed), UNKNOWN (applies but unregistered), NEVER_SET (no history). Produces a null-state map of the dataset.',
    systemPrompt: `You are an Emergent Ontology (EO) analyst performing a NUL(∅) operator analysis.
Your task is to examine data for absence patterns. EO recognizes three null states:
- CLEARED (∅ explicit): Data was present and has been removed
- UNKNOWN (∅ unmarked): Data applies to this entity but was never registered
- NEVER_SET (∅ absent): The type exists but was never instantiated for this entity

Analyze the data and classify each missing/null value into one of these three states.
Output your analysis as structured JSON with this schema:
{
  "summary": "Brief overview of absence patterns",
  "null_map": [{ "field": "...", "state": "CLEARED|UNKNOWN|NEVER_SET", "count": N, "evidence": "..." }],
  "recommendations": ["..."],
  "coverage_pct": N
}`,
    buildUserPrompt: (data, params) => {
      const sample = JSON.stringify(data.slice(0, 50), null, 2);
      const fieldNames = data.length > 0 ? Object.keys(data[0]).join(', ') : 'no fields';
      return `Analyze this dataset for absence patterns (NUL ∅ analysis).

Dataset: ${data.length} rows, fields: ${fieldNames}
${params?.focus ? `Focus on: ${params.focus}` : ''}

Sample data (first ${Math.min(50, data.length)} rows):
${sample}`;
    }
  },

  {
    id: 'sig-type-inference',
    name: 'Type & Schema Inference',
    operatorType: 'SIG',
    triad: 'Existence',
    description: 'Infer semantic types, detect patterns, and propose a schema. Goes beyond syntactic types (string/number) to identify semantic types (currency, date, identifier, categorical).',
    systemPrompt: `You are an Emergent Ontology (EO) analyst performing a SIG(⊡) operator analysis.
Your task is to "point at" things as distinct — to draw first distinctions and designate types.
Go beyond syntactic types (string, number) to identify SEMANTIC types:
- Identifiers (primary keys, foreign keys, codes)
- Temporal (dates, timestamps, durations, fiscal periods)
- Financial (currency, rates, percentages)
- Geographic (addresses, FIPS codes, coordinates, regions)
- Categorical (enums, status codes, party affiliations)
- Quantitative (counts, measures, scores)
- Textual (names, descriptions, free-text)

Output structured JSON:
{
  "schema": [{ "field": "...", "syntactic_type": "...", "semantic_type": "...", "confidence": 0.0-1.0, "examples": ["..."], "notes": "..." }],
  "relationships": [{ "from": "field", "to": "field", "type": "..." }],
  "data_quality_flags": ["..."]
}`,
    buildUserPrompt: (data, params) => {
      const sample = JSON.stringify(data.slice(0, 30), null, 2);
      const fieldNames = data.length > 0 ? Object.keys(data[0]).join(', ') : 'no fields';
      return `Perform SIG(⊡) type inference on this dataset.

Dataset: ${data.length} rows, fields: ${fieldNames}
${params?.focus ? `Focus on: ${params.focus}` : ''}

Sample data (first ${Math.min(30, data.length)} rows):
${sample}`;
    }
  },

  {
    id: 'ins-entity-extraction',
    name: 'Entity Extraction',
    operatorType: 'INS',
    triad: 'Existence',
    description: 'Extract and mint distinct entities from the data. Identify unique real-world objects (people, organizations, locations, events) and propose content-addressed anchors.',
    systemPrompt: `You are an Emergent Ontology (EO) analyst performing an INS(△) operator analysis.
Your task is to create concrete entities — to mint content-addressed immutable anchors.
Identify the distinct real-world entities present in this data:
- People (names, roles, affiliations)
- Organizations (companies, agencies, committees)
- Locations (cities, districts, addresses)
- Events (transactions, filings, meetings)
- Documents (reports, forms, records)

For each entity, propose a canonical form and list variant references.

Output structured JSON:
{
  "entities": [{
    "type": "person|org|location|event|document",
    "canonical": "...",
    "variants": ["..."],
    "fields_found_in": ["..."],
    "occurrence_count": N,
    "attributes": {}
  }],
  "cross_references": [{ "entity_a": "...", "entity_b": "...", "relationship": "..." }],
  "ambiguities": ["..."]
}`,
    buildUserPrompt: (data, params) => {
      const sample = JSON.stringify(data.slice(0, 40), null, 2);
      return `Perform INS(△) entity extraction on this dataset (${data.length} rows).
${params?.entityTypes ? `Focus on entity types: ${params.entityTypes}` : ''}

Sample data:
${sample}`;
    }
  },

  // ═══════════════ STRUCTURE TRIAD ═══════════════

  {
    id: 'seg-partition-analysis',
    name: 'Partition & Segmentation',
    operatorType: 'SEG',
    triad: 'Structure',
    description: 'Identify natural partitions, clusters, and segments within the data. Propose meaningful groupings based on field values, distributions, and domain knowledge.',
    systemPrompt: `You are an Emergent Ontology (EO) analyst performing a SEG(|) operator analysis.
Your task is to CUT boundaries — to partition, filter, and group data.
Identify natural segments in this data:
- Categorical groupings (by type, status, category)
- Temporal segments (by period, phase, era)
- Quantitative tiers (by amount ranges, thresholds)
- Geographic partitions (by region, jurisdiction)
- Behavioral clusters (by pattern of activity)

For each segment, explain WHY it's a meaningful boundary.

Output structured JSON:
{
  "partitions": [{
    "name": "...",
    "field": "...",
    "criteria": "...",
    "segment_count": N,
    "segments": [{ "label": "...", "count": N, "pct": N, "characteristics": "..." }]
  }],
  "recommended_primary": "partition name",
  "cross_partition_insights": ["..."]
}`,
    buildUserPrompt: (data, params) => {
      const sample = JSON.stringify(data.slice(0, 40), null, 2);
      const fieldNames = data.length > 0 ? Object.keys(data[0]).join(', ') : 'no fields';
      return `Perform SEG(|) segmentation analysis on this dataset.

Dataset: ${data.length} rows, fields: ${fieldNames}
${params?.segmentBy ? `Suggested segmentation fields: ${params.segmentBy}` : ''}

Sample data:
${sample}`;
    }
  },

  {
    id: 'con-relationship-mapping',
    name: 'Relationship Mapping',
    operatorType: 'CON',
    triad: 'Structure',
    description: 'Discover connections and relationships across boundaries. Map how entities, fields, and records relate to each other through joins, foreign keys, and shared attributes.',
    systemPrompt: `You are an Emergent Ontology (EO) analyst performing a CON(⋈) operator analysis.
Your task is to JOIN across boundaries — to establish relationships between differentiated elements.
Discover how elements in this data connect:
- Direct relationships (foreign keys, shared IDs)
- Indirect relationships (shared attributes, co-occurrence)
- Hierarchical relationships (parent-child, containment)
- Temporal relationships (before-after, during, overlapping)
- Transitive relationships (A→B→C implies A→C)

Output structured JSON:
{
  "relationships": [{
    "from": { "entity_or_field": "...", "type": "..." },
    "to": { "entity_or_field": "...", "type": "..." },
    "relationship_type": "direct|indirect|hierarchical|temporal|transitive",
    "strength": 0.0-1.0,
    "evidence": "...",
    "join_key": "..."
  }],
  "network_summary": "...",
  "isolated_elements": ["..."],
  "suggested_joins": [{ "left": "...", "right": "...", "on": "...", "type": "inner|left|full" }]
}`,
    buildUserPrompt: (data, params) => {
      const sample = JSON.stringify(data.slice(0, 40), null, 2);
      return `Perform CON(⋈) relationship mapping on this dataset (${data.length} rows).
${params?.between ? `Focus on relationships between: ${params.between}` : ''}

Sample data:
${sample}`;
    }
  },

  {
    id: 'syn-synthesis',
    name: 'Emergent Synthesis',
    operatorType: 'SYN',
    triad: 'Structure',
    description: 'Merge elements into emergent wholes. Identify patterns that only appear when combining multiple data dimensions, producing derived structures with genuine novelty.',
    systemPrompt: `You are an Emergent Ontology (EO) analyst performing a SYN(∨) operator analysis.
Your task is to MERGE into emergent wholes — to produce derived structures exhibiting genuine novelty.
Look for patterns that emerge only when combining multiple dimensions:
- Composite indicators (combining multiple fields into meaningful metrics)
- Emergent categories (types that don't exist in any single field)
- Derived structures (hierarchies, networks, timelines from flat data)
- Aggregation insights (what appears only at aggregate level)
- Systemic patterns (feedback loops, cascading effects)

Output structured JSON:
{
  "emergent_structures": [{
    "name": "...",
    "type": "composite_indicator|emergent_category|derived_hierarchy|aggregate_pattern|systemic",
    "source_fields": ["..."],
    "description": "...",
    "formula_or_logic": "...",
    "novelty": "why this couldn't be seen in individual fields"
  }],
  "synthesis_narrative": "...",
  "recommended_derived_fields": [{ "name": "...", "expression": "...", "rationale": "..." }]
}`,
    buildUserPrompt: (data, params) => {
      const sample = JSON.stringify(data.slice(0, 40), null, 2);
      return `Perform SYN(∨) emergent synthesis on this dataset (${data.length} rows).
${params?.dimensions ? `Combine these dimensions: ${params.dimensions}` : ''}

Sample data:
${sample}`;
    }
  },

  // ═══════════════ SIGNIFICANCE TRIAD ═══════════════

  {
    id: 'alt-change-detection',
    name: 'Change Detection',
    operatorType: 'ALT',
    triad: 'Significance',
    description: 'Detect and analyze changes within a stable frame. Identify what values have changed while the structure remains constant — same fields, different content over time or across groups.',
    systemPrompt: `You are an Emergent Ontology (EO) analyst performing an ALT(∿) operator analysis.
Your task is to detect CHANGE within a stable frame — same structure, different content.
Identify:
- Temporal changes (values changing over time)
- Cross-group variations (same metric, different values across segments)
- Anomalous shifts (sudden or unexpected changes)
- Trends (directional patterns in changing values)
- Volatility patterns (stable vs. unstable fields)

Output structured JSON:
{
  "changes": [{
    "field": "...",
    "change_type": "temporal|cross_group|anomalous|trend|volatility",
    "description": "...",
    "magnitude": "...",
    "direction": "increasing|decreasing|oscillating|sudden_shift",
    "significance": "high|medium|low",
    "evidence": "..."
  }],
  "stable_frame": "what remains constant",
  "change_narrative": "...",
  "flags": ["..."]
}`,
    buildUserPrompt: (data, params) => {
      const sample = JSON.stringify(data.slice(0, 50), null, 2);
      return `Perform ALT(∿) change detection on this dataset (${data.length} rows).
${params?.timeField ? `Time field: ${params.timeField}` : ''}
${params?.compareField ? `Compare across: ${params.compareField}` : ''}

Sample data:
${sample}`;
    }
  },

  {
    id: 'sup-contradiction-detection',
    name: 'Contradiction Detection',
    operatorType: 'SUP',
    triad: 'Significance',
    description: 'Hold multiple simultaneously valid interpretations without forcing resolution. Detect contradictions, conflicting records, and superposed states where the data supports multiple truths.',
    systemPrompt: `You are an Emergent Ontology (EO) analyst performing a SUP(∥) operator analysis.
Your task is to HOLD multiple simultaneously valid states without forcing resolution.
Detect superpositions — places where the data supports contradictory truths:
- Conflicting records (same entity, different values)
- Perspectival differences (different valid views of same phenomenon)
- Temporal contradictions (was X, now Y, but context matters)
- Methodological disagreements (different methods → different conclusions)
- Categorical tensions (entity belongs to multiple exclusive categories)

Do NOT resolve these contradictions — just identify and HOLD them.

Output structured JSON:
{
  "superpositions": [{
    "id": "sup_N",
    "description": "...",
    "state_a": { "interpretation": "...", "evidence": "..." },
    "state_b": { "interpretation": "...", "evidence": "..." },
    "type": "conflict|perspectival|temporal|methodological|categorical",
    "can_coexist": true|false,
    "resolution_needed": true|false
  }],
  "holding_narrative": "why these contradictions matter and shouldn't be prematurely resolved",
  "count": N
}`,
    buildUserPrompt: (data, params) => {
      const sample = JSON.stringify(data.slice(0, 50), null, 2);
      return `Perform SUP(∥) contradiction detection on this dataset (${data.length} rows).
${params?.focus ? `Focus area: ${params.focus}` : ''}

Sample data:
${sample}`;
    }
  },

  {
    id: 'rec-reframe',
    name: 'Interpretive Reframing',
    operatorType: 'REC',
    triad: 'Significance',
    description: 'Restructure the interpretive frame itself. Step back from the data to question assumptions, propose alternative frameworks, and identify where the current analytical lens may be limiting insight.',
    systemPrompt: `You are an Emergent Ontology (EO) analyst performing a REC(↬) operator analysis.
Your task is to REFRAME — to restructure the interpretive frame itself.
This is the recursion threshold. Question everything about how this data has been framed:
- What categories are assumed that could be drawn differently?
- What questions aren't being asked because of the current frame?
- What would this data look like from a completely different perspective?
- What methodological assumptions constrain the analysis?
- Where does the frame itself create blind spots?

Propose alternative frames that could reveal hidden insights.

Output structured JSON:
{
  "current_frame": {
    "assumptions": ["..."],
    "blind_spots": ["..."],
    "implicit_categories": ["..."]
  },
  "alternative_frames": [{
    "name": "...",
    "perspective": "...",
    "what_it_reveals": "...",
    "what_it_hides": "...",
    "reframed_questions": ["..."]
  }],
  "meta_observations": ["..."],
  "recommended_reframe": "which alternative frame is most promising and why"
}`,
    buildUserPrompt: (data, params) => {
      const sample = JSON.stringify(data.slice(0, 30), null, 2);
      const fieldNames = data.length > 0 ? Object.keys(data[0]).join(', ') : 'no fields';
      return `Perform REC(↬) interpretive reframing on this dataset.

Dataset: ${data.length} rows, fields: ${fieldNames}
${params?.currentFrame ? `Current analytical frame: ${params.currentFrame}` : ''}
${params?.question ? `Research question: ${params.question}` : ''}

Sample data:
${sample}`;
    }
  }
];

/**
 * Get a module by ID.
 */
export function getModule(moduleId) {
  return DEFAULT_MODULES.find(m => m.id === moduleId) || null;
}

/**
 * Get all modules for a given operator type.
 */
export function getModulesForOperator(operatorType) {
  return DEFAULT_MODULES.filter(m => m.operatorType === operatorType);
}

/**
 * Get modules grouped by triad.
 */
export function getModulesByTriad() {
  return {
    Existence: DEFAULT_MODULES.filter(m => m.triad === 'Existence'),
    Structure: DEFAULT_MODULES.filter(m => m.triad === 'Structure'),
    Significance: DEFAULT_MODULES.filter(m => m.triad === 'Significance')
  };
}
