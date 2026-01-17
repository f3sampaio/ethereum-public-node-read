import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceResponseDto } from './dto/invoice-response.dto';

@ApiTags('invoices')
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  /**
   * Create a new invoice
   * POST /invoices
   * Body: { amount: "12.50" } (USDC)
   */
  @Post()
  @ApiOperation({
    summary: 'Create a new invoice',
    description:
      'Creates a new invoice with a randomly generated deposit address. The amount is converted from USDC to micro-USDC (multiplied by 1,000,000).',
  })
  @ApiBody({ type: CreateInvoiceDto })
  @ApiResponse({
    status: 201,
    description: 'Invoice created successfully',
    type: InvoiceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid amount. Must be a positive number.',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to create invoice',
  })
  create(@Body() createInvoiceDto: CreateInvoiceDto): InvoiceResponseDto {
    try {
      // Convert USDC string to micro-USDC (USDC has 6 decimals)
      const amountInUsdc = parseFloat(createInvoiceDto.amount);
      if (isNaN(amountInUsdc) || amountInUsdc <= 0) {
        throw new HttpException(
          'Invalid amount. Must be a positive number.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const amountExpected = Math.floor(amountInUsdc * 1_000_000); // Convert to micro-USDC

      // Create invoice (deposit address is auto-generated)
      const invoice = this.invoiceService.create({
        amountExpected,
      });

      return {
        id: invoice.id,
        amountExpected: invoice.amountExpected,
        depositAddress: invoice.depositAddress,
        status: invoice.status,
        detectedTxHash: invoice.detectedTxHash,
        detectedBlockNumber: invoice.detectedBlockNumber,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to create invoice',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get invoice by ID
   * GET /invoices/:id
   * Returns: status + address + amount
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get invoice by ID',
    description: 'Retrieves an invoice by its unique identifier. Returns status, deposit address, and amount.',
  })
  @ApiParam({
    name: 'id',
    description: 'Invoice unique identifier',
    example: 'inv_1234567890_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice found',
    type: InvoiceResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Invoice not found',
  })
  findOne(@Param('id') id: string): InvoiceResponseDto {
    const invoice = this.invoiceService.findOne(id);
    if (!invoice) {
      throw new HttpException('Invoice not found', HttpStatus.NOT_FOUND);
    }

    return {
      id: invoice.id,
      amountExpected: invoice.amountExpected,
      depositAddress: invoice.depositAddress,
      status: invoice.status,
      detectedTxHash: invoice.detectedTxHash,
      detectedBlockNumber: invoice.detectedBlockNumber,
    };
  }
}
