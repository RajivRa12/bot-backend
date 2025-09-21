import { prisma } from '../lib/prisma.js';

/**
 * Central subscription service for handling payment confirmations and subscription management
 * This service is payment-provider agnostic and can work with Stripe, Play Store, etc.
 */

export class SubscriptionService {
  /**
   * Confirm payment and activate/update subscription
   * @param {string} userId - User ID (clerkUserId)
   * @param {string} planCode - Plan identifier (can be plan ID or plan name)
   * @param {Date} paidAt - Payment timestamp
   * @param {string} externalPaymentId - External payment ID (Stripe, Play Store, etc.)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Updated subscription data
   */
  static async confirmPayment(userId, planCode, paidAt = new Date(), externalPaymentId, options = {}) {
    const { billingCycle = 'monthly', amount = 0, currency = 'usd' } = options;

    try {
      // Find user by clerkUserId
      const user = await prisma.user.findUnique({
        where: { clerkUserId: userId },
        include: { referralStats: true }
      });

      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Find plan by ID or name
      const plan = await prisma.plan.findFirst({
        where: {
          OR: [
            { id: planCode },
            { name: planCode }
          ]
        }
      });

      if (!plan) {
        throw new Error(`Plan not found: ${planCode}`);
      }

      // Calculate period dates
      const currentPeriodStart = paidAt;
      const currentPeriodEnd = new Date(paidAt);
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + (billingCycle === 'yearly' ? 12 : 1));

      // Determine credits to grant
      const creditsToGrant = plan.isDaily ? plan.dailyCredits : plan.monthlyCredits;

      // Process subscription update/creation in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Find existing active subscription
        let subscription = await tx.subscription.findFirst({
          where: { 
            userId: user.id, 
            status: 'active' 
          },
          include: { plan: true }
        });

        if (subscription) {
          // Update existing subscription
          subscription = await tx.subscription.update({
            where: { id: subscription.id },
            data: {
              planId: plan.id,
              billingCycle,
              status: 'active',
              currentPeriodStart,
              currentPeriodEnd,
              cancelAtPeriodEnd: false,
              canceledAt: null,
              updatedAt: new Date()
            }
          });
        } else {
          // Create new subscription
          subscription = await tx.subscription.create({
            data: {
              userId: user.id,
              planId: plan.id,
              billingCycle,
              status: 'active',
              currentPeriodStart,
              currentPeriodEnd,
              cancelAtPeriodEnd: false
            }
          });
        }

        // Grant credits to user
        await tx.creditLedger.create({
          data: {
            userId: user.id,
            subscriptionId: subscription.id,
            amount: creditsToGrant,
            type: 'granted',
            description: `Credits granted for ${plan.name} subscription`
          }
        });

        // Create billing history record
        await tx.billingHistory.create({
          data: {
            userId: user.id,
            subscriptionId: subscription.id,
            amount: amount,
            currency: currency,
            status: 'completed',
            paymentDate: paidAt,
            externalPaymentId: externalPaymentId
          }
        });

        // Process referral commission if user was referred
        if (user.referredById && amount > 0) {
          const referralEarning = billingCycle === 'yearly' 
            ? (plan.priceYearly * 0.20) 
            : (plan.priceMonthly * 0.20);

          await tx.referralStats.update({
            where: { userId: user.referredById },
            data: {
              totalPaidSubscribers: { increment: 1 },
              totalEarning: { increment: referralEarning }
            }
          });
        }

        return subscription;
      });

      return {
        success: true,
        subscription: result,
        creditsGranted: creditsToGrant,
        message: 'Payment confirmed and subscription activated'
      };

    } catch (error) {
      console.error('Error confirming payment:', error);
      throw new Error(`Failed to confirm payment: ${error.message}`);
    }
  }

  /**
   * Cancel subscription at period end
   * @param {string} userId - User ID (clerkUserId)
   * @returns {Promise<Object>} Updated subscription data
   */
  static async cancelSubscription(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { clerkUserId: userId }
      });

      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      const subscription = await prisma.subscription.findFirst({
        where: { 
          userId: user.id, 
          status: 'active' 
        }
      });

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: true,
          canceledAt: new Date(),
          updatedAt: new Date()
        }
      });

      return {
        success: true,
        subscription: updatedSubscription,
        message: 'Subscription will be canceled at period end'
      };

    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }
  }

  /**
   * Get user's subscription details with available credits
   * @param {string} userId - User ID (clerkUserId)
   * @returns {Promise<Object>} Subscription details
   */
  static async getSubscriptionDetails(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { clerkUserId: userId }
      });

      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      const subscription = await prisma.subscription.findFirst({
        where: { 
          userId: user.id, 
          status: 'active' 
        },
        include: { 
          plan: true,
          creditLedger: {
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        }
      });

      if (!subscription) {
        return {
          success: true,
          subscription: null,
          availableCredits: 0,
          message: 'No active subscription found'
        };
      }

      // Calculate available credits
      const creditSum = await prisma.creditLedger.aggregate({
        where: { userId: user.id },
        _sum: { amount: true }
      });

      const availableCredits = creditSum._sum.amount || 0;

      // Get today's usage for Pro plan daily limit
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayUsage = await prisma.dailyUsage.findFirst({
        where: {
          userId: user.id,
          date: today
        }
      });

      return {
        success: true,
        subscription: {
          id: subscription.id,
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          billingCycle: subscription.billingCycle
        },
        availableCredits,
        dailyUsage: todayUsage?.usageCount || 0,
        dailyLimit: subscription.plan.isDaily ? subscription.plan.dailyCredits : null,
        recentCredits: subscription.creditLedger
      };

    } catch (error) {
      console.error('Error getting subscription details:', error);
      throw new Error(`Failed to get subscription details: ${error.message}`);
    }
  }

  /**
   * Consume credits for API usage
   * @param {string} userId - User ID (clerkUserId)
   * @param {number} creditsToConsume - Number of credits to consume
   * @param {string} description - Description of usage
   * @returns {Promise<Object>} Result of credit consumption
   */
  static async consumeCredits(userId, creditsToConsume = 1, description = 'API usage') {
    try {
      const user = await prisma.user.findUnique({
        where: { clerkUserId: userId }
      });

      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      const subscription = await prisma.subscription.findFirst({
        where: { 
          userId: user.id, 
          status: 'active' 
        },
        include: { plan: true }
      });

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      // Check daily limit for Pro plan
      if (subscription.plan.isDaily) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayUsage = await prisma.dailyUsage.findFirst({
          where: {
            userId: user.id,
            date: today
          }
        });

        const currentUsage = todayUsage?.usageCount || 0;
        if (currentUsage + creditsToConsume > subscription.plan.dailyCredits) {
          throw new Error(`Daily limit exceeded. Used: ${currentUsage}/${subscription.plan.dailyCredits}`);
        }
      }

      // Check available credits
      const creditSum = await prisma.creditLedger.aggregate({
        where: { userId: user.id },
        _sum: { amount: true }
      });

      const availableCredits = creditSum._sum.amount || 0;
      if (availableCredits < creditsToConsume) {
        throw new Error(`Insufficient credits. Available: ${availableCredits}, Required: ${creditsToConsume}`);
      }

      // Consume credits in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Record credit consumption
        await tx.creditLedger.create({
          data: {
            userId: user.id,
            subscriptionId: subscription.id,
            amount: -creditsToConsume,
            type: 'consumed',
            description
          }
        });

        // Update daily usage for Pro plan
        if (subscription.plan.isDaily) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          await tx.dailyUsage.upsert({
            where: {
              userId_date: {
                userId: user.id,
                date: today
              }
            },
            update: {
              usageCount: { increment: creditsToConsume }
            },
            create: {
              userId: user.id,
              subscriptionId: subscription.id,
              date: today,
              usageCount: creditsToConsume
            }
          });
        }

        return {
          creditsConsumed: creditsToConsume,
          remainingCredits: availableCredits - creditsToConsume
        };
      });

      return {
        success: true,
        ...result,
        message: 'Credits consumed successfully'
      };

    } catch (error) {
      console.error('Error consuming credits:', error);
      throw new Error(`Failed to consume credits: ${error.message}`);
    }
  }

  /**
   * Renew subscriptions that are due for renewal
   * @returns {Promise<Object>} Renewal results
   */
  static async renewDueSubscriptions() {
    try {
      const now = new Date();
      
      // Find subscriptions due for renewal
      const dueSubscriptions = await prisma.subscription.findMany({
        where: {
          status: 'active',
          cancelAtPeriodEnd: false,
          currentPeriodEnd: {
            lte: now
          }
        },
        include: { 
          plan: true,
          user: true
        }
      });

      const renewalResults = [];

      for (const subscription of dueSubscriptions) {
        try {
          // Extend subscription by one period
          const newPeriodEnd = new Date(subscription.currentPeriodEnd);
          newPeriodEnd.setMonth(newPeriodEnd.getMonth() + (subscription.billingCycle === 'yearly' ? 12 : 1));

          const updatedSubscription = await prisma.$transaction(async (tx) => {
            // Update subscription period
            const updated = await tx.subscription.update({
              where: { id: subscription.id },
              data: {
                currentPeriodStart: subscription.currentPeriodEnd,
                currentPeriodEnd: newPeriodEnd,
                updatedAt: new Date()
              }
            });

            // Grant new period credits
            const creditsToGrant = subscription.plan.isDaily 
              ? subscription.plan.dailyCredits 
              : subscription.plan.monthlyCredits;

            await tx.creditLedger.create({
              data: {
                userId: subscription.userId,
                subscriptionId: subscription.id,
                amount: creditsToGrant,
                type: 'granted',
                description: `Credits granted for ${subscription.billingCycle} renewal`
              }
            });

            return updated;
          });

          renewalResults.push({
            subscriptionId: subscription.id,
            userId: subscription.user.clerkUserId,
            success: true,
            newPeriodEnd,
            creditsGranted: subscription.plan.isDaily 
              ? subscription.plan.dailyCredits 
              : subscription.plan.monthlyCredits
          });

        } catch (error) {
          console.error(`Error renewing subscription ${subscription.id}:`, error);
          renewalResults.push({
            subscriptionId: subscription.id,
            userId: subscription.user.clerkUserId,
            success: false,
            error: error.message
          });
        }
      }

      return {
        success: true,
        renewed: renewalResults.filter(r => r.success).length,
        failed: renewalResults.filter(r => !r.success).length,
        results: renewalResults,
        message: `Processed ${dueSubscriptions.length} subscriptions`
      };

    } catch (error) {
      console.error('Error renewing subscriptions:', error);
      throw new Error(`Failed to renew subscriptions: ${error.message}`);
    }
  }
}


