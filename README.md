# FindThatFace Backend

A Node.js backend service for face recognition with subscription management, auto-renewal, and credit-based usage tracking.

## Features

- **Subscription Management**: Create, update, and cancel subscriptions
- **Auto-Renewal**: Automatic subscription renewals with cron job support
- **Credit System**: Track and consume credits for API usage
- **Payment Integration**: Stripe integration with webhook support
- **Referral System**: 20% commission for referrals
- **Multi-Provider Support**: Payment provider agnostic design

## Tech Stack

- **Runtime**: Node.js with ES modules
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Payment**: Stripe integration
- **Authentication**: Clerk (external service)

## Setup

### 1. Environment Variables

Create a `.env` file with the following variables:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/lenso_db"
DIRECT_URL="postgresql://username:password@localhost:5432/lenso_db"

# Stripe Configuration
STRIPE_SECRET_KEY="sk_test_your_stripe_secret_key_here"
STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret_here"

# Clerk Authentication (if using Clerk)
CLERK_SECRET_KEY="your_clerk_secret_key_here"

# Admin Configuration
ADMIN_TOKEN="your_secure_admin_token_here"

# Server Configuration
PORT=3000
NODE_ENV="production"
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

```bash
# Generate Prisma client
npm run build

# Push schema to database
npm run migrate
```

### 4. Create Plans (Required)

You need to create subscription plans in your database. You can do this through your admin interface or by running SQL commands:

```sql
INSERT INTO "Plan" (id, name, "priceMonthly", "priceYearly", "dailyCredits", "monthlyCredits", "isDaily", description) VALUES
('free-plan-id', 'Free', 0.00, 0.00, 0, 2, false, 'Free trial with 2 credits'),
('pro-plan-id', 'Pro', 9.99, 99.99, 25, 0, true, 'Pro plan with 25 daily searches'),
('premium-plan-id', 'Premium', 19.99, 199.99, 0, 1000, false, 'Premium plan with 1000 monthly credits');
```

### 5. Start Server

```bash
# Development
npm run dev

# Production
npm start
```

### 6. Setup Auto-Renewals

Add to your crontab to run renewals daily at midnight:

```bash
# Edit crontab
crontab -e

# Add this line (adjust path as needed)
0 0 * * * cd /path/to/project && npm run renew
```

## API Endpoints

### User Management
- `POST /api/user/setupUser` - Create new user with free trial
- `GET /api/user/getUser` - Get user details
- `DELETE /api/user/deleteUser` - Delete user
- `GET /api/user/getPlan` - Get all available plans

### Subscription Management
- `POST /api/subscriptions/confirm` - Confirm payment and activate subscription
- `POST /api/subscriptions/cancel` - Cancel subscription at period end
- `GET /api/subscriptions/me` - Get user's subscription details

### Usage Tracking
- `POST /api/usage/consume` - Consume credits for API usage

### Admin
- `POST /api/admin/subscriptions/renew-due` - Manually run subscription renewals

### Payment Webhooks
- `POST /api/user/stripe-webhook` - Stripe webhook handler

## Usage Examples

### Confirm Payment (Frontend Integration)

```javascript
// After successful payment on frontend
const response = await fetch('/api/subscriptions/confirm', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'clerk_user_id',
    planCode: 'pro-plan-id', // or plan name
    paidAt: new Date().toISOString(),
    externalPaymentId: 'stripe_payment_intent_id',
    billingCycle: 'monthly',
    amount: 9.99,
    currency: 'usd'
  })
});
```

### Consume Credits

```javascript
// When user performs a search
const response = await fetch('/api/usage/consume', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'clerk_user_id',
    credits: 1,
    description: 'Face search API call'
  })
});
```

### Get Subscription Details

```javascript
const response = await fetch('/api/subscriptions/me?userId=clerk_user_id');
const data = await response.json();
console.log('Available credits:', data.data.availableCredits);
console.log('Daily usage:', data.data.dailyUsage);
```

## Database Schema

### Key Models

- **User**: Core user data with Clerk integration
- **Subscription**: Subscription details with auto-renewal support
- **Plan**: Subscription plans with pricing and credit limits
- **CreditLedger**: Credit transaction history
- **DailyUsage**: Daily usage tracking for Pro plans
- **BillingHistory**: Payment transaction records
- **ReferralStats**: Referral earnings and statistics

### Subscription Lifecycle

1. **Payment Confirmation**: Frontend calls `/api/subscriptions/confirm` after successful payment
2. **Credit Granting**: Credits are granted based on plan type (daily/monthly)
3. **Auto-Renewal**: Cron job extends subscriptions and grants new credits
4. **Usage Tracking**: Credits are consumed and daily limits enforced

## Development

### Running Tests

```bash
# Run renewals manually
npm run renew

# Check logs
tail -f logs/renewals.log
```

### Database Migrations

```bash
# After schema changes
npx prisma db push

# Generate new client
npx prisma generate
```

## Production Deployment

1. Set up PostgreSQL database
2. Configure environment variables
3. Run database migrations
4. Set up cron job for auto-renewals
5. Configure reverse proxy (nginx)
6. Set up monitoring and logging

## Security Notes

- Use strong `ADMIN_TOKEN` for admin endpoints
- Restrict CORS origins in production
- Validate all webhook signatures
- Use HTTPS in production
- Regularly rotate API keys

## Support

For issues or questions, please check the logs and ensure all environment variables are properly configured.

