/**
 * SIG(⊡) — to point
 * Point at column types; draw first distinctions in raw data.
 *
 * CSV parsing (RFC 4180) and schema inference.
 * SIG designates types — it points at what each column is.
 */

/**
 * SIG(⊡) — Parse CSV text into rows of objects.
 * Implements RFC 4180 with quoted field support.
 *
 * @param {string} text - Raw CSV text
 * @param {string} [delimiter=','] - Field delimiter
 * @returns {{ headers: string[], rows: Object[] }}
 */
export function sig_parseCSV(text, delimiter = ',') {
  const lines = _tokenizeCSV(text, delimiter);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i];
    if (fields.length === 1 && fields[0].trim() === '') continue; // skip empty lines

    const row = {};
    for (let j = 0; j < headers.length; j++) {
      if (j < fields.length) {
        row[headers[j]] = fields[j];
      }
      // If field missing from this row, it simply won't be in the object
      // NUL(∅) will classify it as NEVER_SET
    }
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * SIG(⊡) — Parse JSON text into rows.
 * Handles any shape: arrays of objects, wrapped arrays, single objects,
 * arrays of primitives, and nested structures.
 *
 * @param {string} text - Raw JSON text
 * @returns {{ headers: string[], rows: Object[] }}
 */
export function sig_parseJSON(text) {
  const parsed = JSON.parse(text);
  let rows = _extractRows(parsed);

  if (rows.length === 0) {
    throw new Error('SIG: Could not extract any rows from this JSON');
  }

  // Collect all unique headers across all rows
  const headerSet = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      headerSet.add(key);
    }
  }
  const headers = Array.from(headerSet);

  // Flatten nested values — objects/arrays become JSON strings
  for (const row of rows) {
    for (const key of headers) {
      const v = row[key];
      if (v !== null && v !== undefined && typeof v === 'object') {
        row[key] = JSON.stringify(v);
      }
    }
  }

  return { headers, rows };
}

/**
 * Extract an array of row-objects from any JSON shape.
 */
function _extractRows(data) {
  // Array of objects — the ideal case
  if (Array.isArray(data)) {
    if (data.length === 0) return [];
    // Array of objects
    if (typeof data[0] === 'object' && data[0] !== null && !Array.isArray(data[0])) {
      return data.map(item => {
        if (typeof item !== 'object' || item === null) return { value: item };
        return item;
      });
    }
    // Array of primitives — wrap each in {value: x}
    if (typeof data[0] !== 'object') {
      return data.map((v, i) => ({ index: i, value: v }));
    }
    // Array of arrays — treat as rows with column indices
    if (Array.isArray(data[0])) {
      return data.map((arr, i) => {
        const row = { _row: i };
        arr.forEach((v, j) => { row[`col_${j}`] = typeof v === 'object' && v !== null ? JSON.stringify(v) : v; });
        return row;
      });
    }
    return data.map(v => ({ value: v }));
  }

  // Single object — look for a property that is an array of objects (common wrapper pattern)
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    // Check all top-level keys for the largest array of objects
    let bestKey = null;
    let bestLen = 0;
    for (const [key, val] of Object.entries(data)) {
      if (Array.isArray(val) && val.length > bestLen) {
        if (val.length > 0 && typeof val[0] === 'object' && val[0] !== null && !Array.isArray(val[0])) {
          bestKey = key;
          bestLen = val.length;
        } else if (val.length > 0) {
          // Array of primitives or arrays — still a candidate
          if (bestLen === 0) {
            bestKey = key;
            bestLen = val.length;
          }
        }
      }
    }

    // Found a nested array — extract it
    if (bestKey && bestLen > 0) {
      return _extractRows(data[bestKey]);
    }

    // No nested array — treat the object itself as a single row
    return [data];
  }

  // Primitive — wrap it
  if (data !== null && data !== undefined) {
    return [{ value: data }];
  }

  return [];
}

/**
 * SIG(⊡) — Infer column types from data.
 * Points at what each column is: string, number, date, boolean.
 *
 * @param {string[]} headers - Column names
 * @param {Object[]} rows - Data rows
 * @returns {Object[]} Array of { name, inferredType, sampleValues, confidence }
 */
export function sig_inferSchema(headers, rows) {
  const schema = [];

  for (const header of headers) {
    const values = rows
      .map(row => row[header])
      .filter(v => v !== undefined && v !== null && v !== '');

    const sampleValues = values.slice(0, 5);
    const { type, confidence } = _inferColumnType(values);

    schema.push({
      name: header,
      inferredType: type,
      confidence,
      sampleValues,
      totalValues: values.length,
      totalRows: rows.length,
      override: null,          // Analyst can override
      overrideJustification: null  // Required when overriding
    });
  }

  return schema;
}

/**
 * SIG(⊡) — Auto-detect file format from filename or content.
 */
export function sig_detectFormat(filename, content) {
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'tsv') return 'tsv';
  if (ext === 'csv') return 'csv';
  if (ext === 'json' || ext === 'geojson' || ext === 'ndjson' || ext === 'jsonl') {
    return ext === 'ndjson' || ext === 'jsonl' ? 'ndjson' : 'json';
  }

  // Try to detect from content
  const trimmed = content.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return 'json';
  }

  // Check for tab-delimited
  const firstLine = trimmed.split('\n')[0] || '';
  if (firstLine.includes('\t') && !firstLine.includes(',')) {
    return 'tsv';
  }

  return 'csv'; // Default assumption
}

/**
 * SIG(⊡) — Parse newline-delimited JSON (NDJSON/JSONL).
 */
export function sig_parseNDJSON(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  const rows = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line.trim());
      if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
        rows.push(obj);
      } else {
        rows.push({ value: obj });
      }
    } catch (e) {
      // Skip unparseable lines
    }
  }

  const headerSet = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) headerSet.add(key);
  }
  const headers = Array.from(headerSet);

  // Flatten nested values
  for (const row of rows) {
    for (const key of headers) {
      const v = row[key];
      if (v !== null && v !== undefined && typeof v === 'object') {
        row[key] = JSON.stringify(v);
      }
    }
  }

  return { headers, rows };
}

/**
 * Parse a file based on detected format.
 */
export function sig_parseFile(filename, content) {
  const format = sig_detectFormat(filename, content);

  switch (format) {
    case 'csv':
      return { ...sig_parseCSV(content, ','), format };
    case 'tsv':
      return { ...sig_parseCSV(content, '\t'), format };
    case 'json':
      return { ...sig_parseJSON(content), format };
    case 'ndjson':
      return { ...sig_parseNDJSON(content), format };
    default:
      throw new Error(`SIG: Unsupported file format: ${format}`);
  }
}

// ============ Internal helpers ============

/**
 * Tokenize CSV text into array of field arrays.
 * Handles quoted fields, embedded commas, embedded newlines.
 */
function _tokenizeCSV(text, delimiter) {
  const lines = [];
  let currentLine = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    } else {
      if (char === '"' && currentField === '') {
        // Start of quoted field
        inQuotes = true;
        i++;
      } else if (char === delimiter) {
        currentLine.push(currentField);
        currentField = '';
        i++;
      } else if (char === '\r' && nextChar === '\n') {
        currentLine.push(currentField);
        lines.push(currentLine);
        currentLine = [];
        currentField = '';
        i += 2;
      } else if (char === '\n') {
        currentLine.push(currentField);
        lines.push(currentLine);
        currentLine = [];
        currentField = '';
        i++;
      } else {
        currentField += char;
        i++;
      }
    }
  }

  // Handle last field/line
  if (currentField !== '' || currentLine.length > 0) {
    currentLine.push(currentField);
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Infer the type of a column from its values.
 */
function _inferColumnType(values) {
  if (values.length === 0) return { type: 'string', confidence: 0 };

  let numberCount = 0;
  let booleanCount = 0;
  let dateCount = 0;

  for (const v of values) {
    const str = String(v).trim();

    // Check boolean
    if (['true', 'false', 'yes', 'no', '1', '0'].includes(str.toLowerCase())) {
      booleanCount++;
    }

    // Check number
    if (str !== '' && !isNaN(Number(str))) {
      numberCount++;
    }

    // Check date (ISO 8601 or common formats)
    if (_isDateLike(str)) {
      dateCount++;
    }
  }

  const total = values.length;

  // Require >80% match for type inference
  if (numberCount / total > 0.8) {
    return { type: 'number', confidence: numberCount / total };
  }
  if (dateCount / total > 0.8) {
    return { type: 'date', confidence: dateCount / total };
  }
  if (booleanCount / total > 0.8) {
    return { type: 'boolean', confidence: booleanCount / total };
  }

  return { type: 'string', confidence: 1.0 };
}

/**
 * Check if a string looks like a date.
 */
function _isDateLike(str) {
  // ISO 8601
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return true;
  // MM/DD/YYYY or DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(str)) return true;
  // Attempt Date.parse (unreliable but supplementary)
  const parsed = Date.parse(str);
  return !isNaN(parsed) && str.length > 4;
}
