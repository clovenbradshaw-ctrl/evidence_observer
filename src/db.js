/**
 * Database Layer — sql.js (SQLite in WebAssembly)
 * Manages the Experience Engine's persistent state: 𝓔 = (G, S, M, π, γ, σ)
 *
 * SQLite handles structured queries and metadata.
 * IndexedDB handles large blob storage and SQLite persistence.
 */

const IDB_NAME = 'evidence_observer';
const IDB_VERSION = 1;
const IDB_STORE_DB = 'sqlite_state';
const IDB_STORE_BLOBS = 'data_blobs';
const AUTOSAVE_INTERVAL_MS = 30000;

let _db = null;
let _autosaveTimer = null;

/**
 * Open IndexedDB for persistent storage.
 */
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = (event) => {
      const idb = event.target.result;
      if (!idb.objectStoreNames.contains(IDB_STORE_DB)) {
        idb.createObjectStore(IDB_STORE_DB);
      }
      if (!idb.objectStoreNames.contains(IDB_STORE_BLOBS)) {
        idb.createObjectStore(IDB_STORE_BLOBS);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Read a value from IndexedDB.
 */
async function idbGet(storeName, key) {
  const idb = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Write a value to IndexedDB.
 */
async function idbPut(storeName, key, value) {
  const idb = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Store a large data blob in IndexedDB.
 * Returns the blob key for reference from SQLite.
 */
export async function storeBlob(key, data) {
  await idbPut(IDB_STORE_BLOBS, key, data);
  return key;
}

/**
 * Retrieve a large data blob from IndexedDB.
 */
export async function getBlob(key) {
  return await idbGet(IDB_STORE_BLOBS, key);
}

/**
 * Initialize the database. Attempts to restore from IndexedDB first.
 * Falls back to creating a fresh database with schema.
 */
export async function initDB(sqlPromise, schemaSQL) {
  const SQL = await sqlPromise;

  // Try to restore from IndexedDB
  const savedState = await idbGet(IDB_STORE_DB, 'current').catch(() => null);

  if (savedState) {
    _db = new SQL.Database(new Uint8Array(savedState));
    console.log('[db] Restored from IndexedDB');
  } else {
    _db = new SQL.Database();
    _db.run(schemaSQL);
    console.log('[db] Created fresh database with schema');
  }

  // Enable WAL mode for better concurrent read performance
  _db.run('PRAGMA journal_mode=WAL');
  _db.run('PRAGMA foreign_keys=ON');

  // Start autosave timer
  _startAutosave();

  return _db;
}

/**
 * Get the current database instance.
 */
export function getDB() {
  if (!_db) throw new Error('Database not initialized. Call initDB() first.');
  return _db;
}

/**
 * Run a SQL statement (INSERT, UPDATE, CREATE, etc.)
 */
export function run(sql, params = []) {
  return getDB().run(sql, params);
}

/**
 * Execute a query and return results as array of objects.
 */
export function query(sql, params = []) {
  const stmt = getDB().prepare(sql);
  if (params.length > 0) stmt.bind(params);

  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

/**
 * Execute a query and return the first result, or null.
 */
export function queryOne(sql, params = []) {
  const results = query(sql, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * Persist SQLite state to IndexedDB.
 * Called automatically on interval and on significant operations.
 */
export async function persistToIndexedDB() {
  if (!_db) return;
  const data = _db.export();
  await idbPut(IDB_STORE_DB, 'current', data.buffer);
  console.log('[db] Persisted to IndexedDB');
}

/**
 * Export the entire SQLite database as a Uint8Array (for self-contained HTML export).
 */
export function exportDB() {
  return getDB().export();
}

/**
 * Import a database from a Uint8Array (for self-contained HTML import).
 */
export async function importDB(sqlPromise, uint8Array) {
  const SQL = await sqlPromise;
  if (_db) _db.close();
  _db = new SQL.Database(uint8Array);
  _db.run('PRAGMA journal_mode=WAL');
  _db.run('PRAGMA foreign_keys=ON');
  await persistToIndexedDB();
  return _db;
}

/**
 * Generate a UUID v4.
 */
export function uuid() {
  return crypto.randomUUID();
}

/**
 * Get current ISO 8601 timestamp.
 */
export function now() {
  return new Date().toISOString();
}

/**
 * Start the autosave interval.
 */
function _startAutosave() {
  if (_autosaveTimer) clearInterval(_autosaveTimer);
  _autosaveTimer = setInterval(() => {
    persistToIndexedDB().catch(err =>
      console.warn('[db] Autosave failed:', err)
    );
  }, AUTOSAVE_INTERVAL_MS);
}

/**
 * Stop autosave and close the database.
 */
export function closeDB() {
  if (_autosaveTimer) {
    clearInterval(_autosaveTimer);
    _autosaveTimer = null;
  }
  if (_db) {
    persistToIndexedDB().catch(() => {});
    _db.close();
    _db = null;
  }
}

/**
 * Export all IndexedDB blobs as a map of key → base64 string.
 * Used for self-contained HTML export.
 */
export async function exportAllBlobs() {
  const idb = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE_BLOBS, 'readonly');
    const store = tx.objectStore(IDB_STORE_BLOBS);
    const request = store.getAllKeys();
    request.onsuccess = async () => {
      const keys = request.result;
      const blobs = {};
      for (const key of keys) {
        const data = await idbGet(IDB_STORE_BLOBS, key);
        if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
          const bytes = new Uint8Array(data);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          blobs[key] = btoa(binary);
        } else if (typeof data === 'string') {
          blobs[key] = btoa(data);
        }
      }
      resolve(blobs);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Import blobs from a map of key → base64 string.
 * Used for self-contained HTML import.
 */
export async function importAllBlobs(blobMap) {
  for (const [key, base64] of Object.entries(blobMap)) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    await storeBlob(key, bytes.buffer);
  }
}
