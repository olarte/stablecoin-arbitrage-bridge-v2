import { ethers } from 'ethers';
import { SuiClient } from '@mysten/sui.js/client';
import { CHAIN_CONFIG } from '../config/chains.js';

export let ethProvider, suiProvider;
export const swapStates = new Map();
export const walletConnections = new Map();

export async function initializeProviders() {
  try {
    console.log('🔗 Initializing blockchain providers...');

    // Ethereum Sepolia provider
    ethProvider = new ethers.JsonRpcProvider(CHAIN_CONFIG.ethereum.rpc);

    // Sui Testnet provider
    suiProvider = new SuiClient({ url: CHAIN_CONFIG.sui.rpc });

    // Test connections
    const ethNetwork = await ethProvider.getNetwork();
    const suiChainId = await suiProvider.getChainIdentifier();

    console.log(`✅ Ethereum Sepolia connected: Chain ${ethNetwork.chainId}`);
    console.log(`✅ Sui Testnet connected: ${suiChainId}`);

    return { ethProvider, suiProvider };
  } catch (error) {
    console.error('❌ Provider initialization failed:', error);
    throw error;
  }
}

// Helper function for mock spread calculation
export async function checkCrossChainSpread(fromChain, toChain, fromToken, toToken, minSpread) {
  try {
    // Simulate price fetching with small variance
    const basePrice = 1.0000;
    const variance = 0.0010; // 0.1% variance

    const sourcePrice = basePrice + (Math.random() - 0.5) * variance;
    const destPrice = basePrice + (Math.random() - 0.5) * variance;

    const spread = Math.abs(sourcePrice - destPrice) / destPrice * 100;
    const meetsThreshold = spread >= minSpread;

    console.log(`📊 ${fromChain} → ${toChain}: ${spread.toFixed(4)}% spread`);

    return {
      spread: parseFloat(spread.toFixed(4)),
      meetsThreshold,
      sourcePrice,
      destPrice,
      direction: sourcePrice > destPrice ? 'positive' : 'negative',
      profitEstimate: meetsThreshold ? (spread * 0.8).toFixed(2) + '%' : '0%',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Spread calculation error:', error);
    throw error;
  }
}