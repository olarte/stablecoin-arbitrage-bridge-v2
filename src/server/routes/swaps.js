import express from 'express';
import { randomBytes, createHash } from 'crypto';
import { swapStates, walletConnections, checkCrossChainSpread } from '../services/blockchain.js';
import { executeRealArbitrageTrade, scanForArbitrageOpportunities } from '../services/trading.js';
import { getWalletBalances, getGasPrices } from '../services/wallets.js';

const router = express.Router();

// Enhanced swap state class
class SwapState {
  constructor(config) {
    this.swapId = config.swapId;
    this.fromChain = config.fromChain;
    this.toChain = config.toChain;
    this.fromToken = config.fromToken;
    this.toToken = config.toToken;
    this.amount = config.amount;
    this.walletSession = config.walletSession;
    this.minSpread = config.minSpread;
    this.maxSlippage = config.maxSlippage;
    this.enableAtomicSwap = config.enableAtomicSwap;
    this.hashlock = config.hashlock;
    this.secret = config.secret;
    this.timelock = config.timelock;
    this.status = 'CREATED';
    this.steps = [];
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.chains = config.chains || [config.fromChain, config.toChain]; // Support multi-chain
    this.arbitrageType = config.arbitrageType || 'bilateral';
  }

  updateStatus(newStatus) {
    this.status = newStatus;
    this.updatedAt = new Date().toISOString();
    console.log(`🔄 Swap ${this.swapId} status: ${newStatus}`);
  }

  addStep(step) {
    this.steps.push({
      ...step,
      timestamp: new Date().toISOString()
    });
    this.updatedAt = new Date().toISOString();
  }
}

// ================================
// WALLET STATUS & MANAGEMENT
// ================================

// Get current wallet balances and trading status
router.get('/wallet-status', async (req, res) => {
  try {
    console.log('📊 Fetching enhanced wallet status...');

    const [balances, gasPrices] = await Promise.all([
      getWalletBalances(),
      getGasPrices()
    ]);

    const tradingConfig = {
      enabled: process.env.ENABLE_REAL_TRADING === 'true',
      testnetMode: process.env.TESTNET_MODE !== 'false',
      safetyLimits: {
        maxTradeUSD: parseFloat(process.env.MAX_TRADE_AMOUNT_USD) || 100,
        minProfitPercent: parseFloat(process.env.MIN_PROFIT_THRESHOLD) || 0.3,
        maxSlippagePercent: parseFloat(process.env.MAX_SLIPPAGE_PERCENT) || 2.0
      }
    };

    // Calculate total portfolio value across all chains
    let totalValueUSD = 0;
    const chainValues = {};

    try {
      // Ethereum portfolio
      if (balances.ethereum?.USDC) {
        chainValues.ethereum = parseFloat(balances.ethereum.USDC);
        totalValueUSD += chainValues.ethereum;
      }

      // Sui portfolio
      if (balances.sui?.USDC) {
        chainValues.sui = parseFloat(balances.sui.USDC);
        totalValueUSD += chainValues.sui;
      }

      // Celo portfolio
      if (balances.celo) {
        let celoValue = 0;
        if (balances.celo.cUSD) celoValue += parseFloat(balances.celo.cUSD);
        if (balances.celo.USDC) celoValue += parseFloat(balances.celo.USDC);
        if (balances.celo.cEUR) celoValue += parseFloat(balances.celo.cEUR) * 1.1; // Rough EUR to USD
        if (balances.celo.cREAL) celoValue += parseFloat(balances.celo.cREAL) * 0.2; // Rough BRL to USD

        chainValues.celo = celoValue;
        totalValueUSD += celoValue;
      }
    } catch (error) {
      console.warn('Portfolio calculation error:', error.message);
    }

    // Enhanced readiness check
    const readyForTrading = totalValueUSD > 10 && (
      (balances.ethereum?.address && parseFloat(balances.ethereum?.ETH || 0) > 0.01) ||
      (balances.sui?.address && parseFloat(balances.sui?.SUI || 0) > 0.1) ||
      (balances.celo?.address && parseFloat(balances.celo?.CELO || 0) > 0.1)
    );

    res.json({
      success: true,
      data: {
        wallets: {
          ethereum: {
            connected: !!balances.ethereum?.address,
            address: balances.ethereum?.address,
            balances: balances.ethereum || {},
            portfolioValue: chainValues.ethereum || 0
          },
          sui: {
            connected: !!balances.sui?.address,
            address: balances.sui?.address,
            balances: balances.sui || {},
            portfolioValue: chainValues.sui || 0
          },
          celo: {
            connected: !!balances.celo?.address,
            address: balances.celo?.address,
            balances: balances.celo || {},
            portfolioValue: chainValues.celo || 0
          }
        },
        portfolio: {
          totalValueUSD: totalValueUSD.toFixed(2),
          breakdown: chainValues,
          readyForTrading,
          crossChainCapable: Object.keys(chainValues).length >= 2
        },
        network: {
          ethereum: 'Sepolia Testnet',
          sui: 'Sui Testnet',
          celo: 'Alfajores Testnet',
          gasPrices
        },
        trading: tradingConfig,
        newFeatures: [
          'Full Celo integration',
          'Cross-chain arbitrage (3 chains)',
          'Enhanced portfolio tracking',
          'Multi-stablecoin support'
        ]
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Wallet status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get wallet status',
      details: error.message
    });
  }
});

// ================================
// ARBITRAGE OPPORTUNITY SCANNING
// ================================

// Scan for enhanced arbitrage opportunities including Celo
router.get('/scan-opportunities', async (req, res) => {
  try {
    const { 
      minProfit = 0.3, 
      includeGas = true,
      includeCelo = true,
      includeTriangular = true,
      chainFilter = null
    } = req.query;

    console.log(`🔍 Scanning enhanced arbitrage opportunities...`);
    console.log(`   Min profit: ${minProfit}%`);
    console.log(`   Include Celo: ${includeCelo}`);
    console.log(`   Include triangular: ${includeTriangular}`);

    const opportunities = await scanForArbitrageOpportunities();

    // Filter by minimum profit
    let filteredOpportunities = opportunities.opportunities.filter(
      opp => parseFloat(opp.spread) >= parseFloat(minProfit)
    );

    // Apply chain filter if specified
    if (chainFilter) {
      const chainsToInclude = chainFilter.split(',');
      filteredOpportunities = filteredOpportunities.filter(opp => 
        !opp.chains || opp.chains.some(chain => chainsToInclude.includes(chain))
      );
    }

    // Filter by feature flags
    if (!includeCelo) {
      filteredOpportunities = filteredOpportunities.filter(opp => 
        !opp.chains || !opp.chains.includes('celo')
      );
    }

    if (!includeTriangular) {
      filteredOpportunities = filteredOpportunities.filter(opp => 
        opp.type !== 'triangular'
      );
    }

    // Enhanced risk assessment and enrichment
    const enrichedOpportunities = filteredOpportunities.map(opp => ({
      ...opp,
      riskLevel: calculateRiskLevel(opp),
      recommendedAction: getRecommendedAction(opp),
      gasImpact: includeGas ? estimateGasImpact(opp.recommendedAmount || 50, opp.chains || ['ethereum', 'sui']) : null,
      executionComplexity: getExecutionComplexity(opp),
      profitability: {
        gross: opp.spread,
        estimatedNet: calculateNetProfit(opp),
        confidence: opp.confidence || 'MEDIUM'
      }
    }));

    // Sort by adjusted profitability (considering complexity)
    enrichedOpportunities.sort((a, b) => {
      const scoreA = parseFloat(a.profitability.estimatedNet) - (a.executionComplexity.score * 0.1);
      const scoreB = parseFloat(b.profitability.estimatedNet) - (b.executionComplexity.score * 0.1);
      return scoreB - scoreA;
    });

    // Enhanced summary with breakdown by type
    const summary = {
      totalScanned: opportunities.opportunities.length,
      profitableFound: enrichedOpportunities.length,
      bestOpportunity: enrichedOpportunities[0] || null,
      averageSpread: enrichedOpportunities.length > 0 ? 
        (enrichedOpportunities.reduce((sum, opp) => sum + parseFloat(opp.spread), 0) / enrichedOpportunities.length).toFixed(3) : 
        '0',
      marketCondition: getMarketCondition(enrichedOpportunities),
      breakdown: opportunities.breakdown || {},
      typeBreakdown: {
        bilateral: enrichedOpportunities.filter(o => o.type?.includes('cross_chain') || o.type === 'bilateral').length,
        triangular: enrichedOpportunities.filter(o => o.type === 'triangular').length,
        celoNative: enrichedOpportunities.filter(o => o.type === 'celo_native').length,
        bridgeArbitrage: enrichedOpportunities.filter(o => o.arbitrageType === 'bridge_arbitrage').length
      }
    };

    console.log(`✅ Enhanced scan complete: ${summary.profitableFound}/${summary.totalScanned} profitable`);
    console.log(`   Best opportunity: ${summary.bestOpportunity?.pair} (${summary.bestOpportunity?.spread}%)`);

    res.json({
      success: true,
      data: {
        opportunities: enrichedOpportunities,
        summary,
        scanParams: {
          minProfitThreshold: parseFloat(minProfit),
          includeGasEstimates: includeGas,
          includeCelo,
          includeTriangular,
          chainFilter
        },
        newCapabilities: [
          'Celo cross-chain arbitrage',
          'Triangular arbitrage detection',
          'Multi-stablecoin opportunities',
          'Enhanced risk assessment'
        ]
      },
      message: summary.profitableFound > 0 ? 
        `Found ${summary.profitableFound} profitable opportunities! Best: ${summary.bestOpportunity?.pair} (${summary.bestOpportunity?.spread}%)` :
        'No profitable opportunities found at current market prices',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Enhanced opportunity scan error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scan arbitrage opportunities',
      details: error.message
    });
  }
});

// ================================
// ENHANCED TRADING EXECUTION
// ================================

// Execute enhanced arbitrage trade (supports all directions including Celo)
router.post('/execute-arbitrage', async (req, res) => {
  try {
    const {
      tokenPair,
      amount,
      direction, // Now supports: 'eth_to_sui', 'sui_to_eth', 'eth_to_celo', 'celo_to_eth', 'sui_to_celo', 'celo_to_sui'
      expectedSpread,
      maxSlippage = 1.0,
      confirmRealMoney = false,
      dryRun = false
    } = req.body;

    // Enhanced validation
    if (!tokenPair || !amount || !direction || !expectedSpread) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['tokenPair', 'amount', 'direction', 'expectedSpread']
      });
    }

    // Validate supported directions
    const supportedDirections = [
      'eth_to_sui', 'sui_to_eth',
      'eth_to_celo', 'celo_to_eth', 
      'sui_to_celo', 'celo_to_sui',
      'celo_native'
    ];

    if (!supportedDirections.includes(direction)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported direction: ${direction}`,
        supportedDirections
      });
    }

    if (!confirmRealMoney && !dryRun) {
      return res.status(400).json({
        success: false,
        error: 'Must confirm real money trading or enable dry run',
        message: 'Set confirmRealMoney=true for real trades or dryRun=true for simulation',
        warning: 'Real trades use actual testnet tokens and gas'
      });
    }

    if (!dryRun && process.env.ENABLE_REAL_TRADING !== 'true') {
      return res.status(403).json({
        success: false,
        error: 'Real trading not enabled',
        message: 'Set ENABLE_REAL_TRADING=true in .env file',
        suggestion: 'Use dryRun=true for simulation'
      });
    }

    // Enhanced safety limits
    const maxAmount = parseFloat(process.env.MAX_TRADE_AMOUNT_USD) || 100;
    if (amount > maxAmount) {
      return res.status(400).json({
        success: false,
        error: `Trade amount ${amount} exceeds safety limit ${maxAmount}`,
        suggestion: `Reduce amount to ${maxAmount} or lower`
      });
    }

    // Enhanced logging
    console.log(`\n🚨 ${dryRun ? 'DRY RUN' : 'REAL'} ENHANCED ARBITRAGE TRADE:`);
    console.log(`================================================`);
    console.log(`   Pair: ${tokenPair}`);
    console.log(`   Amount: $${amount}`);
    console.log(`   Direction: ${direction}`);
    console.log(`   Expected Spread: ${expectedSpread}%`);
    console.log(`   Max Slippage: ${maxSlippage}%`);
    console.log(`   Mode: ${dryRun ? 'SIMULATION' : 'REAL TRADING'}`);
    console.log(`   Chains: ${getInvolvedChains(direction).join(' → ')}`);
    console.log(`================================================`);

    if (dryRun) {
      // Enhanced simulation
      const simulationResult = {
        success: true,
        tradeId: `sim_${Date.now()}`,
        mode: 'SIMULATION',
        type: 'enhanced_arbitrage',
        summary: {
          tokenPair,
          amount,
          direction,
          expectedSpread,
          actualProfit: (expectedSpread * getEfficiencyMultiplier(direction)).toFixed(2),
          profitUSD: (amount * expectedSpread * getEfficiencyMultiplier(direction) * 0.01).toFixed(2),
          involvedChains: getInvolvedChains(direction),
          estimatedGasCost: estimateGasForDirection(direction)
        },
        transactions: generateSimulatedTransactions(direction),
        note: 'This was a simulation - no real transactions were executed',
        enhancedFeatures: [
          'Celo support included',
          'Multi-chain execution',
          'Optimized gas routing'
        ]
      };

      console.log(`✅ ENHANCED SIMULATION COMPLETED`);
      return res.json({
        success: true,
        data: simulationResult,
        timestamp: new Date().toISOString()
      });
    }

    // Execute real enhanced trade
    const tradeResult = await executeRealArbitrageTrade({
      tokenPair,
      amount,
      direction,
      expectedSpread,
      maxSlippage
    });

    // Enhanced logging
    if (tradeResult.success) {
      console.log(`✅ ENHANCED ARBITRAGE TRADE COMPLETED SUCCESSFULLY!`);
      console.log(`💰 Profit: ${tradeResult.summary.actualProfit}% (~$${tradeResult.summary.profitUSD})`);
      console.log(`🌐 Chains: ${getInvolvedChains(direction).join(' → ')}`);
    } else {
      console.log(`❌ ENHANCED ARBITRAGE TRADE FAILED: ${tradeResult.error}`);
    }

    res.json({
      success: tradeResult.success,
      data: {
        ...tradeResult,
        type: 'enhanced_arbitrage',
        involvedChains: getInvolvedChains(direction)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Enhanced arbitrage execution error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute enhanced arbitrage trade',
      details: error.message
    });
  }
});

// NEW: Execute multi-chain arbitrage (2-3 chains)
router.post('/execute-enhanced-arbitrage', async (req, res) => {
  try {
    const {
      chains, // ['ethereum', 'celo'] or ['ethereum', 'sui', 'celo']
      tokens, // ['USDC', 'cUSD'] or ['USDC', 'USDC', 'cUSD']
      amount,
      expectedSpread,
      maxSlippage = 1.5,
      confirmRealMoney = false,
      dryRun = false
    } = req.body;

    // Enhanced validation for multi-chain
    if (!chains || !Array.isArray(chains) || chains.length < 2 || chains.length > 3) {
      return res.status(400).json({
        success: false,
        error: 'Chains must be an array of 2-3 supported chains',
        supportedChains: ['ethereum', 'sui', 'celo'],
        examples: [
          ['ethereum', 'celo'],
          ['sui', 'celo'],
          ['ethereum', 'sui', 'celo']
        ]
      });
    }

    if (!tokens || !Array.isArray(tokens) || tokens.length !== chains.length) {
      return res.status(400).json({
        success: false,
        error: 'Tokens array must match chains array length',
        example: 'For chains: ["ethereum", "celo"], tokens: ["USDC", "cUSD"]'
      });
    }

    // Validate supported chains
    const supportedChains = ['ethereum', 'sui', 'celo'];
    const invalidChains = chains.filter(chain => !supportedChains.includes(chain));
    if (invalidChains.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Unsupported chains: ${invalidChains.join(', ')}`,
        supportedChains
      });
    }

    if (!confirmRealMoney && !dryRun) {
      return res.status(400).json({
        success: false,
        error: 'Must confirm real money trading or enable dry run',
        message: 'Set confirmRealMoney=true for real trades or dryRun=true for simulation',
        warning: 'Multi-chain trades involve multiple transaction fees'
      });
    }

    // Enhanced safety limits for multi-chain
    const maxAmount = parseFloat(process.env.MAX_TRADE_AMOUNT_USD) || 100;
    if (amount > maxAmount) {
      return res.status(400).json({
        success: false,
        error: `Trade amount ${amount} exceeds safety limit ${maxAmount}`,
        suggestion: `Multi-chain trades have higher complexity - reduce amount to ${maxAmount} or lower`
      });
    }

    const arbitrageType = chains.length === 3 ? 'triangular' : 'bilateral';

    console.log(`\n🌐 ${dryRun ? 'DRY RUN' : 'REAL'} ENHANCED CROSS-CHAIN ARBITRAGE:`);
    console.log(`===============================================`);
    console.log(`   Type: ${arbitrageType.toUpperCase()}`);
    console.log(`   Chains: ${chains.join(' → ')}`);
    console.log(`   Tokens: ${tokens.join(' → ')}`);
    console.log(`   Amount: $${amount}`);
    console.log(`   Expected Spread: ${expectedSpread}%`);
    console.log(`   Max Slippage: ${maxSlippage}%`);
    console.log(`   Complexity: ${arbitrageType === 'triangular' ? 'HIGH' : 'MEDIUM'}`);
    console.log(`===============================================`);

    if (dryRun) {
      // Enhanced multi-chain simulation
      const simulationResult = {
        success: true,
        tradeId: `multi_sim_${Date.now()}`,
        mode: 'SIMULATION',
        type: 'enhanced_multi_chain_arbitrage',
        arbitrageType,
        summary: {
          chains,
          tokens,
          amount,
          expectedSpread,
          actualProfit: (expectedSpread * getMultiChainEfficiency(chains)).toFixed(2),
          profitUSD: (amount * expectedSpread * getMultiChainEfficiency(chains) * 0.01).toFixed(2),
          complexity: arbitrageType === 'triangular' ? 'HIGH' : 'MEDIUM',
          estimatedTime: arbitrageType === 'triangular' ? '10-15 minutes' : '5-8 minutes'
        },
        execution: {
          steps: generateMultiChainSteps(chains, tokens),
          estimatedGas: estimateMultiChainGas(chains),
          riskFactors: getMultiChainRisks(chains)
        },
        note: 'This was a multi-chain simulation - no real transactions were executed'
      };

      console.log(`✅ MULTI-CHAIN SIMULATION COMPLETED`);
      return res.json({
        success: true,
        data: simulationResult,
        timestamp: new Date().toISOString()
      });
    }

    // Execute real enhanced cross-chain arbitrage
    const result = await executeEnhancedCrossChainArbitrage({
      chains,
      tokens,
      amount,
      expectedSpread,
      maxSlippage
    });

    // Enhanced logging
    if (result.success) {
      console.log(`✅ ENHANCED CROSS-CHAIN ARBITRAGE COMPLETED!`);
      console.log(`🌐 Type: ${result.type}`);
      console.log(`💰 Estimated Profit: ${result.summary?.profitability || 'Calculating...'}`);
    } else {
      console.log(`❌ ENHANCED CROSS-CHAIN ARBITRAGE FAILED: ${result.error}`);
    }

    res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Enhanced cross-chain arbitrage error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute enhanced cross-chain arbitrage',
      details: error.message
    });
  }
});

// ================================
// ENHANCED ATOMIC SWAP FUNCTIONALITY
// ================================

// Create enhanced bidirectional atomic swap (supports Celo)
router.post('/bidirectional-real', async (req, res) => {
  try {
    const {
      fromChain,
      toChain, 
      fromToken,
      toToken,
      amount,
      sessionId,
      minSpread = 0.5,
      maxSlippage = 1,
      enableAtomicSwap = true,
      timeoutMinutes = 60
    } = req.body;

    // Enhanced supported pairs including Celo
    const supportedPairs = [
      { from: 'ethereum', to: 'sui', via: 'native' },
      { from: 'sui', to: 'ethereum', via: 'native' },
      { from: 'ethereum', to: 'celo', via: 'bridge' },
      { from: 'celo', to: 'ethereum', via: 'bridge' },
      { from: 'sui', to: 'celo', via: 'bridge' },
      { from: 'celo', to: 'sui', via: 'bridge' }
    ];

    const swapPair = supportedPairs.find(p => p.from === fromChain && p.to === toChain);
    if (!swapPair) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported swap direction',
        supportedPairs: supportedPairs.map(p => `${p.from} → ${p.to} (${p.via})`)
      });
    }

    // Validate wallet session
    const walletSession = walletConnections.get(sessionId);
    if (!walletSession) {
      return res.status(400).json({
        success: false,
        error: 'Wallet session not found. Please connect wallets first.',
        suggestion: 'Use POST /api/wallet/register to register wallet session'
      });
    }

    // Enhanced wallet validation for all chains
    const walletValidation = validateWalletsForSwap(walletSession, fromChain, toChain);
    if (!walletValidation.valid) {
      return res.status(400).json({
        success: false,
        error: walletValidation.error,
        requiredWallets: walletValidation.required
      });
    }

    // Generate atomic swap components
    const swapId = `atomic_${Date.now()}_${randomBytes(8).toString('hex')}`;
    const secret = randomBytes(32);
    const hashlock = createHash('sha256').update(secret).digest('hex');
    const timelock = Math.floor(Date.now() / 1000) + (timeoutMinutes * 60);

    // Enhanced cross-chain spread check
    console.log(`🔍 Checking enhanced cross-chain spread for ${fromChain} → ${toChain}`);
    const spreadCheck = await checkCrossChainSpread(fromChain, toChain, fromToken, toToken, minSpread);

    if (!spreadCheck.meetsThreshold) {
      return res.status(400).json({
        success: false,
        error: `Insufficient spread: ${spreadCheck.spread}% < ${minSpread}%`,
        spreadCheck,
        suggestion: `Wait for spread ≥ ${minSpread}% or lower minSpread parameter`,
        currentMarketCondition: spreadCheck.marketCondition || 'UNKNOWN'
      });
    }

    // Initialize enhanced swap state
    const swapState = new SwapState({
      swapId,
      fromChain,
      toChain,
      fromToken,
      toToken,
      amount,
      walletSession,
      minSpread,
      maxSlippage,
      enableAtomicSwap,
      hashlock,
      secret: secret.toString('hex'),
      timelock,
      chains: [fromChain, toChain],
      arbitrageType: 'atomic_swap'
    });

    swapState.spreadCheck = spreadCheck;

    // Create enhanced execution plan
    const executionPlan = createEnhancedExecutionPlan({
      fromChain,
      toChain,
      fromToken,
      toToken,
      amount,
      walletSession,
      spreadCheck,
      swapPair
    });

    swapState.executionPlan = executionPlan;
    swapState.updateStatus('PLAN_CREATED');
    swapStates.set(swapId, swapState);

    console.log(`✅ Created enhanced atomic swap: ${swapId}`);
    console.log(`   Route: ${fromChain} → ${toChain} (${swapPair.via})`);
    console.log(`   Spread: ${spreadCheck.spread}%`);
    console.log(`   Expected Profit: ${executionPlan.expectedProfit.netProfit}`);

    res.json({
      success: true,
      data: {
        swapId,
        executionPlan,
        spreadCheck,
        walletInfo: {
          fromWallet: executionPlan.wallets.fromChain,
          toWallet: executionPlan.wallets.toChain,
          signaturesRequired: executionPlan.steps.filter(s => s.requiresSignature).length
        },
        atomicComponents: enableAtomicSwap ? {
          hashlock,
          timelock: new Date(timelock * 1000).toISOString(),
          secretRequired: true,
          expiresIn: `${timeoutMinutes} minutes`
        } : null,
        estimatedProfit: executionPlan.expectedProfit,
        enhancedFeatures: [
          'Celo integration support',
          'Multi-DEX routing',
          'Optimized gas usage',
          'Enhanced monitoring'
        ],
        nextStep: 'Use POST /api/swap/execute-step to begin execution'
      }
    });

  } catch (error) {
    console.error('Enhanced atomic swap creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create enhanced atomic swap',
      details: error.message
    });
  }
});

// Enhanced swap status with detailed progress
router.get('/status-real/:swapId', async (req, res) => {
  try {
    const { swapId } = req.params;
    const swapState = swapStates.get(swapId);

    if (!swapState) {
      return res.status(404).json({
        success: false,
        error: 'Swap not found',
        suggestion: 'Check swapId or create new swap'
      });
    }

    // Calculate enhanced progress
    const completedSteps = swapState.executionPlan.steps.filter(s => s.status === 'COMPLETED').length;
    const failedSteps = swapState.executionPlan.steps.filter(s => s.status === 'FAILED').length;
    const totalSteps = swapState.executionPlan.steps.length;
    const progress = Math.round((completedSteps / totalSteps) * 100);

    // Check for expiration
    const currentTime = Math.floor(Date.now() / 1000);
    const isExpired = currentTime > swapState.timelock;
    if (isExpired && swapState.status !== 'EXPIRED') {
      swapState.updateStatus('EXPIRED');
    }

    // Get current spread for comparison (enhanced)
    let currentSpread = null;
    try {
      currentSpread = await checkCrossChainSpread(
        swapState.fromChain,
        swapState.toChain,
        swapState.fromToken,
        swapState.toToken,
        swapState.minSpread
      );
    } catch (error) {
      console.log('Could not fetch current spread:', error.message);
    }

    // Enhanced next action determination
    let nextAction = 'Complete';
    let currentStepIndex = swapState.executionPlan.steps.findIndex(s => s.status === 'PENDING');
    if (currentStepIndex >= 0) {
      const currentStep = swapState.executionPlan.steps[currentStepIndex];
      nextAction = `Execute step ${currentStepIndex + 1}: ${currentStep.type}`;
    }

    res.json({
      success: true,
      data: {
        swapId,
        status: swapState.status,
        type: swapState.arbitrageType || 'atomic_swap',
        progress: {
          percentage: progress,
          completedSteps,
          failedSteps,
          totalSteps,
          currentStep: currentStepIndex >= 0 ? currentStepIndex : totalSteps,
          nextAction
        },

        // Enhanced swap configuration
        config: {
          fromChain: swapState.fromChain,
          toChain: swapState.toChain,
          fromToken: swapState.fromToken,
          toToken: swapState.toToken,
          amount: swapState.amount,
          minSpread: swapState.minSpread,
          maxSlippage: swapState.maxSlippage,
          chains: swapState.chains,
          complexity: swapState.chains?.length > 2 ? 'HIGH' : 'MEDIUM'
        },

        // Enhanced spread analysis
        spreadAnalysis: {
          initial: swapState.spreadCheck ? swapState.spreadCheck.spread : null,
          current: currentSpread ? currentSpread.spread : null,
          stillProfitable: currentSpread ? currentSpread.meetsThreshold : null,
          direction: currentSpread ? currentSpread.direction : null,
          change: currentSpread && swapState.spreadCheck ? 
            (currentSpread.spread - swapState.spreadCheck.spread).toFixed(3) : null,
          marketCondition: currentSpread?.marketCondition || 'UNKNOWN'
        },

        // Enhanced timing information
        timing: {
          created: swapState.createdAt,
          updated: swapState.updatedAt,
          timeRemaining: Math.max(0, swapState.timelock - currentTime),
          isExpired,
          timelockISO: new Date(swapState.timelock * 1000).toISOString(),
          estimatedCompletion: getEstimatedCompletion(swapState)
        },

        // Enhanced atomic guarantees
        atomicGuarantees: swapState.enableAtomicSwap ? {
          hashlock: swapState.hashlock,
          secretRevealed: swapState.status === 'COMPLETED',
          canRefund: isExpired || swapState.status === 'FAILED',
          securityLevel: 'HIGH'
        } : null,

        // Enhanced execution details
        execution: {
          plan: swapState.executionPlan,
          stepHistory: swapState.steps,
          enhancedFeatures: [
            'Real-time progress tracking',
            'Dynamic spread monitoring',
            'Multi-chain support',
            'Enhanced security'
          ]
        }
      }
    });

  } catch (error) {
    console.error('Enhanced status fetch error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enhanced swap status',
      details: error.message
    });
  }
});

// ================================
// ENHANCED UTILITY FUNCTIONS
// ================================

function calculateRiskLevel(opportunity) {
  let riskScore = 0;

  // Spread-based risk
  if (opportunity.spread > 2.0) riskScore += 0; // Low risk
  else if (opportunity.spread > 1.0) riskScore += 1; // Medium risk  
  else riskScore += 2; // High risk

  // Chain-based risk
  if (opportunity.chains?.includes('ethereum')) riskScore += 1; // Higher gas costs
  if (opportunity.type === 'triangular') riskScore += 2; // Complex execution
  if (opportunity.type === 'celo_native') riskScore -= 1; // Lower risk due to low fees

  // Confidence-based risk
  if (opportunity.confidence === 'LOW') riskScore += 1;

  if (riskScore <= 1) return 'LOW';
  else if (riskScore <= 3) return 'MEDIUM';
  else return 'HIGH';
}

function getRecommendedAction(opportunity) {
  if (opportunity.spread > 1.5 && opportunity.confidence === 'HIGH') return 'EXECUTE_IMMEDIATELY';
  if (opportunity.spread > 1.0) return 'EXECUTE';
  if (opportunity.spread > 0.5) return 'MONITOR_CLOSELY';
  return 'MONITOR';
}

function getExecutionComplexity(opportunity) {
  let score = 1; // Base complexity

  if (opportunity.type === 'triangular') score += 3;
  if (opportunity.chains?.includes('ethereum')) score += 1;
  if (opportunity.chains?.length > 2) score += 2;
  if (opportunity.arbitrageType === 'bridge_arbitrage') score += 1;

  return {
    score,
    level: score <= 2 ? 'LOW' : score <= 4 ? 'MEDIUM' : 'HIGH',
    description: getComplexityDescription(score)
  };
}

function getComplexityDescription(score) {
  if (score <= 2) return 'Simple execution, low gas costs';
  if (score <= 4) return 'Moderate complexity, multiple transactions';
  return 'Complex execution, high gas costs, multiple chains';
}

function calculateNetProfit(opportunity) {
  let netProfit = opportunity.spread;

  // Deduct estimated fees
  if (opportunity.chains?.includes('ethereum')) netProfit -= 0.3; // High gas costs
  if (opportunity.type === 'triangular') netProfit -= 0.2; // Additional complexity
  if (opportunity.type === 'celo_native') netProfit -= 0.05; // Very low fees
  else netProfit -= 0.1; // Standard DEX fees

  return Math.max(0, netProfit).toFixed(3);
}

function getMarketCondition(opportunities) {
  if (opportunities.length > 5) return 'VERY_ACTIVE';
  if (opportunities.length > 3) return 'ACTIVE';
  if (opportunities.length > 1) return 'MODERATE';
  if (opportunities.length > 0) return 'QUIET';
  return 'DORMANT';
}

function getInvolvedChains(direction) {
  const chainMap = {
    'eth_to_sui': ['ethereum', 'sui'],
    'sui_to_eth': ['sui', 'ethereum'],
    'eth_to_celo': ['ethereum', 'celo'],
    'celo_to_eth': ['celo', 'ethereum'],
    'sui_to_celo': ['sui', 'celo'],
    'celo_to_sui': ['celo', 'sui'],
    'celo_native': ['celo']
  };
  return chainMap[direction] || ['unknown'];
}

function getEfficiencyMultiplier(direction) {
  // Different directions have different efficiency due to gas costs
  const efficiencyMap = {
    'eth_to_sui': 0.75, // Ethereum gas costs reduce efficiency
    'sui_to_eth': 0.75,
    'eth_to_celo': 0.80, // Celo's low fees help
    'celo_to_eth': 0.75,
    'sui_to_celo': 0.90, // Both low fee chains
    'celo_to_sui': 0.90,
    'celo_native': 0.95  // Lowest fees
  };
  return efficiencyMap[direction] || 0.80;
}

function estimateGasForDirection(direction) {
  const gasMap = {
    'eth_to_sui': '$3.50',
    'sui_to_eth': '$3.50',
    'eth_to_celo': '$2.75',
    'celo_to_eth': '$2.75',
    'sui_to_celo': '$0.05',
    'celo_to_sui': '$0.05',
    'celo_native': '$0.02'
  };
  return gasMap[direction] || '$2.00';
}

function generateSimulatedTransactions(direction) {
  const chains = getInvolvedChains(direction);
  const transactions = {};

  chains.forEach((chain, index) => {
    transactions[`step${index + 1}`] = {
      txHash: `0xSIMULATED_${chain.toUpperCase()}_${Date.now()}`,
      chain,
      status: 'simulated',
      gasUsed: chain === 'ethereum' ? '180000' : '100000'
    };
  });

  return transactions;
}

function getMultiChainEfficiency(chains) {
  let efficiency = 0.95; // Base efficiency

  if (chains.includes('ethereum')) efficiency -= 0.15; // Gas costs
  if (chains.length === 3) efficiency -= 0.10; // Complexity
  if (chains.includes('celo')) efficiency += 0.05; // Low fees

  return Math.max(0.5, efficiency);
}

function generateMultiChainSteps(chains, tokens) {
  return chains.map((chain, index) => ({
    step: index + 1,
    chain,
    token: tokens[index],
    action: index === 0 ? 'SELL' : index === chains.length - 1 ? 'BUY' : 'SWAP',
    estimatedTime: chain === 'ethereum' ? '2-5 minutes' : '30-60 seconds'
  }));
}

function estimateMultiChainGas(chains) {
  const gasEstimates = {
    ethereum: 5.0,
    sui: 0.01,
    celo: 0.01
  };

  const total = chains.reduce((sum, chain) => sum + (gasEstimates[chain] || 1), 0);

  return {
    breakdown: chains.map(chain => ({ chain, cost: `$${gasEstimates[chain] || 1}` })),
    total: `$${total.toFixed(2)}`
  };
}

function getMultiChainRisks(chains) {
  const risks = [];

  if (chains.includes('ethereum')) risks.push('High gas costs on Ethereum');
  if (chains.length === 3) risks.push('Complex execution with multiple failure points');
  if (chains.includes('celo') && chains.includes('ethereum')) {
    risks.push('Bridge delays between major ecosystems');
  }

  return risks.length > 0 ? risks : ['Standard arbitrage risks apply'];
}

function validateWalletsForSwap(walletSession, fromChain, toChain) {
  const required = [];
  const errors = [];

  if (fromChain === 'ethereum' || toChain === 'ethereum') {
    required.push('ethereum');
    if (!walletSession.evmAddress) {
      errors.push('Ethereum wallet required');
    }
  }

  if (fromChain === 'sui' || toChain === 'sui') {
    required.push('sui');
    if (!walletSession.suiAddress) {
      errors.push('Sui wallet required');
    }
  }

  if (fromChain === 'celo' || toChain === 'celo') {
    required.push('celo');
    if (!walletSession.celoAddress && !walletSession.evmAddress) {
      errors.push('Celo wallet required (EVM compatible)');
    }
  }

  return {
    valid: errors.length === 0,
    error: errors.join(', '),
    required
  };
}

function createEnhancedExecutionPlan(config) {
  const { fromChain, toChain, fromToken, toToken, amount, walletSession, spreadCheck, swapPair } = config;

  // Create execution steps based on swap pair type
  const steps = [];

  if (swapPair.via === 'native') {
    steps.push(
      {
        type: 'SPREAD_VERIFICATION',
        description: 'Verify profitable spread exists',
        status: 'COMPLETED',
        result: `${spreadCheck.spread}% spread confirmed`
      },
      {
        type: 'WALLET_PREPARATION',
        description: 'Prepare wallet signatures and approvals',
        status: 'PENDING',
        requiresSignature: true,
        chain: fromChain
      },
      {
        type: 'SOURCE_SWAP',
        description: `Swap ${fromToken} → bridge token on ${fromChain}`,
        status: 'PENDING',
        requiresSignature: true,
        chain: fromChain,
        estimatedGas: getChainGasEstimate(fromChain)
      },
      {
        type: 'BRIDGE_TRANSFER',
        description: `Bridge tokens from ${fromChain} to ${toChain}`,
        status: 'PENDING',
        estimatedTime: '5-15 minutes',
        bridgeFee: '~0.1%'
      },
      {
        type: 'DESTINATION_SWAP',
        description: `Swap bridge token → ${toToken} on ${toChain}`,
        status: 'PENDING',
        requiresSignature: true,
        chain: toChain,
        estimatedGas: getChainGasEstimate(toChain)
      }
    );
  } else {
    // Bridge-based swaps (for Celo)
    steps.push(
      {
        type: 'SPREAD_VERIFICATION',
        description: 'Verify profitable spread exists',
        status: 'COMPLETED',
        result: `${spreadCheck.spread}% spread confirmed`
      },
      {
        type: 'BRIDGE_PREPARATION',
        description: `Prepare ${fromChain} → ${toChain} bridge`,
        status: 'PENDING',
        requiresSignature: true,
        chain: fromChain
      },
      {
        type: 'SOURCE_SWAP',
        description: `Swap ${fromToken} on ${fromChain}`,
        status: 'PENDING',
        requiresSignature: true,
        chain: fromChain,
        estimatedGas: getChainGasEstimate(fromChain)
      },
      {
        type: 'BRIDGE_EXECUTION',
        description: `Execute bridge transfer`,
        status: 'PENDING',
        estimatedTime: '2-8 minutes',
        bridgeFee: '~0.1-0.3%'
      },
      {
        type: 'DESTINATION_SWAP',
        description: `Swap to ${toToken} on ${toChain}`,
        status: 'PENDING',
        requiresSignature: true,
        chain: toChain,
        estimatedGas: getChainGasEstimate(toChain)
      }
    );
  }

  return {
    type: `${fromChain.toUpperCase()}_${toChain.toUpperCase()}_${swapPair.via.toUpperCase()}_SWAP`,
    route: `${fromChain.toUpperCase()} → ${toChain.toUpperCase()}`,
    wallets: {
      fromChain: getWalletAddress(walletSession, fromChain),
      toChain: getWalletAddress(walletSession, toChain)
    },
    steps,
    estimatedTime: swapPair.via === 'bridge' ? '10-20 minutes' : '15-30 minutes',
    estimatedFees: {
      dexFees: '0.3-0.6%',
      bridgeFees: swapPair.via === 'bridge' ? '0.1-0.3%' : '0.1%',
      gasFees: estimateGasForPair(fromChain, toChain),
      totalFees: '~0.7-1.5%'
    },
    expectedProfit: {
      grossSpread: `${spreadCheck.spread}%`,
      netProfit: `${(spreadCheck.spread * 0.65).toFixed(2)}%`, // Conservative estimate
      estimatedUSD: `$${(amount * spreadCheck.spread * 0.0065).toFixed(2)}`
    }
  };
}

function getChainGasEstimate(chain) {
  const estimates = {
    ethereum: '~0.005 ETH',
    sui: '~0.001 SUI',
    celo: '~0.001 CELO'
  };
  return estimates[chain] || '~0.001 tokens';
}

function getWalletAddress(walletSession, chain) {
  if (chain === 'ethereum') return walletSession.evmAddress;
  if (chain === 'sui') return walletSession.suiAddress;
  if (chain === 'celo') return walletSession.celoAddress || walletSession.evmAddress;
  return null;
}

function estimateGasForPair(fromChain, toChain) {
  const costs = { ethereum: 5, sui: 0.01, celo: 0.01 };
  const total = (costs[fromChain] || 1) + (costs[toChain] || 1);
  return `$${total.toFixed(2)}`;
}

function getEstimatedCompletion(swapState) {
  const currentStep = swapState.executionPlan.steps.findIndex(s => s.status === 'PENDING');
  if (currentStep === -1) return 'Completed';

  const remainingSteps = swapState.executionPlan.steps.length - currentStep;
  const avgTimePerStep = 3; // minutes
  const estimatedMinutes = remainingSteps * avgTimePerStep;

  const completionTime = new Date(Date.now() + estimatedMinutes * 60000);
  return completionTime.toISOString();
}

function estimateGasImpact(tradeAmountUSD, chains = ['ethereum', 'sui']) {
  const gasEstimates = {
    ethereum: 5, // $5
    sui: 0.01,   // $0.01
    celo: 0.01   // $0.01
  };

  const totalGasCost = chains.reduce((sum, chain) => sum + (gasEstimates[chain] || 1), 0);

  return {
    totalGasCostUSD: totalGasCost.toFixed(2),
    percentageOfTrade: ((totalGasCost / tradeAmountUSD) * 100).toFixed(2),
    breakdown: chains.map(chain => ({
      chain,
      cost: `$${gasEstimates[chain] || 1}`,
      impact: `${((gasEstimates[chain] || 1) / tradeAmountUSD * 100).toFixed(2)}%`
    })),
    recommendation: totalGasCost / tradeAmountUSD > 0.1 ? 
      'Consider larger trade size to reduce gas impact' : 
      'Gas impact acceptable'
  };
}

// ================================
// ENHANCED HEALTH & INFO ENDPOINTS
// ================================

// Enhanced trading system health check
router.get('/health', async (req, res) => {
  try {
    const [balances, gasPrices] = await Promise.all([
      getWalletBalances().catch(() => ({})),
      getGasPrices().catch(() => ({}))
    ]);

    const healthStatus = {
      trading: {
        enabled: process.env.ENABLE_REAL_TRADING === 'true',
        testnetMode: process.env.TESTNET_MODE !== 'false',
        enhancedFeatures: true
      },
      wallets: {
        ethereum: !!balances.ethereum?.address,
        sui: !!balances.sui?.address,
        celo: !!balances.celo?.address
      },
      network: {
        ethereum: 'Sepolia Testnet',
        sui: 'Sui Testnet',
        celo: 'Alfajores Testnet'
      },
      capabilities: {
        crossChainArbitrage: true,
        triangularArbitrage: true,
        celoIntegration: true,
        atomicSwaps: true,
        multiStablecoin: true
      },
      activeSwaps: swapStates.size,
      systemTime: new Date().toISOString(),
      version: '2.0.0-enhanced'
    };

    res.json({
      success: true,
      status: 'healthy',
      data: healthStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

export default router;