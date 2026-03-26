"use client"

import React from "react"

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSignature } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { saveSignal, generateSignature, generateReferenceId, type SignalRecord } from '@/lib/signal-storage';
import { AppHeader } from '@/components/app-header';

export default function CreateSignalPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    paymentReference: '',
    signalType: '',
    description: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const signalData = `${formData.paymentReference}|${formData.signalType}|${formData.description}`;
    const signature = generateSignature(signalData);
    const id = generateReferenceId();
    
    const signal: SignalRecord = {
      id,
      paymentReference: formData.paymentReference,
      signalType: formData.signalType,
      description: formData.description,
      signature,
      timestamp: new Date().toISOString(),
      status: 'signed',
    };
    
    saveSignal(signal);
    router.push(`/receipt/${id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader showBackButton backText="Back to Dashboard" />

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-2 text-foreground">Create Signal</h2>
          <p className="text-sm text-muted-foreground">
            Record a new payment information signal
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              Signal Information
            </CardTitle>
            <CardDescription>
              Enter payment reference details for governance tracking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="paymentReference">Payment Reference</Label>
                <Input
                  id="paymentReference"
                  placeholder="e.g., INV-2024-001"
                  value={formData.paymentReference}
                  onChange={(e) => setFormData({ ...formData, paymentReference: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signalType">Signal Type</Label>
                <Select
                  value={formData.signalType}
                  onValueChange={(value) => setFormData({ ...formData, signalType: value })}
                  required
                >
                  <SelectTrigger id="signalType">
                    <SelectValue placeholder="Select signal type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Governance Approval">Governance Approval</SelectItem>
                    <SelectItem value="Compliance Check">Compliance Check</SelectItem>
                    <SelectItem value="Route Verification">Route Verification</SelectItem>
                    <SelectItem value="Risk Assessment">Risk Assessment</SelectItem>
                    <SelectItem value="Audit Trail">Audit Trail</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter signal details and context..."
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="pt-4 space-y-3">
                <Button type="submit" className="w-full" size="lg">
                  Generate Signal & Signature
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  This will create a signed record with timestamp and reference ID
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 p-4 border border-border rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Information Only:</strong> This signature is for authentication 
            and record-keeping purposes. No financial transactions or fund movements occur.
          </p>
        </div>
      </main>
    </div>
  );
}
