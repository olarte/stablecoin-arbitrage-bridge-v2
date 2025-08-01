import express from 'express';
import { ethers } from 'ethers';
import { ethWallet } from '../services/wallets.js';
import { CHAIN_CONFIG } from '../config/chains.js';

const router = express.Router();

// Simple rate limiting for faucets
const faucetUsage = new Map();
const FAUCET_COOLDOWN = 3600000; // 1 hour

// Test USDC faucet
router.post('/usdc', async (req, res) => {
  try {
    const { address, amount = 100 } = req.body;

    if (!address || !ethers.isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Valid Ethereum address required'
      });
    }

    // Rate limiting
    const lastUsed = faucetUsage.get(address);
    if (lastUsed && Date.now() - lastUsed < FAUCET_COOLDOWN) {
      return res.status(429).json({
        success: false,
        error: 'Faucet cooldown active. Try again in 1 hour.',
        nextAvailable: new Date(lastUsed + FAUCET_COOLDOWN).toISOString()
      });
    }

    if (!ethWallet) {
      return res.status(500).json({
        success: false,
        error: 'Faucet wallet not configured'
      });
    }

    // For testnet, we'll simulate USDC transfer
    // In reality, you'd need actual test USDC tokens
    const txHash = `0x${Math.random().toString(16).slice(2)}`;
    faucetUsage.set(address, Date.now());

    console.log(`🚰 USDC faucet: ${amount} USDC → ${address}`);

    res.json({
      success: true,
      data: {
        txHash,
        amount,
        token: 'USDC',
        recipient: address,
        message: 'Test USDC sent! (simulated)',
        explorer: `https://sepolia.etherscan.io/tx/${txHash}`
      }
    });

  } catch (error) {
    console.error('Faucet error:', error);
    res.status(500).json({
      success: false,
      error: 'Faucet temporarily unavailable'
    });
  }
});

// Check faucet availability
router.get('/status/:address', (req, res) => {
  const { address } = req.params;
  const lastUsed = faucetUsage.get(address);
  const canUse = !lastUsed || Date.now() - lastUsed >= FAUCET_COOLDOWN;

  res.json({
    success: true,
    data: {
      address,
      canUseFaucet: canUse,
      lastUsed: lastUsed ? new Date(lastUsed).toISOString() : null,
      nextAvailable: lastUsed && !canUse ? 
        new Date(lastUsed + FAUCET_COOLDOWN).toISOString() : 
        'Now'
    }
  });
});

export default router;