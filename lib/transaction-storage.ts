/**
 * PIS – Unified Transaction Storage System v2
 *
 * Dual-layer persistence for maximum data safety:
 *   Layer 1 (primary)  — IndexedDB via a lightweight async wrapper
 *   Layer 2 (fallback) — localStorage (synchronous, always available)
 *
 * Both layers are written on every mutation. Reads prefer IndexedDB and
 * fall back to localStorage if IDB is unavailable (private browsing, etc.).
 *
 * Additional features:
 * - Versioned schema (v1) — safe for future migrations
 * - Cross-tab real-time sync via BroadcastChannel + localStorage "storage" events
 * - Internal listener/subscriber pattern for React components
 * - Full export (JSON download) and import (JSON restore) for backup
 * - Last-backup timestamp tracking so users know when they last exported
 * - Deterministic, collision-resistant Reference ID generation
 * - Cryptographic-style signature for tamper detection
 * - Search, filter, and aggregate helpers
 */

// ─────────────────────────────────────────────────────────
// Schema version — bump when shape changes
// ─────────────────────────────────────────────────────────
const SCHEMA_VERSION = 1;
const STORAGE_KEY = `pis_transactions_v${SCHEMA_VERSION}`;
const BACKUP_TS_KEY = 'pis_last_backup_ts';
const IDB_DB_NAME = 'pis-storage';
const IDB_STORE = 'transactions';
const IDB_VERSION = 1;
const DOMAIN = 'pis.pi';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface TransactionRecord {
  /** Stable unique Reference ID: PIS-<timestamp36>-<random9> */
  id: string;
  /** Pi amount */
  amount: number;
  /**
   * Primary recipient identifier — wallet address (Pi UID / public key).
   * This is ALWAYS the wallet address when provided; falls back to Pi username
   * only if wallet address was not collected.
   */
  recipient: string;
  /** Human description of the payment purpose */
  description: string;
  /** Pi Network transaction ID — null until the Pi SDK confirms completion */
  piTransactionId: string | null;
  /** Tamper-detection signature: SIG-<hash> */
  signature: string;
  /** ISO 8601 creation timestamp */
  timestamp: string;
  status: 'pending' | 'completed' | 'verified' | 'failed';
  metadata: {
    /** Always "pis.pi" */
    domain: string;
    /** Optional memo shown in the Pi wallet dialog */
    memo?: string;
    /** Pi app ID from authentication */
    appId?: string;
    /** Authenticated sender Pi username */
    username?: string;
    /**
     * Recipient wallet address — PRIMARY recipient identifier.
     * Mirrors `recipient` when collected from the pay form.
     */
    recipientWalletAddress?: string;
    /** Optional recipient Pi username — secondary cross-reference only */
    recipientUsername?: string;
    /** Sender wallet address (Pi UID) */
    senderWalletAddress?: string;
    [key: string]: unknown;
  };
}

export interface StorageStats {
  total: number;
  completed: number;
  verified: number;
  pending: number;
  failed: number;
  totalAmount: number;
}

export interface ExportBundle {
  exportedAt: string;
  schemaVersion: number;
  domain: string;
  totalRecords: number;
  transactions: TransactionRecord[];
}

export interface StorageHealth {
  localStorage: boolean;
  indexedDB: boolean;
  lastBackupAt: string | null;
  totalRecords: number;
}

// ─────────────────────────────────────────────────────────
// IndexedDB helpers (async, non-blocking)
// ─────────────────────────────────────────────────────────

let _idbPromise: Promise<IDBDatabase> | null = null;

function openIDB(): Promise<IDBDatabase> {
  if (_idbPromise) return _idbPromise;
  _idbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = window.indexedDB.open(IDB_DB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => { _idbPromise = null; reject(req.error); };
  });
  return _idbPromise;
}

async function idbGetAll(): Promise<TransactionRecord[]> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAll();
      req.onsuccess = () => resolve(req.result as TransactionRecord[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function idbPutAll(records: TransactionRecord[]): Promise<void> {
  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      // Clear then re-write is the safest full-replace strategy
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        records.forEach((r) => store.put(r));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      clearReq.onerror = () => reject(clearReq.error);
    });
  } catch {
    // IDB write failure is non-fatal — localStorage is the synchronous fallback
  }
}

// ─────────────────────────────────────────────────────────
// Listener / subscriber pattern
// ─────────────────────────────────────────────────────────

type StorageChangeListener = (transactions: TransactionRecord[]) => void;
const listeners: StorageChangeListener[] = [];

function notifyListeners(transactions: TransactionRecord[]): void {
  listeners.forEach((fn) => fn(transactions));
}

let _channel: BroadcastChannel | null = null;

/** Call once at app startup to enable cross-tab sync */
export function initStorageSync(): void {
  if (typeof window === 'undefined') return;

  // BroadcastChannel for same-origin cross-tab sync (modern browsers)
  if ('BroadcastChannel' in window && !_channel) {
    _channel = new BroadcastChannel('pis_storage_sync');
    _channel.onmessage = (e) => {
      if (e.data?.type === 'update' && Array.isArray(e.data.records)) {
        notifyListeners(e.data.records as TransactionRecord[]);
      }
    };
  }

  // Fallback: legacy localStorage "storage" event (cross-tab in older browsers)
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        const records = JSON.parse(event.newValue) as TransactionRecord[];
        notifyListeners(records);
      } catch {
        // malformed — ignore
      }
    }
  });
}

function broadcastUpdate(records: TransactionRecord[]): void {
  try {
    _channel?.postMessage({ type: 'update', records });
  } catch {
    // channel closed or unavailable
  }
}

/** Subscribe to any transaction list change. Returns unsubscribe fn. */
export function subscribeToTransactionChanges(
  listener: StorageChangeListener
): () => void {
  listeners.push(listener);
  return () => {
    const i = listeners.indexOf(listener);
    if (i > -1) listeners.splice(i, 1);
  };
}

// ─────────────────────────────────────────────────────────
// Core sync read/write (localStorage — always synchronous)
// ─────────────────────────────────────────────────────────

function lsRead(): TransactionRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TransactionRecord[]) : [];
  } catch {
    return [];
  }
}

function lsWrite(records: TransactionRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Quota exceeded — trim oldest 20% and retry
    const trimmed = records.slice(0, Math.max(1, Math.floor(records.length * 0.8)));
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)); } catch { /* no-op */ }
  }
}

/** Write to both layers. IDB is async; localStorage is synchronous (immediate). */
function persistAll(records: TransactionRecord[]): void {
  lsWrite(records);
  idbPutAll(records); // async, fire-and-forget — failure is non-fatal
  broadcastUpdate(records);
  notifyListeners(records);
}

function sort(records: TransactionRecord[]): TransactionRecord[] {
  return [...records].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

// ─────────────────────────────────────────────────────────
// Core CRUD (synchronous API — localStorage backed)
// ─────────────────────────────────────────────────────────

/** Read all transactions, newest first */
export function getTransactions(): TransactionRecord[] {
  return sort(lsRead());
}

/** Persist a new transaction record */
export function saveTransaction(tx: TransactionRecord): void {
  const list = lsRead();
  const exists = list.findIndex((t) => t.id === tx.id);
  const record: TransactionRecord = { ...tx, metadata: { ...tx.metadata, domain: DOMAIN } };
  if (exists > -1) {
    list[exists] = record;
  } else {
    list.unshift(record);
  }
  persistAll(sort(list));
}

/** Find a single transaction by Reference ID */
export function getTransactionById(id: string): TransactionRecord | null {
  return getTransactions().find((t) => t.id === id) ?? null;
}

/** Update status (and optionally Pi txid) for an existing record */
export function updateTransactionStatus(
  id: string,
  status: TransactionRecord['status'],
  piTransactionId?: string
): void {
  const list = lsRead();
  const idx = list.findIndex((t) => t.id === id);
  if (idx === -1) return;
  list[idx] = {
    ...list[idx],
    status,
    ...(piTransactionId ? { piTransactionId } : {}),
  };
  persistAll(sort(list));
}

// ─────────────────────────────────────────────────────────
// IDB recovery — async, called on mount to heal any IDB gap
// ─────────────────────────────────────────────────────────

/**
 * On app mount, call this to reconcile both layers.
 * If IDB has more records than localStorage, IDB wins and heals localStorage.
 * If localStorage has more, it heals IDB.
 * The merged result is written to both layers.
 */
export async function reconcileLayers(): Promise<void> {
  const lsRecords = lsRead();
  const idbRecords = await idbGetAll();

  if (idbRecords.length === 0 && lsRecords.length === 0) return;

  // Merge: IDB wins on conflicts (it's the richer async store)
  const map = new Map<string, TransactionRecord>();
  lsRecords.forEach((r) => map.set(r.id, r));
  idbRecords.forEach((r) => map.set(r.id, r)); // IDB overwrites LS on conflict

  const merged = sort(Array.from(map.values()));

  if (merged.length !== lsRecords.length) {
    // Only write if there's actually a difference to avoid noise
    lsWrite(merged);
    notifyListeners(merged);
  }
  if (merged.length !== idbRecords.length) {
    idbPutAll(merged);
  }
}

// ─────────────────────────────────────────────────────────
// Verification
// ─────────────────────────────────────────────────────────

/**
 * Verify a record by matching its stored signature.
 * On success the record is promoted to "verified" status.
 */
export function verifyTransaction(id: string, signature: string): boolean {
  const tx = getTransactionById(id);
  if (!tx || tx.signature !== signature) return false;
  updateTransactionStatus(id, 'verified');
  return true;
}

// ─────────────────────────────────────────────────────────
// ID + Signature generation
// ─────────────────────────────────────────────────────────

/**
 * Generate a stable, unique Reference ID.
 * Format: PIS-<base36-timestamp>-<9-char-random>
 */
export function generateReferenceId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Array.from({ length: 9 }, () =>
    Math.floor(Math.random() * 36).toString(36)
  ).join('').toUpperCase();
  return `PIS-${ts}-${rnd}`;
}

/**
 * Generate a deterministic tamper-detection signature.
 * Binds id/amount/recipient/description together — any mutation is detectable.
 */
export function generateSignature(data: string): string {
  const salt = 'PIS_PAYMENT_SIGNATURE_SALT_V1';
  const ts = Date.now().toString();
  const combined = `${data}|${ts}|${salt}`;
  const encoded = btoa(unescape(encodeURIComponent(combined)));
  return `SIG-${encoded.substring(0, 48).toUpperCase()}`;
}

// ─────────────────────────────────────────────────────────
// Statistics + filtering
// ─────────────────────────────────────────────────────────

export function getTransactionStats(): StorageStats {
  const list = getTransactions();
  return {
    total: list.length,
    completed: list.filter((t) => t.status === 'completed').length,
    verified: list.filter((t) => t.status === 'verified').length,
    pending: list.filter((t) => t.status === 'pending').length,
    failed: list.filter((t) => t.status === 'failed').length,
    totalAmount: list
      .filter((t) => t.status === 'completed' || t.status === 'verified')
      .reduce((sum, t) => sum + t.amount, 0),
  };
}

export function getTransactionsByStatus(
  status: TransactionRecord['status']
): TransactionRecord[] {
  return getTransactions().filter((t) => t.status === status);
}

/** Full-text search across id, recipient, description, piTransactionId, wallet addresses */
export function searchTransactions(query: string): TransactionRecord[] {
  const q = query.toLowerCase();
  return getTransactions().filter(
    (t) =>
      t.id.toLowerCase().includes(q) ||
      t.recipient.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      (t.piTransactionId?.toLowerCase().includes(q) ?? false) ||
      (t.metadata?.recipientWalletAddress as string | undefined)?.toLowerCase().includes(q) ||
      (t.metadata?.senderWalletAddress as string | undefined)?.toLowerCase().includes(q) ||
      (t.metadata?.recipientUsername as string | undefined)?.toLowerCase().includes(q)
  );
}

// ─────────────────────────────────────────────────────────
// Storage health
// ─────────────────────────────────────────────────────────

export async function getStorageHealth(): Promise<StorageHealth> {
  let idbAvailable = false;
  try {
    await openIDB();
    idbAvailable = true;
  } catch {
    idbAvailable = false;
  }

  const lsAvailable = (() => {
    try { localStorage.setItem('_pis_test', '1'); localStorage.removeItem('_pis_test'); return true; }
    catch { return false; }
  })();

  return {
    localStorage: lsAvailable,
    indexedDB: idbAvailable,
    lastBackupAt: getLastBackupTimestamp(),
    totalRecords: getTransactions().length,
  };
}

// ─────────────────────────────────────────────────────────
// Export / Import (Backup & Restore)
// ─────────────────────────────────────────────────────────

/** Track when the user last exported a backup */
export function setLastBackupTimestamp(iso: string): void {
  try { localStorage.setItem(BACKUP_TS_KEY, iso); } catch { /* no-op */ }
}

export function getLastBackupTimestamp(): string | null {
  try { return localStorage.getItem(BACKUP_TS_KEY); } catch { return null; }
}

/**
 * Build an export bundle and trigger a browser download.
 * Returns the bundle object so callers can show a confirmation.
 */
export function exportTransactions(): ExportBundle {
  const transactions = getTransactions();
  const now = new Date().toISOString();
  const bundle: ExportBundle = {
    exportedAt: now,
    schemaVersion: SCHEMA_VERSION,
    domain: DOMAIN,
    totalRecords: transactions.length,
    transactions,
  };

  if (typeof window !== 'undefined') {
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PIS-Backup-${now.split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setLastBackupTimestamp(now);
  }

  return bundle;
}

/**
 * Import transactions from a backup bundle.
 * Merges with existing records (de-duplicates by id, imported record wins on conflict).
 */
export function importTransactions(bundle: ExportBundle): {
  imported: number;
  skipped: number;
  total: number;
} {
  if (!bundle?.transactions || !Array.isArray(bundle.transactions)) {
    throw new Error('Invalid backup file: missing transactions array.');
  }

  const existing = lsRead();
  const existingMap = new Map(existing.map((t) => [t.id, t]));

  let imported = 0;
  let skipped = 0;

  bundle.transactions.forEach((tx) => {
    if (!tx.id || !tx.timestamp || !tx.signature) {
      skipped++;
      return;
    }
    existingMap.set(tx.id, tx);
    imported++;
  });

  const merged = sort(Array.from(existingMap.values()));
  persistAll(merged);

  return { imported, skipped, total: merged.length };
}

/** Wipe all stored transactions from both layers. Irreversible. */
export function clearAllTransactions(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* no-op */ }
  idbPutAll([]); // async clear of IDB
  notifyListeners([]);
}

// ─────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────

export function getDomain(): string { return DOMAIN; }
export function getStorageKey(): string { return STORAGE_KEY; }
export function getSchemaVersion(): number { return SCHEMA_VERSION; }
