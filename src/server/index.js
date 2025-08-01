import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Route imports
import swapRoutes from './routes/swaps.js';
import arbitrageRoutes from './routes/arbitrage.js';
import walletRoutes from './routes/wallet.js';

// Service imports
import { initializeProviders } from './services/blockchain.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api', limiter);

// Routes
app.use('/api/swap', swapRoutes);
app.use('/api/arbitrage', arbitrageRoutes);
app.use('/api/wallet', walletRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    chains: ['ethereum-sepolia', 'sui-testnet']
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'StableArb Bridge v2 is operational! 🚀',
    timestamp: new Date().toISOString()
  });
});

// Start server
async function startServer() {
  try {
    await initializeProviders();

    app.listen(PORT, () => {
      console.log(`🚀 StableArb Bridge v2 running on port ${PORT}`);
      console.log(`📊 Health: http://localhost:${PORT}/api/health`);
      console.log(`🧪 Test: http://localhost:${PORT}/api/test`);
      console.log(`📈 Endpoints available:`);
      console.log(`   - POST /api/swap/bidirectional-real`);
      console.log(`   - GET  /api/swap/status-real/:id`);
      console.log(`   - POST /api/wallet/register`);
      console.log(`   - GET  /api/arbitrage/sepolia-sui-yield`);
      console.log(`✨ Ready for arbitrage opportunities!`);
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
}

startServer();