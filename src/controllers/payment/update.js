import { prisma } from "../../lib/prisma.js";
import { SubscriptionService } from "../../services/subscriptionService.js";
import Stripe from "stripe";

// Initialize Stripe with secret key (will be created when needed)
let stripe;

export const handleStripeWebhook = async (req, res) => {
  console.log('Headers:', req.headers);
  console.log('Raw body:', req.body.toString());
  const sig = req.headers["stripe-signature"];

  // Initialize Stripe if not already done
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16", // Use the latest stable version
    });
  }

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({
      success: false,
      message: "Invalid webhook signature",
    });
  }

  // Handle payment_intent.succeeded and checkout.session.completed events
  if (event.type === "payment_intent.succeeded" || event.type === "checkout.session.completed") {
    const paymentData = event.data.object;
    const paymentIntentId = paymentData.id || paymentData.payment_intent;
    const amount = paymentData.amount || paymentData.amount_total;
    const currency = paymentData.currency || 'usd';
    const metadata = paymentData.metadata || {};

    try {
      // Extract relevant data from metadata
      const userId = metadata.userId;
      const planId = metadata.planId;
      const billingCycle = metadata.billingCycle || 'monthly';

      if (!userId || !planId) {
        return res.status(400).json({
          success: false,
          message: "Missing userId or planId in payment metadata",
        });
      }

      if (!["monthly", "yearly"].includes(billingCycle)) {
        return res.status(400).json({
          success: false,
          message: "Invalid billingCycle value in metadata",
        });
      }

      // Use the subscription service to confirm payment
      const result = await SubscriptionService.confirmPayment(
        userId,
        planId,
        new Date(),
        paymentIntentId,
        {
          billingCycle,
          amount: amount ? amount / 100 : 0, // Convert from cents to dollars
          currency
        }
      );

      return res.status(200).json({
        success: true,
        message: "Payment processed and subscription updated successfully",
        data: result
      });

    } catch (error) {
      console.error("Error processing payment:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while processing the payment",
        error: error.message,
      });
    }
  }

  // Return a 200 for other events to acknowledge receipt
  return res.status(200).json({
    success: true,
    message: "Webhook received (non-payment event)",
  });
};