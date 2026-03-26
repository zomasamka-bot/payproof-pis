/**
 * PIS - Payment Information Service
 * Pi Network Configuration
 * 
 * This file contains configuration for Pi Browser integration
 * Domain: pis.pi
 */

export const PI_CONFIG = {
  // App Information
  appName: "PIS - Payment Information Service",
  appDomain: "pis.pi",
  appVersion: "1.0.0",
  
  // Features
  features: {
    signalGeneration: true,
    signatureVerification: true,
    receiptExport: true,
    localStorageOnly: true,
  },
  
  // Constraints
  constraints: {
    noPayments: true,
    noFundTransfers: true,
    noAssetCustody: true,
    noExternalAPIs: true,
  },
  
  // Signal Types
  signalTypes: [
    "Governance Approval",
    "Compliance Check",
    "Route Verification",
    "Risk Assessment",
    "Audit Trail",
  ],
  
  // Status Types
  statusTypes: ["pending", "signed", "verified"] as const,
};

export type SignalStatus = typeof PI_CONFIG.statusTypes[number];

/**
 * Application Purpose Statement
 * For Pi Developer Portal Submission
 */
export const APP_PURPOSE = `
PIS (Payment Information Service) is an institutional-grade payment intelligence 
layer designed exclusively for recording, signing, and verifying payment-related 
information signals.

Key Features:
- Generate signed payment information signals
- Verify signal authenticity using cryptographic signatures
- Export receipts in JSON format for record-keeping
- Track governance and compliance checkpoints

Important Disclaimers:
- NO fund movement or transfers occur in this application
- NO asset custody or holding capabilities
- NO external payment processing
- Information recording and verification ONLY
- All data stored locally in browser storage

Use Cases:
- Governance approval tracking
- Compliance checkpoint recording
- Payment route verification signals
- Risk assessment documentation
- Audit trail generation

This application serves as a reference layer for institutional processes
and does not execute any financial transactions.
`;

export default PI_CONFIG;
