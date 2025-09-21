import express from 'express';
import { confirmPayment } from '../controllers/subscription/confirm.js';
import { getSubscriptionDetails } from '../controllers/subscription/me.js';
import { cancelSubscription } from '../controllers/subscription/cancel.js';

const router = express.Router();

// Subscription management routes
router.post('/confirm', confirmPayment);
router.get('/me', getSubscriptionDetails);
router.post('/cancel', cancelSubscription);

export default router;
