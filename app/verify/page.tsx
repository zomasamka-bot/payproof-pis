'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Shield, CheckCircle, XCircle, Copy, ArrowRight, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AppHeader } from '@/components/app-header';
import { BottomNav } from '@/components/bottom-nav';
import { StatusBadge } from '@/components/status-badge';
import {
  getTransactionById,
  verifyTransaction,
  initStorageSync,
  subscribeToTransactionChanges,
  type TransactionRecord,
} from '@/lib/transaction-storage';

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm break-all leading-snug ${mono ? 'font-mono' : 'font-medium'}`}>{value}</span>
    </div>
  );
}

// Inner component that uses useSearchParams — must be inside Suspense
function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [refId, setRefId] = useState(searchParams.get('id') ?? '');
  const [sig, setSig] = useState(searchParams.get('sig') ?? '');

  const [result, setResult] = useState<{
    verified: boolean;
    tx: TransactionRecord | null;
    attempted: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const runVerify = useCallback((id: string, signature: string) => {
    if (!id.trim() || !signature.trim()) return;
    const tx = getTransactionById(id.trim());
    const isVerified = tx ? verifyTransaction(id.trim(), signature.trim()) : false;
    const updated = getTransactionById(id.trim());
    setResult({ verified: isVerified, tx: updated, attempted: true });
  }, []);

  useEffect(() => {
    initStorageSync();
    const unsub = subscribeToTransactionChanges(() => {
      if (result?.tx) {
        const updated = getTransactionById(result.tx.id);
        setResult((prev) => prev ? { ...prev, tx: updated } : prev);
      }
    });

    const urlId = searchParams.get('id');
    const urlSig = searchParams.get('sig');
    if (urlId && urlSig) {
      runVerify(urlId, urlSig);
    }

    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runVerify(refId, sig);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  const isFormValid = refId.trim().length > 0 && sig.trim().length > 0;

  return (
    <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-5 pb-28 space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Verify Transaction</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Confirm the authenticity of any PIS receipt using its Reference ID and Signature.
        </p>
      </div>

      {/* Verify form */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Verification Input
            </span>
          </div>
          <Separator />

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="refId" className="text-sm font-medium">
                Reference ID
              </Label>
              <Input
                id="refId"
                placeholder="e.g. PIS-M0WYB4EK1-ABCDEFGHI"
                value={refId}
                onChange={(e) => setRefId(e.target.value)}
                className="font-mono text-sm"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sig" className="text-sm font-medium">
                Signature
              </Label>
              <Input
                id="sig"
                placeholder="SIG-XXXXXXXX…"
                value={sig}
                onChange={(e) => setSig(e.target.value)}
                className="font-mono text-sm"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={!isFormValid}
              className="w-full font-semibold"
            >
              <Search className="h-4 w-4 mr-2" />
              Verify Record
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Result */}
      {result && result.attempted && (
        <Card className={result.verified ? 'border-green-300 dark:border-green-800' : 'border-destructive/40'}>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${
                result.verified ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
              }`}>
                {result.verified
                  ? <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  : <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                }
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">
                  {result.verified ? 'Record Verified' : 'Verification Failed'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {result.verified
                    ? 'Signature matches. This is an authentic PIS record.'
                    : result.tx
                      ? 'Signature does not match this Reference ID.'
                      : 'No record found for this Reference ID.'}
                </p>
              </div>
            </div>

            {result.verified && result.tx && (
              <>
                <Separator />
                <div className="space-y-3">
                  <DetailRow label="Reference ID" value={result.tx.id} mono />
                  <DetailRow label="Amount" value={`${fmt(result.tx.amount)} π`} mono />
                  <DetailRow
                    label="Recipient Wallet Address"
                    value={
                      (result.tx.metadata?.recipientWalletAddress as string | undefined) ??
                      result.tx.recipient
                    }
                    mono
                  />
                  {(result.tx.metadata?.recipientUsername as string | undefined) && (
                    <DetailRow
                      label="Recipient Pi Username"
                      value={`@${result.tx.metadata.recipientUsername as string}`}
                      mono
                    />
                  )}
                  {(result.tx.metadata?.senderWalletAddress as string | undefined) && (
                    <DetailRow
                      label="Sender Wallet Address"
                      value={result.tx.metadata.senderWalletAddress as string}
                      mono
                    />
                  )}
                  <DetailRow label="Description" value={result.tx.description} />
                  <DetailRow
                    label="Timestamp"
                    value={new Date(result.tx.timestamp).toLocaleString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit',
                    })}
                  />
                  {result.tx.piTransactionId && (
                    <DetailRow label="Pi Transaction ID" value={result.tx.piTransactionId} mono />
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Status</span>
                    <StatusBadge status={result.tx.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Domain</span>
                    <span className="text-xs font-mono text-muted-foreground">pis.pi</span>
                  </div>
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-transparent"
                    onClick={() => handleCopy(result.tx!.id)}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    {copied ? 'Copied!' : 'Copy Ref ID'}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => router.push(`/receipt/${result.tx!.id}`)}
                  >
                    View Receipt
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </div>
              </>
            )}

            {!result.verified && (
              <Button
                variant="outline"
                size="sm"
                className="w-full bg-transparent"
                onClick={() => {
                  setRefId('');
                  setSig('');
                  setResult(null);
                }}
              >
                Clear and Try Again
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info notice */}
      <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">How to verify:</span> Open any receipt,
          tap "Verify This Receipt" to auto-fill both fields, or paste them manually from a
          saved JSON record. All verification is performed locally.
        </p>
      </div>

      <p className="text-center text-xs text-muted-foreground/40 font-mono pt-1">
        pis.pi · Local verification · No external calls
      </p>
    </main>
  );
}

// Loading skeleton shown during Suspense prerender
function VerifyFallback() {
  return (
    <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-5 pb-28 space-y-4">
      <div>
        <div className="h-7 w-48 bg-muted rounded animate-pulse" />
        <div className="h-4 w-72 bg-muted rounded animate-pulse mt-2" />
      </div>
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="h-32 bg-muted/50 rounded animate-pulse" />
        </CardContent>
      </Card>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <Suspense fallback={<VerifyFallback />}>
        <VerifyContent />
      </Suspense>
      <BottomNav />
    </div>
  );
}
