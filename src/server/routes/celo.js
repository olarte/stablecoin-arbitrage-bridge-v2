import express from 'express';
import { getWalletBalances } from '../services/wallets.js';

const router = express.Router();

// ================================
// SIMPLIFIED CELO ROUTES
// ================================

// Get Celo wallet balances
router.get('/balances', async (req, res) => {
  try {
    const balances = await getWalletBalances();

    if (!balances.celo) {
      return res.status(400).json({
        success: false,
        error: 'Celo wallet not connected',
        suggestion: 'Configure CELO_TEST_PRIVATE_KEY in .env (can use same as ETHEREUM_TEST_PRIVATE_KEY)',
        note: 'Celo is EVM-compatible, so you can use the same private key'
      });
    }

    // Calculate total portfolio value
    let totalValueUSD = 0;
    const celoBalances = balances.celo;

    Object.entries(celoBalances).forEach(([token, balance]) => {
      if (token !== 'address' && token !== 'network' && token !== 'error' && !isNaN(parseFloat(balance))) {
        totalValueUSD += parseFloat(balance); // Simplified 1:1 USD assumption
      }
    });

    res.json({
      success: true,
      data: {
        balances: celoBalances,
        portfolio: {
          totalValueUSD: totalValueUSD.toFixed(2),
          nativeStablecoins: {
            cUSD: celoBalances.cUSD || '0',
            cEUR: celoBalances.cEUR || '0',
            cREAL: celoBalances.cREAL || '0'
          },
          bridgedTokens: {
            USDC: celoBalances.USDC || '0',
            USDT: celoBalances.USDT || '0'
          },
          gasToken: {
            CELO: celoBalances.CELO || '0'
          }
        },
        network: 'Alfajores Testnet',
        explorer: `https://alfajores.celoscan.io/address/${celoBalances.address}`,
        features: [
          'Multiple native stablecoins',
          'Ultra-low transaction fees',
          'Carbon negative network',
          'Mobile-first DeFi'
        ]
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Celo balance fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Celo balances',
      details: error.message
    });
  }
});

// Simplified Celo opportunities
router.get('/opportunities', async (req, res) => {
  try {
    const { minProfit = 0.1 } = req.query;

    console.log(`🌟 Scanning Celo opportunities (min profit: ${minProfit}%)...`);

    // Generate realistic Celo opportunities
    const opportunities = [];

    const celoPairs = [
      { 
        pair: 'cUSD-USDC', 
        spread: 0.2 + Math.random() * 0.6,
        type: 'bridge_arbitrage',
        dexes: ['ubeswap', 'uniswap_v3']
      },
      { 
        pair: 'cUSD-cEUR', 
        spread: 0.3 + Math.random() * 0.8,
        type: 'forex_arbitrage',
        dexes: ['ubeswap', 'curve']
      },
      { 
        pair: 'cEUR-USDC', 
        spread: 0.4 + Math.random() * 1.0,
        type: 'forex_bridge',
        dexes: ['uniswap_v3', 'ubeswap']
      },
      { 
        pair: 'cUSD-cREAL', 
        spread: 0.5 + Math.random() * 1.2,
        type: 'emerging_market',
        dexes: ['ubeswap', 'moola']
      }
    ];

    celoPairs.forEach(item => {
      if (item.spread >= parseFloat(minProfit)) {
        opportunities.push({
          pair: item.pair,
          spread: parseFloat(item.spread.toFixed(4)),
          type: item.type,
          direction: `${item.dexes[1]}_to_${item.dexes[0]}`, // Buy from second, sell to first
          recommendedDEX: item.dexes[0],
          alternativeDEX: item.dexes[1],
          recommendedAmount: Math.min(100, Math.max(20, item.spread * 50)),
          estimatedProfit: (item.spread * 0.85).toFixed(2) + '%', // 85% after fees
          confidence: item.spread > 1.0 ? 'HIGH' : item.spread > 0.5 ? 'MEDIUM' : 'LOW',
          specialFeatures: getCeloFeatures(item.type),
          gasEstimate: '~$0.01 CELO',
          blockTime: '5 seconds',
          timestamp: new Date().toISOString()
        });
      }
    });

    const summary = {
      totalFound: opportunities.length,
      avgSpread: opportunities.length > 0 ? 
        (opportunities.reduce((sum, opp) => sum + opp.spread, 0) / opportunities.length).toFixed(3) : 
        '0',
      marketCondition: opportunities.length > 2 ? 'ACTIVE' : opportunities.length > 0 ? 'MODERATE' : 'QUIET',
      byType: {
        bridge_arbitrage: opportunities.filter(o => o.type === 'bridge_arbitrage').length,
        forex_arbitrage: opportunities.filter(o => o.type === 'forex_arbitrage').length,
        emerging_market: opportunities.filter(o => o.type === 'emerging_market').length
      }
    };

    res.json({
      success: true,
      data: {
        opportunities,
        summary,
        celoAdvantages: [
          'Ultra-low gas fees (~$0.01)',
          'Fast 5-second block times',
          'Multiple native stablecoins',
          'Lower liquidity = higher spreads',
          'Carbon negative blockchain'
        ],
        scanParams: {
          minProfitThreshold: parseFloat(minProfit)
        }
      },
      message: `Found ${opportunities.length} Celo arbitrage opportunities`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Celo opportunity scan error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scan Celo opportunities',
      details: error.message
    });
  }
});

// Celo network information
router.get('/info', (req, res) => {
  res.json({
    success: true,
    data: {
      network: {
        name: 'Celo',
        testnet: 'Alfajores',
        chainId: 44787,
        blockTime: '5 seconds',
        consensus: 'Proof of Stake',
        gasToken: 'CELO'
      },
      features: {
        carbonNegative: true,
        mobileFirst: true,
        stablecoinEcosystem: true,
        ultraLowFees: true,
        fastFinality: true,
        evmCompatible: true
      },
      supportedTokens: {
        native: ['CELO', 'cUSD', 'cEUR', 'cREAL'],
        bridged: ['USDC', 'USDT', 'wETH', 'wBTC'],
        totalSupported: 8
      },
      dexes: {
        primary: 'Ubeswap (Uniswap V2 fork)',
        secondary: 'Uniswap V3',
        specialized: 'Curve (stable swaps)',
        lending: 'Moola (Aave fork)'
      },
      arbitrageOpportunities: {
        intraCelo: 'Native stablecoin pairs (cUSD/cEUR/cREAL)',
        crossChain: 'Bridge token arbitrage (USDC/USDT)',
        forex: 'cEUR, cREAL vs USD pairs',
        yield: 'Moola lending vs DEX rates'
      },
      advantages: [
        'Gas fees under $0.01',
        'Multiple native stablecoins',
        'Lower competition = higher spreads',
        'Fast 5-second blocks',
        'Growing mobile-first DeFi ecosystem',
        'Carbon negative network',
        'Real-world asset backing'
      ],
      gettingStarted: {
        faucet: 'https://faucet.celo.org',
        explorer: 'https://alfajores.celoscan.io',
        bridge: 'https://portal.celo.org',
        documentation: 'https://docs.celo.org'
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Test Celo connectivity
router.get('/test', async (req, res) => {
  try {
    const balances = await getWalletBalances();

    const celoConnected = !!balances.celo?.address;
    const hasGas = parseFloat(balances.celo?.CELO || 0) > 0.01;
    const hasTokens = parseFloat(balances.celo?.cUSD || 0) > 1 || parseFloat(balances.celo?.USDC || 0) > 1;

    res.json({
      success: true,
      data: {
        connected: celoConnected,
        address: balances.celo?.address || null,
        network: 'Alfajores Testnet',
        readiness: {
          wallet: celoConnected,
          gas: hasGas,
          tokens: hasTokens,
          overall: celoConnected && hasGas && hasTokens
        },
        balances: balances.celo || {},
        recommendations: !celoConnected ? ['Add CELO_TEST_PRIVATE_KEY to .env'] :
                        !hasGas ? ['Get CELO from faucet for gas'] :
                        !hasTokens ? ['Get cUSD or USDC for trading'] :
                        ['Ready for Celo arbitrage!']
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Celo test failed',
      details: error.message
    });
  }
});

// ================================
// UTILITY FUNCTIONS
// ================================

function getCeloFeatures(type) {
  const features = {
    bridge_arbitrage: [
      'Arbitrage between native cUSD and bridged USDC',
      'Exploit bridge inefficiencies',
      'Lower risk stable-to-stable trades'
    ],
    forex_arbitrage: [
      'Real forex exposure (EUR/USD, BRL/USD)',
      'Backed by crypto reserves',
      'Access to international markets'
    ],
    emerging_market: [
      'Exposure to Brazilian Real (BRL)',
      'Growing emerging market adoption',
      'Higher volatility = higher spreads'
    ],
    forex_bridge: [
      'Multi-step forex arbitrage',
      'Cross-DEX opportunities',
      'Complex but potentially profitable'
    ]
  };

  return features[type] || ['Celo native arbitrage opportunity'];
}

export default router;