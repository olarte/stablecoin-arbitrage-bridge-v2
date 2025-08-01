import express from 'express';
import { walletConnections } from '../services/blockchain.js';

const router = express.Router();

// Register wallet session
router.post('/register', async (req, res) => {
  try {
    const { sessionId, ethereumAddress, suiAddress } = req.body;

    if (!sessionId || !ethereumAddress || !suiAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sessionId, ethereumAddress, suiAddress'
      });
    }

    // Store wallet session
    walletConnections.set(sessionId, {
      ethereumAddress,
      suiAddress,
      connectedAt: new Date().toISOString()
    });

    console.log(`✅ Wallet session registered: ${sessionId}`);

    res.json({
      success: true,
      data: {
        sessionId,
        ethereumAddress,
        suiAddress,
        status: 'connected'
      }
    });

  } catch (error) {
    console.error('Wallet registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register wallet session',
      details: error.message
    });
  }
});

export default router;