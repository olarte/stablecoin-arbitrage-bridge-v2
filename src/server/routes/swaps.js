import express from 'express';
import { randomBytes, createHash } from 'crypto';
import { swapStates, walletConnections, checkCrossChainSpread } from '../services/blockchain.js';

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
        error: 'Wallet session not found. Please connect wallets first.'
      });
    }

    // Generate atomic swap components
    const swapId = `atomic_${Date.now()}_${randomBytes(8).toString('hex')}`;
    const secret = randomBytes(32);
    const hashlock = createHash('sha256').update(secret).digest('hex');
    const timelock = Math.floor(Date.now() / 1000) + (timeoutMinutes * 60);

    // Check cross-chain spread
    const spreadCheck = await checkCrossChainSpread(fromChain, toChain, fromToken, toToken, minSpread);

    if (!spreadCheck.meetsThreshold) {
      return res.status(400).json({
        success: false,
        error: `Insufficient spread: ${spreadCheck.spread}% < ${minSpread}%`,
        spreadCheck
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

    // Create execution plan
    const executionPlan = {
      type: 'ETHEREUM_SUI_ATOMIC_SWAP',
      route: `${fromChain.toUpperCase()} → ${toChain.toUpperCase()}`,
      steps: [
        {
          type: 'SPREAD_VERIFICATION',
          description: 'Verify profitable spread exists',
          status: 'COMPLETED'
        },
        {
          type: 'WALLET_PREPARATION',
          description: 'Prepare wallet signatures',
          status: 'PENDING',
          requiresSignature: true
        },
        {
          type: 'SOURCE_SWAP',
          description: `Swap ${fromToken} on ${fromChain}`,
          status: 'PENDING',
          requiresSignature: true
        },
        {
          type: 'BRIDGE_TRANSFER',
          description: `Bridge to ${toChain}`,
          status: 'PENDING'
        },
        {
          type: 'DESTINATION_SWAP',
          description: `Swap to ${toToken} on ${toChain}`,
          status: 'PENDING',
          requiresSignature: true
        }
      ],
      estimatedTime: '15-30 minutes',
      estimatedFees: '~0.8-1.5%'
    };

    swapState.executionPlan = executionPlan;
    swapState.updateStatus('PLAN_CREATED');
    swapStates.set(swapId, swapState);

    console.log(`✅ Created atomic swap: ${swapId} (${spreadCheck.spread}% spread)`);

    res.json({
      success: true,
      data: {
        swapId,
        executionPlan,
        spreadCheck,
        atomicComponents: {
          hashlock,
          timelock: new Date(timelock * 1000).toISOString(),
          secretRequired: true
        },
        estimatedProfit: spreadCheck.profitEstimate
      }
    });

  } catch (error) {
    console.error('Swap creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create atomic swap',
      details: error.message
    });
  }
});

// Get swap status
router.get('/status-real/:swapId', async (req, res) => {
  try {
    const { swapId } = req.params;
    const swapState = swapStates.get(swapId);

    if (!swapState) {
      return res.status(404).json({
        success: false,
        error: 'Swap not found'
      });
    }

    const completedSteps = swapState.executionPlan.steps.filter(s => s.status === 'COMPLETED').length;
    const totalSteps = swapState.executionPlan.steps.length;
    const progress = Math.round((completedSteps / totalSteps) * 100);

    res.json({
      success: true,
      data: {
        swapId,
        status: swapState.status,
        progress,
        completedSteps,
        totalSteps,
        spreadCheck: swapState.spreadCheck,
        executionPlan: swapState.executionPlan,
        createdAt: swapState.createdAt,
        updatedAt: swapState.updatedAt
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get swap status',
      details: error.message
    });
  }
});

export default router;