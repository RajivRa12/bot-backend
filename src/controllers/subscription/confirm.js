import { SubscriptionService } from '../../services/subscriptionService.js';

/**
 * Confirm payment and activate subscription
 * POST /api/subscriptions/confirm
 */
export const confirmPayment = async (req, res) => {
  try {
    const { userId, planCode, paidAt, externalPaymentId, billingCycle, amount, currency } = req.body;

    // Validate required fields
    if (!userId || !planCode || !externalPaymentId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, planCode, and externalPaymentId are required'
      });
    }

    // Validate billingCycle
    if (billingCycle && !['monthly', 'yearly'].includes(billingCycle)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid billingCycle. Must be "monthly" or "yearly"'
      });
    }

    // Parse paidAt if provided
    const paymentDate = paidAt ? new Date(paidAt) : new Date();

    // Confirm payment using subscription service
    const result = await SubscriptionService.confirmPayment(
      userId,
      planCode,
      paymentDate,
      externalPaymentId,
      {
        billingCycle: billingCycle || 'monthly',
        amount: amount || 0,
        currency: currency || 'usd'
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Payment confirmed and subscription activated',
      data: result
    });

  } catch (error) {
    console.error('Error confirming payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to confirm payment',
      error: error.message
    });
  }
};


