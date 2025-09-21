import { SubscriptionService } from '../../services/subscriptionService.js';

/**
 * Get user's subscription details with available credits
 * GET /api/subscriptions/me
 */
export const getSubscriptionDetails = async (req, res) => {
  try {
    const { userId } = req.query;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: userId is required'
      });
    }

    // Get subscription details using subscription service
    const result = await SubscriptionService.getSubscriptionDetails(userId);

    return res.status(200).json({
      success: true,
      message: 'Subscription details retrieved successfully',
      data: result
    });

  } catch (error) {
    console.error('Error getting subscription details:', error);
    
    // Handle specific error cases
    if (error.message.includes('User not found')) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: error.message
      });
    }
    
    if (error.message.includes('No active subscription')) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found',
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to get subscription details',
      error: error.message
    });
  }
};
