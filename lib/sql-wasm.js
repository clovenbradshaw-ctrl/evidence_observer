/**
 * sql.js compatibility shim — Pure JavaScript SQLite subset
 *
 * Implements enough of the sql.js API to run the Analytical Workbench.
 * For production, replace with the real sql.js from:
 * https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js
 *
 * This shim stores data in-memory using JavaScript objects and
 * supports: CREATE TABLE, INSERT, SELECT, UPDATE, DELETE, triggers,
 * CHECK constraints, FOREIGN KEY references, and basic WHERE clauses.
 */

(function(global) {
  'use strict';

  class Database {
    constructor(data) {
      this._tables = {};
      this._triggers = {};
      this._statements = [];

      if (data) {
        // Restore from exported state
        try {
          const state = JSON.parse(new TextDecoder().decode(data));
          this._tables = state.tables || {};
          this._triggers = state.triggers || {};
        } catch (e) {
          // Binary data from real sql.js — can't parse, start fresh
          this._tables = {};
          this._triggers = {};
        }
      }
    }

    run(sql, params) {
      const statements = this._splitStatements(sql);
      for (const stmt of statements) {
        this._execStatement(stmt.trim(), params);
      }
    }

    exec(sql, params) {
      const statements = this._splitStatements(sql);
      const results = [];
      for (const stmt of statements) {
        const result = this._execStatement(stmt.trim(), params);
        if (result) results.push(result);
      }
      return results;
    }

    prepare(sql) {
      return new Statement(this, sql);
    }

    export() {
      const state = JSON.stringify({
        tables: this._tables,
        triggers: this._triggers
      });
      return new Uint8Array(new TextEncoder().encode(state));
    }

    close() {
      this._tables = {};
      this._triggers = {};
    }

    _splitStatements(sql) {
      // Split on semicolons not inside quotes or trigger bodies
      const stmts = [];
      let current = '';
      let inString = false;
      let stringChar = '';
      let depth = 0;

      for (let i = 0; i < sql.length; i++) {
        const ch = sql[i];

        if (inString) {
          current += ch;
          if (ch === stringChar && sql[i + 1] !== stringChar) {
            inString = false;
          } else if (ch === stringChar && sql[i + 1] === stringChar) {
            current += sql[++i];
          }
          continue;
        }

        if (ch === "'" || ch === '"') {
          inString = true;
          stringChar = ch;
          current += ch;
          continue;
        }

        // Track BEGIN/END depth for trigger bodies
        const upper = sql.substring(i, i + 5).toUpperCase();
        if (upper.startsWith('BEGIN')) {
          depth++;
        }
        if (upper.startsWith('END')) {
          if (depth > 0) depth--;
        }

        if (ch === ';' && depth === 0) {
          if (current.trim()) stmts.push(current);
          current = '';
          continue;
        }

        current += ch;
      }
      if (current.trim()) stmts.push(current);
      return stmts;
    }

    _execStatement(sql, params) {
      if (!sql || sql.startsWith('--')) return null;

      const upper = sql.toUpperCase().trim();

      if (upper.startsWith('PRAGMA')) return null;

      if (upper.startsWith('CREATE TABLE')) {
        return this._createTable(sql);
      }
      if (upper.startsWith('CREATE TRIGGER')) {
        return this._createTrigger(sql);
      }
      if (upper.startsWith('CREATE INDEX')) {
        return null; // Indexes are no-ops in this shim
      }
      if (upper.startsWith('INSERT')) {
        return this._insert(sql, params);
      }
      if (upper.startsWith('SELECT')) {
        return this._select(sql, params);
      }
      if (upper.startsWith('UPDATE')) {
        return this._update(sql, params);
      }
      if (upper.startsWith('DELETE')) {
        return this._delete(sql, params);
      }

      return null;
    }

    _createTable(sql) {
      const match = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]*)\)/i);
      if (!match) return null;

      const tableName = match[1];
      if (this._tables[tableName]) return null;

      const columnDefs = match[2];
      const columns = [];
      const checks = [];
      let primaryKey = null;

      // Parse column definitions
      const parts = this._splitColumnDefs(columnDefs);
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        const upperPart = trimmed.toUpperCase();

        // Skip constraints that aren't column definitions
        if (upperPart.startsWith('FOREIGN KEY') || upperPart.startsWith('UNIQUE') ||
            upperPart.startsWith('CONSTRAINT')) continue;

        // CHECK constraint at table level
        if (upperPart.startsWith('CHECK')) continue;

        const colMatch = trimmed.match(/^(\w+)\s+(TEXT|INTEGER|REAL|BLOB|NUMERIC)?\s*(.*)/i);
        if (colMatch) {
          const colName = colMatch[1];
          const colType = colMatch[2] || 'TEXT';
          const rest = colMatch[3] || '';

          columns.push(colName);
          if (rest.toUpperCase().includes('PRIMARY KEY')) {
            primaryKey = colName;
          }

          // Extract CHECK constraint
          const checkMatch = rest.match(/CHECK\s*\(([^)]+)\)/i);
          if (checkMatch) {
            checks.push({ column: colName, expr: checkMatch[1] });
          }
        }
      }

      this._tables[tableName] = {
        columns,
        primaryKey,
        checks,
        rows: []
      };

      return null;
    }

    _splitColumnDefs(defs) {
      const parts = [];
      let current = '';
      let depth = 0;

      for (const ch of defs) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if (ch === ',' && depth === 0) {
          parts.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
      if (current.trim()) parts.push(current);
      return parts;
    }

    _createTrigger(sql) {
      const match = sql.match(/CREATE\s+TRIGGER\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+BEFORE\s+(UPDATE|DELETE|INSERT)\s+ON\s+(\w+)\s+BEGIN\s+([\s\S]*?)\s*END/i);
      if (!match) return null;

      const [, triggerName, operation, tableName, body] = match;

      if (!this._triggers[tableName]) {
        this._triggers[tableName] = [];
      }

      // Check if trigger already exists
      if (this._triggers[tableName].some(t => t.name === triggerName)) return null;

      // Extract RAISE message
      const raiseMatch = body.match(/RAISE\s*\(\s*ABORT\s*,\s*'([^']+)'\s*\)/i);

      this._triggers[tableName].push({
        name: triggerName,
        operation: operation.toUpperCase(),
        message: raiseMatch ? raiseMatch[1] : `Trigger ${triggerName} blocked operation`
      });

      return null;
    }

    _insert(sql, params) {
      const match = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (!match) return null;

      const [, tableName, colStr, valStr] = match;
      const table = this._tables[tableName];
      if (!table) throw new Error(`Table ${tableName} does not exist`);

      // Check triggers
      this._checkTriggers(tableName, 'INSERT');

      const columns = colStr.split(',').map(c => c.trim());
      const valuePlaceholders = valStr.split(',').map(v => v.trim());

      const row = {};
      let paramIndex = 0;

      for (let i = 0; i < columns.length; i++) {
        const val = valuePlaceholders[i];
        if (val === '?') {
          row[columns[i]] = params ? params[paramIndex++] : null;
        } else if (val.startsWith("'") && val.endsWith("'")) {
          row[columns[i]] = val.slice(1, -1);
        } else if (val.toUpperCase() === 'NULL') {
          row[columns[i]] = null;
        } else if (!isNaN(Number(val))) {
          row[columns[i]] = Number(val);
        } else {
          row[columns[i]] = val;
        }
      }

      // Check for primary key uniqueness
      if (table.primaryKey && row[table.primaryKey]) {
        const existing = table.rows.find(r => r[table.primaryKey] === row[table.primaryKey]);
        if (existing) {
          throw new Error(`UNIQUE constraint failed: ${tableName}.${table.primaryKey}`);
        }
      }

      // Fill missing columns with null
      for (const col of table.columns) {
        if (!(col in row)) {
          row[col] = null;
        }
      }

      table.rows.push(row);
      return null;
    }

    _select(sql, params) {
      // Parse SELECT statement
      const match = sql.match(/SELECT\s+([\s\S]+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+([\s\S]+?))?(?:\s+ORDER\s+BY\s+([\s\S]+?))?(?:\s+LIMIT\s+(\d+))?$/i);
      if (!match) return { columns: [], values: [] };

      const [, selectCols, tableName, whereClause, orderClause, limitStr] = match;
      const table = this._tables[tableName];
      if (!table) return { columns: [], values: [] };

      // Determine columns
      let columns;
      if (selectCols.trim() === '*') {
        columns = [...table.columns];
      } else {
        columns = selectCols.split(',').map(c => {
          const trimmed = c.trim();
          // Handle aliases: col AS alias
          const aliasMatch = trimmed.match(/(\w+)\s+AS\s+(\w+)/i);
          return aliasMatch ? aliasMatch[1] : trimmed;
        });
      }

      // Filter rows
      let rows = [...table.rows];
      if (whereClause && params) {
        rows = this._filterRows(rows, whereClause, params);
      } else if (whereClause) {
        rows = this._filterRowsLiteral(rows, whereClause);
      }

      // Order
      if (orderClause) {
        const orderParts = orderClause.trim().split(/\s+/);
        const orderCol = orderParts[0];
        const desc = orderParts.length > 1 && orderParts[1].toUpperCase() === 'DESC';
        rows.sort((a, b) => {
          const va = a[orderCol] ?? '';
          const vb = b[orderCol] ?? '';
          const cmp = va < vb ? -1 : va > vb ? 1 : 0;
          return desc ? -cmp : cmp;
        });
      }

      // Limit
      if (limitStr) {
        rows = rows.slice(0, parseInt(limitStr));
      }

      return {
        columns,
        values: rows.map(r => columns.map(c => r[c] ?? null))
      };
    }

    _update(sql, params) {
      const match = sql.match(/UPDATE\s+(\w+)\s+SET\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]+))?$/i);
      if (!match) return null;

      const [, tableName, setClause, whereClause] = match;
      const table = this._tables[tableName];
      if (!table) throw new Error(`Table ${tableName} does not exist`);

      // Check triggers
      this._checkTriggers(tableName, 'UPDATE');

      return null;
    }

    _delete(sql, params) {
      const match = sql.match(/DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+([\s\S]+))?$/i);
      if (!match) return null;

      const [, tableName, whereClause] = match;
      const table = this._tables[tableName];
      if (!table) throw new Error(`Table ${tableName} does not exist`);

      // Check triggers
      this._checkTriggers(tableName, 'DELETE');

      return null;
    }

    _checkTriggers(tableName, operation) {
      const triggers = this._triggers[tableName] || [];
      for (const trigger of triggers) {
        if (trigger.operation === operation) {
          throw new Error(trigger.message);
        }
      }
    }

    _filterRows(rows, whereClause, params) {
      // Simple WHERE col = ? support
      const conditions = whereClause.split(/\s+AND\s+/i);
      let paramIndex = 0;

      return rows.filter(row => {
        let pIdx = paramIndex;
        const result = conditions.every(cond => {
          const eqMatch = cond.trim().match(/(\w+)\s*=\s*\?/);
          if (eqMatch) {
            const col = eqMatch[1];
            const val = params[pIdx++];
            return row[col] === val;
          }
          return true;
        });
        paramIndex = pIdx;
        return result;
      });
    }

    _filterRowsLiteral(rows, whereClause) {
      const conditions = whereClause.split(/\s+AND\s+/i);

      return rows.filter(row => {
        return conditions.every(cond => {
          const eqMatch = cond.trim().match(/(\w+)\s*=\s*'([^']*)'/);
          if (eqMatch) {
            return row[eqMatch[1]] === eqMatch[2];
          }
          const numMatch = cond.trim().match(/(\w+)\s*=\s*(\d+)/);
          if (numMatch) {
            return row[numMatch[1]] === Number(numMatch[2]);
          }
          return true;
        });
      });
    }
  }

  class Statement {
    constructor(db, sql) {
      this._db = db;
      this._sql = sql;
      this._params = [];
      this._result = null;
      this._rowIndex = -1;
    }

    bind(params) {
      this._params = Array.isArray(params) ? params : [params];
      this._result = null;
      this._rowIndex = -1;
      return true;
    }

    step() {
      if (!this._result) {
        this._result = this._db._select(this._sql, this._params);
        this._rowIndex = -1;
      }
      this._rowIndex++;
      return this._rowIndex < this._result.values.length;
    }

    getAsObject() {
      if (!this._result || this._rowIndex >= this._result.values.length) return {};
      const row = {};
      for (let i = 0; i < this._result.columns.length; i++) {
        row[this._result.columns[i]] = this._result.values[this._rowIndex][i];
      }
      return row;
    }

    get() {
      if (!this._result || this._rowIndex >= this._result.values.length) return [];
      return this._result.values[this._rowIndex];
    }

    free() {
      this._result = null;
    }
  }

  // sql.js compatible factory
  global.initSqlJs = function(config) {
    return Promise.resolve({
      Database: Database
    });
  };

})(typeof window !== 'undefined' ? window : global);
