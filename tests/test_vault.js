/**
 * Tests for the Given-Log (Vault) — Phase 1
 *
 * Tests INS(△) ingestion, NUL(∅) null detection,
 * and Ineliminability (Anti-Gaslighting) enforcement.
 */

import { initDB, run, query, queryOne } from '../src/db.js';
import { ins_createSource, ins_createAnchor, getAllSources, getSource, getAnchors, hashExists } from '../src/models/given_log.js';
import { sig_parseCSV, sig_inferSchema, sig_parseFile } from '../src/given/parser.js';
import { nul_nullify, nul_nullifyRow, nul_audit } from '../src/given/nul.js';
import { NullState } from '../src/models/operators.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (got: ${actual}, expected: ${expected})`);
}

// ============ NUL(∅) Tests ============

console.log('\n=== NUL(∅) — Three-State Null Detection ===');

// CLEARED: explicitly empty string
assertEqual(nul_nullify('', true, true), NullState.CLEARED,
  'Empty string → CLEARED');

// CLEARED: explicit null
assertEqual(nul_nullify(null, true, true), NullState.CLEARED,
  'Explicit null → CLEARED');

// UNKNOWN: undefined value
assertEqual(nul_nullify(undefined, true, true), NullState.UNKNOWN,
  'Undefined → UNKNOWN');

// NEVER_SET: field not in record
assertEqual(nul_nullify(undefined, true, false), NullState.NEVER_SET,
  'Field not in record → NEVER_SET');

// Populated: actual value
assertEqual(nul_nullify('Tom Cash', true, true), null,
  'Populated value → null (not a null state)');

// Populated: zero is not null
assertEqual(nul_nullify(0, true, true), null,
  'Zero is populated, not null');

// Row-level null detection
console.log('\n=== NUL(∅) — Row-Level Detection ===');

const testRow = { name: 'Tom', amount: '', address: null };
const testSchema = ['name', 'amount', 'address', 'phone'];
const rowNulls = nul_nullifyRow(testRow, testSchema);

assertEqual(rowNulls.amount, NullState.CLEARED,
  'Row: empty string field → CLEARED');
assertEqual(rowNulls.address, NullState.CLEARED,
  'Row: null field → CLEARED');
assertEqual(rowNulls.phone, NullState.NEVER_SET,
  'Row: missing field → NEVER_SET');
assert(!('name' in rowNulls),
  'Row: populated field not in nullStates');

// Audit across dataset
console.log('\n=== NUL(∅) — Dataset Audit ===');

const auditRows = [
  { name: 'Tom', amount: '500', phone: '555-0100' },
  { name: 'Jane', amount: '', phone: null },
  { name: '', amount: '300' }
];
const auditResult = nul_audit(auditRows, ['name', 'amount', 'phone']);

assertEqual(auditResult.name.populated, 2, 'Audit: name has 2 populated');
assertEqual(auditResult.name.CLEARED, 1, 'Audit: name has 1 CLEARED');
assertEqual(auditResult.phone.CLEARED, 1, 'Audit: phone has 1 CLEARED');
assertEqual(auditResult.phone.NEVER_SET, 1, 'Audit: phone has 1 NEVER_SET');

// ============ SIG(⊡) Tests ============

console.log('\n=== SIG(⊡) — CSV Parsing ===');

const csvText = `name,amount,date
Tom Cash,500.00,2023-03-15
"Jane ""JJ"" Doe",250.00,2023-04-01
Maria Santos,,2023-05-10`;

const { headers, rows } = sig_parseCSV(csvText);

assertEqual(headers.length, 3, 'CSV: parsed 3 headers');
assertEqual(rows.length, 3, 'CSV: parsed 3 rows');
assertEqual(rows[0].name, 'Tom Cash', 'CSV: first row name correct');
assertEqual(rows[1].name, 'Jane "JJ" Doe', 'CSV: quoted field with escaped quotes');
assertEqual(rows[2].amount, '', 'CSV: empty field preserved as empty string');

// Schema inference
console.log('\n=== SIG(⊡) — Schema Inference ===');

const schema = sig_inferSchema(headers, rows);

assertEqual(schema[0].name, 'name', 'Schema: first column is name');
assertEqual(schema[0].inferredType, 'string', 'Schema: name is string');
assertEqual(schema[1].name, 'amount', 'Schema: second column is amount');
assertEqual(schema[1].inferredType, 'number', 'Schema: amount is number');
assertEqual(schema[2].name, 'date', 'Schema: third column is date');
assertEqual(schema[2].inferredType, 'date', 'Schema: date is date');

// ============ Results ============

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

if (typeof process !== 'undefined') {
  process.exit(failed > 0 ? 1 : 0);
}
