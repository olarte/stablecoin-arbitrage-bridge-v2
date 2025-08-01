
export const CHAINS = {
  ethereum: {
    id: 1,
    name: 'Ethereum',
    rpcUrl: process.env.ETHEREUM_RPC_URL,
    currency: 'ETH',
    blockExplorer: 'https://etherscan.io',
    contracts: {
      usdc: '0xA0b86a33E6441d05b0c45AadfF5E36C48D1F6e',
      usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      dai: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
    },
    gasLimit: {
      transfer: 21000,
      swap: 150000,
      bridge: 200000
    },
    confirmations: 12
  },
  
  sui: {
    id: 'sui',
    name: 'Sui',
    rpcUrl: process.env.SUI_RPC_URL,
    currency: 'SUI',
    blockExplorer: 'https://explorer.sui.io',
    contracts: {
      usdc: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN',
      usdt: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN',
      dai: '0xa198f3be41cda8c07b3bf3fee02263526e535d682bbbd0d974cf8b5c04c456ac::coin::COIN'
    },
    gasLimit: {
      transfer: 1000000,
      swap: 2000000,
      bridge: 3000000
    },
    confirmations: 1
  }
};

export const SUPPORTED_TOKENS = {
  USDC: {
    symbol: 'USDC',
    decimals: 6,
    minBridgeAmount: 10,
    maxBridgeAmount: 100000,
    contracts: {
      ethereum: CHAINS.ethereum.contracts.usdc,
      sui: CHAINS.sui.contracts.usdc
    }
  },
  
  USDT: {
    symbol: 'USDT',
    decimals: 6,
    minBridgeAmount: 10,
    maxBridgeAmount: 100000,
    contracts: {
      ethereum: CHAINS.ethereum.contracts.usdt,
      sui: CHAINS.sui.contracts.usdt
    }
  },
  
  DAI: {
    symbol: 'DAI',
    decimals: 18,
    minBridgeAmount: 10,
    maxBridgeAmount: 100000,
    contracts: {
      ethereum: CHAINS.ethereum.contracts.dai,
      sui: CHAINS.sui.contracts.dai
    }
  }
};

export const BRIDGE_CONFIG = {
  fees: {
    ethereum: 0.001, // 0.1%
    sui: 0.0005      // 0.05%
  },
  
  minProfitThreshold: parseFloat(process.env.MIN_PROFIT_THRESHOLD) || 0.01,
  maxSlippage: parseFloat(process.env.MAX_SLIPPAGE) || 0.005,
  gasPriceMultiplier: parseFloat(process.env.GAS_PRICE_MULTIPLIER) || 1.2,
  
  timeouts: {
    ethereum: 300000, // 5 minutes
    sui: 60000        // 1 minute
  }
};

export function getChainById(chainId) {
  return Object.values(CHAINS).find(chain => chain.id === chainId);
}

export function getTokenBySymbol(symbol) {
  return SUPPORTED_TOKENS[symbol.toUpperCase()];
}

export function getSupportedChains() {
  return Object.keys(CHAINS);
}

export function getSupportedTokens() {
  return Object.keys(SUPPORTED_TOKENS);
}
