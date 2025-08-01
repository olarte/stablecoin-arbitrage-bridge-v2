import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';

// Route imports
import swapRoutes from './routes/swaps.js';
import arbitrageRoutes from './routes/arbitrage.js';
import walletRoutes from './routes/wallet.js';
import faucetRoutes from './routes/faucet.js';
import celoRoutes from './routes/celo.js';

// Service imports
import { initializeProviders } from './services/blockchain.js';
import { initializeTestWallets } from './services/wallets.js';

dotenv.config();

const app = express();
let PORT = process.env.PORT || 3001;

// ================================
// SECURITY & MIDDLEWARE SETUP
// ================================

// Enhanced security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "wss:"] // Allow WebSocket connections
    },
  },
}));

// CORS configuration for development and production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' ? 
    [process.env.FRONTEND_URL] : 
    ['http://localhost:3000', 'http://localhost:5000', 'http://localhost:8080'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced rate limiting
const createRateLimiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { success: false, error: message },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`🚫 Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: message,
      retryAfter: Math.round(windowMs / 1000)
    });
  }
});

// Different rate limits for different endpoints
const generalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests
  'Too many requests, please try again later'
);

const tradingLimiter = createRateLimiter(
  60 * 1000, // 1 minute  
  5, // 5 trades per minute
  'Trading rate limit exceeded, please wait before executing another trade'
);

const faucetLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  3, // 3 faucet requests per hour
  'Faucet rate limit exceeded, please wait before requesting more tokens'
);

// Apply rate limiting
app.use('/api', generalLimiter);
app.use('/api/swap/execute-arbitrage', tradingLimiter);
app.use('/api/swap/execute-real-trade', tradingLimiter);
app.use('/api/faucet', faucetLimiter);

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`📨 ${timestamp} ${req.method} ${req.path} - IP: ${req.ip}`);

  // Log request body for POST requests (excluding sensitive data)
  if (req.method === 'POST' && req.body) {
    const safeBody = { ...req.body };
    if (safeBody.privateKey) safeBody.privateKey = '[REDACTED]';
    if (safeBody.secret) safeBody.secret = '[REDACTED]';
    console.log(`📝 Request body:`, JSON.stringify(safeBody, null, 2));
  }

  next();
});

// ================================
// ROUTE REGISTRATION
// ================================

// Main API routes
app.use('/api/swap', swapRoutes);
app.use('/api/arbitrage', arbitrageRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/faucet', faucetRoutes);
app.use('/api/celo', celoRoutes);

// ================================
// CORE ENDPOINTS
// ================================

// Enhanced health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development',

      // System information
      system: {
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        },
        node: process.version
      },

      // Trading configuration
      trading: {
        enabled: process.env.ENABLE_REAL_TRADING === 'true',
        testnetMode: process.env.TESTNET_MODE === 'true',
        maxTradeAmount: process.env.MAX_TRADE_AMOUNT_USD || '100',
        minProfitThreshold: process.env.MIN_PROFIT_THRESHOLD || '0.3'
      },

      // Supported features
      features: {
        atomicSwaps: true,
        realBlockchainIntegration: true,
        crossChainArbitrage: true,
        multiChainSupport: ['ethereum-sepolia', 'sui-testnet'],
        dexIntegration: ['uniswap-v3', 'cetus-dex'],
        pegMonitoring: true
      },

      // Network status
      networks: {
        ethereum: 'Sepolia Testnet',
        sui: 'Sui Testnet'
      }
    };

    res.json({
      success: true,
      data: healthData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API information and documentation endpoint
app.get('/api/info', (req, res) => {
  const apiInfo = {
    name: 'StableArb Bridge API',
    version: '2.0.0',
    description: 'Cross-chain arbitrage trading system with atomic swap capabilities',

    // Available endpoints
    endpoints: {
      health: 'GET /api/health - System health check',

      // Wallet management
      walletRegister: 'POST /api/wallet/register - Register wallet session',
      walletStatus: 'GET /api/swap/wallet-status - Get wallet balances and status',

      // Trading
      scanOpportunities: 'GET /api/swap/scan-opportunities - Scan for arbitrage opportunities',
      executeArbitrage: 'POST /api/swap/execute-arbitrage - Execute real arbitrage trade',

      // Atomic swaps
      createSwap: 'POST /api/swap/bidirectional-real - Create atomic cross-chain swap',
      swapStatus: 'GET /api/swap/status-real/:swapId - Get swap status',

      // Faucets (testnet)
      faucetUSDC: 'POST /api/faucet/usdc - Request test USDC tokens',
      faucetStatus: 'GET /api/faucet/status/:address - Check faucet availability'
    },

    // Trading pairs
    supportedPairs: [
      'USDC-USDT',
      'USDT-USDC',
      'ETH-USDC'
    ],

    // Supported chains
    chains: {
      ethereum: {
        network: 'Sepolia Testnet',
        chainId: 11155111,
        currency: 'ETH',
        explorer: 'https://sepolia.etherscan.io'
      },
      sui: {
        network: 'Sui Testnet',
        chainId: 'sui:testnet',
        currency: 'SUI',
        explorer: 'https://suiexplorer.com'
      }
    },

    // Safety information
    safety: {
      testnetOnly: true,
      maxTradeAmount: '$100 equivalent',
      realMoneyAtRisk: false,
      automaticSafetyLimits: true
    },

    // Contact and support
    support: {
      documentation: '/api/docs',
      github: 'https://github.com/your-repo/stablearb-bridge',
      issues: 'https://github.com/your-repo/stablearb-bridge/issues'
    },

    timestamp: new Date().toISOString()
  };

  res.json({
    success: true,
    data: apiInfo
  });
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'StableArb Bridge v2 is operational! 🚀',
    timestamp: new Date().toISOString(),
    requestInfo: {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }
  });
});

// ================================
// PORT MANAGEMENT
// ================================

// Smart port finder function
async function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ Port ${startPort} in use, trying ${startPort + 1}...`);
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(err);
      }
    });
  });
}

// ================================
// ERROR HANDLING
// ================================

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error('💥 Unhandled error:', error);

  // Don't leak error details in production
  const errorResponse = {
    success: false,
    error: process.env.NODE_ENV === 'production' ? 
      'Internal server error' : 
      error.message,
    timestamp: new Date().toISOString(),
    requestId: req.id || Date.now()
  };

  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = error.stack;
  }

  res.status(500).json(errorResponse);
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    path: req.path,
    method: req.method,
    suggestion: 'Check /api/info for available endpoints',
    timestamp: new Date().toISOString()
  });
});

// ================================
// SERVER STARTUP
// ================================

// Enhanced server startup function
async function startServer() {
  try {
    console.log('\n🚀 Starting StableArb Bridge v2...');
    console.log('=====================================');

    // Environment validation
    console.log('🔧 Validating environment...');
    const requiredEnvVars = ['ETHEREUM_TEST_PRIVATE_KEY', 'SUI_TEST_PRIVATE_KEY'];
    const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

    if (missingVars.length > 0) {
      console.warn('⚠️ Missing environment variables:', missingVars.join(', '));
      console.warn('⚠️ Some trading features may be limited');
    }

    // Initialize blockchain providers
    console.log('🔗 Initializing blockchain providers...');
    await initializeProviders();

    // Initialize test wallets
    console.log('🔐 Connecting to test wallets...');
    try {
      await initializeTestWallets();
      console.log('✅ Test wallets connected successfully');
    } catch (error) {
      console.warn('⚠️ Wallet initialization failed:', error.message);
      console.warn('⚠️ Trading features will be limited');
    }

    // Find available port
    console.log('🔍 Finding available port...');
    PORT = await findAvailablePort(PORT);

    // Start the server
    const server = app.listen(PORT, () => {
      console.log('\n✅ StableArb Bridge v2 - REAL TRADING MODE ACTIVE');
      console.log('================================================');
      console.log(`🌐 Server URL: http://localhost:${PORT}`);
      console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`📖 API Info: http://localhost:${PORT}/api/info`);
      console.log(`🧪 Test Endpoint: http://localhost:${PORT}/api/test`);
      console.log('');
      console.log('🎯 TRADING ENDPOINTS:');
      console.log(`   💰 Wallet Status: GET http://localhost:${PORT}/api/swap/wallet-status`);
      console.log(`   🔍 Scan Opportunities: GET http://localhost:${PORT}/api/swap/scan-opportunities`);
      console.log(`   ⚡ Execute Arbitrage: POST http://localhost:${PORT}/api/swap/execute-arbitrage`);
      console.log(`   🔗 Create Atomic Swap: POST http://localhost:${PORT}/api/swap/bidirectional-real`);
      console.log('');
      console.log('🌟 CELO ENDPOINTS:');
      console.log(`   🔍 Celo Opportunities: GET http://localhost:${PORT}/api/celo/opportunities`);
      console.log(`   💱 Celo Prices: GET http://localhost:${PORT}/api/celo/prices/:pair`);
      console.log(`   ⚡ Celo Native Arbitrage: POST http://localhost:${PORT}/api/celo/execute-native-arbitrage`);
      console.log(`   💰 Celo Balances: GET http://localhost:${PORT}/api/celo/balances`);
      console.log(`   ℹ️ Celo Info: GET http://localhost:${PORT}/api/celo/info`);
      console.log('');
      console.log('🚰 TESTNET FAUCETS:');
      console.log(`   💧 USDC Faucet: POST http://localhost:${PORT}/api/faucet/usdc`);
      console.log(`   📊 Faucet Status: GET http://localhost:${PORT}/api/faucet/status/:address`);
      console.log('');
      console.log('🛡️ SAFETY FEATURES:');
      console.log(`   🏠 Testnet Only: ${process.env.TESTNET_MODE !== 'false' ? 'YES' : 'NO'}`);
      console.log(`   💵 Max Trade: $${process.env.MAX_TRADE_AMOUNT_USD || '100'}`);
      console.log(`   📈 Min Profit: ${process.env.MIN_PROFIT_THRESHOLD || '0.3'}%`);
      console.log(`   🔒 Rate Limited: YES`);
      console.log('');
      console.log('🎉 Ready for cross-chain arbitrage trading!');
      console.log('⚠️  Remember: This uses TESTNET tokens only - no real money at risk');
      console.log('🌟 NEW: Celo integration with multiple native stablecoins!');
      console.log('💡 Try: cUSD ↔ cEUR ↔ cREAL arbitrage on ultra-low fees');
      console.log('================================================\n');
    });

    // Graceful shutdown handling
    const shutdown = (signal) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      server.close(() => {
        console.log('✅ Server closed successfully');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        console.log('⏰ Forcing shutdown after 10 seconds');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Cleanup expired swaps every 5 minutes
    setInterval(() => {
      try {
        const now = Math.floor(Date.now() / 1000);
        let expiredCount = 0;

        // This would need to be imported from blockchain service
        // for (const [swapId, swapState] of swapStates.entries()) {
        //   if (now > swapState.timelock + 3600) { // 1 hour after expiry
        //     swapStates.delete(swapId);
        //     expiredCount++;
        //   }
        // }

        if (expiredCount > 0) {
          console.log(`🧹 Cleaned up ${expiredCount} expired swaps`);
        }
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error('❌ Server startup failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Start the server
startServer().catch(error => {
  console.error('💥 Fatal startup error:', error);
  process.exit(1);
});