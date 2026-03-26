# Pi Payment System - AI Tutorial

## System Overview

This app has a global `window.pay()` function for Pi Network payments. It's automatically initialized after authentication and handles the complete payment flow including approval, validation, and completion.

## Architecture

- **Payment Module**: `lib/pi-payment.ts` - Core implementation
- **Initialization**: Happens in `contexts/pi-auth-context.tsx` after user authenticates
- **API Endpoints**: Configured in `lib/system-config.ts` (all route through backend)
- **Features**: Automatic approval, blockchain validation, incomplete payment recovery

## Key Implementation Details

### Type Definitions
All types use `type` (not `interface`):
- `PaymentOptions` - Parameters for `window.pay()`
- `PaymentMetadata` - Custom payment data object
- `PiPayment` - Pi Network payment structure

### Global Function
\`\`\`typescript
window.pay(options: PaymentOptions): Promise<void>
\`\`\`

### Configuration
All API URLs use placeholders in `lib/system-config.ts`:
- `BACKEND_CONFIG.BASE_URL` - Backend API
- `BACKEND_CONFIG.BLOCKCHAIN_BASE_URL` - Blockchain API
- Payment endpoints are in `BACKEND_URLS` (GET_PAYMENT, APPROVE_PAYMENT, COMPLETE_PAYMENT)
- URLs are auto-generated from these base URLs

## Usage Examples

### Basic Payment
\`\`\`typescript
await window.pay({
  amount: 5,
  metadata: { productId: 'abc123' }
});
\`\`\`

### With Callbacks
\`\`\`typescript
await window.pay({
  amount: product.price_in_pi,
  memo: `Purchase ${product.name}`,
  metadata: { productId: product.id },
  onComplete: (metadata) => console.log('Success!', metadata),
  onError: (error) => console.error('Failed:', error)
});
\`\`\`

### Set Reward Handler (Optional)
\`\`\`typescript
import { setPaymentRewardHandler } from '@/lib/pi-payment';

// Call once during app initialization
setPaymentRewardHandler((metadata) => {
  // Handle fulfillment logic
  console.log('Payment completed!', metadata);
});
\`\`\`

### Practical Component Example
\`\`\`typescript
import { usePiAuth } from '@/contexts/pi-auth-context';

function BuyButton({ product }) {
  const handlePurchase = async () => {
    await window.pay({
      amount: product.price_in_pi,
      metadata: { productId: product.id },
      onComplete: () => alert('Success!'),
      onError: (error) => alert(error.message)
    });
  };
  
  return <button onClick={handlePurchase}>Buy</button>;
}
\`\`\`

## Payment Flow

1. User calls `window.pay()`
2. Pi SDK creates payment and shows modal
3. Backend auto-approves payment
4. User completes in Pi app
5. System validates transaction on blockchain
6. Backend marks payment complete
7. Reward handler fires (if set)
8. `onComplete` callback fires (if provided)

## Important Notes for AI

- **Automatic initialization**: Payment system initializes on auth, no manual setup needed
- **Types over interfaces**: All type definitions use `type`, not `interface`
- **Backend proxy**: All Pi APIs route through backend (no direct Pi API calls)
- **Placeholders**: All URLs use placeholders that will be replaced by deployment system
- **Incomplete payments**: System handles incomplete payments via authenticate callback with 2-second delay to avoid race conditions
- **Security**: Validates transaction IDs and on-chain amounts before completion
- **Validation logging**: Failed validations log onchain vs expected amounts for debugging

## API Reference

### `window.pay(options: PaymentOptions)`
- `amount` (number, required) - Pi amount
- `memo` (string, optional) - Description
- `metadata` (object, required) - Custom data
- `onComplete` (function, optional) - Success callback with metadata
- `onError` (function, optional) - Error callback with error and optional payment

### `setPaymentRewardHandler(handler: Function)`
- Sets global callback for all successful payments
- Handler receives payment metadata
- Call once during app initialization

## Error Handling

\`\`\`typescript
try {
  await window.pay({ amount: 5, metadata: { id: '123' } });
} catch (error) {
  console.error('Payment initialization failed:', error);
}
\`\`\`

Errors are also handled via the `onError` callback if provided.
