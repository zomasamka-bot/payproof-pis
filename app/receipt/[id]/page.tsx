'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CheckCircle, Copy, Download, ShieldCheck, ArrowRight,
  Circle, Check,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AppHeader } from '@/components/app-header';
import { BottomNav } from '@/components/bottom-nav';
import { StatusBadge } from '@/components/status-badge';
import {
  getTransactionById,
  initStorageSync,
  subscribeToTransactionChanges,
  type TransactionRecord,
} from '@/lib/transaction-storage';

function ReceiptRow({
  label,
  value,
  mono = false,
  copyable = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {copyable && (
          <button
            onClick={copy}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`Copy ${label}`}
          >
            {copied
              ? <Check className="h-3 w-3 text-green-500" />
              : <Copy className="h-3 w-3" />}
          </button>
        )}
      </div>
      <span
        className={`text-sm break-all leading-snug ${
          mono ? 'font-mono' : 'font-medium'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

type CopyKey = 'ref' | 'sig' | 'json';

export default function ReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [tx, setTx] = useState<TransactionRecord | null>(null);
  const [copied, setCopied] = useState<CopyKey | null>(null);

  useEffect(() => {
    initStorageSync();
    setTx(getTransactionById(id));
    const unsub = subscribeToTransactionChanges(() =>
      setTx(getTransactionById(id))
    );
    return () => unsub();
  }, [id]);

  const copyText = (text: string, key: CopyKey) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const fmt = (n: number) =>
    n.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });

  if (!tx) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <AppHeader showBackButton backLink="/history" backText="History" />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
          <Circle className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Transaction not found</p>
          <Button
            variant="outline"
            size="sm"
            className="bg-transparent"
            onClick={() => router.push('/history')}
          >
            View History
          </Button>
        </div>
        <BottomNav />
      </div>
    );
  }

  // Wallet address is the primary recipient identifier when available
  const recipientWallet =
    (tx.metadata?.recipientWalletAddress as string | undefined) ?? tx.recipient;
  const recipientUsername =
    (tx.metadata?.recipientUsername as string | undefined) ??
    (tx.recipient !== recipientWallet ? tx.recipient : undefined);
  const senderWallet = tx.metadata?.senderWalletAddress as string | undefined;
  const senderUsername = tx.metadata?.username as string | undefined;

  const receiptJson = JSON.stringify(
    {
      domain: 'pis.pi',
      service: 'PIS – Payment Information Service',
      schemaVersion: 1,
      referenceId: tx.id,
      amount: tx.amount,
      recipientWalletAddress: recipientWallet,
      recipientUsername: recipientUsername ?? null,
      senderWalletAddress: senderWallet ?? null,
      senderUsername: senderUsername ?? null,
      description: tx.description,
      piTransactionId: tx.piTransactionId,
      signature: tx.signature,
      timestamp: tx.timestamp,
      status: tx.status,
      metadata: tx.metadata,
    },
    null,
    2
  );

  const handleDownload = () => {
    const blob = new Blob([receiptJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PIS-Receipt-${tx.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isSuccess = tx.status === 'completed' || tx.status === 'verified';
  const isFailed = tx.status === 'failed';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader showBackButton backLink="/history" backText="History" />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-5 pb-28 space-y-4">

        {/* Status hero */}
        <div
          className={`rounded-2xl p-5 flex flex-col items-center text-center gap-2 ${
            isSuccess
              ? 'bg-primary text-primary-foreground'
              : isFailed
              ? 'bg-destructive/10 border border-destructive/30'
              : 'bg-muted border border-border'
          }`}
        >
          {isSuccess ? (
            <CheckCircle className="h-10 w-10" />
          ) : isFailed ? (
            <Circle className="h-10 w-10 text-destructive" />
          ) : (
            <div className="w-10 h-10 rounded-full border-2 border-current border-t-transparent animate-spin opacity-60" />
          )}
          <div>
            <p className="text-lg font-semibold mt-1">
              {isSuccess ? 'Payment Recorded' : isFailed ? 'Payment Failed' : 'Pending Confirmation'}
            </p>
            <p className={`text-2xl font-bold font-mono mt-0.5 ${isSuccess ? '' : 'text-foreground'}`}>
              {fmt(tx.amount)} π
            </p>
          </div>
          <StatusBadge
            status={tx.status}
            className={
              isSuccess
                ? 'bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20'
                : ''
            }
          />
        </div>

        {/* Core receipt details */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Receipt Details
              </span>
              <span className="text-xs font-mono text-muted-foreground">pis.pi</span>
            </div>
            <Separator />

            <ReceiptRow label="Reference ID" value={tx.id} mono copyable />

            {/* Recipient — wallet address primary */}
            <ReceiptRow label="Recipient Wallet Address" value={recipientWallet} mono copyable />
            {recipientUsername && (
              <ReceiptRow label="Recipient Pi Username" value={`@${recipientUsername}`} mono />
            )}

            {/* Sender */}
            {senderWallet && (
              <ReceiptRow label="Sender Wallet Address" value={senderWallet} mono copyable />
            )}
            {senderUsername && (
              <ReceiptRow label="Sender Pi Username" value={`@${senderUsername}`} mono />
            )}

            <ReceiptRow label="Description" value={tx.description} />
            <ReceiptRow
              label="Timestamp"
              value={new Date(tx.timestamp).toLocaleString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              })}
            />
            {tx.piTransactionId && (
              <ReceiptRow label="Pi Transaction ID" value={tx.piTransactionId} mono />
            )}
            {tx.metadata?.memo && (
              <ReceiptRow label="Memo" value={tx.metadata.memo as string} />
            )}
          </CardContent>
        </Card>

        {/* Signature block */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Signature
              </span>
              <button
                onClick={() => copyText(tx.signature, 'sig')}
                className="text-xs text-accent hover:underline transition-colors"
              >
                {copied === 'sig' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs font-mono bg-muted rounded-lg p-2.5 break-all leading-relaxed text-muted-foreground">
              {tx.signature}
            </p>
            <p className="text-xs text-muted-foreground/60">
              Use this signature with the Reference ID on the Verify page to confirm authenticity.
            </p>
          </CardContent>
        </Card>

        {/* Copy / Download row */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 bg-transparent"
            onClick={() => copyText(tx.id, 'ref')}
          >
            {copied === 'ref' ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied === 'ref' ? 'Copied!' : 'Copy Ref ID'}
          </Button>
          <Button
            variant="outline"
            className="flex-1 bg-transparent"
            onClick={() => copyText(receiptJson, 'json')}
          >
            {copied === 'json' ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied === 'json' ? 'Copied!' : 'Copy JSON'}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="bg-transparent shrink-0"
            onClick={handleDownload}
            aria-label="Download receipt JSON"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>

        {/* Action buttons */}
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full bg-transparent"
            onClick={() =>
              router.push(
                `/verify?id=${encodeURIComponent(tx.id)}&sig=${encodeURIComponent(tx.signature)}`
              )
            }
          >
            <ShieldCheck className="h-4 w-4 mr-2" />
            Verify This Receipt
          </Button>
          <Button className="w-full font-semibold" onClick={() => router.push('/pay')}>
            New Payment
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

        {/* Full JSON preview */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Full Record (JSON)
            </span>
            <pre className="text-xs font-mono bg-muted rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed text-muted-foreground max-h-52 overflow-y-auto">
              {receiptJson}
            </pre>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground/40 font-mono pt-1">
          pis.pi · Testnet · No custody
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
