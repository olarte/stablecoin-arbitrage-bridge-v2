import express from 'express';
import { walletConnections } from '../services/blockchain.js';

const router = express.Router();

// Register wallet connection
router.post('/register', async (req, res) => {
  try {
    const { sessionId, evmAddress, suiAddress, evmChainId } = req.body;

    if (!sessionId || (!evmAddress && !suiAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required wallet information'
      });
    }

    walletConnections.set(sessionId, {
      evmAddress,
      suiAddress,
      evmChainId,
      registeredAt: new Date().toISOString()
    });

    console.log(`📝 Registered wallet session: ${sessionId}`);

    res.json({
      success: true,
      data: {
        sessionId,
        registeredWallets: {
          evm: !!evmAddress,
          sui: !!suiAddress
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to register wallet'
    });
  }
});

export default router;