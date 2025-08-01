
import { ethers } from 'ethers';
import { SuiClient } from '@mysten/sui.js/client';
import { CHAIN_CONFIG } from '../config/chains.js';

export let ethProvider, suiProvider;
export const swapStates = new Map();
export const walletConnections = new Map();

// Fallback RPC URLs
const FALLBACK_RPCS = {
  ethereum: [
    'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    'https://rpc.sepolia.org',
    'https://sepolia.gateway.tenderly.co'
  ],
  sui: [
    'https://fullnode.testnet.sui.io',
    'https://sui-testnet.nodereal.io'
  ]
};

async function createEthProvider() {
  const rpcUrls = [
    CHAIN_CONFIG.ethereum.rpc,
    ...FALLBACK_RPCS.ethereum
  ].filter(Boolean);

  for (const rpcUrl of rpcUrls) {
    try {
      console.log(`🔗 Trying Ethereum RPC: ${rpcUrl.split('/')[2]}...`);
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // Test the connection
      await provider.getNetwork();
      console.log(`✅ Ethereum provider connected via ${rpcUrl.split('/')[2]}`);
      return provider;
    } catch (error) {
      console.log(`❌ Failed to connect to ${rpcUrl.split('/')[2]}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error('Failed to connect to any Ethereum RPC endpoint');
}

async function createSuiProvider() {
  const rpcUrls = [
    CHAIN_CONFIG.sui.rpc,
    ...FALLBACK_RPCS.sui
  ].filter(Boolean);

  for (const rpcUrl of rpcUrls) {
    try {
      console.log(`🔗 Trying Sui RPC: ${rpcUrl.split('/')[2]}...`);
      const provider = new SuiClient({ url: rpcUrl });
      
      // Test the connection
      await provider.getChainIdentifier();
      console.log(`✅ Sui provider connected via ${rpcUrl.split('/')[2]}`);
      return provider;
    } catch (error) {
      console.log(`❌ Failed to connect to ${rpcUrl.split('/')[2]}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error('Failed to connect to any Sui RPC endpoint');
}

export async function initializeProviders() {
  try {
    console.log('🔗 Initializing blockchain providers...');

    // Initialize providers with fallback support
    ethProvider = await createEthProvider();
    suiProvider = await createSuiProvider();

    // Test connections and get network info
    const ethNetwork = await ethProvider.getNetwork();
    const suiChainId = await suiProvider.getChainIdentifier();

    console.log(`✅ Ethereum connected: Chain ${ethNetwork.chainId} (${ethNetwork.name})`);
    console.log(`✅ Sui connected: ${suiChainId}`);

    return { ethProvider, suiProvider };
  } catch (error) {
    console.error('❌ Provider initialization failed:', error.message);
    throw new Error(`Blockchain initialization failed: ${error.message}`);
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
