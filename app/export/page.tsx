'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Download, Upload, Trash2, AlertTriangle,
  FileJson, CheckCircle, Info, Database,
  HardDrive, Layers, Clock, ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AppHeader } from '@/components/app-header';
import { BottomNav } from '@/components/bottom-nav';
import {
  getTransactions,
  getTransactionStats,
  exportTransactions,
  importTransactions,
  clearAllTransactions,
  initStorageSync,
  reconcileLayers,
  subscribeToTransactionChanges,
  getSchemaVersion,
  getStorageHealth,
  getLastBackupTimestamp,
  type ExportBundle,
  type StorageStats,
  type StorageHealth,
} from '@/lib/transaction-storage';

type ImportState =
  | { phase: 'idle' }
  | { phase: 'parsing' }
  | { phase: 'success'; imported: number; skipped: number; total: number }
  | { phase: 'error'; message: string };

type ClearState = 'idle' | 'confirm' | 'done';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function backupAge(iso: string): { label: string; urgent: boolean } {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return { label: 'Today', urgent: false };
  if (days === 1) return { label: '1 day ago', urgent: false };
  if (days < 7) return { label: `${days} days ago`, urgent: false };
  if (days < 30) return { label: `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`, urgent: true };
  return { label: `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`, urgent: true };
}

export default function ExportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState<StorageStats>({
    total: 0, completed: 0, verified: 0, pending: 0, failed: 0, totalAmount: 0,
  });
  const [health, setHealth] = useState<StorageHealth | null>(null);
  const [importState, setImportState] = useState<ImportState>({ phase: 'idle' });
  const [clearState, setClearState] = useState<ClearState>('idle');
  const [exportDone, setExportDone] = useState(false);

  const refresh = async () => {
    setStats(getTransactionStats());
    const h = await getStorageHealth();
    setHealth(h);
  };

  useEffect(() => {
    initStorageSync();
    reconcileLayers().then(() => refresh());
    const unsub = subscribeToTransactionChanges(() => refresh());
    return () => unsub();
  }, []);

  const handleExport = () => {
    exportTransactions();
    setExportDone(true);
    setTimeout(() => { setExportDone(false); refresh(); }, 3000);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportState({ phase: 'parsing' });
    try {
      const text = await file.text();
      const bundle = JSON.parse(text) as ExportBundle;
      const result = importTransactions(bundle);
      setImportState({ phase: 'success', imported: result.imported, skipped: result.skipped, total: result.total });
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not parse the backup file. Please use a valid PIS export.';
      setImportState({ phase: 'error', message: msg });
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClearConfirm = () => {
    clearAllTransactions();
    setClearState('done');
    refresh();
    setTimeout(() => setClearState('idle'), 4000);
  };

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  const lastBackup = health?.lastBackupAt ?? getLastBackupTimestamp();
  const age = lastBackup ? backupAge(lastBackup) : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader showBackButton backLink="/history" backText="History" />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-5 pb-28 space-y-4">

        <div>
          <h2 className="text-xl font-semibold">Backup &amp; Restore</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Export records as JSON or restore from a previous backup. All data is stored
            on this device only — regular exports prevent data loss.
          </p>
        </div>

        {/* Backup reminder banner — shown when last backup is old or missing */}
        {(age?.urgent || !lastBackup) && stats.total > 0 && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-3.5 py-3">
            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                {lastBackup ? `Last backup: ${age!.label}` : 'No backup yet'}
              </p>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                {stats.total} record{stats.total !== 1 ? 's' : ''} in storage with no recent backup.
                Export now to prevent data loss if browser storage is cleared.
              </p>
            </div>
            <Button size="sm" className="shrink-0 text-xs" onClick={handleExport}>
              Export Now
            </Button>
          </div>
        )}

        {/* Storage health */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Storage Health
              </span>
            </div>
            <Separator />

            {/* Two-layer status */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${health?.localStorage ? 'bg-green-500' : 'bg-red-500'}`} />
                <div>
                  <p className="text-xs font-medium">localStorage</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {health?.localStorage ? 'Available' : 'Unavailable'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${health?.indexedDB ? 'bg-green-500' : 'bg-amber-400'}`} />
                <div>
                  <p className="text-xs font-medium">IndexedDB</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {health?.indexedDB ? 'Available' : 'Unavailable'}
                  </p>
                </div>
              </div>
            </div>

            {/* Record / backup summary */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div>
                <p className="text-xs text-muted-foreground">Total Records</p>
                <p className="text-lg font-semibold font-mono mt-0.5">{stats.total}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-lg font-semibold font-mono mt-0.5">
                  {stats.completed + stats.verified}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Sent</p>
                <p className="text-lg font-semibold font-mono mt-0.5">{fmt(stats.totalAmount)} π</p>
              </div>
            </div>

            <Separator />

            {/* Last backup row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Last backup</p>
              </div>
              <div className="flex items-center gap-1.5">
                {lastBackup ? (
                  <>
                    <span className={`text-xs font-medium ${age?.urgent ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                      {age?.label}
                    </span>
                    <span className="text-xs text-muted-foreground/50">
                      ({fmtDate(lastBackup)})
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Never</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Storage key</span>
              <span className="font-mono">pis_transactions_v{getSchemaVersion()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Export */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Export / Download Backup
              </span>
            </div>
            <Separator />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Downloads all {stats.total} transaction record{stats.total !== 1 ? 's' : ''} as a
              single JSON file. Each record includes: Reference ID, recipient wallet address,
              sender wallet address, Pi username (if set), amount, description, Pi Transaction ID,
              tamper-detection signature, timestamp, and status.
            </p>
            {stats.total > 0 && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  <p className="text-muted-foreground">Completed + Verified</p>
                  <p className="font-semibold font-mono mt-0.5">{stats.completed + stats.verified} records</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  <p className="text-muted-foreground">Total Pi Sent</p>
                  <p className="font-semibold font-mono mt-0.5">{stats.totalAmount.toFixed(4)} π</p>
                </div>
              </div>
            )}
            <Button
              className="w-full font-semibold"
              onClick={handleExport}
              disabled={stats.total === 0}
            >
              {exportDone ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Downloaded — Backup Updated
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download JSON Backup
                </>
              )}
            </Button>
            {stats.total === 0 && (
              <p className="text-xs text-muted-foreground text-center">
                No transactions to export yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Import */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Import / Restore Backup
              </span>
            </div>
            <Separator />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Select a PIS JSON backup file to merge its records into local storage.
              Existing records are preserved — imported records update any conflicts by Reference ID.
              Both storage layers are updated.
            </p>

            {importState.phase === 'success' && (
              <div className="flex items-start gap-2.5 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-3 py-2.5">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <div className="text-xs text-green-700 dark:text-green-300 space-y-0.5">
                  <p className="font-semibold">Import successful</p>
                  <p>
                    {importState.imported} record{importState.imported !== 1 ? 's' : ''} imported
                    {importState.skipped > 0 && `, ${importState.skipped} skipped (invalid)`}.
                    Total in storage: {importState.total}.
                  </p>
                </div>
              </div>
            )}

            {importState.phase === 'error' && (
              <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-xs text-destructive space-y-0.5">
                  <p className="font-semibold">Import failed</p>
                  <p>{importState.message}</p>
                </div>
              </div>
            )}

            {importState.phase === 'parsing' && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                Parsing backup file…
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full bg-transparent"
              onClick={() => { setImportState({ phase: 'idle' }); fileRef.current?.click(); }}
            >
              <FileJson className="h-4 w-4 mr-2" />
              Select Backup File (.json)
            </Button>
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              <span className="text-xs font-semibold uppercase tracking-wider text-destructive">
                Clear All Data
              </span>
            </div>
            <Separator />

            {clearState === 'done' ? (
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                All records removed from localStorage and IndexedDB.
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Permanently removes all transaction records from both storage layers on this
                  device. This cannot be undone. Export a backup first.
                </p>
                {clearState === 'confirm' ? (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <p className="text-xs text-destructive leading-relaxed">
                        This will permanently delete all {stats.total} record{stats.total !== 1 ? 's' : ''} from
                        both localStorage and IndexedDB. Are you sure?
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="destructive" className="flex-1" onClick={handleClearConfirm}>
                        Yes, Delete All
                      </Button>
                      <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setClearState('idle')}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full border-destructive/40 text-destructive hover:bg-destructive/5 bg-transparent"
                    onClick={() => setClearState('confirm')}
                    disabled={stats.total === 0}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All Records
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Info */}
        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Every transaction is written to both IndexedDB (primary) and localStorage (fallback)
            simultaneously. If either layer fails, the other preserves the data. Export regularly
            to keep a permanent copy — imported records are merged and de-duplicated by Reference ID.
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground/40 font-mono pt-1">
          pis.pi · Dual-layer storage · No cloud sync
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
