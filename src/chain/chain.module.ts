import { Module } from '@nestjs/common';
import { chainProvider, CHAIN_PROVIDER } from './chain.provider';

@Module({
  providers: [chainProvider],
  exports: [CHAIN_PROVIDER],
})
export class ChainModule {}
