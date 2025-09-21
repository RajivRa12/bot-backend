import { SubscriptionService } from '../../services/subscriptionService.js';

/**
 * Cancel subscription at period end
 * POST /api/subscriptions/cancel
 */
export const cancelSubscription = async (req, res) => {
  try {
    const { userId } = req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: userId is required'
      });
    }

    // Cancel subscription using subscription service
    const result = await SubscriptionService.cancelSubscription(userId);

    return res.status(200).json({
      success: true,
      message: 'Subscription canceled successfully',
      data: result
    });

  } catch (error) {
    console.error('Error canceling subscription:', error);
    
    // Handle specific error cases
    if (error.message.includes('User not found')) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: error.message
      });
    }
    
    if (error.message.includes('No active subscription')) {
      return res.status(400).json({
        success: false,
        message: 'No active subscription found',
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription',
      error: error.message
    });
  }
};
