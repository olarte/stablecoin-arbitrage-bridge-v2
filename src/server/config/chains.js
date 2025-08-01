export const CHAIN_CONFIG = {
  ethereum: {
    rpc: process.env.SEPOLIA_RPC || 'https://sepolia.gateway.tenderly.co',
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

  // NEW: Celo Network Configuration
  celo: {
    rpc: process.env.CELO_RPC || 'https://alfajores-forno.celo-testnet.org', // Alfajores testnet
    mainnetRpc: 'https://forno.celo.org', // For mainnet later
    chainId: 44787, // Alfajores testnet
    mainnetChainId: 42220, // Celo mainnet

    // Rich stablecoin ecosystem
    tokens: {
      // Native Celo stablecoins
      cUSD: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1',  // Celo Dollar
      cEUR: '0x10c892A6EC43a53E45D0B916B4b7D383B1b78C0F',  // Celo Euro
      cREAL: '0xE4D517785D091D3c54818832dB6094bcc2744545', // Celo Real (Brazilian)

      // Bridge tokens
      USDC: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B',  // Bridged USDC
      USDT: '0x617f3112bf5397D0467D315cC709EF968D9ba546',  // Bridged USDT

      // Native token
      CELO: '0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9',  // Celo native token

      // Wrapped tokens
      wETH: '0x66803FB87aBd4aaC3cbB3fAd7C3aa01f6F3FB207', // Wrapped ETH
      wBTC: '0xd71Ffd0940c920786eC4DbB5A12306669b5b81EF'  // Wrapped BTC
    },

    // Mainnet token addresses (for future use)
    mainnetTokens: {
      cUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
      cEUR: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73',
      cREAL: '0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787',
      USDC: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
      USDT: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e',
      CELO: '0x471EcE3750Da237f93B8E339c536989b8978a438'
    },

    // Uniswap V3 on Celo
    uniswap: {
      factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
      nftManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
    },

    // Ubeswap (Celo's native DEX)
    ubeswap: {
      factory: '0x62d5b84bE28a183aBB507E125B384122D2C25fAE',
      router: '0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121',
      farmingRewards: '0x9D87c01672A7D535a8f48aA2A2329a8d9F78332C'
    },

    // Curve Finance on Celo (for stable swaps)
    curve: {
      tricrypto: '0x7d91E51C8F218d0d51dc1DFCf4C6F9a2cEa0Ee3C',
      cUSDcEURcREAL: '0x1a8ce77f3e8d1db8b7A2e3a4b0e9e6C4d7F2A8b9' // Hypothetical
    },

    // Moola (Celo's lending protocol)
    moola: {
      lendingPool: '0x970b12522CA9b4054807a2c5B736149a5BE6f670',
      priceOracle: '0x4217b46b8b3dBD83F4b0f0F78Dd8eA91e9C2A72E'
    }
  },

  sui: {
    rpc: process.env.SUI_RPC || 'https://fullnode.testnet.sui.io',
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

// Enhanced Chainlink oracles with Celo support
export const CHAINLINK_ORACLES = {
  ethereum: {
    USDC_USD: '0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E',
    USDT_USD: '0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7',
    ETH_USD: '0x694AA1769357215DE4FAC081bf1f309aDC325306',
    decimals: 8
  },

  // Celo has extensive Chainlink oracle support
  celo: {
    // Celo native assets
    CELO_USD: '0x022F9dCC73C5Fb43F2b4eF2EF9ad3eDD1D853946',
    cUSD_USD: '0x99d865Ed50D2C32c1493896810FA386c1Ce81D91',
    cEUR_USD: '0x87d61b8c8f5B8A8fcB6983c5c0d15Dc2689A7F4b',
    cREAL_USD: '0x8F3CbEb8b71b7F7d9e0bBF2e1A4b9A8F2E4D7C6B', // Hypothetical

    // Bridge tokens
    USDC_USD: '0x9d85d5C4DE3C84E6E3C4E9A8F6B5D7C8A9E4F1B2',
    USDT_USD: '0x7A2B4C8D9E6F3A5C7B9D8E4F2A6C1B7E9D5F8A3C',

    // Other assets
    BTC_USD: '0x5F4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    ETH_USD: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',

    decimals: 8
  },

  sui: {
    USDC_USD: null,
    SUI_USD: null,
    decimals: 8
  }
};

// Cross-chain arbitrage pairs
export const ARBITRAGE_PAIRS = {
  stablecoins: [
    // Within Celo ecosystem
    { from: 'cUSD', to: 'USDC', chains: ['celo'] },
    { from: 'cUSD', to: 'cEUR', chains: ['celo'] },
    { from: 'cUSD', to: 'cREAL', chains: ['celo'] },
    { from: 'cEUR', to: 'USDC', chains: ['celo'] },

    // Cross-chain opportunities
    { from: 'USDC', to: 'USDC', chains: ['ethereum', 'celo'] },
    { from: 'USDT', to: 'USDT', chains: ['ethereum', 'celo'] },
    { from: 'cUSD', to: 'USDC', chains: ['celo', 'ethereum'] },
    { from: 'cUSD', to: 'USDC', chains: ['celo', 'sui'] },

    // Three-way arbitrage
    { from: 'USDC', to: 'cUSD', to: 'USDC', chains: ['ethereum', 'celo', 'sui'] }
  ],

  volatile: [
    { from: 'CELO', to: 'ETH', chains: ['celo', 'ethereum'] },
    { from: 'CELO', to: 'SUI', chains: ['celo', 'sui'] }
  ]
};

// DEX configurations by chain
export const DEX_CONFIG = {
  ethereum: {
    primary: 'uniswap_v3',
    secondary: '1inch_fusion'
  },
  celo: {
    primary: 'ubeswap',
    secondary: 'uniswap_v3',
    stable: 'curve'
  },
  sui: {
    primary: 'cetus',
    secondary: 'aftermath'
  }
};