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
    console.log('📊 Fetching wallet status...');

    const [balances, gasPrices] = await Promise.all([
      getWalletBalances(),
      getGasPrices()
    ]);

    const tradingConfig = {
      enabled: process.env.ENABLE_REAL_TRADING === 'true',
      testnetMode: process.env.TESTNET_MODE === 'true',
      safetyLimits: {
        maxTradeUSD: parseFloat(process.env.MAX_TRADE_AMOUNT_USD) || 100,
        minProfitPercent: parseFloat(process.env.MIN_PROFIT_THRESHOLD) || 0.3,
        maxSlippagePercent: parseFloat(process.env.MAX_SLIPPAGE_PERCENT) || 2.0
      }
    };

    // Calculate total portfolio value (simplified)
    let totalValueUSD = 0;
    try {
      if (balances.ethereum?.USDC) totalValueUSD += parseFloat(balances.ethereum.USDC);
      if (balances.sui?.USDC) totalValueUSD += parseFloat(balances.sui.USDC);
    } catch (error) {
      console.warn('Portfolio calculation error:', error.message);
    }

    res.json({
      success: true,
      data: {
        wallets: {
          ethereum: {
            connected: !!balances.ethereum?.address,
            address: balances.ethereum?.address,
            balances: balances.ethereum || {}
          },
          sui: {
            connected: !!balances.sui?.address,
            address: balances.sui?.address,
            balances: balances.sui || {}
          }
        },
        portfolio: {
          totalValueUSD: totalValueUSD.toFixed(2),
          readyForTrading: totalValueUSD > 10 // Need at least $10 to trade
        },
        network: {
          ethereum: 'Sepolia Testnet',
          sui: 'Sui Testnet',
          gasPrices
        },
        trading: tradingConfig
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

// Scan for real arbitrage opportunities
router.get('/scan-opportunities', async (req, res) => {
  try {
    const { minProfit = 0.3, includeGas = true } = req.query;

    console.log(`🔍 Scanning arbitrage opportunities (min profit: ${minProfit}%)...`);

    const opportunities = await scanForArbitrageOpportunities();

    // Filter by minimum profit
    const filteredOpportunities = opportunities.opportunities.filter(
      opp => parseFloat(opp.spread) >= parseFloat(minProfit)
    );

    // Add risk assessment
    const enrichedOpportunities = filteredOpportunities.map(opp => ({
      ...opp,
      riskLevel: opp.spread > 1.0 ? 'LOW' : opp.spread > 0.5 ? 'MEDIUM' : 'HIGH',
      recommendedAction: opp.spread > 0.8 ? 'EXECUTE' : 'MONITOR',
      gasImpact: includeGas ? estimateGasImpact(opp.recommendedAmount) : null
    }));

    // Sort by profitability
    enrichedOpportunities.sort((a, b) => parseFloat(b.spread) - parseFloat(a.spread));

    const summary = {
      totalScanned: opportunities.opportunities.length,
      profitableFound: enrichedOpportunities.length,
      bestOpportunity: enrichedOpportunities[0] || null,
      averageSpread: enrichedOpportunities.length > 0 ? 
        (enrichedOpportunities.reduce((sum, opp) => sum + parseFloat(opp.spread), 0) / enrichedOpportunities.length).toFixed(3) : 
        '0',
      marketCondition: enrichedOpportunities.length > 2 ? 'ACTIVE' : 
                      enrichedOpportunities.length > 0 ? 'MODERATE' : 'QUIET'
    };

    console.log(`✅ Scan complete: ${summary.profitableFound}/${summary.totalScanned} profitable`);

    res.json({
      success: true,
      data: {
        opportunities: enrichedOpportunities,
        summary,
        scanParams: {
          minProfitThreshold: parseFloat(minProfit),
          includeGasEstimates: includeGas
        }
      },
      message: summary.profitableFound > 0 ? 
        `Found ${summary.profitableFound} profitable opportunities! Best: ${summary.bestOpportunity.spread}%` :
        'No profitable opportunities found at current market prices',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Opportunity scan error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scan arbitrage opportunities',
      details: error.message
    });
  }
});

// ================================
// REAL TRADING EXECUTION
// ================================

// Execute real arbitrage trade
router.post('/execute-arbitrage', async (req, res) => {
  try {
    const {
      tokenPair,
      amount,
      direction,
      expectedSpread,
      maxSlippage = 1.0,
      confirmRealMoney = false,
      dryRun = false
    } = req.body;

    // Validation
    if (!tokenPair || !amount || !direction || !expectedSpread) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['tokenPair', 'amount', 'direction', 'expectedSpread']
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

    // Safety limits
    const maxAmount = parseFloat(process.env.MAX_TRADE_AMOUNT_USD) || 100;
    if (amount > maxAmount) {
      return res.status(400).json({
        success: false,
        error: `Trade amount ${amount} exceeds safety limit ${maxAmount}`,
        suggestion: `Reduce amount to ${maxAmount} or lower`
      });
    }

    console.log(`\n🚨 ${dryRun ? 'DRY RUN' : 'REAL'} ARBITRAGE TRADE REQUESTED:`);
    console.log(`================================================`);
    console.log(`   Pair: ${tokenPair}`);
    console.log(`   Amount: $${amount}`);
    console.log(`   Direction: ${direction}`);
    console.log(`   Expected Spread: ${expectedSpread}%`);
    console.log(`   Max Slippage: ${maxSlippage}%`);
    console.log(`   Mode: ${dryRun ? 'SIMULATION' : 'REAL TRADING'}`);
    console.log(`================================================`);

    if (dryRun) {
      // Simulate the trade
      const simulationResult = {
        success: true,
        tradeId: `sim_${Date.now()}`,
        mode: 'SIMULATION',
        summary: {
          tokenPair,
          amount,
          direction,
          expectedSpread,
          actualProfit: (expectedSpread * 0.85).toFixed(2), // Simulate 85% of expected
          profitUSD: (amount * expectedSpread * 0.0085).toFixed(2)
        },
        transactions: {
          step1: { txHash: '0xSIMULATED_TX_1', status: 'simulated' },
          step2: { txHash: '0xSIMULATED_TX_2', status: 'simulated' }
        },
        note: 'This was a simulation - no real transactions were executed'
      };

      console.log(`✅ SIMULATION COMPLETED`);
      return res.json({
        success: true,
        data: simulationResult,
        timestamp: new Date().toISOString()
      });
    }

    // Execute real trade
    const tradeResult = await executeRealArbitrageTrade({
      tokenPair,
      amount,
      direction,
      expectedSpread,
      maxSlippage
    });

    // Log result
    if (tradeResult.success) {
      console.log(`✅ REAL ARBITRAGE TRADE COMPLETED SUCCESSFULLY!`);
      console.log(`💰 Profit: ${tradeResult.summary.actualProfit}% (~$${tradeResult.summary.profitUSD})`);
    } else {
      console.log(`❌ REAL ARBITRAGE TRADE FAILED: ${tradeResult.error}`);
    }

    res.json({
      success: tradeResult.success,
      data: tradeResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Arbitrage execution error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute arbitrage trade',
      details: error.message
    });
  }
});

// ================================
// ATOMIC SWAP FUNCTIONALITY
// ================================

// Create bidirectional atomic swap
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

    // Validate supported pairs
    const supportedPairs = [
      { from: 'ethereum', to: 'sui', via: 'native' },
      { from: 'sui', to: 'ethereum', via: 'native' }
    ];

    const swapPair = supportedPairs.find(p => p.from === fromChain && p.to === toChain);
    if (!swapPair) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported swap direction',
        supportedPairs: supportedPairs.map(p => `${p.from} → ${p.to}`)
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

    // Validate wallet addresses for swap direction
    if (fromChain === 'ethereum' && !walletSession.evmAddress) {
      return res.status(400).json({
        success: false,
        error: 'Ethereum wallet required for this swap direction'
      });
    }

    if (toChain === 'sui' && !walletSession.suiAddress) {
      return res.status(400).json({
        success: false,
        error: 'Sui wallet required for this swap direction'
      });
    }

    // Generate atomic swap components
    const swapId = `atomic_${Date.now()}_${randomBytes(8).toString('hex')}`;
    const secret = randomBytes(32);
    const hashlock = createHash('sha256').update(secret).digest('hex');
    const timelock = Math.floor(Date.now() / 1000) + (timeoutMinutes * 60);

    // Check cross-chain spread
    console.log(`🔍 Checking cross-chain spread for ${fromChain} → ${toChain}`);
    const spreadCheck = await checkCrossChainSpread(fromChain, toChain, fromToken, toToken, minSpread);

    if (!spreadCheck.meetsThreshold) {
      return res.status(400).json({
        success: false,
        error: `Insufficient spread: ${spreadCheck.spread}% < ${minSpread}%`,
        spreadCheck,
        suggestion: `Wait for spread ≥ ${minSpread}% or lower minSpread parameter`
      });
    }

    // Initialize swap state
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
      timelock
    });

    swapState.spreadCheck = spreadCheck;

    // Create comprehensive execution plan
    const executionPlan = {
      type: 'ETHEREUM_SUI_ATOMIC_SWAP',
      route: `${fromChain.toUpperCase()} → ${toChain.toUpperCase()}`,
      wallets: {
        fromChain: fromChain === 'ethereum' ? walletSession.evmAddress : walletSession.suiAddress,
        toChain: toChain === 'ethereum' ? walletSession.evmAddress : walletSession.suiAddress
      },
      steps: [
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
          estimatedGas: fromChain === 'ethereum' ? '~0.005 ETH' : '~0.001 SUI'
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
          estimatedGas: toChain === 'ethereum' ? '~0.005 ETH' : '~0.001 SUI'
        }
      ],
      estimatedTime: '15-30 minutes',
      estimatedFees: {
        dexFees: '0.3-0.6%',
        bridgeFees: '0.1%',
        gasFees: '$3-8',
        totalFees: '~0.7-1.3%'
      },
      expectedProfit: {
        grossSpread: `${spreadCheck.spread}%`,
        netProfit: `${(spreadCheck.spread * 0.7).toFixed(2)}%`, // After fees
        estimatedUSD: `$${(amount * spreadCheck.spread * 0.007).toFixed(2)}`
      }
    };

    swapState.executionPlan = executionPlan;
    swapState.updateStatus('PLAN_CREATED');
    swapStates.set(swapId, swapState);

    console.log(`✅ Created atomic swap: ${swapId}`);
    console.log(`   From: ${walletSession.evmAddress || walletSession.suiAddress}`);
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
        nextStep: 'Use POST /api/swap/execute-step to begin execution'
      }
    });

  } catch (error) {
    console.error('Atomic swap creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create atomic swap',
      details: error.message
    });
  }
});

// Get swap status with detailed progress
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

    // Calculate detailed progress
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

    // Get current spread for comparison
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

    // Determine next action
    let nextAction = 'Complete';
    let currentStepIndex = swapState.executionPlan.steps.findIndex(s => s.status === 'PENDING');
    if (currentStepIndex >= 0) {
      nextAction = `Execute step ${currentStepIndex + 1}: ${swapState.executionPlan.steps[currentStepIndex].type}`;
    }

    res.json({
      success: true,
      data: {
        swapId,
        status: swapState.status,
        progress: {
          percentage: progress,
          completedSteps,
          failedSteps,
          totalSteps,
          currentStep: currentStepIndex >= 0 ? currentStepIndex : totalSteps,
          nextAction
        },

        // Swap configuration
        config: {
          fromChain: swapState.fromChain,
          toChain: swapState.toChain,
          fromToken: swapState.fromToken,
          toToken: swapState.toToken,
          amount: swapState.amount,
          minSpread: swapState.minSpread,
          maxSlippage: swapState.maxSlippage
        },

        // Spread analysis
        spreadAnalysis: {
          initial: swapState.spreadCheck ? swapState.spreadCheck.spread : null,
          current: currentSpread ? currentSpread.spread : null,
          stillProfitable: currentSpread ? currentSpread.meetsThreshold : null,
          direction: currentSpread ? currentSpread.direction : null,
          change: currentSpread && swapState.spreadCheck ? 
            (currentSpread.spread - swapState.spreadCheck.spread).toFixed(3) : null
        },

        // Timing information
        timing: {
          created: swapState.createdAt,
          updated: swapState.updatedAt,
          timeRemaining: Math.max(0, swapState.timelock - currentTime),
          isExpired,
          timelockISO: new Date(swapState.timelock * 1000).toISOString()
        },

        // Atomic guarantees
        atomicGuarantees: swapState.enableAtomicSwap ? {
          hashlock: swapState.hashlock,
          secretRevealed: swapState.status === 'COMPLETED',
          canRefund: isExpired || swapState.status === 'FAILED'
        } : null,

        // Execution details
        execution: {
          plan: swapState.executionPlan,
          stepHistory: swapState.steps
        }
      }
    });

  } catch (error) {
    console.error('Status fetch error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch swap status',
      details: error.message
    });
  }
});

// ================================
// UTILITY FUNCTIONS
// ================================

function estimateGasImpact(tradeAmountUSD) {
  // Simplified gas impact estimation
  const ethGasCostUSD = 3; // ~$3 for Ethereum transaction
  const suiGasCostUSD = 0.01; // ~$0.01 for Sui transaction
  const totalGasCost = ethGasCostUSD + suiGasCostUSD;

  return {
    totalGasCostUSD: totalGasCost.toFixed(2),
    percentageOfTrade: ((totalGasCost / tradeAmountUSD) * 100).toFixed(2),
    recommendation: totalGasCost / tradeAmountUSD > 0.1 ? 
      'Consider larger trade size to reduce gas impact' : 
      'Gas impact acceptable'
  };
}

// ================================
// HEALTH & INFO ENDPOINTS
// ================================

// Trading system health check
router.get('/health', async (req, res) => {
  try {
    const [balances, gasPrices] = await Promise.all([
      getWalletBalances().catch(() => ({})),
      getGasPrices().catch(() => ({}))
    ]);

    const healthStatus = {
      trading: {
        enabled: process.env.ENABLE_REAL_TRADING === 'true',
        testnetMode: process.env.TESTNET_MODE === 'true'
      },
      wallets: {
        ethereum: !!balances.ethereum?.address,
        sui: !!balances.sui?.address
      },
      network: {
        ethereum: 'Sepolia Testnet',
        sui: 'Sui Testnet'
      },
      activeSwaps: swapStates.size,
      systemTime: new Date().toISOString()
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