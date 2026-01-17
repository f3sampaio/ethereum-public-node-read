import {
  Injectable,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { JsonRpcProvider, Interface, Log } from 'ethers';
import { CHAIN_PROVIDER } from '../chain/chain.provider';
import { InvoiceService } from '../invoice/invoice.service';
import { InvoiceStatus } from '../invoice/entities/invoice.entity';

// ERC-20 Transfer event signature: Transfer(address,address,uint256)
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

@Injectable()
export class UsdcIndexerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UsdcIndexerService.name);
  private lastProcessedBlock: number = 0;
  private pollingInterval?: NodeJS.Timeout;

  // Configuration from environment variables
  private readonly pollIntervalMs: number;
  private readonly reorgBufferBlocks: number;
  private readonly confirmationsRequired: number;
  private readonly usdcContract: string;

  // ERC-20 Transfer event ABI for decoding
  private readonly transferInterface = new Interface([
    'event Transfer(address indexed from, address indexed to, uint256 value)',
  ]);

  constructor(
    @Inject(CHAIN_PROVIDER) private readonly provider: JsonRpcProvider,
    private readonly invoiceService: InvoiceService,
  ) {
    this.pollIntervalMs =
      parseInt(process.env.POLL_INTERVAL_MS || '10000', 10) || 10000; // Default 10 seconds
    this.reorgBufferBlocks =
      parseInt(process.env.REORG_BUFFER_BLOCKS || '12', 10) || 12; // Default 12 blocks
    this.confirmationsRequired =
      parseInt(process.env.CONFIRMATIONS_REQUIRED || '12', 10) || 12; // Default 12 confirmations
    this.usdcContract =
      process.env.USDC_CONTRACT ||
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // Mainnet USDC

    if (!this.usdcContract) {
      throw new Error('USDC_CONTRACT environment variable is required');
    }
  }

  async onModuleInit() {
    this.logger.log('Starting USDC indexer service...');
    this.logger.log(`USDC Contract: ${this.usdcContract}`);
    this.logger.log(`Poll Interval: ${this.pollIntervalMs}ms`);
    this.logger.log(`Reorg Buffer: ${this.reorgBufferBlocks} blocks`);
    this.logger.log(`Confirmations Required: ${this.confirmationsRequired} blocks`);

    // Initialize lastProcessedBlock to current block minus some buffer
    try {
      const currentBlock = await this.provider.getBlockNumber();
      this.lastProcessedBlock = Math.max(0, currentBlock - this.reorgBufferBlocks);
      this.logger.log(
        `Initialized lastProcessedBlock to ${this.lastProcessedBlock}`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize lastProcessedBlock', error);
      // Start from 0 if we can't get current block
      this.lastProcessedBlock = 0;
    }

    // Start polling
    this.startPolling();
  }

  private startPolling() {
    this.pollingInterval = setInterval(() => {
      this.poll().catch((error) => {
        this.logger.error('Error during polling', error);
      });
    }, this.pollIntervalMs);

    // Run immediately on start
    this.poll().catch((error) => {
      this.logger.error('Error during initial poll', error);
    });
  }

  private async poll() {
    try {
      const latest = await this.provider.getBlockNumber();
      const toBlock = latest - this.reorgBufferBlocks;

      if (toBlock <= this.lastProcessedBlock) {
        return; // No new blocks to process
      }

      this.logger.debug(
        `Polling blocks ${this.lastProcessedBlock + 1} to ${toBlock}`,
      );

      // Get Transfer event logs from USDC contract
      const logs = await this.provider.getLogs({
        address: this.usdcContract,
        fromBlock: this.lastProcessedBlock + 1,
        toBlock,
        topics: [TRANSFER_TOPIC],
      });

      this.logger.debug(`Found ${logs.length} Transfer logs`);

      // Process each log
      for (const log of logs) {
        await this.processTransferLog(log, latest);
      }

      // Update lastProcessedBlock
      this.lastProcessedBlock = toBlock;

      // Check for invoices that should be marked as PAID
      await this.checkConfirmations(latest);
    } catch (error) {
      this.logger.error('Error in poll', error);
    }
  }

  private async processTransferLog(log: Log, currentBlock: number) {
    try {
      // Decode the Transfer event using decodeEventLog (ethers v6)
      const decoded = this.transferInterface.decodeEventLog(
        'Transfer',
        log.data,
        log.topics,
      );

      // In ethers v6, decoded args are accessed by index
      // Transfer(address indexed from, address indexed to, uint256 value)
      const from = decoded[0] as string;
      const to = decoded[1] as string;
      const value = decoded[2] as bigint;

      // Normalize addresses to lowercase for comparison
      const toAddress = to.toLowerCase();

      // Find invoices with matching deposit address
      const invoices = this.invoiceService.findByDepositAddress(toAddress);

      if (invoices.length === 0) {
        return; // No matching invoices
      }

      this.logger.log(
        `Found transfer to ${toAddress}: ${value.toString()} micro-USDC`,
      );

      // Process each matching invoice
      for (const invoice of invoices) {
        // Only process if invoice is still PENDING
        if (invoice.status !== InvoiceStatus.PENDING) {
          continue;
        }

        // Check if amount matches (allow some tolerance for gas or rounding)
        const amountReceived = Number(value);
        if (amountReceived >= invoice.amountExpected) {
          // Mark as DETECTED immediately
          // In ethers v6, Log has transactionHash and blockNumber properties
          const txHash = log.transactionHash || '';
          const blockNumber = Number(log.blockNumber);

          this.invoiceService.markAsDetected(invoice.id, txHash, blockNumber);
          this.logger.log(
            `Invoice ${invoice.id} marked as DETECTED at block ${blockNumber}`,
          );
        } else {
          this.logger.warn(
            `Invoice ${invoice.id} received ${amountReceived} but expected ${invoice.amountExpected}`,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error processing transfer log', error);
    }
  }

  private async checkConfirmations(currentBlock: number) {
    // Get all invoices that are DETECTED but not yet PAID
    const allInvoices = this.invoiceService.findAll();
    const detectedInvoices = allInvoices.filter(
      (invoice) =>
        invoice.status === InvoiceStatus.DETECTED &&
        invoice.detectedBlockNumber !== undefined,
    );

    for (const invoice of detectedInvoices) {
      if (!invoice.detectedBlockNumber) {
        continue;
      }

      const confirmations = currentBlock - invoice.detectedBlockNumber;

      if (confirmations >= this.confirmationsRequired) {
        this.invoiceService.markAsPaid(invoice.id);
        this.logger.log(
          `Invoice ${invoice.id} marked as PAID (${confirmations} confirmations)`,
        );
      }
    }
  }

  onModuleDestroy() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.logger.log('Stopped USDC indexer polling');
    }
  }
}
