import express from 'express';
import { renewDueSubscriptions } from '../controllers/admin/renewals.js';

const router = express.Router();

// Admin routes
router.post('/subscriptions/renew-due', renewDueSubscriptions);

export default router;


