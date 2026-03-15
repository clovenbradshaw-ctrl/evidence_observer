/**
 * Pre-Built Operator Stacks — Common Data Cleaning & Analysis Patterns
 *
 * Operator stacks are sequences of EOQL commands that accomplish common
 * data transformation tasks. Users can apply a stack with one click,
 * and the system will execute each step in order, feeding results forward.
 *
 * Categories:
 *   - Data Quality: null audits, type validation, deduplication
 *   - Cleaning: standardization, trimming, normalization
 *   - Filtering: subsetting, exclusion, range selection
 *   - Aggregation: summaries, grouping, pivots
 *   - Joining: linking, matching, merging datasets
 *   - Comparison: version diffs, before/after, branch comparison
 *   - Classification: reclassification, binning, categorization
 *   - Profiling: full data profiling, distribution analysis
 */

/**
 * @typedef {Object} OperatorStack
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {string} description - What this stack does
 * @property {string} category - Category for grouping
 * @property {string} icon - Glyph/icon for display
 * @property {string[]} operators - Operator codes used (for helix display)
 * @property {Function} generate - Generates EOQL commands given source/field context
 */

export const STACK_CATEGORIES = {
  quality: { label: 'Data Quality', icon: '∅', color: 'existence' },
  cleaning: { label: 'Cleaning', icon: '⊡', color: 'existence' },
  filtering: { label: 'Filtering', icon: '|', color: 'structure' },
  aggregation: { label: 'Aggregation', icon: '∨', color: 'structure' },
  joining: { label: 'Joining', icon: '⋈', color: 'structure' },
  comparison: { label: 'Comparison', icon: '∥', color: 'significance' },
  classification: { label: 'Classification', icon: '↬', color: 'significance' },
  profiling: { label: 'Profiling', icon: '◉', color: 'existence' },
};

/**
 * All pre-built operator stacks.
 */
export const OPERATOR_STACKS = [

  // ════════════════════════════════════════════
  //  DATA QUALITY
  // ════════════════════════════════════════════

  {
    id: 'full-null-audit',
    name: 'Full Null Audit',
    description: 'Audit all fields for missing values — identifies CLEARED, UNKNOWN, and NEVER_SET null states across every column.',
    category: 'quality',
    icon: '∅',
    operators: ['NUL'],
    requiredInputs: ['source'],
    generate: ({ source }) => [
      `NUL(${source})`
    ]
  },

  {
    id: 'schema-validation',
    name: 'Schema Validation',
    description: 'Infer column types, check cardinality, and detect type mismatches. Identifies fields that may need type casting.',
    category: 'quality',
    icon: '⊡',
    operators: ['SIG'],
    requiredInputs: ['source'],
    generate: ({ source }) => [
      `SIG(${source})`
    ]
  },

  {
    id: 'quality-report',
    name: 'Quality Report',
    description: 'Combined null audit + schema validation — a complete data quality assessment showing types, nulls, and anomalies.',
    category: 'quality',
    icon: '∅',
    operators: ['NUL', 'SIG'],
    requiredInputs: ['source'],
    generate: ({ source }) => [
      `NUL(${source})`,
      `SIG(${source})`
    ]
  },

  {
    id: 'find-duplicates',
    name: 'Find Duplicates',
    description: 'Group by a key field and filter to rows that appear more than once — surfaces duplicate records for deduplication.',
    category: 'quality',
    icon: '∨',
    operators: ['SYN', 'SEG'],
    requiredInputs: ['source', 'field'],
    generate: ({ source, field }) => [
      `SYN(${source}, ${field}, GROUP BY ${field})`,
      `SEG(_last, count>1)`
    ]
  },

  {
    id: 'completeness-check',
    name: 'Completeness Check',
    description: 'Identify records missing critical fields — filters to rows where any required field is null or empty.',
    category: 'quality',
    icon: '∅',
    operators: ['NUL', 'SEG'],
    requiredInputs: ['source', 'field'],
    generate: ({ source, field }) => [
      `NUL(${source})`,
      `SEG(_last, ${field} LIKE "")`
    ]
  },

  // ════════════════════════════════════════════
  //  CLEANING
  // ════════════════════════════════════════════

  {
    id: 'trim-whitespace',
    name: 'Trim Whitespace',
    description: 'Remove leading and trailing whitespace from a text field across all records.',
    category: 'cleaning',
    icon: '∿',
    operators: ['ALT'],
    requiredInputs: ['source', 'field'],
    generate: ({ source, field }) => [
      `ALT(${source}, ${field}, TRIM)`
    ]
  },

  {
    id: 'standardize-case',
    name: 'Standardize Case',
    description: 'Convert a text field to uppercase for consistent matching and comparison.',
    category: 'cleaning',
    icon: '∿',
    operators: ['ALT'],
    requiredInputs: ['source', 'field'],
    generate: ({ source, field }) => [
      `ALT(${source}, ${field}, UPPER)`
    ]
  },

  {
    id: 'clean-and-standardize',
    name: 'Clean & Standardize',
    description: 'Trim whitespace then standardize to uppercase — common prep before joining or deduplication.',
    category: 'cleaning',
    icon: '∿',
    operators: ['ALT', 'ALT'],
    requiredInputs: ['source', 'field'],
    generate: ({ source, field }) => [
      `ALT(${source}, ${field}, TRIM)`,
      `ALT(_last, ${field}, UPPER)`
    ]
  },

  {
    id: 'find-replace',
    name: 'Find & Replace',
    description: 'Replace all occurrences of a substring in a field. Useful for cleaning inconsistent labels, removing special characters.',
    category: 'cleaning',
    icon: '∿',
    operators: ['ALT'],
    requiredInputs: ['source', 'field', 'findText', 'replaceText'],
    generate: ({ source, field, findText, replaceText }) => [
      `ALT(${source}, ${field}, REPLACE("${findText}", "${replaceText}"))`
    ]
  },

  {
    id: 'normalize-numeric',
    name: 'Normalize Numeric',
    description: 'Round a numeric field to remove decimal noise — useful after calculations or imports with floating point artifacts.',
    category: 'cleaning',
    icon: '∿',
    operators: ['ALT'],
    requiredInputs: ['source', 'field'],
    generate: ({ source, field }) => [
      `ALT(${source}, ${field}, ROUND)`
    ]
  },

  {
    id: 'strip-currency-symbols',
    name: 'Strip Currency Symbols',
    description: 'Remove $ and comma formatting from monetary fields to enable numeric operations.',
    category: 'cleaning',
    icon: '∿',
    operators: ['ALT', 'ALT'],
    requiredInputs: ['source', 'field'],
    generate: ({ source, field }) => [
      `ALT(${source}, ${field}, REPLACE("$", ""))`,
      `ALT(_last, ${field}, REPLACE(",", ""))`
    ]
  },

  {
    id: 'conditional-fill',
    name: 'Conditional Fill',
    description: 'Fill a field with a default value when another field meets a condition — useful for cleaning missing data with logical defaults.',
    category: 'cleaning',
    icon: '∿',
    operators: ['ALT'],
    requiredInputs: ['source', 'field', 'conditionField', 'conditionValue', 'fillValue'],
    generate: ({ source, field, conditionField, conditionValue, fillValue }) => [
      `ALT(${source}, ${field}, IF(${conditionField}="${conditionValue}", "${fillValue}", ${field}))`
    ]
  },

  // ════════════════════════════════════════════
  //  FILTERING
  // ════════════════════════════════════════════

  {
    id: 'filter-exact',
    name: 'Exact Match Filter',
    description: 'Keep only records where a field exactly matches a value.',
    category: 'filtering',
    icon: '|',
    operators: ['SEG'],
    requiredInputs: ['source', 'field', 'value'],
    generate: ({ source, field, value }) => [
      `SEG(${source}, ${field}="${value}")`
    ]
  },

  {
    id: 'filter-exclude',
    name: 'Exclude Records',
    description: 'Remove records where a field matches a value — inverse filter.',
    category: 'filtering',
    icon: '|',
    operators: ['SEG'],
    requiredInputs: ['source', 'field', 'value'],
    generate: ({ source, field, value }) => [
      `SEG(${source}, ${field}!="${value}")`
    ]
  },

  {
    id: 'filter-range',
    name: 'Numeric Range Filter',
    description: 'Keep records where a numeric field falls within a min/max range.',
    category: 'filtering',
    icon: '|',
    operators: ['SEG', 'SEG'],
    requiredInputs: ['source', 'field', 'min', 'max'],
    generate: ({ source, field, min, max }) => [
      `SEG(${source}, ${field}>=${min})`,
      `SEG(_last, ${field}<=${max})`
    ]
  },

  {
    id: 'filter-contains',
    name: 'Text Search Filter',
    description: 'Keep records where a text field contains a search term (case-insensitive).',
    category: 'filtering',
    icon: '|',
    operators: ['SEG'],
    requiredInputs: ['source', 'field', 'value'],
    generate: ({ source, field, value }) => [
      `SEG(${source}, ${field} CONTAINS "${value}")`
    ]
  },

  {
    id: 'filter-non-null',
    name: 'Remove Nulls',
    description: 'Keep only records where a field has a non-empty value — removes nulls and blanks.',
    category: 'filtering',
    icon: '|',
    operators: ['SEG'],
    requiredInputs: ['source', 'field'],
    generate: ({ source, field }) => [
      `SEG(${source}, ${field}!="")`
    ]
  },

  {
    id: 'top-n-filter',
    name: 'Top N by Value',
    description: 'Filter then sort to find records with the highest values in a numeric field.',
    category: 'filtering',
    icon: '|',
    operators: ['SEG'],
    requiredInputs: ['source', 'field', 'threshold'],
    generate: ({ source, field, threshold }) => [
      `SEG(${source}, ${field}>${threshold})`
    ]
  },

  {
    id: 'multi-criteria-filter',
    name: 'Multi-Criteria Filter',
    description: 'Apply two sequential filters — first narrow by one field, then further refine by another.',
    category: 'filtering',
    icon: '|',
    operators: ['SEG', 'SEG'],
    requiredInputs: ['source', 'field', 'value', 'field2', 'value2'],
    generate: ({ source, field, value, field2, value2 }) => [
      `SEG(${source}, ${field}="${value}")`,
      `SEG(_last, ${field2}="${value2}")`
    ]
  },

  // ════════════════════════════════════════════
  //  AGGREGATION
  // ════════════════════════════════════════════

  {
    id: 'simple-summary',
    name: 'Quick Summary',
    description: 'Get count, sum, average, min, and max for a numeric field across all records.',
    category: 'aggregation',
    icon: '∨',
    operators: ['SYN'],
    requiredInputs: ['source', 'field'],
    generate: ({ source, field }) => [
      `SYN(${source}, ${field})`
    ]
  },

  {
    id: 'group-summary',
    name: 'Group Summary',
    description: 'Aggregate a numeric field grouped by a category field — creates a summary table with counts, sums, and averages per group.',
    category: 'aggregation',
    icon: '∨',
    operators: ['SYN'],
    requiredInputs: ['source', 'field', 'groupField'],
    generate: ({ source, field, groupField }) => [
      `SYN(${source}, ${field}, GROUP BY ${groupField})`
    ]
  },

  {
    id: 'filtered-summary',
    name: 'Filtered Summary',
    description: 'Filter records first, then aggregate — common pattern for answering questions like "what is the total X for records where Y=Z?"',
    category: 'aggregation',
    icon: '∨',
    operators: ['SEG', 'SYN'],
    requiredInputs: ['source', 'filterField', 'filterValue', 'sumField'],
    generate: ({ source, filterField, filterValue, sumField }) => [
      `SEG(${source}, ${filterField}="${filterValue}")`,
      `SYN(_last, ${sumField})`
    ]
  },

  {
    id: 'distribution-analysis',
    name: 'Distribution Analysis',
    description: 'Group by a field to see the distribution of values — useful for understanding categorical breakdowns and frequency counts.',
    category: 'aggregation',
    icon: '∨',
    operators: ['SYN'],
    requiredInputs: ['source', 'field'],
    generate: ({ source, field }) => [
      `SYN(${source}, ${field}, GROUP BY ${field})`
    ]
  },

  {
    id: 'compare-groups',
    name: 'Compare Groups',
    description: 'Split records into two groups and compare aggregates — useful for A/B analysis or before/after comparisons.',
    category: 'aggregation',
    icon: '∨',
    operators: ['SEG', 'SYN', 'SEG', 'SYN'],
    requiredInputs: ['source', 'splitField', 'splitValue', 'measureField'],
    generate: ({ source, splitField, splitValue, measureField }) => [
      `SEG(${source}, ${splitField}="${splitValue}")`,
      `SYN(_last, ${measureField})`,
      `SEG(${source}, ${splitField}!="${splitValue}")`,
      `SYN(_last, ${measureField})`
    ]
  },

  {
    id: 'cross-tab',
    name: 'Cross-Tabulation',
    description: 'First filter to a category, then group by another field — produces a cross-tabulated view for two dimensions.',
    category: 'aggregation',
    icon: '∨',
    operators: ['SEG', 'SYN'],
    requiredInputs: ['source', 'filterField', 'filterValue', 'groupField', 'measureField'],
    generate: ({ source, filterField, filterValue, groupField, measureField }) => [
      `SEG(${source}, ${filterField}="${filterValue}")`,
      `SYN(_last, ${measureField}, GROUP BY ${groupField})`
    ]
  },

  // ════════════════════════════════════════════
  //  JOINING
  // ════════════════════════════════════════════

  {
    id: 'simple-join',
    name: 'Simple Join',
    description: 'Join two sources on a shared key field — combines columns from both datasets.',
    category: 'joining',
    icon: '⋈',
    operators: ['CON'],
    requiredInputs: ['source', 'source2', 'joinKey'],
    generate: ({ source, source2, joinKey }) => [
      `CON(${source}, ${source2}, ${joinKey})`
    ]
  },

  {
    id: 'join-and-filter',
    name: 'Join & Filter',
    description: 'Join two sources then filter the result — common for enrichment followed by selection.',
    category: 'joining',
    icon: '⋈',
    operators: ['CON', 'SEG'],
    requiredInputs: ['source', 'source2', 'joinKey', 'filterField', 'filterValue'],
    generate: ({ source, source2, joinKey, filterField, filterValue }) => [
      `CON(${source}, ${source2}, ${joinKey})`,
      `SEG(_last, ${filterField}="${filterValue}")`
    ]
  },

  {
    id: 'join-and-aggregate',
    name: 'Join & Aggregate',
    description: 'Join two sources then aggregate — common for enriching data with reference tables and computing summaries.',
    category: 'joining',
    icon: '⋈',
    operators: ['CON', 'SYN'],
    requiredInputs: ['source', 'source2', 'joinKey', 'groupField', 'sumField'],
    generate: ({ source, source2, joinKey, groupField, sumField }) => [
      `CON(${source}, ${source2}, ${joinKey})`,
      `SYN(_last, ${sumField}, GROUP BY ${groupField})`
    ]
  },

  {
    id: 'reference-lookup',
    name: 'Reference Table Lookup',
    description: 'Enrich a dataset by joining with a reference/lookup table on a code field — adds descriptive labels from reference data.',
    category: 'joining',
    icon: '⋈',
    operators: ['CON'],
    requiredInputs: ['source', 'source2', 'joinKey'],
    generate: ({ source, source2, joinKey }) => [
      `CON(${source}, ${source2}, ${joinKey})`
    ]
  },

  // ════════════════════════════════════════════
  //  COMPARISON
  // ════════════════════════════════════════════

  {
    id: 'version-diff',
    name: 'Version Diff',
    description: 'Compare two versions of a dataset side-by-side — identifies matched, left-only, and right-only records.',
    category: 'comparison',
    icon: '∥',
    operators: ['SUP'],
    requiredInputs: ['source', 'source2', 'joinKey'],
    generate: ({ source, source2, joinKey }) => [
      `SUP(${source}, ${source2}, ${joinKey})`
    ]
  },

  {
    id: 'before-after',
    name: 'Before/After Analysis',
    description: 'Filter original and transformed data, then compare them side-by-side to verify transformations.',
    category: 'comparison',
    icon: '∥',
    operators: ['SEG', 'SEG', 'SUP'],
    requiredInputs: ['source', 'field', 'value', 'joinKey'],
    generate: ({ source, field, value, joinKey }) => [
      `SEG(${source}, ${field}="${value}")`,
      `SEG(${source}, ${field}!="${value}")`,
      `SUP(_result_0, _result_1, ${joinKey})`
    ]
  },

  {
    id: 'source-comparison',
    name: 'Source Comparison',
    description: 'Stack two sources together with labels — useful for visual comparison without a join key.',
    category: 'comparison',
    icon: '∥',
    operators: ['SUP'],
    requiredInputs: ['source', 'source2'],
    generate: ({ source, source2 }) => [
      `SUP(${source}, ${source2})`
    ]
  },

  {
    id: 'field-value-comparison',
    name: 'Field Value Comparison',
    description: 'Compare a field across two subsets of the same source — useful for "how does X differ between group A and group B?"',
    category: 'comparison',
    icon: '∥',
    operators: ['SEG', 'SYN', 'SEG', 'SYN'],
    requiredInputs: ['source', 'splitField', 'groupA', 'groupB', 'measureField'],
    generate: ({ source, splitField, groupA, groupB, measureField }) => [
      `SYN(SEG(${source}, ${splitField}="${groupA}"), ${measureField})`,
      `SYN(SEG(${source}, ${splitField}="${groupB}"), ${measureField})`
    ]
  },

  // ════════════════════════════════════════════
  //  CLASSIFICATION
  // ════════════════════════════════════════════

  {
    id: 'reclassify-values',
    name: 'Reclassify Values',
    description: 'Map raw values to standardized categories using a classification framework — creates a new derived field.',
    category: 'classification',
    icon: '↬',
    operators: ['REC'],
    requiredInputs: ['source', 'newField', 'sourceField', 'mapping'],
    generate: ({ source, newField, sourceField, mapping }) => [
      `REC(${source}, ${newField}=${sourceField}:${mapping})`
    ]
  },

  {
    id: 'bin-numeric',
    name: 'Numeric Binning',
    description: 'Create a categorical field from a numeric field by binning into ranges — useful for histograms and grouped analysis.',
    category: 'classification',
    icon: '↬',
    operators: ['ALT'],
    requiredInputs: ['source', 'field', 'lowThreshold', 'highThreshold'],
    generate: ({ source, field, lowThreshold, highThreshold }) => [
      `ALT(${source}, ${field}_bin, IF(${field}<${lowThreshold}, "Low", IF(${field}>${highThreshold}, "High", "Medium")))`
    ]
  },

  {
    id: 'flag-outliers',
    name: 'Flag Outliers',
    description: 'Add an outlier flag field — marks records where a numeric value exceeds a threshold as potential outliers.',
    category: 'classification',
    icon: '∿',
    operators: ['ALT'],
    requiredInputs: ['source', 'field', 'threshold'],
    generate: ({ source, field, threshold }) => [
      `ALT(${source}, ${field}_outlier, IF(${field}>${threshold}, "OUTLIER", "NORMAL"))`
    ]
  },

  {
    id: 'categorize-completeness',
    name: 'Categorize Completeness',
    description: 'Run a null audit then classify each field as COMPLETE, PARTIAL, or EMPTY based on null percentage.',
    category: 'classification',
    icon: '↬',
    operators: ['NUL', 'ALT'],
    requiredInputs: ['source'],
    generate: ({ source }) => [
      `NUL(${source})`,
      `ALT(_last, quality, IF(null_pct=0, "COMPLETE", IF(null_pct>50, "POOR", "PARTIAL")))`
    ]
  },

  // ════════════════════════════════════════════
  //  PROFILING
  // ════════════════════════════════════════════

  {
    id: 'full-profile',
    name: 'Full Data Profile',
    description: 'Complete data profiling: schema inference + null audit + source info. The single-click way to understand a new dataset.',
    category: 'profiling',
    icon: '◉',
    operators: ['SOURCE', 'SIG', 'NUL'],
    requiredInputs: ['source'],
    generate: ({ source }) => [
      `SOURCE(${source})`,
      `SIG(${source})`,
      `NUL(${source})`
    ]
  },

  {
    id: 'value-frequency',
    name: 'Value Frequency',
    description: 'Count how many times each unique value appears in a field — reveals the distribution and most common values.',
    category: 'profiling',
    icon: '∨',
    operators: ['SYN'],
    requiredInputs: ['source', 'field'],
    generate: ({ source, field }) => [
      `SYN(${source}, ${field}, GROUP BY ${field})`
    ]
  },

  {
    id: 'clean-profile-export',
    name: 'Clean → Profile → Export',
    description: 'Full pipeline: trim and standardize a key field, run quality checks, then snapshot the clean result for further use.',
    category: 'profiling',
    icon: '△',
    operators: ['ALT', 'ALT', 'NUL', 'SIG', 'INS'],
    requiredInputs: ['source', 'field'],
    generate: ({ source, field }) => [
      `ALT(${source}, ${field}, TRIM)`,
      `ALT(_last, ${field}, UPPER)`,
      `NUL(_last)`,
      `SIG(_last)`,
      `INS(_last, "${source}_clean")`
    ]
  },

  {
    id: 'enrich-and-summarize',
    name: 'Enrich & Summarize',
    description: 'Join with a reference table, then aggregate by a category — the complete pipeline from raw data to summary insight.',
    category: 'profiling',
    icon: '◉',
    operators: ['CON', 'SYN'],
    requiredInputs: ['source', 'source2', 'joinKey', 'groupField', 'sumField'],
    generate: ({ source, source2, joinKey, groupField, sumField }) => [
      `CON(${source}, ${source2}, ${joinKey})`,
      `SYN(_last, ${sumField}, GROUP BY ${groupField})`
    ]
  },

  {
    id: 'investigative-pipeline',
    name: 'Investigative Pipeline',
    description: 'Full investigation: profile source, filter to relevant subset, aggregate findings, flag outliers. Built for investigative journalism workflows.',
    category: 'profiling',
    icon: '◉',
    operators: ['SIG', 'NUL', 'SEG', 'SYN', 'ALT'],
    requiredInputs: ['source', 'filterField', 'filterValue', 'measureField', 'threshold'],
    generate: ({ source, filterField, filterValue, measureField, threshold }) => [
      `SIG(${source})`,
      `NUL(${source})`,
      `SEG(${source}, ${filterField}="${filterValue}")`,
      `SYN(_last, ${measureField})`,
      `ALT(SEG(${source}, ${filterField}="${filterValue}"), ${measureField}_flag, IF(${measureField}>${threshold}, "HIGH", "NORMAL"))`
    ]
  },
];

/**
 * Get stacks by category.
 * @param {string} category - Category key
 * @returns {OperatorStack[]}
 */
export function getStacksByCategory(category) {
  return OPERATOR_STACKS.filter(s => s.category === category);
}

/**
 * Get a stack by ID.
 * @param {string} id - Stack ID
 * @returns {OperatorStack|null}
 */
export function getStack(id) {
  return OPERATOR_STACKS.find(s => s.id === id) || null;
}

/**
 * Search stacks by query string.
 * @param {string} query - Search query
 * @returns {OperatorStack[]}
 */
export function searchStacks(query) {
  const q = query.toLowerCase();
  return OPERATOR_STACKS.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.description.toLowerCase().includes(q) ||
    s.category.includes(q) ||
    s.operators.some(op => op.toLowerCase().includes(q))
  );
}

/**
 * Get the required input fields for a stack.
 * Returns a description of what the user needs to provide.
 * @param {string} stackId
 * @returns {{ name: string, label: string, type: string }[]}
 */
export function getStackInputs(stackId) {
  const stack = getStack(stackId);
  if (!stack) return [];

  const inputDefs = {
    source: { label: 'Source', type: 'source', desc: 'Data source to operate on' },
    source2: { label: 'Second Source', type: 'source', desc: 'Source to join/compare with' },
    field: { label: 'Field', type: 'field', desc: 'Column to operate on' },
    field2: { label: 'Second Field', type: 'field', desc: 'Additional column' },
    filterField: { label: 'Filter Field', type: 'field', desc: 'Column to filter by' },
    filterValue: { label: 'Filter Value', type: 'text', desc: 'Value to match' },
    value: { label: 'Value', type: 'text', desc: 'Value to match' },
    value2: { label: 'Second Value', type: 'text', desc: 'Second value to match' },
    joinKey: { label: 'Join Key', type: 'field', desc: 'Field to join on' },
    groupField: { label: 'Group By Field', type: 'field', desc: 'Field to group by' },
    sumField: { label: 'Aggregate Field', type: 'field', desc: 'Numeric field to aggregate' },
    measureField: { label: 'Measure Field', type: 'field', desc: 'Numeric field to measure' },
    splitField: { label: 'Split Field', type: 'field', desc: 'Field to split groups on' },
    splitValue: { label: 'Split Value', type: 'text', desc: 'Value to split on' },
    min: { label: 'Minimum', type: 'number', desc: 'Lower bound' },
    max: { label: 'Maximum', type: 'number', desc: 'Upper bound' },
    threshold: { label: 'Threshold', type: 'number', desc: 'Threshold value' },
    lowThreshold: { label: 'Low Threshold', type: 'number', desc: 'Low bin boundary' },
    highThreshold: { label: 'High Threshold', type: 'number', desc: 'High bin boundary' },
    findText: { label: 'Find Text', type: 'text', desc: 'Text to find' },
    replaceText: { label: 'Replace With', type: 'text', desc: 'Replacement text' },
    newField: { label: 'New Field Name', type: 'text', desc: 'Name for new derived field' },
    sourceField: { label: 'Source Field', type: 'field', desc: 'Field to reclassify from' },
    mapping: { label: 'Mapping', type: 'text', desc: 'Mapping rules: val1->label1,val2->label2' },
    conditionField: { label: 'Condition Field', type: 'field', desc: 'Field to check condition on' },
    conditionValue: { label: 'Condition Value', type: 'text', desc: 'Value to check for' },
    fillValue: { label: 'Fill Value', type: 'text', desc: 'Value to fill with' },
    groupA: { label: 'Group A Value', type: 'text', desc: 'First group value' },
    groupB: { label: 'Group B Value', type: 'text', desc: 'Second group value' },
  };

  return (stack.requiredInputs || []).map(name => ({
    name,
    ...(inputDefs[name] || { label: name, type: 'text', desc: '' })
  }));
}
