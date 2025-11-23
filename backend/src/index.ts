import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { configurePassport } from './passport-config';
import pool from './db';

// Import routes
import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import statementsRoutes from './routes/statements';
import artifactsRoutes from './routes/artifacts';

dotenv.config();

// Configure Passport
configurePassport();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// API Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0-mvp'
  });
});

// API routes
app.get('/api/status', (req, res) => {
  res.json({
    message: 'Personality Profiling API v1.0-MVP',
    features: {
      auth: true,
      profiles: true,
      statements: true,
      artifacts: true
    }
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/statements', statementsRoutes);
app.use('/api/artifacts', artifactsRoutes);

// Serve static files from frontend build (production)
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));

// Catch-all route - serve index.html for client-side routing
// IMPORTANT: This must come AFTER all API routes
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 API Health check: http://localhost:${PORT}/api/health`);
  console.log(`📍 Frontend: http://localhost:${PORT}`);
});
