import { Injectable } from '@nestjs/common';
import { Wallet } from 'ethers';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';

@Injectable()
export class InvoiceService {
  private invoices: Map<string, Invoice> = new Map();

  /**
   * Create a new invoice with a randomly generated deposit address
   */
  create(invoice: Omit<Invoice, 'id' | 'status' | 'depositAddress'>): Invoice {
    const id = this.generateId();
    const depositAddress = this.generateDepositAddress();
    const newInvoice: Invoice = {
      ...invoice,
      id,
      depositAddress,
      status: InvoiceStatus.PENDING,
    };
    this.invoices.set(id, newInvoice);
    return newInvoice;
  }

  /**
   * Find an invoice by ID
   */
  findOne(id: string): Invoice | undefined {
    return this.invoices.get(id);
  }

  /**
   * Find all invoices
   */
  findAll(): Invoice[] {
    return Array.from(this.invoices.values());
  }

  /**
   * Update an invoice
   */
  update(id: string, updates: Partial<Omit<Invoice, 'id'>>): Invoice | null {
    const invoice = this.invoices.get(id);
    if (!invoice) {
      return null;
    }

    const updatedInvoice: Invoice = {
      ...invoice,
      ...updates,
    };
    this.invoices.set(id, updatedInvoice);
    return updatedInvoice;
  }

  /**
   * Update invoice status to DETECTED with transaction details
   */
  markAsDetected(
    id: string,
    txHash: string,
    blockNumber: number,
  ): Invoice | null {
    return this.update(id, {
      status: InvoiceStatus.DETECTED,
      detectedTxHash: txHash,
      detectedBlockNumber: blockNumber,
    });
  }

  /**
   * Update invoice status to PAID
   */
  markAsPaid(id: string): Invoice | null {
    return this.update(id, {
      status: InvoiceStatus.PAID,
    });
  }

  /**
   * Delete an invoice
   */
  remove(id: string): boolean {
    return this.invoices.delete(id);
  }

  /**
   * Find invoices by deposit address (case-insensitive comparison)
   */
  findByDepositAddress(depositAddress: string): Invoice[] {
    const normalizedAddress = depositAddress.toLowerCase();
    return Array.from(this.invoices.values()).filter(
      (invoice) => invoice.depositAddress.toLowerCase() === normalizedAddress,
    );
  }

  /**
   * Generate a unique ID for invoices
   */
  private generateId(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a random Ethereum address for deposit
   * ⚠️ This is OK for a prototype. For production you'll switch to xpub-derived addresses (no private keys in API).
   */
  private generateDepositAddress(): string {
    return Wallet.createRandom().address;
  }
}
