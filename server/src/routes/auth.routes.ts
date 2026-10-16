import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();
const isDevelopment = process.env.NODE_ENV === 'development';
const positiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};
const authLimiter = rateLimit({
  windowMs: positiveInteger(process.env.AUTH_RATE_LIMIT_WINDOW_MS, positiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 900000)),
  limit: positiveInteger(process.env.AUTH_RATE_LIMIT_MAX, isDevelopment ? 100 : 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many sign-in attempts. Please try again later.' },
});

router.get('/me', authenticate, (req: Request, res: Response) => authController.currentUser(req, res));

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', authLimiter, (req: Request, res: Response) => {
  return authController.register(req, res);
});

/**
 * @route POST /api/auth/login
 * @desc Login user and get token
 * @access Public
 */
router.post('/login', authLimiter, (req: Request, res: Response) => {
  return authController.login(req, res);
});

export default router;
