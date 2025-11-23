import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

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
      auth: false,
      profiles: false,
      artifacts: false
    }
  });
});

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
