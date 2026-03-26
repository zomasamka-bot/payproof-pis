'use client';

import Link from 'next/link';
import { ArrowLeft, Zap, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePiAuth } from '@/contexts/pi-auth-context';

interface AppHeaderProps {
  showBackButton?: boolean;
  backLink?: string;
  backText?: string;
  /** Hide the "New Payment" quick-action CTA in main headers */
  hidePayButton?: boolean;
}

export function AppHeader({
  showBackButton = false,
  backLink = '/',
  backText = 'Dashboard',
  hidePayButton = false,
}: AppHeaderProps) {
  const { isAuthenticated, userData } = usePiAuth();

  return (
    <header className="border-b border-border bg-card/95 backdrop-blur sticky top-0 z-50 supports-[backdrop-filter]:bg-card/80">
      <div className="px-4 py-3 max-w-lg mx-auto">
        {showBackButton ? (
          <Link
            href={backLink}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{backText}</span>
          </Link>
        ) : (
          <div className="flex items-center justify-between gap-3">
            {/* Brand mark */}
            <Link href="/" className="block shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                  <span className="text-primary-foreground text-xs font-bold font-mono">PP</span>
                </div>
                <div>
                  <h1 className="text-base font-semibold text-foreground leading-none">PayProof PIS</h1>
                  <p className="text-xs text-muted-foreground leading-none mt-0.5">
                    Payment Information Service
                  </p>
                </div>
              </div>
            </Link>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* Wallet connection indicator */}
              {isAuthenticated && (
                <Link href="/" className="hidden sm:flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                  {userData?.username ? `@${userData.username}` : 'Connected'}
                </Link>
              )}

              <Badge variant="outline" className="text-xs font-mono tracking-wide hidden sm:flex">
                pis.pi
              </Badge>

              {!hidePayButton && (
                <Link href="/pay">
                  <Button size="sm" className="font-semibold">
                    <Zap className="h-3.5 w-3.5 mr-1.5" />
                    Pay &amp; Record
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
