'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap, AlertCircle, Info, FlaskConical, Wallet,
  Copy, Check, ArrowRight, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { AppHeader } from '@/components/app-header';
import { usePiAuth } from '@/contexts/pi-auth-context';
import { pay } from '@/lib/pi-payment';
import {
  saveTransaction,
  updateTransactionStatus,
  generateReferenceId,
  generateSignature,
  reconcileLayers,
  type TransactionRecord,
} from '@/lib/transaction-storage';

type Step = 'form' | 'confirming' | 'processing' | 'cancelled' | 'error';

export default function PayPage() {
  const router = useRouter();
  const { userData, walletAddress, isAuthenticated } = usePiAuth();

  const [step, setStep] = useState<Step>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingRefId, setPendingRefId] = useState<string | null>(null);
  const [senderCopied, setSenderCopied] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  // Reconcile IDB + localStorage on mount to heal any layer gap
  useEffect(() => { reconcileLayers(); }, []);

  const [form, setForm] = useState({
    // PRIMARY — wallet address. Required. Stored as `recipient` and in
    // metadata.recipientWalletAddress. This is the on-chain identifier.
    recipientWallet: '',
    // OPTIONAL — Pi username for SDK cross-reference only
    recipientUsername: '',
    amount: '',
    description: '',
    memo: '',
  });

  // Wallet address is required; amount and description are required.
  const isValid =
    form.recipientWallet.trim().length >= 4 &&
    Number(form.amount) > 0 &&
    form.description.trim().length > 0;

  const handleChange =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const copySenderWallet = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setSenderCopied(true);
    setTimeout(() => setSenderCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setStep('confirming');

    const refId = generateReferenceId();
    setPendingRefId(refId);
    const amount = Number(form.amount);
    const wallet = form.recipientWallet.trim();

    // Signature binds: refId + amount + wallet address (primary) + description
    const sigData = `${refId}|${amount}|${wallet}|${form.description.trim()}`;
    const signature = generateSignature(sigData);

    // `recipient` = wallet address as the primary identifier
    const txRecord: TransactionRecord = {
      id: refId,
      amount,
      recipient: wallet,
      description: form.description.trim(),
      piTransactionId: null,
      signature,
      timestamp: new Date().toISOString(),
      status: 'pending',
      metadata: {
        domain: 'pis.pi',
        memo: form.memo.trim() || `PIS Payment – ${refId}`,
        username: userData?.username ?? undefined,
        senderWalletAddress: walletAddress ?? undefined,
        recipientWalletAddress: wallet,
        recipientUsername: form.recipientUsername.trim() || undefined,
      },
    };

    // Persist before the Pi SDK dialog opens — record exists even if user cancels
    saveTransaction(txRecord);

    try {
      setStep('processing');

      await pay({
        amount,
        memo: txRecord.metadata.memo as string,
        metadata: {
          referenceId: refId,
          recipientWalletAddress: wallet,
          recipientUsername: form.recipientUsername.trim() || undefined,
          senderWalletAddress: walletAddress ?? undefined,
          description: form.description.trim(),
          domain: 'pis.pi',
        },
        onComplete: (txid) => {
          // txid is the Pi blockchain transaction ID — passed as first arg from pi-payment.ts
          updateTransactionStatus(refId, 'completed', txid);
          router.push(`/receipt/${refId}`);
        },
        onError: (error) => {
          const msg = error.message ?? '';
          const isCancelled =
            msg.toLowerCase().includes('cancel') ||
            msg.toLowerCase().includes('user denied');
          updateTransactionStatus(refId, 'failed');
          if (isCancelled) {
            setStep('cancelled');
          } else {
            setErrorMsg(msg || 'Payment failed. Please try again.');
            setStep('error');
          }
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      updateTransactionStatus(refId, 'failed');
      setErrorMsg(msg);
      setStep('error');
    }
  };

  const reset = () => {
    setStep('form');
    setErrorMsg('');
    setPendingRefId(null);
  };

  const showForm = step === 'form' || step === 'error' || step === 'cancelled';

  const walletShort = walletAddress
    ? walletAddress.length > 20
      ? `${walletAddress.slice(0, 10)}…${walletAddress.slice(-8)}`
      : walletAddress
    : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader showBackButton backLink="/" backText="Dashboard" />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-5 pb-10 space-y-4">

        <div>
          <h2 className="text-xl font-semibold">New Payment</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pay with Pi. A signed receipt is automatically generated and saved to both
            local storage layers.
          </p>
        </div>

        {/* Pi Browser required — shown on Vercel / standard browser */}
        {!isAuthenticated && (
          <div className="rounded-xl border border-border bg-muted/50 px-4 py-5 space-y-2 text-center">
            <p className="text-sm font-semibold">Pi Browser Required</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Payments require Pi Browser. Open{' '}
              <span className="font-mono text-foreground">payproofpis1234.pinet.com</span>{' '}
              inside the Pi Network app to authenticate and pay.
            </p>
          </div>
        )}

        {/* Testnet notice */}
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-3.5 py-3">
          <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            <span className="font-semibold">Testnet active.</span> Payments run on Pi Testnet.
            No real Pi is moved. Verify the full flow here before Mainnet launch.
          </p>
        </div>

        {/* Cancelled */}
        {step === 'cancelled' && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  Payment Cancelled
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  You cancelled the payment. The pending record has been saved and marked failed.
                </p>
                {pendingRefId && (
                  <p className="text-xs font-mono text-muted-foreground mt-1">
                    Ref: {pendingRefId}
                  </p>
                )}
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" className="bg-transparent" onClick={reset}>
                    Try Again
                  </Button>
                  <Button size="sm" variant="outline" className="bg-transparent"
                    onClick={() => router.push('/history')}>
                    View History
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {step === 'error' && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Payment Failed</p>
                <p className="text-xs text-muted-foreground mt-0.5">{errorMsg}</p>
                <Button size="sm" variant="outline" className="mt-3 bg-transparent" onClick={reset}>
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Processing */}
        {(step === 'confirming' || step === 'processing') && (
          <Card className="border-accent/30 bg-accent/5">
            <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <p className="text-sm font-medium">
                {step === 'confirming'
                  ? 'Building transaction record…'
                  : 'Waiting for Pi wallet approval…'}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                {step === 'processing'
                  ? 'Approve the payment inside your Pi Browser wallet to continue.'
                  : 'Generating Reference ID and signature. Saving to both storage layers.'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-5">

                {/* ── SECTION A: Sending From ── */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Sending From
                  </p>
                  <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
                    {/* Sender section — shows REAL Pi UID from authentication */}
                  {userData?.username && (
                      <div className="flex items-center gap-3 px-3.5 py-3 border-b border-border bg-green-50/30 dark:bg-green-900/10">
                        <div className="w-7 h-7 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 text-green-600 dark:text-green-400 text-xs font-bold">@</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">Pi Username (from real authentication)</p>
                          <p className="text-sm font-mono font-medium truncate mt-0.5">
                            @{userData.username}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3 px-3.5 py-3 bg-green-50/30 dark:bg-green-900/10">
                      <div className="w-7 h-7 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Wallet className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">Sender Pi UID (Real wallet address from SDK)</p>
                        <p className="text-xs font-mono text-foreground break-all leading-relaxed mt-0.5">
                          {walletAddress ?? '—'}
                        </p>
                      </div>
                      {walletAddress && (
                        <button
                          type="button"
                          onClick={copySenderWallet}
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                          aria-label="Copy sender wallet address"
                        >
                          {senderCopied
                            ? <Check className="h-3.5 w-3.5 text-green-500" />
                            : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* ── SECTION B: Sending To — wallet address PRIMARY ── */}
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Sending To
                  </p>

                  {/* Recipient Wallet Address — PRIMARY, required */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="recipientWallet" className="text-sm font-semibold">
                        Recipient Wallet Address
                      </Label>
                      <span className="text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                        Required
                      </span>
                    </div>
                    <Input
                      id="recipientWallet"
                      placeholder="Recipient Pi UID or public key"
                      value={form.recipientWallet}
                      onChange={handleChange('recipientWallet')}
                      autoComplete="off"
                      spellCheck={false}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      The primary recipient identifier. Embedded in the Reference ID signature
                      and stored in both receipt layers for audit purposes.
                    </p>
                  </div>

                  {/* Pi Username — OPTIONAL, collapsible */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowOptional((v) => !v)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showOptional
                        ? <ChevronUp className="h-3.5 w-3.5" />
                        : <ChevronDown className="h-3.5 w-3.5" />}
                      {showOptional ? 'Hide' : 'Add'} Pi Username (optional)
                    </button>

                    {showOptional && (
                      <div className="space-y-1.5 mt-3">
                        <Label htmlFor="recipientUsername" className="text-sm font-medium">
                          Recipient Pi Username
                          <span className="ml-2 text-xs font-normal text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          id="recipientUsername"
                          placeholder="e.g. satoshi"
                          value={form.recipientUsername}
                          onChange={handleChange('recipientUsername')}
                          autoComplete="off"
                          spellCheck={false}
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Optional cross-reference. The Pi SDK routes payments server-side via
                          username — the wallet address remains the primary record identifier.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* ── SECTION C: Payment Details ── */}
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Payment Details
                  </p>

                  {/* Amount */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="amount" className="text-sm font-semibold">Amount</Label>
                      <span className="text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                        Required
                      </span>
                    </div>
                    <div className="relative">
                      <Input
                        id="amount"
                        type="number"
                        min="0.001"
                        step="any"
                        placeholder="0.00"
                        value={form.amount}
                        onChange={handleChange('amount')}
                        className="font-mono text-sm pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">
                        π
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="description" className="text-sm font-semibold">Description</Label>
                      <span className="text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                        Required
                      </span>
                    </div>
                    <Textarea
                      id="description"
                      placeholder="What is this payment for?"
                      value={form.description}
                      onChange={handleChange('description')}
                      rows={2}
                      className="text-sm resize-none"
                    />
                  </div>

                  {/* Memo */}
                  <div className="space-y-1.5">
                    <Label htmlFor="memo" className="text-sm font-medium">
                      Memo
                      <span className="ml-2 text-xs font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="memo"
                      placeholder="Internal note — shown in Pi wallet dialog"
                      value={form.memo}
                      onChange={handleChange('memo')}
                      className="text-sm"
                    />
                  </div>
                </div>

              </CardContent>
            </Card>

            {/* Transparency notice */}
            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                A unique Reference ID and tamper-detection signature are generated and saved to
                both IndexedDB and localStorage before the Pi SDK dialog opens. Your receipt
                is preserved even if you cancel or close the app mid-payment.
              </p>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={!isValid}
              className="w-full font-semibold"
            >
              <Zap className="h-4 w-4 mr-2" />
              Pay &amp; Record
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>

            <p className="text-center text-xs text-muted-foreground/40 font-mono">
              pis.pi · Dual-layer storage · No custody
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
