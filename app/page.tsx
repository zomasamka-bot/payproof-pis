'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Zap, Clock, ShieldCheck, TrendingUp,
  Circle, FlaskConical, Wallet, Copy, Check, ChevronRight,
  Link2, ArrowUpRight, Download, Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AppHeader } from '@/components/app-header';
import { BottomNav } from '@/components/bottom-nav';
import { StatusBadge } from '@/components/status-badge';
import { PiConnectionDiagnostics } from '@/components/pi-connection-diagnostics';
import { usePiAuth } from '@/contexts/pi-auth-context';
import {
  getTransactions,
  getTransactionStats,
  initStorageSync,
  reconcileLayers,
  subscribeToTransactionChanges,
  type TransactionRecord,
} from '@/lib/transaction-storage';

export default function DashboardPage() {
  const { userData, walletAddress, isAuthenticated } = usePiAuth();
  // userData is { uid, username } from Pi SDK authenticate() result
  const [recent, setRecent] = useState<TransactionRecord[]>([]);
  const [stats, setStats] = useState({
    total: 0, completed: 0, verified: 0, pending: 0, failed: 0, totalAmount: 0,
  });
  const [walletCopied, setWalletCopied] = useState(false);
  const [walletExpanded, setWalletExpanded] = useState(false);

  const refresh = () => {
    setRecent(getTransactions().slice(0, 5));
    setStats(getTransactionStats());
  };

  useEffect(() => {
    initStorageSync();
    reconcileLayers().then(() => refresh());
    const unsub = subscribeToTransactionChanges(() => refresh());
    return () => unsub();
  }, []);

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  const truncate = (str: string, head = 10, tail = 8) =>
    str.length > head + tail + 3
      ? `${str.slice(0, head)}…${str.slice(-tail)}`
      : str;

  const copyWallet = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setWalletCopied(true);
    setTimeout(() => setWalletCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader hidePayButton />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-5 pb-28 space-y-4">

        {/* Authentication status banner — shows real Pi connection */}
        {isAuthenticated && (
          <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                  ✓ Connected to Pi Network
                </p>
                <p className="text-xs text-green-700 dark:text-green-200 mt-0.5">
                  Real Pi UID: <span className="font-mono">{walletAddress?.slice(0, 16)}…</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Not authenticated — shows what's needed */}
        {!isAuthenticated && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">!</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Not authenticated
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-200 mt-0.5">
                  Open this app inside Pi Browser to connect your real Pi wallet.
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-3 py-2.5">
          <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            <span className="font-semibold">Testnet mode.</span> Payments run on Pi Testnet — no real Pi is transferred.
          </p>
        </div>

        {/* Pi Browser required banner — shown on Vercel / standard browser */}
        {!isAuthenticated && (
          <div className="rounded-xl border border-border bg-muted/50 px-4 py-4 space-y-2">
            <p className="text-sm font-semibold">Open in Pi Browser to activate</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              PayProof PIS requires Pi Browser for authentication and payments.
              Open <span className="font-mono text-foreground">https://payproof-pis.vercel.app</span> inside
              the Pi Network app to get started.
            </p>
          </div>
        )}

        {/* Connection Diagnostics — shows SDK load status and manual trigger */}
        {!isAuthenticated && <PiConnectionDiagnostics />}

        {/* ── Wallet Identity Card ── */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">

            {/* Header row */}
            <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  isAuthenticated ? 'bg-primary/10' : 'bg-muted'
                }`}>
                  <Wallet className={`h-5 w-5 ${isAuthenticated ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {userData?.username ? `@${userData.username}` : (userData?.uid ? `uid:${userData.uid.slice(0, 8)}…` : 'Pi Wallet')}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-block w-2 h-2 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                    <p className="text-xs text-muted-foreground">
                      {isAuthenticated ? 'Real Pi UID from SDK' : 'Not connected'}
                    </p>
                  </div>
                </div>
              </div>

              {/* View Wallet Details button — disclosure toggle only */}
              <Button
                size="sm"
                variant={walletExpanded ? 'secondary' : 'default'}
                className="shrink-0 font-semibold"
                onClick={() => setWalletExpanded((v) => !v)}
              >
                {walletExpanded ? (
                  <>
                    <Link2 className="h-3.5 w-3.5 mr-1.5" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <Wallet className="h-3.5 w-3.5 mr-1.5" />
                    View Details
                  </>
                )}
              </Button>
            </div>

            {/* Expanded wallet panel */}
            {walletExpanded && (
              <>
                <Separator />
                <div className="px-4 py-4 space-y-3 bg-muted/20">

                  {/* Wallet Address row */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">
                      Pi UID (Real Wallet Address from Pi SDK)
                    </p>
                    <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2.5">
                      <p className="text-xs font-mono flex-1 break-all leading-relaxed text-foreground">
                        {walletAddress ?? '—'}
                      </p>
                      <button
                        onClick={copyWallet}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors ml-1"
                        aria-label="Copy wallet address"
                      >
                        {walletCopied
                          ? <Check className="h-3.5 w-3.5 text-green-500" />
                          : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Network / Domain chips */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-background border border-border rounded-lg px-3 py-2.5">
                      <p className="text-muted-foreground text-xs">Network</p>
                      <p className="font-semibold mt-0.5">Pi Testnet</p>
                    </div>
                    <div className="bg-background border border-border rounded-lg px-3 py-2.5">
                      <p className="text-muted-foreground text-xs">Service Domain</p>
                      <p className="font-mono font-semibold mt-0.5">pis.pi</p>
                    </div>
                  </div>

                  {/* Identity note */}
                  <p className="text-xs text-muted-foreground/70 leading-relaxed">
                    Your Pi UID is the on-chain identity used as your wallet address within the Pi Network ecosystem.
                    It is recorded in every transaction receipt for governance and compliance.
                  </p>
                </div>
              </>
            )}

            {/* Pay & Record CTA strip */}
            <Separator />
            <Link href="/pay" className="block">
              <div className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/50 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Zap className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Pay &amp; Record</p>
                    <p className="text-xs text-muted-foreground">Execute payment + auto-receipt</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </Link>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-accent" />
                <span className="text-xs text-muted-foreground">Total Sent</span>
              </div>
              <p className="text-xl font-semibold font-mono">{fmt(stats.totalAmount)} π</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stats.total} transactions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                <span className="text-xs text-muted-foreground">Verified</span>
              </div>
              <p className="text-xl font-semibold font-mono">{stats.verified}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stats.completed} completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/history" className="block">
            <Card className="hover:border-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4">
                <Clock className="h-5 w-5 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">History</p>
                <p className="text-xs text-muted-foreground">All transactions</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/verify" className="block">
            <Card className="hover:border-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4">
                <ShieldCheck className="h-5 w-5 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Verify</p>
                <p className="text-xs text-muted-foreground">Check by Ref ID</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent transactions */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Recent</h3>
            {recent.length > 0 && (
              <Link href="/history" className="text-xs text-accent hover:underline">
                View all
              </Link>
            )}
          </div>

          {recent.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
                <Circle className="h-8 w-8 text-muted-foreground/30" />
                <div>
                  <p className="text-sm text-muted-foreground">No transactions yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    Connect your wallet and make your first payment
                  </p>
                </div>
                <Link href="/pay">
                  <Button size="sm" className="mt-1">
                    <Zap className="h-3.5 w-3.5 mr-1.5" />
                    Make First Payment
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {recent.map((tx) => {
                const wallet =
                  (tx.metadata?.recipientWalletAddress as string | undefined) ??
                  tx.recipient;
                const walletShort =
                  wallet.length > 22
                    ? `${wallet.slice(0, 10)}…${wallet.slice(-8)}`
                    : wallet;
                return (
                  <Link key={tx.id} href={`/receipt/${tx.id}`}>
                    <Card className="hover:border-accent/40 transition-colors cursor-pointer">
                      <CardContent className="p-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{tx.description}</p>
                            {/* Reference ID — always visible */}
                            <div className="flex items-center gap-1 mt-0.5">
                              <Hash className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                              <p className="text-xs font-mono text-muted-foreground truncate">
                                {tx.id}
                              </p>
                            </div>
                            {/* Wallet address — primary */}
                            <div className="flex items-center gap-1 mt-0.5">
                              <Wallet className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                              <p className="text-xs font-mono text-muted-foreground truncate">
                                {walletShort}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground/50 font-mono mt-1">
                              {fmtTime(tx.timestamp)}
                            </p>
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-1.5">
                            <p className="text-sm font-semibold font-mono">{fmt(tx.amount)} π</p>
                            <StatusBadge status={tx.status} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <p className="text-center text-xs text-muted-foreground/40 font-mono pt-1">
          pis.pi · Testnet · No custody
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
