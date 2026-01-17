export enum InvoiceStatus {
  PENDING = 'PENDING',
  DETECTED = 'DETECTED',
  PAID = 'PAID',
}

export interface Invoice {
  id: string;
  amountExpected: number; // micro-USDC (integer)
  depositAddress: string;
  status: InvoiceStatus;
  detectedTxHash?: string;
  detectedBlockNumber?: number;
}
