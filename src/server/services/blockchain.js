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

    // Export for other modules
    window.ethProvider = ethProvider;
    window.suiProvider = suiProvider;

    return { ethProvider, suiProvider };
  } catch (error) {
    console.error('❌ Provider initialization failed:', error);
    throw error;
  }
}