import { prisma } from "../../lib/prisma.js";



export const getAllPlans = async (req, res) => {
  try {
    // Fetch all plans with related subscriptions
    const plans = await prisma.plan.findMany({
      include: {
        subscriptions: {
          select: {
            id: true,
            userId: true,
            stripeSubscriptionId: true,
            billingCycle: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
            canceledAt: true,
          },
        },
      },
    });

    // Prepare response data
    const responseData = plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
      dailyCredits: plan.dailyCredits,
      monthlyCredits: plan.monthlyCredits,
      isDaily: plan.isDaily,
      description: plan.description,
      features: plan.features,
      subscriptions: plan.subscriptions,
    }));

    return res.status(200).json({
      success: true,
      message: "Plans retrieved successfully",
      plans: responseData,
    });
  } catch (error) {
    console.error("Error retrieving plans:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while retrieving plans",
      error: error.message,
    });
  }
};