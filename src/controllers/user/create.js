import { prisma } from "../../lib/prisma.js";

export const setupNewUser = async (req, res) => {
  try {
    // Extract and validate input
    const { clerkUserId, email, name, referredById } = req.body;
    if (!clerkUserId || !email) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: clerkUserId and email are mandatory",
      });
    }

    // Check for existing user
    const existingUser = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (existingUser) {
      return res.status(200).json({
        success: true,
        message: "User already exists",
        user: existingUser,
      });
    }

    // Validate referredById if provided
    let referrer = null;
    if (referredById) {
      referrer = await prisma.user.findFirst({
        where: { referralStats: { referenceId: referredById } },
      });
      if (!referrer) {
        return res.status(400).json({
          success: false,
          message: `Invalid referredById: No referrer found with referenceId ${referredById}`,
        });
      }
    }

    // Create free plan if it doesn't exist
    let freePlan = await prisma.plan.findUnique({
      where: { name: "Free" },
    });

    if (!freePlan) {
      freePlan = await prisma.plan.create({
        data: {
          name: "Free",
          priceMonthly: 0.00,
          priceYearly: 0.00,
          dailyCredits: 0,
          monthlyCredits: 2, // 2 credits for one month
          description: "1-month free trial with 2 credits",
        },
      });
    }

    // Calculate end date (1 month from now)
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(startDate.getMonth() + 1);

    // Generate a unique referenceId
    const generateReferenceId = () => `AURA-REF-${Math.random().toString(36).substr(2, 8)}`;

    // Create user, referral stats, subscription, and update referrer stats in a transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          clerkUserId,
          email,
          name: name || "Anonymous",
          referredById: referrer ? referrer.id : null,
        },
      });

      // Create compulsory ReferralStats for the new user
      const referralStats = await tx.referralStats.create({
        data: {
          userId: user.id,
          referenceId: generateReferenceId(),
        },
      });

      await tx.subscription.create({
        data: {
          userId: user.id,
          planId: freePlan.id,
          stripeSubscriptionId: `free-${user.id}-${Date.now()}`, // Placeholder for free plan
          billingCycle: "monthly",
          status: "active",
          startDate,
          endDate,
          remainingCredits: 2, // Initial 2 credits
        },
      });

      // Update referrer's ReferralStats if referredById exists
      if (referrer) {
        await tx.referralStats.update({
          where: { userId: referrer.id },
          data: {
            totalUsersSigned: { increment: 1 },
          },
        });
      }

      return { user, referenceId: referralStats.referenceId };
    });

    return res.status(201).json({
      success: true,
      message: "User created with 1-month free plan (2 credits)",
      user: newUser.user,
      referenceId: newUser.referenceId,
    });
  } catch (error) {
    console.error("Error setting up new user:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while setting up the user",
      error: error.message,
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    // Extract user ID from authenticated request (assuming authMiddleware sets req.user.id)
    const userId = req.user.id;

    // Validate user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Delete user and associated records in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete associated BillingHistory records
      await tx.billingHistory.deleteMany({
        where: { userId },
      });

      // Delete associated Subscriptions (will cascade to BillingHistory if not already deleted)
      await tx.subscription.deleteMany({
        where: { userId },
      });

      // Delete ReferralStats (will cascade if linked to referrals, but ensure it’s handled)
      await tx.referralStats.delete({
        where: { userId },
      });

      // Delete the user
      await tx.user.delete({
        where: { id: userId },
      });
    });

    return res.status(200).json({
      success: true,
      message: "User and associated data deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while deleting the user",
      error: error.message,
    });
  }
};

export const getUser = async (req, res) => {
  try {
    // Extract clerkUserId from request (e.g., query parameter)
    const { clerkUserId } = req.query; // Adjust based on your API design (e.g., req.params or req.body)

    if (!clerkUserId) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: clerkUserId is mandatory",
      });
    }

    // Fetch user with all related data
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        referralStats: true, // Include ReferralStats details
        subscriptions: {
          include: {
            plan: true, // Include plan details
            billingHistory: true, // Include billing history
          },
        },
        billingHistory: true, // Include billing history not tied to subscriptions (if any)
        referrals: true, // Include users referred by this user
        referredBy: true, // Include the user who referred this user (if any)
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prepare response data
    const responseData = {
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      referredById: user.referredById,
      referralStats: user.referralStats || {
        totalUsersSigned: 0,
        totalPaidSubscribers: 0,
        totalEarning: 0.00,
        amountDeduct: 0.00,
      }, // Default values if no ReferralStats
      subscriptions: user.subscriptions,
      billingHistory: user.billingHistory,
      referrals: user.referrals.map(ref => ({
        id: ref.id,
        clerkUserId: ref.clerkUserId,
        email: ref.email,
        name: ref.name,
      })),
      referredBy: user.referredBy
        ? {
            id: user.referredBy.id,
            clerkUserId: user.referredBy.clerkUserId,
            email: user.referredBy.email,
            name: user.referredBy.name,
          }
        : null,
    };

    return res.status(200).json({
      success: true,
      message: "User details retrieved successfully",
      user: responseData,
    });
  } catch (error) {
    console.error("Error retrieving user:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while retrieving the user",
      error: error.message,
    });
  }
};

