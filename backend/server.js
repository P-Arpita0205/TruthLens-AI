const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');

dotenv.config();

const authRoutes = require('./src/routes/auth.routes');
const analyzeRoutes = require('./src/routes/analyze.routes');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/analyze', analyzeRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'TruthLens AI Backend is running' });
});

const PORT = process.env.PORT || 5000;

const checkExistingBackend = () =>
  new Promise((resolve) => {
    const request = http.get(
      {
        host: '127.0.0.1',
        port: PORT,
        path: '/health',
        timeout: 1500
      },
      (response) => {
        if (response.statusCode === 200) {
          resolve(true);
          response.resume();
          return;
        }

        resolve(false);
        response.resume();
      }
    );

    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });

    request.on('error', () => resolve(false));
  });

const server = app.listen(PORT, () => {
  console.log(`TruthLens AI Backend running on port ${PORT}`);
});

server.on('close', () => {
  console.log('TruthLens AI Backend stopped.');
});

server.on('error', async (error) => {
  if (error.code === 'EADDRINUSE') {
    const alreadyRunning = await checkExistingBackend();
    if (alreadyRunning) {
      console.error(`Port ${PORT} is already in use because another TruthLens AI backend is already running.`);
      console.error(`Use the existing server at http://localhost:${PORT} or stop it before starting a new one.`);
    } else {
      console.error(`Port ${PORT} is already in use by another process.`);
      console.error('Stop the process using that port or change PORT in your .env file.');
    }

    process.exitCode = 1;
    return;
  }

  console.error('Backend server error:', error);
  process.exitCode = 1;
});

const shutdown = (signal) => {
  console.log(`${signal} received. Shutting down TruthLens AI backend...`);
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});
