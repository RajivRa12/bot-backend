import { SubscriptionService } from '../../services/subscriptionService.js';

/**
 * Run subscription renewals for due subscriptions
 * POST /api/admin/subscriptions/renew-due
 */
export const renewDueSubscriptions = async (req, res) => {
  try {
    // Check for admin token (basic auth)
    const adminToken = req.headers['x-admin-token'];
    if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. Admin token required.'
      });
    }

    // Run renewals using subscription service
    const result = await SubscriptionService.renewDueSubscriptions();

    return res.status(200).json({
      success: true,
      message: 'Subscription renewals processed',
      data: result
    });

  } catch (error) {
    console.error('Error running subscription renewals:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to run subscription renewals',
      error: error.message
    });
  }
};


