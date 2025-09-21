import express from 'express';
import { consumeCredits } from '../controllers/usage/consume.js';

const router = express.Router();

// Usage management routes
router.post('/consume', consumeCredits);

export default router;


