# PIS – Payment Information Service

**Domain:** pis.pi

## Overview

PIS is an institutional-grade payment intelligence layer designed for recording, signing, and verifying payment-related information signals for governance, compliance, and routing purposes.

## Key Features

- **Create Signal**: Record payment information with reference tracking
- **Digital Signature**: Authentication-only signatures (no financial execution)
- **Receipt Generation**: JSON receipts with reference ID, timestamp, and status
- **Signal Verification**: Authenticate recorded signals within the app

## Application Flow

Dashboard → Create Signal → Receipt → Verify

This is a One-Action App following the Unified Build System.

## Constraints

- ✅ Information recording only
- ✅ Local storage (no external APIs)
- ❌ No payments or fund transfers
- ❌ No asset custody
- ❌ No financial transactions

## Technology Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS v4
- shadcn/ui components
- Local Browser Storage

## Purpose

This application is designed for institutional compliance and governance tracking. All signatures and records are for authentication and audit trail purposes only.

## Testing

The app is ready for testing in the Pi Browser and submission to the Pi Developer Portal. All features are fully functional with no placeholders.
