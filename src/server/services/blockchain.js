
import { ethers } from 'ethers';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { CHAIN_CONFIG, CHAINLINK_ORACLES } from '../config/chains.js';

export class BlockchainService {
  constructor() {
    this.providers = {};
    this.wallets = {};
    this.suiClient = null;
    this.suiKeypair = null;
    this.initializeProviders();
  }

  initializeProviders() {
    // Initialize Ethereum provider
    this.providers.ethereum = new ethers.JsonRpcProvider(CHAIN_CONFIG.ethereum.rpc);
    
    // Initialize Ethereum wallet
    if (process.env.ETHEREUM_PRIVATE_KEY) {
      this.wallets.ethereum = new ethers.Wallet(
        process.env.ETHEREUM_PRIVATE_KEY,
        this.providers.ethereum
      );
    }

    // Initialize Sui client
    this.suiClient = new SuiClient({ url: CHAIN_CONFIG.sui.rpc });
    
    // Initialize Sui keypair
    if (process.env.SUI_PRIVATE_KEY) {
      this.suiKeypair = Ed25519Keypair.fromSecretKey(
        Buffer.from(process.env.SUI_PRIVATE_KEY, 'hex')
      );
    }
  }

  // Ethereum Methods
  async getEthereumBalance(address, tokenAddress = null) {
    try {
      if (!tokenAddress) {
        // Get ETH balance
        const balance = await this.providers.ethereum.getBalance(address);
        return ethers.formatEther(balance);
      } else {
        // Get ERC20 token balance
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
          this.providers.ethereum
        );
        const balance = await tokenContract.balanceOf(address);
        const decimals = await tokenContract.decimals();
        return ethers.formatUnits(balance, decimals);
      }
    } catch (error) {
      console.error('Error getting Ethereum balance:', error);
      throw error;
    }
  }

  async getEthereumGasPrice() {
    try {
      const gasPrice = await this.providers.ethereum.getFeeData();
      return {
        gasPrice: gasPrice.gasPrice,
        maxFeePerGas: gasPrice.maxFeePerGas,
        maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
      };
    } catch (error) {
      console.error('Error getting gas price:', error);
      throw error;
    }
  }

  async sendEthereumTransaction(to, value, data = '0x', gasLimit = 21000) {
    try {
      if (!this.wallets.ethereum) {
        throw new Error('Ethereum wallet not initialized');
      }

      const tx = {
        to,
        value: ethers.parseEther(value.toString()),
        data,
        gasLimit
      };

      const transaction = await this.wallets.ethereum.sendTransaction(tx);
      return await transaction.wait();
    } catch (error) {
      console.error('Error sending Ethereum transaction:', error);
      throw error;
    }
  }

  async transferERC20(tokenAddress, to, amount, decimals = 18) {
    try {
      if (!this.wallets.ethereum) {
        throw new Error('Ethereum wallet not initialized');
      }

      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function transfer(address to, uint256 amount) returns (bool)'],
        this.wallets.ethereum
      );

      const parsedAmount = ethers.parseUnits(amount.toString(), decimals);
      const tx = await tokenContract.transfer(to, parsedAmount);
      return await tx.wait();
    } catch (error) {
      console.error('Error transferring ERC20 token:', error);
      throw error;
    }
  }

  // Sui Methods
  async getSuiBalance(address, coinType = '0x2::sui::SUI') {
    try {
      const balance = await this.suiClient.getBalance({
        owner: address,
        coinType
      });
      return parseFloat(balance.totalBalance) / 1e9; // Convert from MIST to SUI
    } catch (error) {
      console.error('Error getting Sui balance:', error);
      throw error;
    }
  }

  async getSuiGasPrice() {
    try {
      const gasPrice = await this.suiClient.getReferenceGasPrice();
      return gasPrice;
    } catch (error) {
      console.error('Error getting Sui gas price:', error);
      throw error;
    }
  }

  async sendSuiTransaction(recipient, amount, coinType = '0x2::sui::SUI') {
    try {
      if (!this.suiKeypair) {
        throw new Error('Sui keypair not initialized');
      }

      const tx = new TransactionBlock();
      const [coin] = tx.splitCoins(tx.gas, [tx.pure(amount * 1e9)]); // Convert to MIST
      tx.transferObjects([coin], tx.pure(recipient));

      const result = await this.suiClient.signAndExecuteTransactionBlock({
        signer: this.suiKeypair,
        transactionBlock: tx
      });

      return result;
    } catch (error) {
      console.error('Error sending Sui transaction:', error);
      throw error;
    }
  }

  async transferSuiCoin(coinType, recipient, amount) {
    try {
      if (!this.suiKeypair) {
        throw new Error('Sui keypair not initialized');
      }

      const senderAddress = this.suiKeypair.getPublicKey().toSuiAddress();
      
      // Get coins of the specified type
      const coins = await this.suiClient.getCoins({
        owner: senderAddress,
        coinType
      });

      if (coins.data.length === 0) {
        throw new Error(`No coins of type ${coinType} found`);
      }

      const tx = new TransactionBlock();
      const [transferCoin] = tx.splitCoins(
        tx.object(coins.data[0].coinObjectId),
        [tx.pure(amount)]
      );
      tx.transferObjects([transferCoin], tx.pure(recipient));

      const result = await this.suiClient.signAndExecuteTransactionBlock({
        signer: this.suiKeypair,
        transactionBlock: tx
      });

      return result;
    } catch (error) {
      console.error('Error transferring Sui coin:', error);
      throw error;
    }
  }

  // Price Oracle Methods
  async getChainlinkPrice(priceFeed) {
    try {
      const aggregator = new ethers.Contract(
        priceFeed,
        [
          'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)'
        ],
        this.providers.ethereum
      );

      const roundData = await aggregator.latestRoundData();
      const price = ethers.formatUnits(roundData.answer, CHAINLINK_ORACLES.ethereum.decimals);
      
      return {
        price: parseFloat(price),
        timestamp: Number(roundData.updatedAt),
        roundId: roundData.roundId.toString()
      };
    } catch (error) {
      console.error('Error getting Chainlink price:', error);
      throw error;
    }
  }

  // Utility Methods
  async getTransactionStatus(chain, txHash) {
    try {
      if (chain === 'ethereum') {
        const receipt = await this.providers.ethereum.getTransactionReceipt(txHash);
        return {
          status: receipt ? (receipt.status === 1 ? 'success' : 'failed') : 'pending',
          blockNumber: receipt?.blockNumber,
          gasUsed: receipt?.gasUsed?.toString()
        };
      } else if (chain === 'sui') {
        const txResponse = await this.suiClient.getTransactionBlock({
          digest: txHash,
          options: { showEffects: true }
        });
        return {
          status: txResponse.effects?.status?.status === 'success' ? 'success' : 'failed',
          checkpoint: txResponse.checkpoint,
          gasUsed: txResponse.effects?.gasUsed?.computationCost
        };
      }
    } catch (error) {
      console.error('Error getting transaction status:', error);
      throw error;
    }
  }

  async estimateGas(chain, transaction) {
    try {
      if (chain === 'ethereum') {
        return await this.providers.ethereum.estimateGas(transaction);
      } else if (chain === 'sui') {
        // Sui gas estimation would require more complex logic
        // For now, return a default estimate
        return 1000000; // 1M gas units
      }
    } catch (error) {
      console.error('Error estimating gas:', error);
      throw error;
    }
  }

  // Connection status checks
  async checkConnections() {
    const status = {};

    try {
      await this.providers.ethereum.getBlockNumber();
      status.ethereum = 'connected';
    } catch (error) {
      status.ethereum = 'disconnected';
    }

    try {
      await this.suiClient.getLatestCheckpointSequenceNumber();
      status.sui = 'connected';
    } catch (error) {
      status.sui = 'disconnected';
    }

    return status;
  }
}

export default new BlockchainService();
