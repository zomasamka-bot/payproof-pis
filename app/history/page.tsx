'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Search, Circle, ChevronRight, ChevronDown, ChevronUp,
  TrendingUp, Zap, Download, Copy, Check, Wallet, Hash,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AppHeader } from '@/components/app-header';
import { BottomNav } from '@/components/bottom-nav';
import { StatusBadge } from '@/components/status-badge';
import {
  getTransactions,
  getTransactionStats,
  initStorageSync,
  subscribeToTransactionChanges,
  searchTransactions,
  type TransactionRecord,
} from '@/lib/transaction-storage';

type Filter = 'all' | 'completed' | 'verified' | 'pending' | 'failed';

const filterLabels: { key: Filter; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'completed', label: 'Completed' },
  { key: 'verified',  label: 'Verified'  },
  { key: 'pending',   label: 'Pending'   },
  { key: 'failed',    label: 'Failed'    },
];

// ── Copyable inline value ──────────────────────────────────────────
function CopyableValue({ value, truncated }: { value: string; truncated?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <span className="inline-flex items-center gap-1 max-w-full">
      <span className="font-mono text-xs break-all leading-relaxed">{truncated ?? value}</span>
      <button
        onClick={copy}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Copy"
      >
        {copied
          ? <Check className="h-3 w-3 text-green-500" />
          : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}

// ── Expanded detail row ────────────────────────────────────────────
function DetailRow({ label, value, mono = false, copyable = false }: {
  label: string; value: string; mono?: boolean; copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</span>
        {copyable && (
          <button
            onClick={copy}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`Copy ${label}`}
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </button>
        )}
      </div>
      <span className={`text-xs break-all leading-snug ${mono ? 'font-mono' : 'font-medium'}`}>
        {value}
      </span>
    </div>
  );
}

// ── Single transaction row ─────────────────────────────────────────
function TxRow({ tx }: { tx: TransactionRecord }) {
  const [expanded, setExpanded] = useState(false);

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  const fmtFull = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

  const wallet =
    (tx.metadata?.recipientWalletAddress as string | undefined) ?? tx.recipient;
  const walletShort =
    wallet.length > 22 ? `${wallet.slice(0, 10)}…${wallet.slice(-8)}` : wallet;

  const recipientUsername = tx.metadata?.recipientUsername as string | undefined;
  const senderWallet = tx.metadata?.senderWalletAddress as string | undefined;
  const senderUsername = tx.metadata?.username as string | undefined;
  const memo = tx.metadata?.memo as string | undefined;

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    setExpanded((v) => !v);
  };

  return (
    <Card className="hover:border-accent/40 transition-colors overflow-hidden">
      {/* Summary row — tapping navigates to receipt */}
      <Link href={`/receipt/${tx.id}`}>
        <CardContent className="p-3.5">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {/* Description */}
              <p className="text-sm font-medium truncate">{tx.description}</p>

              {/* Reference ID — always visible */}
              <div className="flex items-center gap-1 mt-1">
                <Hash className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                <CopyableValue
                  value={tx.id}
                  truncated={tx.id.length > 28 ? `${tx.id.slice(0, 28)}…` : tx.id}
                />
              </div>

              {/* Wallet address */}
              <div className="flex items-center gap-1 mt-0.5">
                <Wallet className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                <CopyableValue value={wallet} truncated={walletShort} />
              </div>

              {/* Status + date */}
              <div className="flex items-center gap-2 mt-1.5">
                <StatusBadge status={tx.status} />
                <span className="text-xs text-muted-foreground/50 font-mono">
                  {fmtDate(tx.timestamp)}
                </span>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-1.5 ml-1">
              <p className="text-sm font-semibold font-mono">{fmt(tx.amount)} π</p>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
            </div>
          </div>
        </CardContent>
      </Link>

      {/* Expand toggle */}
      <div className="border-t border-border/60">
        <button
          onClick={toggle}
          className="w-full flex items-center justify-between px-3.5 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <span>{expanded ? 'Hide details' : 'Show full details'}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Expanded full detail panel */}
      {expanded && (
        <div className="border-t border-border/60 bg-muted/20 px-3.5 py-3.5 space-y-3">
          <DetailRow label="Reference ID" value={tx.id} mono copyable />
          <Separator />

          {/* Recipient */}
          <DetailRow label="Recipient Wallet Address" value={wallet} mono copyable />
          {recipientUsername && (
            <DetailRow label="Recipient Pi Username" value={`@${recipientUsername}`} mono />
          )}
          <Separator />

          {/* Sender */}
          {senderWallet && (
            <DetailRow label="Sender Wallet Address" value={senderWallet} mono copyable />
          )}
          {senderUsername && (
            <DetailRow label="Sender Pi Username" value={`@${senderUsername}`} mono />
          )}
          {(senderWallet || senderUsername) && <Separator />}

          {/* Payment */}
          <DetailRow label="Amount" value={`${fmt(tx.amount)} π`} mono />
          <DetailRow label="Description" value={tx.description} />
          {memo && <DetailRow label="Memo" value={memo} />}
          <Separator />

          {/* Technical */}
          <DetailRow label="Timestamp" value={fmtFull(tx.timestamp)} />
          {tx.piTransactionId && (
            <DetailRow label="Pi Transaction ID" value={tx.piTransactionId} mono copyable />
          )}
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Status</span>
            <StatusBadge status={tx.status} />
          </div>
          <Separator />

          {/* Signature */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Signature</span>
            </div>
            <p className="text-xs font-mono bg-background rounded border border-border px-2.5 py-2 break-all leading-relaxed text-muted-foreground">
              {tx.signature}
            </p>
          </div>

          {/* Link to full receipt */}
          <Link href={`/receipt/${tx.id}`}>
            <Button size="sm" variant="outline" className="w-full mt-1 bg-transparent text-xs">
              Open Full Receipt
              <ChevronRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      )}
    </Card>
  );
}

// ── Page ───────────────────────────────────────────────────────────
export default function HistoryPage() {
  const [all, setAll] = useState<TransactionRecord[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [stats, setStats] = useState({
    total: 0, completed: 0, verified: 0, pending: 0, failed: 0, totalAmount: 0,
  });

  const refresh = () => {
    setAll(getTransactions());
    setStats(getTransactionStats());
  };

  useEffect(() => {
    initStorageSync();
    refresh();
    const unsub = subscribeToTransactionChanges(() => refresh());
    return () => unsub();
  }, []);

  const displayed = useMemo(() => {
    let list = query.trim() ? searchTransactions(query) : all;
    if (filter !== 'all') list = list.filter((t) => t.status === filter);
    return list;
  }, [all, query, filter]);

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  // Group by calendar date
  const grouped = useMemo(() => {
    const map = new Map<string, TransactionRecord[]>();
    displayed.forEach((tx) => {
      const key = new Date(tx.timestamp).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    });
    return Array.from(map.entries());
  }, [displayed]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-5 pb-28 space-y-4">

        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">History</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-mono">{all.length} records</span>
            <Link href="/export" className="inline-flex items-center gap-1 text-xs text-accent hover:underline font-medium">
              <Download className="h-3 w-3" />
              Backup
            </Link>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-2">
          <Card>
            <CardContent className="p-3">
              <TrendingUp className="h-3.5 w-3.5 text-accent mb-1.5" />
              <p className="text-xs text-muted-foreground leading-none">Total Sent</p>
              <p className="text-base font-semibold font-mono mt-1">{fmt(stats.totalAmount)} π</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <p className="text-xs text-muted-foreground leading-none">Done</p>
              </div>
              <p className="text-base font-semibold font-mono mt-1">{stats.completed + stats.verified}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <p className="text-xs text-muted-foreground leading-none">Pending</p>
              </div>
              <p className="text-base font-semibold font-mono mt-1">{stats.pending}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by Ref ID, wallet, description…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 text-sm font-mono"
          />
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
          {filterLabels.map(({ key, label }) => {
            const count = key === 'all' ? stats.total : (stats[key as keyof typeof stats] as number);
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
                  filter === key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground'
                }`}
              >
                {label}
                {count > 0 && (
                  <span className="ml-1.5 opacity-60">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Transaction list */}
        {displayed.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
              <Circle className="h-8 w-8 text-muted-foreground/30" />
              <div>
                <p className="text-sm text-muted-foreground">
                  {query
                    ? 'No transactions match your search'
                    : filter !== 'all'
                    ? `No ${filter} transactions`
                    : 'No transactions yet'}
                </p>
                {!query && filter === 'all' && (
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    Make your first payment to see it here
                  </p>
                )}
              </div>
              {!query && filter === 'all' && (
                <Link href="/pay">
                  <Button size="sm" className="mt-1">
                    <Zap className="h-3.5 w-3.5 mr-1.5" />
                    Make First Payment
                  </Button>
                </Link>
              )}
              {(query || filter !== 'all') && (
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-transparent"
                  onClick={() => { setQuery(''); setFilter('all'); }}
                >
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {grouped.map(([date, txs]) => (
              <div key={date}>
                <p className="text-xs text-muted-foreground font-medium mb-2 px-0.5">{date}</p>
                <div className="space-y-2">
                  {txs.map((tx) => <TxRow key={tx.id} tx={tx} />)}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground/40 font-mono pt-1">
          pis.pi · Testnet · No custody
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
