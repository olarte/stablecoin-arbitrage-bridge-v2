import { ethers } from 'ethers';
import { SuiClient } from '@mysten/sui.js/client';
import { CHAIN_CONFIG } from '../config/chains.js';

// Global provider instances
let ethProvider = null;
let suiProvider = null;

// Storage for swap states and wallet connections
export const swapStates = new Map();
export const walletConnections = new Map();

// Check cross-chain spread function
export async function checkCrossChainSpread(fromChain, toChain, fromToken, toToken, minSpread) {
  try {
    // Simulate price checking for demo purposes
    // In a real implementation, you'd fetch actual prices from DEXs
    const mockSpread = Math.random() * 2 + 0.5; // Random spread between 0.5% and 2.5%
    
    return {
      meetsThreshold: mockSpread >= minSpread,
      spread: mockSpread.toFixed(2),
      profitEstimate: `${(mockSpread * 0.8).toFixed(2)}%`, // Accounting for fees
      fromChain,
      toChain,
      fromToken,
      toToken
    };
  } catch (error) {
    console.error('Error checking spread:', error);
    return {
      meetsThreshold: false,
      spread: '0',
      profitEstimate: '0%',
      error: error.message
    };
  }
}

export async function initializeProviders() {
  try {
    console.log('🔗 Initializing blockchain providers...');

    // Multiple RPC endpoints for redundancy
    const ethereumRPCs = [
      process.env.SEPOLIA_RPC,
      'https://sepolia.gateway.tenderly.co',
      'https://rpc.sepolia.org',
      'https://ethereum-sepolia.publicnode.com'
    ].filter(Boolean);

    let ethProvider = null;

    // Try each RPC until one works
    for (const rpc of ethereumRPCs) {
      try {
        const provider = new ethers.JsonRpcProvider(rpc);
        await provider.getNetwork(); // Test connection
        ethProvider = provider;
        console.log(`✅ Ethereum connected via ${new URL(rpc).hostname}`);
        break;
      } catch (error) {
        console.log(`⚠️ ${new URL(rpc).hostname} unavailable, trying next...`);
      }
    }

    if (!ethProvider) {
      throw new Error('No Ethereum RPC endpoints available');
    }

    // Sui connection (your current working code)
    suiProvider = new SuiClient({ url: CHAIN_CONFIG.sui.rpc });
    const suiChainId = await suiProvider.getChainIdentifier();

    console.log(`✅ Sui connected: ${suiChainId}`);
    console.log('🎯 Ready for cross-chain arbitrage!');

    // Store providers globally for the module
    global.ethProvider = ethProvider;
    global.suiProvider = suiProvider;

    return { ethProvider, suiProvider };
  } catch (error) {
    console.error('❌ Provider initialization failed:', error);
    throw error;
  }
}