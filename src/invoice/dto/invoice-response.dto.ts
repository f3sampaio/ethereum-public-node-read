import { ApiProperty } from '@nestjs/swagger';
import { InvoiceStatus } from '../entities/invoice.entity';

export class InvoiceResponseDto {
  @ApiProperty({
    description: 'Invoice unique identifier',
    example: 'inv_1234567890_abc123',
  })
  id: string;

  @ApiProperty({
    description: 'Expected amount in micro-USDC (integer)',
    example: 12500000,
  })
  amountExpected: number;

  @ApiProperty({
    description: 'Ethereum address where payment should be sent',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  })
  depositAddress: string;

  @ApiProperty({
    description: 'Current status of the invoice',
    enum: InvoiceStatus,
    example: InvoiceStatus.PENDING,
  })
  status: InvoiceStatus;

  @ApiProperty({
    description: 'Transaction hash when payment is detected',
    example: '0x1234567890abcdef...',
    required: false,
    nullable: true,
  })
  detectedTxHash?: string;

  @ApiProperty({
    description: 'Block number where payment transaction was detected',
    example: 12345,
    required: false,
    nullable: true,
  })
  detectedBlockNumber?: number;
}
