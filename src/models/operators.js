/**
 * The Nine EO Operators — Helix Dependency Ordering
 * NUL → SIG → INS → SEG → CON → SYN → ALT → SUP → REC
 *
 * Three Triads:
 *   Existence:    NUL(∅) SIG(⊡) INS(△)
 *   Structure:    SEG(|) CON(⋈) SYN(∨)
 *   Significance: ALT(∿) SUP(∥) REC(↬)
 */

export const OPERATORS = Object.freeze({
  NUL: {
    code: 'NUL',
    glyph: '∅',
    greek: 'ν',
    friendlyName: 'Validate Nulls',
    verb: 'to nullify',
    role: 'Ground',
    triad: 'Existence',
    mode: 'Differentiating',
    domain: 'Existence',
    helixPosition: 0,
    description: 'Recognize absence as a positive, representable state',
    nullReadings: {
      CLEARED: 'Was present, now removed (∅ explicit)',
      UNKNOWN: 'Applies but unregistered (∅ unmarked)',
      NEVER_SET: 'No history; type exists but never instantiated (∅ absent)'
    }
  },
  SIG: {
    code: 'SIG',
    glyph: '⊡',
    greek: 'σ',
    friendlyName: 'Check Types',
    verb: 'to point',
    role: 'Figure',
    triad: 'Existence',
    mode: 'Relating',
    domain: 'Existence',
    helixPosition: 1,
    description: 'Point at something as distinct; draw first distinction, designate type'
  },
  INS: {
    code: 'INS',
    glyph: '△',
    greek: 'α',
    friendlyName: 'Import',
    verb: 'to create',
    role: 'Pattern',
    triad: 'Existence',
    mode: 'Generating',
    domain: 'Existence',
    helixPosition: 2,
    description: 'Create concrete entity; mint content-addressed immutable anchor'
  },
  SEG: {
    code: 'SEG',
    glyph: '|',
    greek: 'κ',
    friendlyName: 'Filter',
    verb: 'to cut',
    role: 'Ground',
    triad: 'Structure',
    mode: 'Differentiating',
    domain: 'Structure',
    helixPosition: 3,
    description: 'Cut boundaries; partition, filter, group within existing data'
  },
  CON: {
    code: 'CON',
    glyph: '⋈',
    greek: 'ε',
    friendlyName: 'Join',
    verb: 'to join',
    role: 'Figure',
    triad: 'Structure',
    mode: 'Relating',
    domain: 'Structure',
    helixPosition: 4,
    description: 'Join across boundaries; establish relationships between differentiated elements'
  },
  SYN: {
    code: 'SYN',
    glyph: '∨',
    greek: 'η',
    friendlyName: 'Merge',
    verb: 'to merge',
    role: 'Pattern',
    triad: 'Structure',
    mode: 'Generating',
    domain: 'Structure',
    helixPosition: 5,
    description: 'Merge into emergent whole; produce derived structures exhibiting genuine novelty'
  },
  ALT: {
    code: 'ALT',
    glyph: '∿',
    greek: 'δ',
    friendlyName: 'Compare',
    verb: 'to change',
    role: 'Ground',
    triad: 'Significance',
    mode: 'Differentiating',
    domain: 'Significance',
    helixPosition: 6,
    description: 'Change values within stable frame; same structure, different content'
  },
  SUP: {
    code: 'SUP',
    glyph: '∥',
    greek: 'ψ',
    friendlyName: 'Branch',
    verb: 'to hold',
    role: 'Figure',
    triad: 'Significance',
    mode: 'Relating',
    domain: 'Significance',
    helixPosition: 7,
    description: 'Hold multiple simultaneously valid states without forcing resolution'
  },
  REC: {
    code: 'REC',
    glyph: '↬',
    greek: 'Ω',
    friendlyName: 'Reconcile',
    verb: 'to reframe',
    role: 'Pattern',
    triad: 'Significance',
    mode: 'Generating',
    domain: 'Significance',
    helixPosition: 8,
    description: 'Restructure the interpretive frame itself; recursion threshold'
  }
});

/** Helix ordering array — strict dependency sequence */
export const HELIX_ORDER = ['NUL', 'SIG', 'INS', 'SEG', 'CON', 'SYN', 'ALT', 'SUP', 'REC'];

/** Operator glyphs for display */
export const OPERATOR_GLYPHS = Object.freeze(
  Object.fromEntries(Object.values(OPERATORS).map(op => [op.code, op.glyph]))
);

/** Triad groupings */
export const TRIADS = Object.freeze({
  Existence: ['NUL', 'SIG', 'INS'],
  Structure: ['SEG', 'CON', 'SYN'],
  Significance: ['ALT', 'SUP', 'REC']
});

/** Null state enum — NUL operator's three readings */
export const NullState = Object.freeze({
  CLEARED: 'CLEARED',       // Was present, now removed (∅ explicit)
  UNKNOWN: 'UNKNOWN',       // Applies but unregistered (∅ unmarked)
  NEVER_SET: 'NEVER_SET'    // No history (∅ absent)
});

/** Session enforcement modes */
export const EnforcementMode = Object.freeze({
  EXPLORE: 'explore',   // Helix violations warned, not blocked
  CONFIRM: 'confirm'    // Helix violations block export
});

/** Step execution status */
export const StepStatus = Object.freeze({
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  STALE: 'stale'
});

/** Conformance violation types — named per EO */
export const Violations = Object.freeze({
  // Given-conformant (Rules 1-3)
  CategoricalConfusion: 'CategoricalConfusion',   // Rule 1: Given/Meant boundary violated
  Confabulation: 'Confabulation',                  // Rule 2: Meant fabricates Given
  Gaslighting: 'Gaslighting',                      // Rule 3: Given-Log modified or deleted

  // Structure-conformant (Rules 4-6)
  ContextCollapse: 'ContextCollapse',              // Rule 4: God's-eye view assumed
  ForeclosureViolation: 'ForeclosureViolation',    // Rule 5: Refinement expands availability
  PerspectivalFracture: 'PerspectivalFracture',    // Rule 6: Overlapping positions disagree

  // Meant-conformant (Rules 7-9)
  UngroundedAssertion: 'UngroundedAssertion',      // Rule 7: Interpretation without provenance
  SemanticDrift: 'SemanticDrift',                  // Rule 8: Meaning unstable under transformation
  Dogmatism: 'Dogmatism'                           // Rule 9: Interpretation immune to supersession
});

/** SUP → REC resolution reasons (controlled vocabulary) */
export const ResolutionReasons = Object.freeze({
  METHODOLOGICAL_PREFERENCE: 'methodological_preference',
  DATA_QUALITY: 'data_quality',
  SCOPE_ALIGNMENT: 'scope_alignment',
  STAKEHOLDER_REQUIREMENT: 'stakeholder_requirement',
  EMPIRICAL_SUPERIORITY: 'empirical_superiority'
});

/** Lens types for the Horizon-Lattice */
export const LensType = Object.freeze({
  TEMPORAL: 'temporal',
  GEOGRAPHIC: 'geographic',
  CATEGORICAL: 'categorical',
  METHODOLOGICAL: 'methodological',
  OBSERVER: 'observer'
});

/**
 * Check if operator A can precede operator B in the helix ordering.
 * Returns true if A's position <= B's position (valid ordering).
 */
export function isHelixValid(operatorA, operatorB) {
  const posA = OPERATORS[operatorA]?.helixPosition;
  const posB = OPERATORS[operatorB]?.helixPosition;
  if (posA === undefined || posB === undefined) return false;
  return posA <= posB;
}

/**
 * Get the triad for an operator code.
 */
export function getTriad(operatorCode) {
  return OPERATORS[operatorCode]?.triad ?? null;
}

/**
 * Format an operator for display: "SEG(|)"
 */
export function formatOperator(operatorCode) {
  const op = OPERATORS[operatorCode];
  if (!op) return operatorCode;
  return `${op.code}(${op.glyph})`;
}

/**
 * Format an operator with its friendly name: "Filter (SEG)"
 */
export function formatOperatorFriendly(operatorCode) {
  const op = OPERATORS[operatorCode];
  if (!op) return operatorCode;
  return `${op.friendlyName} (${op.code})`;
}

/** Triad display labels — maps internal triad names to user-friendly labels */
export const TRIAD_LABELS = Object.freeze({
  Existence: 'Data Quality',
  Structure: 'Data Structure',
  Significance: 'Interpretation'
});
