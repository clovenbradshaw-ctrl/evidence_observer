/**
 * Data Validation Audit Service — Discrepancy Detection Engine
 *
 * Pure functions for comparing a dashboard's published data against
 * raw source data to surface reliability and validity issues.
 *
 * All functions operate on plain JS arrays (the standard data format
 * throughout Evidence Observer) and return structured findings.
 * No UI logic. No database calls.
 */

import { findPotentialMatches } from '../meant/reconciliation.js';

// ============ Duplicate Detection ============

/**
 * Detect duplicate entities with campaign-finance-specific heuristics.
 * Wraps findPotentialMatches() and adds normalization for business suffixes,
 * PAC name variations, and address similarity.
 *
 * @param {Object[]} records - Array of record objects
 * @param {string} nameField - Field containing entity names (e.g., 'donor_name')
 * @param {Object} [opts] - Options
 * @param {number} [opts.threshold=0.7] - Similarity threshold
 * @param {string} [opts.addressField] - Optional address field for cross-check
 * @returns {Object[]} Matches with duplicateType classification
 */
export function detectDuplicateEntities(records, nameField, opts = {}) {
  const { threshold = 0.7, addressField } = opts;

  // Normalize records for better matching
  const normalized = records.map((r, i) => ({
    ...r,
    _normalizedName: _normalizeName(String(r[nameField] || '')),
    _originalIndex: i
  }));

  // Run base similarity matching
  const rawMatches = findPotentialMatches(normalized, nameField, threshold);

  // Classify each match
  const classified = rawMatches.map(match => {
    const nameA = String(match.recordA[nameField] || '');
    const nameB = String(match.recordB[nameField] || '');
    const normA = _normalizeName(nameA);
    const normB = _normalizeName(nameB);

    let duplicateType = 'possible_duplicate';

    if (normA === normB && nameA !== nameB) {
      // Same after normalization but different raw — likely abbreviation or suffix variant
      if (_isInitialVariant(nameA, nameB)) {
        duplicateType = 'abbreviation';
      } else if (_hasSuffixDifference(nameA, nameB)) {
        duplicateType = 'suffix_variant';
      } else {
        duplicateType = 'name_variant';
      }
    } else if (match.similarity >= 0.9) {
      duplicateType = 'typo';
    }

    // Cross-check address if available
    let addressMatch = null;
    if (addressField) {
      const addrA = _normalizeAddress(String(match.recordA[addressField] || ''));
      const addrB = _normalizeAddress(String(match.recordB[addressField] || ''));
      if (addrA && addrB) {
        addressMatch = addrA === addrB ? 'exact' : null;
      }
    }

    return {
      ...match,
      duplicateType,
      addressMatch,
      normalizedNameA: normA,
      normalizedNameB: normB
    };
  });

  return classified;
}

// ============ Category Error Detection ============

/**
 * Detect category/coding errors by applying analyst-defined rules.
 *
 * @param {Object[]} records - Array of record objects
 * @param {Object[]} rules - Array of { test: (row) => bool, message: string, severity: 'error'|'warning'|'info', field: string }
 * @returns {Object[]} Flagged records: { rowIndex, row, field, message, severity, rule }
 */
export function detectCategoryErrors(records, rules) {
  const findings = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    for (const rule of rules) {
      try {
        if (rule.test(row)) {
          findings.push({
            rowIndex: i,
            row,
            field: rule.field || null,
            message: rule.message,
            severity: rule.severity || 'warning',
            ruleId: rule.id || null
          });
        }
      } catch (e) {
        // Rule evaluation error — skip silently
      }
    }
  }

  return findings;
}

/**
 * Built-in rules for campaign finance data.
 * Returns an array of rules that can be passed to detectCategoryErrors().
 */
export function getCampaignFinanceRules() {
  return [
    {
      id: 'business_as_individual',
      test: (row) => {
        const type = String(row.donor_type || '').toLowerCase();
        const keyword = String(row.donor_type_keyword || row.donor_name || '').toLowerCase();
        return type === 'individual' && /\b(llc|inc|corp|ltd|company|co\.|associates|partners|group)\b/.test(keyword);
      },
      message: 'Business entity classified as Individual',
      severity: 'error',
      field: 'donor_type'
    },
    {
      id: 'pac_as_individual',
      test: (row) => {
        const type = String(row.donor_type || '').toLowerCase();
        const name = String(row.donor_name || '').toLowerCase();
        return type === 'individual' && /\b(pac|committee|political action|campaign)\b/.test(name);
      },
      message: 'PAC or committee classified as Individual',
      severity: 'error',
      field: 'donor_type'
    },
    {
      id: 'missing_location',
      test: (row) => {
        const bucket = String(row.location_bucket || '').trim();
        const city = String(row.city || '').trim();
        return (!bucket || bucket === '') && (!city || city === '');
      },
      message: 'Missing both location bucket and city',
      severity: 'warning',
      field: 'location_bucket'
    },
    {
      id: 'zero_amount',
      test: (row) => {
        const amount = Number(row.amount);
        return amount === 0 || (row.amount !== null && row.amount !== undefined && isNaN(Number(row.amount)));
      },
      message: 'Zero or non-numeric donation amount',
      severity: 'warning',
      field: 'amount'
    }
  ];
}

// ============ Aggregation Comparison ============

/**
 * Compare aggregated values between dashboard data and re-derived raw data.
 * Groups rawData by specified fields, sums the sumField, and diffs against
 * corresponding values in dashboardData.
 *
 * @param {Object[]} dashboardData - Dashboard's published aggregations
 * @param {Object[]} rawData - Raw source data to re-aggregate
 * @param {Object} mapping - Field mapping configuration
 * @param {string[]} mapping.groupByFields - Fields to group by in raw data
 * @param {string} mapping.sumField - Field to sum in raw data
 * @param {string} mapping.dashboardGroupField - Corresponding group field in dashboard data
 * @param {string} mapping.dashboardValueField - Value field in dashboard data to compare against
 * @returns {Object[]} Comparison results
 */
export function compareAggregations(dashboardData, rawData, mapping) {
  const { groupByFields, sumField, dashboardGroupField, dashboardValueField } = mapping;

  // Re-derive aggregations from raw data
  const derived = new Map();
  for (const row of rawData) {
    const groupKey = groupByFields.map(f => String(row[f] || '')).join('|');
    const value = Number(row[sumField]) || 0;
    derived.set(groupKey, (derived.get(groupKey) || 0) + value);
  }

  // Build dashboard lookup
  const dashboardLookup = new Map();
  for (const row of dashboardData) {
    const key = String(row[dashboardGroupField] || '');
    const value = Number(row[dashboardValueField]) || 0;
    dashboardLookup.set(key, value);
  }

  // Compare
  const results = [];
  const allKeys = new Set([...derived.keys(), ...dashboardLookup.keys()]);

  for (const key of allKeys) {
    const derivedValue = derived.get(key) || 0;
    const dashboardValue = dashboardLookup.get(key) || 0;
    const difference = derivedValue - dashboardValue;
    const percentDifference = dashboardValue !== 0
      ? ((difference / dashboardValue) * 100)
      : (derivedValue !== 0 ? 100 : 0);

    results.push({
      group: key,
      dashboardValue,
      derivedValue,
      difference,
      percentDifference: Math.round(percentDifference * 100) / 100,
      match: Math.abs(difference) < 0.01,
      inDashboard: dashboardLookup.has(key),
      inRawData: derived.has(key)
    });
  }

  // Sort by absolute difference descending
  return results.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
}

// ============ Missing Record Detection ============

/**
 * Find records present in one dataset but not the other.
 *
 * @param {Object[]} setA - First dataset (e.g., dashboard)
 * @param {Object[]} setB - Second dataset (e.g., raw source)
 * @param {string[]} matchFields - Fields to use for matching
 * @param {Object} [fieldMapping] - Maps setA field names to setB field names if different
 * @returns {{ onlyInA: Object[], onlyInB: Object[], matched: number }}
 */
export function findMissingRecords(setA, setB, matchFields, fieldMapping = {}) {
  function makeKey(row, fields, mapping = {}) {
    return fields.map(f => {
      const actualField = mapping[f] || f;
      return String(row[actualField] || '').trim().toLowerCase();
    }).join('|');
  }

  const keysA = new Map();
  for (let i = 0; i < setA.length; i++) {
    const key = makeKey(setA[i], matchFields);
    if (!keysA.has(key)) keysA.set(key, []);
    keysA.get(key).push({ index: i, row: setA[i] });
  }

  const keysB = new Map();
  for (let i = 0; i < setB.length; i++) {
    const key = makeKey(setB[i], matchFields, fieldMapping);
    if (!keysB.has(key)) keysB.set(key, []);
    keysB.get(key).push({ index: i, row: setB[i] });
  }

  const onlyInA = [];
  const onlyInB = [];
  let matched = 0;

  for (const [key, entries] of keysA) {
    if (keysB.has(key)) {
      matched += entries.length;
    } else {
      for (const entry of entries) {
        onlyInA.push({ ...entry, presentIn: 'dashboard', key });
      }
    }
  }

  for (const [key, entries] of keysB) {
    if (!keysA.has(key)) {
      for (const entry of entries) {
        onlyInB.push({ ...entry, presentIn: 'raw_source', key });
      }
    }
  }

  return { onlyInA, onlyInB, matched };
}

// ============ Findings Generator ============

/**
 * Structure raw discrepancy results into formal audit findings.
 *
 * @param {Object[]} discrepancies - Raw discrepancy objects from detection functions
 * @param {string} category - 'reliability' or 'validity'
 * @param {string} sourceLabel - Label for the data source (e.g., 'Pamphleteer Council Watch')
 * @returns {Object[]} Structured findings
 */
export function generateFindings(discrepancies, category, sourceLabel) {
  return discrepancies.map((d, i) => ({
    id: `${category.substring(0, 3).toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
    category,
    severity: d.severity || 'warning',
    title: d.message || d.duplicateType || 'Discrepancy found',
    description: _describeFinding(d, category),
    sourceLabel,
    evidence: d,
    timestamp: new Date().toISOString()
  }));
}

// ============ Summary Statistics ============

/**
 * Generate summary statistics for a validation audit.
 *
 * @param {Object} results - All detection results
 * @returns {Object} Summary
 */
export function generateAuditSummary(results) {
  const { duplicates = [], categoryErrors = [], aggregationComparisons = [], missingRecords = {} } = results;

  const aggregationMismatches = aggregationComparisons.filter(r => !r.match);

  return {
    totalFindings: duplicates.length + categoryErrors.length + aggregationMismatches.length +
      (missingRecords.onlyInA?.length || 0) + (missingRecords.onlyInB?.length || 0),
    reliability: {
      duplicateEntities: duplicates.length,
      categoryErrors: categoryErrors.length,
      byType: {
        abbreviation: duplicates.filter(d => d.duplicateType === 'abbreviation').length,
        name_variant: duplicates.filter(d => d.duplicateType === 'name_variant').length,
        suffix_variant: duplicates.filter(d => d.duplicateType === 'suffix_variant').length,
        typo: duplicates.filter(d => d.duplicateType === 'typo').length,
        possible_duplicate: duplicates.filter(d => d.duplicateType === 'possible_duplicate').length
      },
      bySeverity: {
        error: categoryErrors.filter(e => e.severity === 'error').length,
        warning: categoryErrors.filter(e => e.severity === 'warning').length,
        info: categoryErrors.filter(e => e.severity === 'info').length
      }
    },
    validity: {
      aggregationMismatches: aggregationMismatches.length,
      totalAggregations: aggregationComparisons.length,
      missingFromDashboard: missingRecords.onlyInB?.length || 0,
      missingFromSource: missingRecords.onlyInA?.length || 0,
      matchedRecords: missingRecords.matched || 0
    }
  };
}

// ============ Internal Helpers ============

/**
 * Normalize a name for comparison.
 * Strips business suffixes, normalizes whitespace, lowercase.
 */
function _normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\b(llc|inc|corp|ltd|co|pac|committee|political action committee)\b\.?/gi, '')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize an address for comparison.
 */
function _normalizeAddress(addr) {
  return addr
    .toLowerCase()
    .trim()
    .replace(/\b(st|street|ave|avenue|blvd|boulevard|dr|drive|ln|lane|rd|road|ct|court|way|pl|place|cir|circle)\b\.?/g, (m) => {
      const map = { st: 'street', ave: 'avenue', blvd: 'boulevard', dr: 'drive', ln: 'lane', rd: 'road', ct: 'court', pl: 'place', cir: 'circle' };
      const clean = m.replace('.', '').toLowerCase();
      return map[clean] || clean;
    })
    .replace(/[.,#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two names differ only by initials (e.g., "J. Wong" vs "James Wong").
 */
function _isInitialVariant(a, b) {
  const partsA = a.trim().split(/\s+/);
  const partsB = b.trim().split(/\s+/);

  // One must have an initial (single char or char with period)
  const hasInitial = (parts) => parts.some(p => /^[A-Za-z]\.?$/.test(p));
  return hasInitial(partsA) || hasInitial(partsB);
}

/**
 * Check if two names differ only by a business suffix.
 */
function _hasSuffixDifference(a, b) {
  const suffixes = /\b(llc|inc|corp|ltd|co|pac)\b\.?/gi;
  const strippedA = a.replace(suffixes, '').trim();
  const strippedB = b.replace(suffixes, '').trim();
  return strippedA.toLowerCase() === strippedB.toLowerCase() && a.toLowerCase() !== b.toLowerCase();
}

/**
 * Generate a human-readable description for a finding.
 */
function _describeFinding(d, category) {
  if (d.duplicateType) {
    const nameA = d.recordA ? (d.recordA.donor_name || d.recordA.name || 'Record A') : 'Record A';
    const nameB = d.recordB ? (d.recordB.donor_name || d.recordB.name || 'Record B') : 'Record B';
    return `Potential duplicate: "${nameA}" and "${nameB}" (${d.duplicateType}, similarity: ${(d.similarity * 100).toFixed(0)}%)`;
  }
  if (d.message) {
    const rowRef = d.rowIndex !== undefined ? ` (row ${d.rowIndex + 1})` : '';
    return `${d.message}${rowRef}`;
  }
  if (d.difference !== undefined) {
    return `Aggregation mismatch for "${d.group}": dashboard shows ${d.dashboardValue}, raw data yields ${d.derivedValue} (diff: ${d.difference})`;
  }
  return `${category} issue detected`;
}
