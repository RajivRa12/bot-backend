import { SubscriptionService } from '../../services/subscriptionService.js';

/**
 * Consume credits for API usage
 * POST /api/usage/consume
 */
export const consumeCredits = async (req, res) => {
  try {
    const { userId, credits = 1, description = 'API usage' } = req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: userId is required'
      });
    }

    // Validate credits
    if (typeof credits !== 'number' || credits <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Credits must be a positive number'
      });
    }

    // Consume credits using subscription service
    const result = await SubscriptionService.consumeCredits(userId, credits, description);

    return res.status(200).json({
      success: true,
      message: 'Credits consumed successfully',
      data: result
    });

  } catch (error) {
    console.error('Error consuming credits:', error);
    
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
    
    if (error.message.includes('Insufficient credits') || error.message.includes('Daily limit exceeded')) {
      return res.status(400).json({
        success: false,
        message: 'Credit limit exceeded',
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to consume credits',
      error: error.message
    });
  }
};
