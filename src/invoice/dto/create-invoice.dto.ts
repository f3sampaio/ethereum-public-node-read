import { ApiProperty } from '@nestjs/swagger';

export class CreateInvoiceDto {
  @ApiProperty({
    description: 'USDC amount as string',
    example: '12.50',
    type: String,
  })
  amount: string;
}
