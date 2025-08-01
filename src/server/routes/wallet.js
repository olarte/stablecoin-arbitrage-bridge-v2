import express from 'express';
import { walletConnections } from '../services/blockchain.js';

const router = express.Router();

// Register wallet connection
router.post('/register', async (req, res) => {
  try {
    const { 
      sessionId, 
      evmAddress,
      suiAddress, 
      evmChainId 
    } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: sessionId'
      });
    }

    if (!evmAddress && !suiAddress) {
      return res.status(400).json({
        success: false,
        error: 'At least one wallet address required (evmAddress or suiAddress)'
      });
    }

    const walletData = {
      evmAddress,
      suiAddress,
      evmChainId,
      registeredAt: new Date().toISOString()
    };

    walletConnections.set(sessionId, walletData);

    // Debug logging
    console.log(`📝 Registered wallet session: ${sessionId}`);
    console.log(`  EVM: ${evmAddress || 'Not provided'}`);
    console.log(`  Sui: ${suiAddress || 'Not provided'}`);
    console.log(`📊 Total sessions in memory: ${walletConnections.size}`);
    console.log(`🔍 All sessions:`, Array.from(walletConnections.keys()));

    res.json({
      success: true,
      data: {
        sessionId,
        registeredWallets: {
          evm: !!evmAddress,
          sui: !!suiAddress
        },
        addresses: {
          evmAddress,
          suiAddress
        }
      }
    });

  } catch (error) {
    console.error('Wallet registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register wallet',
      details: error.message
    });
  }
});

// Get wallet session info
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Debug logging
    console.log(`🔍 Looking for session: ${sessionId}`);
    console.log(`📊 Total sessions in memory: ${walletConnections.size}`);
    console.log(`🔍 All sessions:`, Array.from(walletConnections.keys()));

    const walletSession = walletConnections.get(sessionId);

    if (!walletSession) {
      return res.status(404).json({
        success: false,
        error: 'Wallet session not found',
        debug: {
          requestedSession: sessionId,
          availableSessions: Array.from(walletConnections.keys()),
          totalSessions: walletConnections.size
        }
      });
    }

    res.json({
      success: true,
      data: walletSession
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get wallet session'
    });
  }
});

// Debug endpoint to see all sessions
router.get('/debug/sessions', (req, res) => {
  res.json({
    success: true,
    data: {
      totalSessions: walletConnections.size,
      sessions: Object.fromEntries(walletConnections),
      sessionIds: Array.from(walletConnections.keys())
    }
  });
});

export default router;