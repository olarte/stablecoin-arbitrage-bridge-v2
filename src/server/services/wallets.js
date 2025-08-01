import { ethers } from 'ethers';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { SuiClient } from '@mysten/sui.js/client';
import { CHAIN_CONFIG } from '../config/chains.js';

// Global wallet instances
export let ethWallet, celoWallet, suiWallet, suiClient;

// ================================
// WALLET INITIALIZATION
// ================================

export async function initializeTestWallets() {
  try {
    console.log('🔐 Connecting to your existing test wallets...');

    // Initialize Ethereum wallet
    if (process.env.ETHEREUM_TEST_PRIVATE_KEY) {
      const provider = new ethers.JsonRpcProvider(CHAIN_CONFIG.ethereum.rpc);
      ethWallet = new ethers.Wallet(process.env.ETHEREUM_TEST_PRIVATE_KEY, provider);

      console.log(`✅ Ethereum wallet connected: ${ethWallet.address}`);

      // Test connection
      try {
        const balance = await provider.getBalance(ethWallet.address);
        console.log(`💰 ETH balance: ${ethers.formatEther(balance)} ETH`);
      } catch (error) {
        console.warn(`⚠️ Could not fetch ETH balance: ${error.message}`);
      }
    } else {
      console.warn('⚠️ ETHEREUM_TEST_PRIVATE_KEY not found in .env - Ethereum trading disabled');
    }

    // Initialize Celo wallet (uses same private key as Ethereum - EVM compatible)
    if (process.env.ETHEREUM_TEST_PRIVATE_KEY || process.env.CELO_TEST_PRIVATE_KEY) {
      const celoProvider = new ethers.JsonRpcProvider(CHAIN_CONFIG.celo.rpc);
      const celoPrivateKey = process.env.CELO_TEST_PRIVATE_KEY || process.env.ETHEREUM_TEST_PRIVATE_KEY;
      celoWallet = new ethers.Wallet(celoPrivateKey, celoProvider);

      console.log(`✅ Celo wallet connected: ${celoWallet.address}`);

      // Test connection and get CELO balance
      try {
        const celoBalance = await celoProvider.getBalance(celoWallet.address);
        console.log(`💰 CELO balance: ${ethers.formatEther(celoBalance)} CELO`);

        // Get cUSD balance
        const cUSDContract = new ethers.Contract(
          CHAIN_CONFIG.celo.tokens.cUSD,
          ['function balanceOf(address) view returns (uint256)'],
          celoProvider
        );
        const cUSDBalance = await cUSDContract.balanceOf(celoWallet.address);
        console.log(`💰 cUSD balance: ${ethers.formatUnits(cUSDBalance, 18)} cUSD`);
      } catch (error) {
        console.warn(`⚠️ Could not fetch Celo balances: ${error.message}`);
      }
    } else {
      console.warn('⚠️ No Celo private key found - Celo trading disabled');
    }

    // Initialize Sui wallet and client
    if (process.env.SUI_TEST_PRIVATE_KEY) {
      try {
        // Initialize Sui client first
        suiClient = new SuiClient({ url: CHAIN_CONFIG.sui.rpc });

        // Handle different Sui private key formats
        let privateKeyArray;
        const privateKey = process.env.SUI_TEST_PRIVATE_KEY;

        if (privateKey.startsWith('0x')) {
          // Hex format
          privateKeyArray = Array.from(Buffer.from(privateKey.slice(2), 'hex'));
        } else if (privateKey.includes(',')) {
          // Array format: [1,2,3,...]
          privateKeyArray = privateKey.replace(/[\[\]]/g, '').split(',').map(n => parseInt(n.trim()));
        } else if (privateKey.length === 44) {
          // Base64 format
          privateKeyArray = Array.from(Buffer.from(privateKey, 'base64'));
        } else {
          // Assume it's a 64-character hex string without 0x
          privateKeyArray = Array.from(Buffer.from(privateKey, 'hex'));
        }

        // Create keypair from private key
        suiWallet = Ed25519Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));

        const suiAddress = suiWallet.getPublicKey().toSuiAddress();
        console.log(`✅ Sui wallet connected: ${suiAddress}`);

        // Test connection and balance
        try {
          const suiBalance = await suiClient.getBalance({
            owner: suiAddress,
            coinType: '0x2::sui::SUI'
          });
          const suiAmount = parseFloat(suiBalance.totalBalance) / 1_000_000_000; // Convert from MIST
          console.log(`💰 SUI balance: ${suiAmount.toFixed(4)} SUI`);
        } catch (error) {
          console.warn(`⚠️ Could not fetch SUI balance: ${error.message}`);
        }

      } catch (error) {
        console.error('❌ Sui wallet initialization failed:', error.message);
        console.warn('⚠️ Check your SUI_TEST_PRIVATE_KEY format in .env');
      }
    } else {
      console.warn('⚠️ SUI_TEST_PRIVATE_KEY not found in .env - Sui trading disabled');
    }

    // Final validation
    if (!ethWallet && !celoWallet && !suiWallet) {
      throw new Error('No wallets initialized - check your private keys in .env file');
    }

    console.log(`✅ Wallet initialization complete`);
    console.log(`   Ethereum: ${ethWallet ? 'Connected' : 'Not available'}`);
    console.log(`   Celo: ${celoWallet ? 'Connected' : 'Not available'}`);
    console.log(`   Sui: ${suiWallet ? 'Connected' : 'Not available'}`);

    return { ethWallet, celoWallet, suiWallet, suiClient };
  } catch (error) {
    console.error('❌ Wallet initialization failed:', error.message);
    throw error;
  }
}

// ================================
// BALANCE MANAGEMENT
// ================================

export async function getWalletBalances() {
  const balances = { ethereum: {}, celo: {}, sui: {} };

  try {
    console.log('📊 Fetching wallet balances...');

    // Get Ethereum balances
    if (ethWallet) {
      try {
        const provider = ethWallet.provider;

        // ETH balance
        const ethBalance = await provider.getBalance(ethWallet.address);
        balances.ethereum.ETH = parseFloat(ethers.formatEther(ethBalance)).toFixed(4);

        // Token balances
        const tokenBalances = await Promise.allSettled([
          getERC20Balance(CHAIN_CONFIG.ethereum.tokens.USDC, 6, 'USDC', ethWallet),
          getERC20Balance(CHAIN_CONFIG.ethereum.tokens.USDT, 6, 'USDT', ethWallet),
          getERC20Balance(CHAIN_CONFIG.ethereum.tokens.DAI, 18, 'DAI', ethWallet)
        ]);

        tokenBalances.forEach((result, index) => {
          const tokens = ['USDC', 'USDT', 'DAI'];
          if (result.status === 'fulfilled') {
            balances.ethereum[tokens[index]] = result.value;
          } else {
            balances.ethereum[tokens[index]] = 'Error';
            console.warn(`⚠️ Failed to fetch ${tokens[index]} balance:`, result.reason.message);
          }
        });

        balances.ethereum.address = ethWallet.address;
        balances.ethereum.network = 'Sepolia Testnet';

      } catch (error) {
        console.error('Ethereum balance fetch error:', error.message);
        balances.ethereum.error = error.message;
      }
    }

    // Get Celo balances
    if (celoWallet) {
      try {
        const provider = celoWallet.provider;

        // CELO balance
        const celoBalance = await provider.getBalance(celoWallet.address);
        balances.celo.CELO = parseFloat(ethers.formatEther(celoBalance)).toFixed(4);

        // Celo stablecoin balances
        const celoTokenBalances = await Promise.allSettled([
          getERC20Balance(CHAIN_CONFIG.celo.tokens.cUSD, 18, 'cUSD', celoWallet),
          getERC20Balance(CHAIN_CONFIG.celo.tokens.cEUR, 18, 'cEUR', celoWallet),
          getERC20Balance(CHAIN_CONFIG.celo.tokens.cREAL, 18, 'cREAL', celoWallet),
          getERC20Balance(CHAIN_CONFIG.celo.tokens.USDC, 6, 'USDC', celoWallet),
          getERC20Balance(CHAIN_CONFIG.celo.tokens.USDT, 6, 'USDT', celoWallet)
        ]);

        const celoTokens = ['cUSD', 'cEUR', 'cREAL', 'USDC', 'USDT'];
        celoTokenBalances.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            balances.celo[celoTokens[index]] = result.value;
          } else {
            balances.celo[celoTokens[index]] = 'Error';
            console.warn(`⚠️ Failed to fetch Celo ${celoTokens[index]} balance:`, result.reason.message);
          }
        });

        balances.celo.address = celoWallet.address;
        balances.celo.network = 'Alfajores Testnet';

      } catch (error) {
        console.error('Celo balance fetch error:', error.message);
        balances.celo.error = error.message;
      }
    }

    // Get Sui balances
    if (suiWallet && suiClient) {
      try {
        const suiAddress = suiWallet.getPublicKey().toSuiAddress();

        // SUI balance
        const suiBalance = await suiClient.getBalance({
          owner: suiAddress,
          coinType: '0x2::sui::SUI'
        });
        balances.sui.SUI = parseFloat(suiBalance.totalBalance / 1_000_000_000).toFixed(4);

        // USDC balance on Sui (if available)
        try {
          const usdcBalance = await suiClient.getBalance({
            owner: suiAddress,
            coinType: CHAIN_CONFIG.sui.tokens.USDC
          });
          balances.sui.USDC = parseFloat(usdcBalance.totalBalance / 1_000_000).toFixed(2);
        } catch (error) {
          balances.sui.USDC = '0.00';
        }

        // USDY balance on Sui (if available)
        try {
          const usdyBalance = await suiClient.getBalance({
            owner: suiAddress,
            coinType: CHAIN_CONFIG.sui.tokens.USDY
          });
          balances.sui.USDY = parseFloat(usdyBalance.totalBalance / 1_000_000).toFixed(2);
        } catch (error) {
          balances.sui.USDY = '0.00';
        }

        balances.sui.address = suiAddress;
        balances.sui.network = 'Sui Testnet';

      } catch (error) {
        console.error('Sui balance fetch error:', error.message);
        balances.sui.error = error.message;
      }
    }

    console.log('✅ Wallet balances fetched successfully');
    return balances;

  } catch (error) {
    console.error('Balance fetch error:', error);
    return balances;
  }
}

// Helper function to get ERC20 token balance
async function getERC20Balance(tokenAddress, decimals, symbol, wallet) {
  try {
    if (!wallet || !tokenAddress) {
      return '0.00';
    }

    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function balanceOf(address) view returns (uint256)'],
      wallet.provider
    );

    const balance = await tokenContract.balanceOf(wallet.address);
    return parseFloat(ethers.formatUnits(balance, decimals)).toFixed(decimals === 6 ? 2 : 4);
  } catch (error) {
    console.warn(`Failed to fetch ${symbol} balance:`, error.message);
    return 'Error';
  }
}

// ================================
// GAS PRICE MANAGEMENT
// ================================

export async function getGasPrices() {
  try {
    const gasPrices = {};

    // Ethereum gas prices
    if (ethWallet) {
      try {
        const feeData = await ethWallet.provider.getFeeData();
        gasPrices.ethereum = {
          gasPrice: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') + ' gwei' : 'Unknown',
          maxFeePerGas: feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei') + ' gwei' : null,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') + ' gwei' : null,
          type: feeData.maxFeePerGas ? 'EIP-1559' : 'Legacy'
        };
      } catch (error) {
        gasPrices.ethereum = { error: error.message };
      }
    }

    // Sui gas prices (relatively stable)
    gasPrices.sui = {
      gasPrice: '1000 MIST per gas unit',
      referenceGasPrice: '1000',
      note: 'Sui gas prices are algorithmically determined'
    };

    return gasPrices;
  } catch (error) {
    console.error('Gas price fetch error:', error);
    return {
      ethereum: { error: 'Failed to fetch' },
      sui: { error: 'Failed to fetch' }
    };
  }
}

// ================================
// WALLET UTILITIES
// ================================

// Check if wallets have sufficient balance for trading
export async function checkTradingReadiness(requiredAmountUSD = 50) {
  try {
    const balances = await getWalletBalances();
    const gasPrices = await getGasPrices();

    // Check Ethereum readiness
    const ethETH = parseFloat(balances.ethereum?.ETH || 0);
    const ethUSDC = parseFloat(balances.ethereum?.USDC || 0);
    const ethReady = ethETH > 0.01 && ethUSDC >= requiredAmountUSD / 2; // Min 0.01 ETH for gas + some USDC

    // Check Sui readiness
    const suiSUI = parseFloat(balances.sui?.SUI || 0);
    const suiUSDC = parseFloat(balances.sui?.USDC || 0);
    const suiReady = suiSUI > 0.1 && suiUSDC >= requiredAmountUSD / 2; // Min 0.1 SUI for gas + some USDC

    const readiness = {
      overall: ethReady && suiReady,
      ethereum: {
        ready: ethReady,
        hasGas: ethETH > 0.01,
        hasTokens: ethUSDC >= requiredAmountUSD / 2,
        balances: {
          ETH: ethETH,
          USDC: ethUSDC
        }
      },
      sui: {
        ready: suiReady,
        hasGas: suiSUI > 0.1,
        hasTokens: suiUSDC >= requiredAmountUSD / 2,
        balances: {
          SUI: suiSUI,
          USDC: suiUSDC
        }
      },
      recommendations: []
    };

    // Add recommendations
    if (!ethReady) {
      if (ethETH <= 0.01) readiness.recommendations.push('Get more ETH for gas on Sepolia');
      if (ethUSDC < requiredAmountUSD / 2) readiness.recommendations.push('Get more USDC on Ethereum');
    }

    if (!suiReady) {
      if (suiSUI <= 0.1) readiness.recommendations.push('Get more SUI for gas on testnet');
      if (suiUSDC < requiredAmountUSD / 2) readiness.recommendations.push('Get more USDC on Sui');
    }

    if (readiness.overall) {
      readiness.recommendations.push('All systems ready for trading!');
    }

    return readiness;
  } catch (error) {
    throw new Error(`Trading readiness check failed: ${error.message}`);
  }
}

// Get wallet transaction history (simplified)
export async function getRecentTransactions(limit = 10) {
  try {
    const transactions = {
      ethereum: [],
      sui: []
    };

    // For Ethereum, we'd typically use etherscan API or similar
    // For now, we'll return placeholder data
    if (ethWallet) {
      transactions.ethereum = [
        {
          hash: '0x...',
          type: 'Token Transfer',
          status: 'Confirmed',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          amount: '100 USDC',
          gasUsed: '21000'
        }
      ];
    }

    // For Sui, we'd use the Sui RPC API
    if (suiWallet) {
      transactions.sui = [
        {
          digest: '0x...',
          type: 'Move Call',
          status: 'Success',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          amount: '50 USDC',
          gasUsed: '1000000'
        }
      ];
    }

    return transactions;
  } catch (error) {
    throw new Error(`Transaction history fetch failed: ${error.message}`);
  }
}

// ================================
// WALLET VALIDATION
// ================================

export function validateWalletConfiguration() {
  const config = {
    ethereum: {
      configured: !!ethWallet,
      address: ethWallet?.address || null,
      network: 'Sepolia Testnet',
      capabilities: ['Uniswap V3 Trading', 'ERC20 Tokens']
    },
    sui: {
      configured: !!suiWallet,
      address: suiWallet?.getPublicKey().toSuiAddress() || null,
      network: 'Sui Testnet',
      capabilities: ['Cetus DEX Trading', 'Sui Native Tokens']
    },
    trading: {
      crossChainEnabled: !!(ethWallet && suiWallet),
      safetyLimitsActive: true,
      maxTradeAmount: process.env.MAX_TRADE_AMOUNT_USD || '100',
      testnetOnly: process.env.TESTNET_MODE !== 'false'
    }
  };

  return config;
}

// ================================
// EXPORT UTILITIES
// ================================

// Export wallet addresses for external use
export function getWalletAddresses() {
  return {
    ethereum: ethWallet?.address || null,
    sui: suiWallet?.getPublicKey().toSuiAddress() || null
  };
}

// Check if specific wallet is available
export function isWalletAvailable(chain) {
  switch (chain) {
    case 'ethereum':
      return !!ethWallet;
    case 'sui':
      return !!suiWallet;
    default:
      return false;
  }
}

// Get wallet instance (use carefully)
export function getWalletInstance(chain) {
  switch (chain) {
    case 'ethereum':
      return ethWallet;
    case 'sui':
      return suiWallet;
    default:
      return null;
  }
}