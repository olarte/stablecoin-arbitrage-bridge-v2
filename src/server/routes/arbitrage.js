import express from 'express';
import { checkCrossChainSpread } from '../services/blockchain.js';

const router = express.Router();

// Scan arbitrage opportunities
router.get('/sepolia-sui-yield', async (req, res) => {
  try {
    const { minProfit = 0.3, includeYield = true } = req.query;

    const opportunities = [];
    const tradablePairs = [
      { token: 'USDC', symbol: 'USDC/USD' },
      { token: 'USDT', symbol: 'USDT/USD' }
    ];

    // Check each pair for arbitrage opportunities
    for (const pair of tradablePairs) {
      const spreadCheck = await checkCrossChainSpread('ethereum', 'sui', pair.token, pair.token, parseFloat(minProfit));

      if (spreadCheck.meetsThreshold) {
        opportunities.push({
          pair: `${pair.token} Cross-Chain`,
          direction: 'ETHEREUM_TO_SUI',
          spread: spreadCheck.spread,
          profitPercent: spreadCheck.profitEstimate,
          recommendedAmount: Math.min(5000, 1000 / (spreadCheck.spread / 100)),
          route: 'Sepolia Uniswap V3 → Bridge → Sui Cetus',
          estimatedTime: '25-45 minutes'
        });
      }
    }

    res.json({
      success: true,
      data: {
        arbitrageOpportunities: opportunities,
        totalOpportunities: opportunities.length,
        bestSpread: opportunities.length > 0 ? opportunities[0].spread : '0',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to scan arbitrage opportunities',
      details: error.message
    });
  }
});

export default router;
