'use client';

import React, { useState } from 'react';
import { usePiAuth } from '@/contexts/pi-auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  CheckCircle2, AlertCircle, WifiOff, RefreshCw, Zap, Code2,
} from 'lucide-react';

export function PiConnectionDiagnostics() {
  const { 
    isAuthenticated, 
    hasError, 
    authMessage, 
    reinitialize, 
    diagnostics,
  } = usePiAuth();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    await reinitialize();
    setIsRetrying(false);
  };

  if (isAuthenticated) return null; // Only show when not authenticated

  return (
    <Card className="border-dashed">
      <CardContent className="p-4 space-y-3">
        {/* Status Summary */}
        <div className="flex items-center gap-3">
          <div className={`flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${
            hasError ? 'bg-red-100 dark:bg-red-900/20' : 'bg-blue-100 dark:bg-blue-900/20'
          }`}>
            {hasError ? (
              <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {isAuthenticated ? 'Connected' : hasError ? 'Connection Failed' : 'Attempting Connection'}
            </p>
            <p className="text-xs text-muted-foreground truncate">{authMessage}</p>
          </div>
        </div>

        {/* Diagnostic Details */}
        <div className="bg-muted/40 rounded-lg p-3 space-y-2 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Environment:</span>
            <span className={diagnostics.sandboxMode ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold'}>
              {diagnostics.sandboxMode ? 'Testnet (Sandbox Mode)' : 'Mainnet'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">SDK Loaded:</span>
            <div className="flex items-center gap-1">
              {diagnostics.sdkLoaded ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                  <span className="text-green-600 dark:text-green-400 font-semibold">Yes</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Waiting...</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Pi.init():</span>
            <div className="flex items-center gap-1">
              {diagnostics.piInitialized ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                  <span className="text-green-600 dark:text-green-400 font-semibold">Done</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Waiting...</span>
                </>
              )}
            </div>
          </div>
          {diagnostics.lastError && (
            <div className="flex flex-col gap-1 pt-1 border-t border-muted">
              <div className="flex items-start justify-between gap-2">
                <span className="text-red-600 dark:text-red-400 font-semibold">Error:</span>
                <span className="text-red-600 dark:text-red-400 text-right break-words text-xs leading-relaxed font-mono">
                  {diagnostics.lastError}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Manual Connection Trigger */}
        <div className="pt-2 space-y-2 border-t border-muted">
          <p className="text-xs text-muted-foreground">
            {hasError 
              ? 'Connection failed. Retry to troubleshoot:'
              : 'Manual connection trigger for testing:'}
          </p>
          <Button
            onClick={handleRetry}
            disabled={isRetrying || isAuthenticated}
            size="sm"
            className="w-full"
            variant={hasError ? 'default' : 'secondary'}
          >
            {isRetrying ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                Trigger Connection
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground/70">
            This initiates Pi.authenticate(). If in Pi Browser, approve the request on your device.
            If on Vercel, this will show the sandbox detection error.
          </p>
        </div>

        {/* Portal Detection Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5 border border-blue-200 dark:border-blue-800 space-y-2">
          <div className="flex items-start gap-2">
            <Code2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              <span className="font-semibold">Step 10 Debugging:</span> Open Browser DevTools (F12) and search for logs starting with <span className="font-mono bg-white dark:bg-black/30 px-1.5 py-0.5 rounded">[v0]</span> to see the exact authentication flow.
            </p>
          </div>
          <div className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed bg-white/40 dark:bg-black/20 p-2 rounded font-mono space-y-1">
            <p className="font-semibold">Expected sequence:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>"Pi SDK loaded successfully"</li>
              <li>"Pi.init() completed successfully"</li>
              <li>"Calling window.Pi.authenticate()..."</li>
              <li>"Authentication successful" OR timeout error</li>
            </ul>
            <p className="mt-2 font-semibold">If authenticate times out:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Search console for "postMessage" errors</li>
              <li>Check for "Unable to post message to https://app-cdn.minepi.com"</li>
              <li>This indicates an iframe messaging issue with the Portal sandbox</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
