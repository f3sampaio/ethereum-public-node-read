import { Provider } from '@nestjs/common';
import { JsonRpcProvider } from 'ethers';

/**
 * Injection token for the Ethereum JSON-RPC provider.
 * Use this token with @Inject() to inject the provider into your services.
 *
 * @example
 * ```typescript
 * constructor(@Inject(CHAIN_PROVIDER) private readonly provider: JsonRpcProvider) {}
 * ```
 */
export const CHAIN_PROVIDER = 'CHAIN_PROVIDER';

/**
 * Provider factory that creates a singleton JsonRpcProvider instance
 * from the ETH_RPC_URL environment variable.
 */
export const chainProvider: Provider = {
  provide: CHAIN_PROVIDER,
  useFactory: (): JsonRpcProvider => {
    const rpcUrl = process.env.ETH_RPC_URL;
    if (!rpcUrl) {
      throw new Error('ETH_RPC_URL environment variable is required');
    }
    return new JsonRpcProvider(rpcUrl);
  },
};
