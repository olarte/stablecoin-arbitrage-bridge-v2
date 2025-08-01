import { ethers } from 'ethers';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { ethWallet, suiWallet, suiClient } from './wallets.js';
import { CHAIN_CONFIG } from '../config/chains.js';

// ================================
// UNISWAP V3 INTEGRATION
// ================================

// Simplified Uniswap V3 Router ABI
const UNISWAP_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
  'function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountIn)'
];

// ERC20 Token ABI (for approvals)
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

export async function executeEthereumSwap(tokenIn, tokenOut, amountIn, minAmountOut) {
  try {
    console.log(`🦄 Executing Ethereum swap: ${amountIn} ${tokenIn} → ${tokenOut}`);

    if (!ethWallet) {
      throw new Error('Ethereum wallet not initialized');
    }

    const tokenInAddress = CHAIN_CONFIG.ethereum.tokens[tokenIn];
    const tokenOutAddress = CHAIN_CONFIG.ethereum.tokens[tokenOut];

    if (!tokenInAddress || !tokenOutAddress) {
      throw new Error(`Token not found: ${tokenIn} or ${tokenOut}`);
    }

    // For demo purposes, we'll simulate the swap
    // In production, you'd execute real Uniswap transactions

    if (process.env.ENABLE_REAL_TRADING === 'true') {
      // Create Uniswap V3 router contract
      const router = new ethers.Contract(
        CHAIN_CONFIG.ethereum.uniswap.router,
        UNISWAP_ROUTER_ABI,
        ethWallet
      );

      // Approve token spending first (if not ETH)
      if (tokenIn !== 'ETH' && tokenIn !== 'WETH') {
        console.log(`📝 Approving ${tokenIn} spending...`);
        const approvalTxHash = await approveToken(tokenInAddress, CHAIN_CONFIG.ethereum.uniswap.router, amountIn);
        console.log(`✅ Approval transaction: ${approvalTxHash}`);
      }

      // Determine token decimals
      const tokenInDecimals = getTokenDecimals(tokenIn);
      const tokenOutDecimals = getTokenDecimals(tokenOut);

      // Prepare swap parameters
      const swapParams = {
        tokenIn: tokenInAddress,
        tokenOut: tokenOutAddress,
        fee: 3000, // 0.3% fee tier
        recipient: ethWallet.address,
        deadline: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
        amountIn: ethers.parseUnits(amountIn.toString(), tokenInDecimals),
        amountOutMinimum: ethers.parseUnits(minAmountOut.toString(), tokenOutDecimals),
        sqrtPriceLimitX96: 0 // No price limit
      };

      // Execute swap
      console.log(`⚡ Executing real swap transaction...`);
      const tx = await router.exactInputSingle(swapParams, {
        value: tokenIn === 'ETH' ? swapParams.amountIn : 0,
        gasLimit: 300000
      });

      console.log(`📝 Transaction submitted: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();

      console.log(`✅ Real swap completed! Block: ${receipt.blockNumber}`);

      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice.toString(),
        explorer: `https://sepolia.etherscan.io/tx/${tx.hash}`,
        estimatedOutput: (amountIn * 0.997).toString() // Simulate output after fees
      };
    } else {
      // Simulation mode
      console.log(`🎭 Simulating Ethereum swap (ENABLE_REAL_TRADING=false)`);
      const simulatedTxHash = `0x${randomBytes(32).toString('hex')}`;

      // Simulate realistic execution time
      await new Promise(resolve => setTimeout(resolve, 2000));

      return {
        success: true,
        txHash: simulatedTxHash,
        blockNumber: Math.floor(Math.random() * 1000000) + 4000000,
        gasUsed: '180000',
        effectiveGasPrice: '20000000000',
        explorer: `https://sepolia.etherscan.io/tx/${simulatedTxHash}`,
        estimatedOutput: (amountIn * 0.997).toString(),
        note: 'SIMULATED TRANSACTION'
      };
    }

  } catch (error) {
    console.error(`❌ Ethereum swap failed:`, error.message);
    return {
      success: false,
      error: error.message,
      chain: 'ethereum'
    };
  }
}

// ================================
// SUI CETUS DEX INTEGRATION
// ================================

export async function executeSuiSwap(tokenIn, tokenOut, amountIn, minAmountOut) {
  try {
    console.log(`🌊 Executing Sui swap: ${amountIn} ${tokenIn} → ${tokenOut}`);

    if (!suiWallet || !suiClient) {
      throw new Error('Sui wallet not initialized');
    }

    const tokenInType = CHAIN_CONFIG.sui.tokens[tokenIn];
    const tokenOutType = CHAIN_CONFIG.sui.tokens[tokenOut];

    if (!tokenInType || !tokenOutType) {
      throw new Error(`Token not found: ${tokenIn} or ${tokenOut}`);
    }

    if (process.env.ENABLE_REAL_TRADING === 'true') {
      // Create transaction block for real Cetus swap
      const txb = new TransactionBlock();

      // Mock Cetus swap (replace with real Cetus integration)
      // In production, you'd use the actual Cetus SDK
      const swapCoin = txb.moveCall({
        target: `${CHAIN_CONFIG.sui.cetus.packageId}::pool::swap`,
        arguments: [
          txb.pure(Math.floor(amountIn * 1_000_000)), // Convert to proper decimals
          txb.pure(Math.floor(minAmountOut * 1_000_000)),
          txb.pure(false) // a2b direction
        ],
        typeArguments: [tokenInType, tokenOutType]
      });

      // Transfer result to sender
      txb.transferObjects([swapCoin], txb.pure(suiWallet.getPublicKey().toSuiAddress()));

      // Set gas budget
      txb.setGasBudget(10_000_000); // 0.01 SUI

      // Sign and execute
      console.log(`⚡ Executing real Sui transaction...`);
      const result = await suiClient.signAndExecuteTransactionBlock({
        signer: suiWallet,
        transactionBlock: txb,
        options: {
          showEffects: true,
          showObjectChanges: true,
        }
      });

      console.log(`✅ Real Sui swap completed! Digest: ${result.digest}`);

      return {
        success: true,
        txHash: result.digest,
        gasUsed: result.effects.gasUsed,
        status: result.effects.status.status,
        explorer: `https://suiexplorer.com/txblock/${result.digest}?network=testnet`,
        estimatedOutput: (amountIn * 0.9995).toString()
      };
    } else {
      // Simulation mode
      console.log(`🎭 Simulating Sui swap (ENABLE_REAL_TRADING=false)`);
      const simulatedTxHash = `0x${randomBytes(32).toString('hex')}`;

      // Simulate realistic execution time
      await new Promise(resolve => setTimeout(resolve, 1500));

      return {
        success: true,
        txHash: simulatedTxHash,
        gasUsed: { computationCost: '1000000', storageCost: '100000' },
        status: 'success',
        explorer: `https://suiexplorer.com/txblock/${simulatedTxHash}?network=testnet`,
        estimatedOutput: (amountIn * 0.9995).toString(),
        note: 'SIMULATED TRANSACTION'
      };
    }

  } catch (error) {
    console.error(`❌ Sui swap failed:`, error.message);
    return {
      success: false,
      error: error.message,
      chain: 'sui'
    };
  }
}

// ================================
// PRICE FETCHING
// ================================

export async function getCurrentDEXPrices(tokenPair) {
  try {
    const [tokenA, tokenB] = tokenPair.split('-');

    console.log(`📊 Fetching DEX prices for ${tokenPair}...`);

    // Simulate realistic price variations with small spreads
    const basePrice = 1.0000;
    const ethVariance = (Math.random() - 0.5) * 0.002; // ±0.1% variance
    const suiVariance = (Math.random() - 0.5) * 0.002; // ±0.1% variance

    const ethereumPrice = basePrice + ethVariance;
    const suiPrice = basePrice + suiVariance;

    // Calculate spread
    const spread = Math.abs(ethereumPrice - suiPrice) / Math.min(ethereumPrice, suiPrice) * 100;

    // Add some realistic market conditions
    const marketConditions = getMarketConditions();
    const adjustedSpread = spread * marketConditions.volatilityMultiplier;

    const priceData = {
      pair: tokenPair,
      ethereum: parseFloat(ethereumPrice.toFixed(6)),
      sui: parseFloat(suiPrice.toFixed(6)),
      spread: parseFloat(adjustedSpread.toFixed(4)),
      volume24h: {
        ethereum: Math.random() * 1000000 + 500000, // $500k-1.5M
        sui: Math.random() * 500000 + 100000 // $100k-600k
      },
      liquidity: {
        ethereum: Math.random() * 5000000 + 2000000, // $2M-7M
        sui: Math.random() * 2000000 + 500000 // $500k-2.5M
      },
      marketConditions,
      timestamp: new Date().toISOString(),
      lastUpdated: Date.now()
    };

    console.log(`📈 ${tokenPair}: ETH=${ethereumPrice.toFixed(6)}, SUI=${suiPrice.toFixed(6)}, Spread=${adjustedSpread.toFixed(4)}%`);

    return priceData;

  } catch (error) {
    console.error('Price fetch error:', error);

    // Fallback to basic mock data
    return {
      pair: tokenPair,
      ethereum: 1.0000,
      sui: 1.0005,
      spread: 0.05,
      timestamp: new Date().toISOString(),
      error: error.message,
      fallback: true
    };
  }
}

// ================================
// UTILITY FUNCTIONS
// ================================

async function approveToken(tokenAddress, spenderAddress, amount) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, ethWallet);

    // Check current allowance
    const currentAllowance = await tokenContract.allowance(ethWallet.address, spenderAddress);
    const requiredAmount = ethers.parseUnits((amount * 1.1).toString(), getTokenDecimals(getTokenSymbol(tokenAddress)));

    if (currentAllowance >= requiredAmount) {
      console.log(`✅ Sufficient allowance already exists`);
      return 'no_approval_needed';
    }

    // Execute approval
    const tx = await tokenContract.approve(spenderAddress, requiredAmount);
    await tx.wait();

    console.log(`✅ Token approval completed: ${tx.hash}`);
    return tx.hash;
  } catch (error) {
    console.error('Token approval failed:', error);
    throw error;
  }
}

function getTokenDecimals(tokenSymbol) {
  const decimals = {
    'ETH': 18,
    'WETH': 18,
    'USDC': 6,
    'USDT': 6,
    'DAI': 18,
    'SUI': 9,
    'USDY': 6
  };
  return decimals[tokenSymbol] || 18;
}

function getTokenSymbol(tokenAddress) {
  // Reverse lookup for token symbols
  for (const [chain, config] of Object.entries(CHAIN_CONFIG)) {
    for (const [symbol, address] of Object.entries(config.tokens || {})) {
      if (address.toLowerCase() === tokenAddress.toLowerCase()) {
        return symbol;
      }
    }
  }
  return 'UNKNOWN';
}

function getMarketConditions() {
  // Simulate different market conditions
  const conditions = [
    { name: 'STABLE', volatilityMultiplier: 0.8, description: 'Low volatility market' },
    { name: 'ACTIVE', volatilityMultiplier: 1.2, description: 'Normal trading activity' },
    { name: 'VOLATILE', volatilityMultiplier: 1.8, description: 'High volatility period' }
  ];

  // Weighted random selection (favor stable/active over volatile)
  const weights = [0.5, 0.4, 0.1];
  const random = Math.random();
  let weightSum = 0;

  for (let i = 0; i < conditions.length; i++) {
    weightSum += weights[i];
    if (random <= weightSum) {
      return {
        ...conditions[i],
        confidence: 0.7 + Math.random() * 0.3 // 70-100% confidence
      };
    }
  }

  return conditions[0]; // Fallback to stable
}

function randomBytes(size) {
  // Simple random bytes generator for simulation
  return Array.from({length: size}, () => Math.floor(Math.random() * 256));
}

// ================================
// POOL LIQUIDITY CHECKING
// ================================

export async function checkLiquidityPools(tokenPair) {
  try {
    const [tokenA, tokenB] = tokenPair.split('-');

    // Simulate liquidity pool data
    const liquidityData = {
      ethereum: {
        uniswapV3: {
          '0.05%': { liquidity: Math.random() * 1000000 + 500000, volume24h: Math.random() * 100000 },
          '0.3%': { liquidity: Math.random() * 5000000 + 2000000, volume24h: Math.random() * 500000 },
          '1%': { liquidity: Math.random() * 2000000 + 1000000, volume24h: Math.random() * 200000 }
        }
      },
      sui: {
        cetus: {
          '0.05%': { liquidity: Math.random() * 500000 + 100000, volume24h: Math.random() * 50000 },
          '0.3%': { liquidity: Math.random() * 2000000 + 500000, volume24h: Math.random() * 200000 }
        }
      }
    };

    return {
      pair: tokenPair,
      liquidity: liquidityData,
      recommendation: 'Use 0.3% fee pools for best liquidity',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Liquidity check failed: ${error.message}`);
  }
}

// Export pool data for external use
export async function getPoolInformation(tokenPair, chain = 'both') {
  try {
    const liquidityData = await checkLiquidityPools(tokenPair);
    const priceData = await getCurrentDEXPrices(tokenPair);

    return {
      ...liquidityData,
      currentPrices: priceData,
      tradingRecommendation: priceData.spread > 0.5 ? 'FAVORABLE' : 'MONITOR',
      optimalTradeSize: calculateOptimalTradeSize(liquidityData, priceData.spread)
    };
  } catch (error) {
    throw new Error(`Pool information fetch failed: ${error.message}`);
  }
}

function calculateOptimalTradeSize(liquidityData, spread) {
  try {
    // Simple calculation based on liquidity and spread
    const ethLiquidity = liquidityData.liquidity.ethereum.uniswapV3['0.3%'].liquidity;
    const suiLiquidity = liquidityData.liquidity.sui.cetus['0.3%'].liquidity;
    const minLiquidity = Math.min(ethLiquidity, suiLiquidity);

    // Recommend 1-5% of minimum liquidity
    const optimalSize = Math.min(
      minLiquidity * 0.03, // 3% of liquidity
      parseFloat(process.env.MAX_TRADE_AMOUNT_USD) || 100 // Safety limit
    );

    return {
      recommended: Math.floor(optimalSize),
      min: 10,
      max: parseFloat(process.env.MAX_TRADE_AMOUNT_USD) || 100,
      reasoning: `Based on ${Math.floor(minLiquidity)} available liquidity`
    };
  } catch (error) {
    return {
      recommended: 50,
      min: 10,
      max: 100,
      reasoning: 'Default recommendation due to calculation error'
    };
  }
}