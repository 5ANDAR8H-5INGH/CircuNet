import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

const isDevelopment = process.env.NODE_ENV === 'development';
const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('Set JWT_SECRET to a random value of at least 32 characters in production.');
  }
  if (configuredOrigins.length === 0) {
    throw new Error('Set CORS_ORIGINS to the deployed frontend origin in production.');
  }
}

// Import database connection
import './config/database';

// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import materialRoutes from './routes/material.routes';
import listingRoutes from './routes/listing.routes';
import transactionRoutes from './routes/transaction.routes';
import transportRoutes from './routes/transport.routes';
import supplyChainRoutes from './routes/supplyChain.routes';
import reportRoutes from './routes/report.routes';
import messageRoutes from './routes/message.routes';
import requirementRoutes from './routes/requirement.routes';
import matchRoutes from './routes/match.routes';

// Create Express app
const app: Express = express();
const PORT = process.env.PORT || 8080;

// Apply middlewares
// Restrict browser API access to the deployed frontend in production.
app.use(isDevelopment
  ? cors()
  : cors({
      origin: (origin, callback) => {
        // Permit non-browser health checks and same-origin requests without an Origin header.
        if (!origin || configuredOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Origin is not allowed by CORS'));
      },
    }));

// Enhance security with Helmet
app.use(helmet());

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(morgan('dev'));

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate limiting
const positiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};
const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS);
if (Number.isSafeInteger(trustedProxyHops) && trustedProxyHops > 0) app.set('trust proxy', trustedProxyHops);
const limiter = rateLimit({
  windowMs: positiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 900000),
  limit: positiveInteger(process.env.RATE_LIMIT_MAX, isDevelopment ? 1000 : 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/transport', transportRoutes);
app.use('/api/supply-chains', supplyChainRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/requirements', requirementRoutes);
app.use('/api/matches', matchRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {},
  });
});

// Start the server
app.listen(PORT, () => {
  console.log('Server is running on port ' + PORT);
});

export default app;
