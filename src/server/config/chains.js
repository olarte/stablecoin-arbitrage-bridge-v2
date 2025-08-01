export const CHAIN_CONFIG = {
  ethereum: {
    rpc: process.env.SEPOLIA_RPC || process.env.ETHEREUM_RPC,
    chainId: 11155111, // Ethereum Sepolia
    tokens: {
      USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      USDT: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
      WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
      DAI: '0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6'
    },
    uniswap: {
      factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c',
      quoter: '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3',
      router: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E'
    },
    fusion: {
      relayerUrl: 'https://fusion.1inch.io/relayer/v1.0/11155111',
      apiUrl: 'https://api.1inch.dev/fusion/v1.0/11155111'
    }
  },
  sui: {
    rpc: process.env.SUI_RPC || process.env.SUI_TESTNET_RPC || 'https://fullnode.testnet.sui.io',
    chainId: 'sui:testnet',
    tokens: {
      USDC: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN',
      USDY: '0xa3d3b6c6d5e9c8f4b7d8e5f2a1c3e9d8f5b2c9e8d5f2a1c3e8d5f2a1c3e9d8f5::usdy::USDY',
      SUI: '0x2::sui::SUI'
    },
    cetus: {
      packageId: '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb',
      globalConfig: '0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f'
    }
  }
};

export const CHAINLINK_ORACLES = {
  ethereum: {
    USDC_USD: '0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E',
    USDT_USD: '0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7',
    ETH_USD: '0x694AA1769357215DE4FAC081bf1f309aDC325306',
    decimals: 8
  }
};