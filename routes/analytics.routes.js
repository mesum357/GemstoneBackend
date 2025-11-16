import express from 'express';
import analyticsController from '../controllers/analytics.controller.js';
import { isAuthenticated, isAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Get analytics for a specific period (use ?period=week|month|all)
router.get('/', isAuthenticated, isAdmin, analyticsController.getAnalytics);

// Get all analytics (week, month, all time) in one call
router.get('/all', isAuthenticated, isAdmin, analyticsController.getAllAnalytics);

export default router;

