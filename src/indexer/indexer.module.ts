import { Module } from '@nestjs/common';
import { UsdcIndexerService } from './usdc-indexer.service';
import { ChainModule } from '../chain/chain.module';
import { InvoiceModule } from '../invoice/invoice.module';

@Module({
  imports: [ChainModule, InvoiceModule],
  providers: [UsdcIndexerService],
})
export class IndexerModule {}
