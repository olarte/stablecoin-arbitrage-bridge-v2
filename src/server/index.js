import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

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

// ================================
// PORT CONFIGURATION (FIXED)
// ================================

// Fix: Ensure PORT is always a number and within valid range
// Use port 5000 for both development and production (Replit recommended port)
let PORT = parseInt(process.env.PORT) || 5000;

// Validate port range
if (PORT < 1024 || PORT > 65535) {
  console.warn(`⚠️ Invalid port ${PORT}, using default 5000`);
  PORT = 5000;
}

console.log(`🔧 Initial port configuration: ${PORT} (type: ${typeof PORT})`);

// Fixed port finder function
async function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    // Ensure startPort is a number and within valid range
    const port = parseInt(startPort);
    if (isNaN(port) || port < 1024 || port > 65535) {
      console.error(`❌ Invalid port: ${startPort}`);
      resolve(3001); // Fallback to default
      return;
    }

    const server = createServer();

    server.listen(port, () => {
      const actualPort = server.address().port;
      server.close(() => resolve(actualPort));
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ Port ${port} in use, trying ${port + 1}...`);

        // Prevent infinite recursion by limiting port range
        if (port < 65500) {
          resolve(findAvailablePort(port + 1));
        } else {
          console.error('❌ No available ports found');
          resolve(3001); // Fallback
        }
      } else {
        console.error(`❌ Port error: ${err.message}`);
        resolve(3001); // Fallback to default
      }
    });
  });
}

const app = express();

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================================
// SECURITY & MIDDLEWARE SETUP
// ================================

// Enhanced security headers with React frontend support
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // React dev needs unsafe-eval
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "wss:", "ws:"] // Allow WebSocket connections for React dev
    },
  },
}));

// Enhanced CORS configuration for React frontend
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' ? 
    [process.env.FRONTEND_URL] : 
    [
      'http://localhost:3000',    // React development server
      'http://localhost:3001',    // Same origin
      'http://localhost:5000',    // Alternative React port
      'http://localhost:8080',    // Alternative frontend port
      'http://127.0.0.1:3000',    // Alternative localhost format
      'http://127.0.0.1:3001'
    ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced rate limiting with React frontend considerations
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
  1000, // Increased for React frontend (was 100)
  'Too many requests, please try again later'
);

const tradingLimiter = createRateLimiter(
  60 * 1000, // 1 minute  
  10, // Increased for testing (was 5)
  'Trading rate limit exceeded, please wait before executing another trade'
);

const faucetLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  5, // Increased for testing (was 3)
  'Faucet rate limit exceeded, please wait before requesting more tokens'
);

// Apply rate limiting
app.use('/api', generalLimiter);
app.use('/api/swap/execute-arbitrage', tradingLimiter);
app.use('/api/swap/execute-enhanced-arbitrage', tradingLimiter);
app.use('/api/swap/execute-real-trade', tradingLimiter);
app.use('/api/faucet', faucetLimiter);

// Enhanced request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();

  // Only log non-OPTIONS requests to reduce noise
  if (req.method !== 'OPTIONS') {
    console.log(`📨 ${timestamp} ${req.method} ${req.path} - IP: ${req.ip}`);

    // Log request body for POST requests (excluding sensitive data)
    if (req.method === 'POST' && req.body && Object.keys(req.body).length > 0) {
      const safeBody = { ...req.body };
      if (safeBody.privateKey) safeBody.privateKey = '[REDACTED]';
      if (safeBody.secret) safeBody.secret = '[REDACTED]';
      console.log(`📝 Request body:`, JSON.stringify(safeBody, null, 2));
    }
  }

  next();
});

// ================================
// STATIC FILE SERVING (FOR REACT BUILD)
// ================================

// Serve React build files in production
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../../stablearb-frontend/build');
  app.use(express.static(buildPath));

  // Serve React app for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(buildPath, 'index.html'));
    }
  });
}

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
// ENHANCED CORE ENDPOINTS
// ================================

// Enhanced health check endpoint with React frontend support
app.get('/api/health', async (req, res) => {
  try {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0-enhanced',
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

      // Enhanced trading configuration
      trading: {
        enabled: process.env.ENABLE_REAL_TRADING === 'true',
        testnetMode: process.env.TESTNET_MODE !== 'false',
        maxTradeAmount: process.env.MAX_TRADE_AMOUNT_USD || '100',
        minProfitThreshold: process.env.MIN_PROFIT_THRESHOLD || '0.3'
      },

      // Enhanced supported features
      features: {
        atomicSwaps: true,
        realBlockchainIntegration: true,
        crossChainArbitrage: true,
        triangularArbitrage: true,
        celoIntegration: true,
        multiChainSupport: ['ethereum-sepolia', 'sui-testnet', 'celo-alfajores'],
        dexIntegration: ['uniswap-v3', 'cetus-dex', 'ubeswap', 'curve'],
        pegMonitoring: true,
        reactFrontend: true
      },

      // Enhanced network status
      networks: {
        ethereum: 'Sepolia Testnet',
        sui: 'Sui Testnet',
        celo: 'Alfajores Testnet'
      },

      // Frontend integration
      frontend: {
        enabled: process.env.NODE_ENV === 'production',
        development: process.env.NODE_ENV !== 'production',
        corsEnabled: true,
        staticServing: process.env.NODE_ENV === 'production'
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

// Enhanced API information and documentation endpoint
app.get('/api/info', (req, res) => {
  const apiInfo = {
    name: 'StableArb Bridge API',
    version: '2.0.0-enhanced',
    description: 'Enhanced cross-chain arbitrage trading system with Celo integration and React frontend',

    // Enhanced available endpoints
    endpoints: {
      health: 'GET /api/health - System health check',

      // Wallet management
      walletRegister: 'POST /api/wallet/register - Register wallet session',
      walletStatus: 'GET /api/swap/wallet-status - Get wallet balances and status',

      // Enhanced trading
      scanOpportunities: 'GET /api/swap/scan-opportunities - Scan for arbitrage opportunities (with Celo)',
      executeArbitrage: 'POST /api/swap/execute-arbitrage - Execute arbitrage trade (all chains)',
      executeEnhancedArbitrage: 'POST /api/swap/execute-enhanced-arbitrage - Execute multi-chain arbitrage',

      // Atomic swaps
      createSwap: 'POST /api/swap/bidirectional-real - Create atomic cross-chain swap',
      swapStatus: 'GET /api/swap/status-real/:swapId - Get swap status',

      // Celo integration
      celoOpportunities: 'GET /api/celo/opportunities - Celo-specific arbitrage opportunities',
      celoBalances: 'GET /api/celo/balances - Celo wallet balances',
      celoPrices: 'GET /api/celo/prices/:pair - Celo token pair prices',
      celoInfo: 'GET /api/celo/info - Celo network information',

      // Faucets (testnet)
      faucetUSDC: 'POST /api/faucet/usdc - Request test USDC tokens',
      faucetStatus: 'GET /api/faucet/status/:address - Check faucet availability'
    },

    // Enhanced trading pairs
    supportedPairs: [
      'USDC-USDT',
      'USDT-USDC',
      'ETH-USDC',
      'USDC-cUSD',
      'cUSD-cEUR',
      'cEUR-cREAL'
    ],

    // Enhanced supported chains
    chains: {
      ethereum: {
        network: 'Sepolia Testnet',
        chainId: 11155111,
        currency: 'ETH',
        explorer: 'https://sepolia.etherscan.io',
        dexes: ['Uniswap V3']
      },
      sui: {
        network: 'Sui Testnet',
        chainId: 'sui:testnet',
        currency: 'SUI',
        explorer: 'https://suiexplorer.com',
        dexes: ['Cetus']
      },
      celo: {
        network: 'Alfajores Testnet',
        chainId: 44787,
        currency: 'CELO',
        explorer: 'https://alfajores.celoscan.io',
        dexes: ['Ubeswap', 'Uniswap V3', 'Curve'],
        nativeStablecoins: ['cUSD', 'cEUR', 'cREAL']
      }
    },

    // Enhanced arbitrage types
    arbitrageTypes: [
      'Cross-chain bilateral (2 chains)',
      'Triangular arbitrage (3 chains)',
      'Celo native stablecoin arbitrage',
      'Bridge token arbitrage',
      'Forex arbitrage (cEUR, cREAL)'
    ],

    // Enhanced safety information
    safety: {
      testnetOnly: true,
      maxTradeAmount: '$100 equivalent',
      realMoneyAtRisk: false,
      automaticSafetyLimits: true,
      rateLimiting: true,
      enhancedValidation: true
    },

    // Frontend information
    frontend: {
      technology: 'React',
      features: ['Real-time updates', 'Multi-chain portfolio', 'Live trading interface'],
      development: 'http://localhost:3000',
      production: 'Served from /api backend'
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

// Enhanced test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'StableArb Bridge v2 Enhanced is operational! 🚀',
    timestamp: new Date().toISOString(),
    version: '2.0.0-enhanced',
    features: [
      'Multi-chain arbitrage (Ethereum, Sui, Celo)',
      'Triangular arbitrage support',
      'React frontend integration',
      'Enhanced safety features',
      'Celo native stablecoin trading'
    ],
    requestInfo: {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }
  });
});

// NEW: Frontend configuration endpoint for React app
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    data: {
      version: '2.0.0-enhanced',
      apiBase: `/api`,
      features: {
        realTrading: process.env.ENABLE_REAL_TRADING === 'true',
        testnetMode: process.env.TESTNET_MODE !== 'false',
        celoEnabled: true,
        triangularArbitrage: true,
        multiChain: true
      },
      limits: {
        maxTradeAmount: parseFloat(process.env.MAX_TRADE_AMOUNT_USD) || 100,
        minProfitThreshold: parseFloat(process.env.MIN_PROFIT_THRESHOLD) || 0.3,
        maxSlippage: parseFloat(process.env.MAX_SLIPPAGE_PERCENT) || 2.0
      },
      chains: ['ethereum', 'sui', 'celo'],
      refreshInterval: 30000, // 30 seconds
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// ================================
// ENHANCED ERROR HANDLING
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

// Enhanced 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    path: req.path,
    method: req.method,
    suggestion: 'Check /api/info for available endpoints',
    availableEndpoints: [
      '/api/health',
      '/api/info',
      '/api/config',
      '/api/swap/wallet-status',
      '/api/swap/scan-opportunities',
      '/api/celo/opportunities'
    ],
    timestamp: new Date().toISOString()
  });
});

// ================================
// ENHANCED SERVER STARTUP
// ================================

// Enhanced server startup function
async function startServer() {
  try {
    console.log('\n🚀 Starting StableArb Bridge v2 Enhanced...');
    console.log('==============================================');
    console.log(`🔧 Port configuration: ${PORT} (type: ${typeof PORT})`);

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
    try {
      await initializeProviders();
      console.log('✅ Blockchain providers initialized');
    } catch (error) {
      console.warn('⚠️ Blockchain provider initialization failed:', error.message);
    }

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
    const finalPort = await findAvailablePort(PORT);
    console.log(`✅ Using port: ${finalPort}`);

    // Start the server - bind to 0.0.0.0 for production accessibility
    const server = app.listen(finalPort, '0.0.0.0', () => {
      console.log('\n✅ StableArb Bridge v2 Enhanced - READY FOR TRADING');
      console.log('===================================================');
      console.log(`🌐 Server URL: http://localhost:${finalPort}`);
      console.log(`📱 React Frontend: ${process.env.NODE_ENV === 'production' ? `http://localhost:${finalPort}` : 'http://localhost:3000'}`);
      console.log(`📊 Health Check: http://localhost:${finalPort}/api/health`);
      console.log(`📖 API Info: http://localhost:${finalPort}/api/info`);
      console.log(`⚙️ Config: http://localhost:${finalPort}/api/config`);
      console.log(`🧪 Test Endpoint: http://localhost:${finalPort}/api/test`);
      console.log('');
      console.log('🎯 ENHANCED TRADING ENDPOINTS:');
      console.log(`   💰 Wallet Status: GET http://localhost:${finalPort}/api/swap/wallet-status`);
      console.log(`   🔍 Scan Opportunities: GET http://localhost:${finalPort}/api/swap/scan-opportunities`);
      console.log(`   ⚡ Execute Arbitrage: POST http://localhost:${finalPort}/api/swap/execute-arbitrage`);
      console.log(`   🌐 Enhanced Arbitrage: POST http://localhost:${finalPort}/api/swap/execute-enhanced-arbitrage`);
      console.log(`   🔗 Create Atomic Swap: POST http://localhost:${finalPort}/api/swap/bidirectional-real`);
      console.log('');
      console.log('🌟 CELO ENHANCED ENDPOINTS:');
      console.log(`   🔍 Celo Opportunities: GET http://localhost:${finalPort}/api/celo/opportunities`);
      console.log(`   💱 Celo Prices: GET http://localhost:${finalPort}/api/celo/prices/:pair`);
      console.log(`   ⚡ Celo Native Arbitrage: POST http://localhost:${finalPort}/api/celo/execute-native-arbitrage`);
      console.log(`   💰 Celo Balances: GET http://localhost:${finalPort}/api/celo/balances`);
      console.log(`   ℹ️ Celo Info: GET http://localhost:${finalPort}/api/celo/info`);
      console.log('');
      console.log('🚰 TESTNET FAUCETS:');
      console.log(`   💧 USDC Faucet: POST http://localhost:${finalPort}/api/faucet/usdc`);
      console.log(`   📊 Faucet Status: GET http://localhost:${finalPort}/api/faucet/status/:address`);
      console.log('');
      console.log('🛡️ ENHANCED SAFETY FEATURES:');
      console.log(`   🏠 Testnet Only: ${process.env.TESTNET_MODE !== 'false' ? 'YES' : 'NO'}`);
      console.log(`   💵 Max Trade: $${process.env.MAX_TRADE_AMOUNT_USD || '100'}`);
      console.log(`   📈 Min Profit: ${process.env.MIN_PROFIT_THRESHOLD || '0.3'}%`);
      console.log(`   🔒 Rate Limited: YES (Enhanced)`);
      console.log(`   🌐 CORS Enabled: YES (React Ready)`);
      console.log('');
      console.log('🚀 ENHANCED FEATURES:');
      console.log('   ✅ Multi-chain arbitrage (3 chains)');
      console.log('   ✅ Triangular arbitrage support');
      console.log('   ✅ Celo native stablecoin trading');
      console.log('   ✅ React frontend integration');
      console.log('   ✅ Enhanced opportunity scanning');
      console.log('   ✅ Real-time portfolio tracking');
      console.log('');
      console.log('🎉 Ready for enhanced cross-chain arbitrage trading!');
      console.log('⚠️  Remember: This uses TESTNET tokens only - no real money at risk');
      console.log('🌟 NEW: Full Celo integration with cUSD ↔ cEUR ↔ cREAL trading!');
      console.log('💡 NEW: Triangular arbitrage across Ethereum → Sui → Celo!');
      console.log('📱 NEW: React frontend for easy trading interface!');
      console.log('===================================================\n');

      if (process.env.NODE_ENV !== 'production') {
        console.log('🔧 DEVELOPMENT MODE:');
        console.log('   • Start React frontend: cd frontend && npm start');
        console.log('   • React will run on: http://localhost:3000');
        console.log(`   • API accessible at: http://localhost:${finalPort}/api`);
        console.log('   • CORS configured for React development\n');
      }
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

    // Enhanced cleanup for expired swaps
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
    console.error('❌ Enhanced server startup failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Start the enhanced server
startServer().catch(error => {
  console.error('💥 Fatal enhanced startup error:', error);
  process.exit(1);
});