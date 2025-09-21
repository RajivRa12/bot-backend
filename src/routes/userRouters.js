import express from 'express';
import { setupNewUser, getUser, deleteUser } from '../controllers/user/create.js';
import { PrismaClient } from '@prisma/client';
import stripe from 'stripe';
import {getAllPlans } from '../controllers/plans/create.js';

const prisma = new PrismaClient();
const router = express.Router();

router.post('/setupUser', setupNewUser);
router.get('/getUser', getUser);
router.delete('/deleteUser', deleteUser);

router.post('/create-payment-intent', async (req, res) => {
  const { planId, billingCycle, userId } = req.body;
  if (!userId || !planId || !billingCycle) return res.status(400).json({ success: false, message: 'Missing fields' });
  if (!['monthly', 'yearly'].includes(billingCycle)) return res.status(400).json({ success: false, message: 'Invalid billingCycle' });

  try {
    const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    const amount = (billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly) * 100;
    const paymentIntent = await stripeInstance.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: { userId, planId, billingCycle },
    });

    res.json({ success: true, clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Payment intent failed' });
  }
});

router.get('/getPlan',getAllPlans)
export default router;