export interface SignalRecord {
  id: string;
  paymentReference: string;
  signalType: string;
  description: string;
  signature: string;
  timestamp: string;
  status: 'pending' | 'verified' | 'signed';
  metadata?: Record<string, string>;
  domain: string; // Domain identity
}

const STORAGE_KEY = 'pis_signals';
const DOMAIN = 'pis.pi';

// Storage event listeners for cross-tab synchronization
type StorageChangeListener = (signals: SignalRecord[]) => void;
const listeners: StorageChangeListener[] = [];

// Setup cross-tab sync
export function initStorageSync(): void {
  if (typeof window === 'undefined') return;
  
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      const signals = JSON.parse(event.newValue) as SignalRecord[];
      listeners.forEach(listener => listener(signals));
    }
  });
}

export function subscribeToStorageChanges(listener: StorageChangeListener): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
}

export function saveSignal(signal: SignalRecord): void {
  const signals = getSignals();
  const signalWithDomain = { ...signal, domain: DOMAIN };
  signals.push(signalWithDomain);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(signals));
  // Notify internal listeners
  listeners.forEach(listener => listener(signals));
}

export function getSignals(): SignalRecord[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function getSignalById(id: string): SignalRecord | null {
  const signals = getSignals();
  return signals.find(s => s.id === id) || null;
}

export function verifySignal(id: string, signature: string): boolean {
  const signal = getSignalById(id);
  if (signal && signal.signature === signature) {
    // Update status to verified
    updateSignalStatus(id, 'verified');
    return true;
  }
  return false;
}

export function updateSignalStatus(id: string, status: 'pending' | 'verified' | 'signed'): void {
  const signals = getSignals();
  const index = signals.findIndex(s => s.id === id);
  if (index !== -1) {
    signals[index].status = status;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(signals));
    // Notify internal listeners for cross-component sync
    listeners.forEach(listener => listener(signals));
  }
}

export function getDomain(): string {
  return DOMAIN;
}

export function getStorageKey(): string {
  return STORAGE_KEY;
}

export function generateSignature(data: string): string {
  // Cryptographic-style signature generation for authentication
  // Note: This is for information verification only, not financial transactions
  const timestamp = Date.now().toString();
  const combined = data + timestamp + 'PIS_SIGNATURE_SALT';
  const hash = btoa(combined);
  return `SIG-${hash.substring(0, 32).toUpperCase()}`;
}

export function generateReferenceId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `PIS-${timestamp}-${random}`.toUpperCase();
}
