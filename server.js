import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import userRoutes from './src/routes/userRouters.js';
import subscriptionRoutes from './src/routes/subscriptionRoutes.js';
import usageRoutes from './src/routes/usageRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';
import cors from 'cors';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Enable CORS for all origins (for local testing)
app.use(cors({
  origin: '*', // Replace with specific origins in production
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

// Stripe webhook route (must be before body parsing middleware)
import { handleStripeWebhook } from './src/controllers/payment/update.js';
app.post('/api/user/stripe-webhook', bodyParser.raw({ type: 'application/json' }), handleStripeWebhook);

// Middleware to parse JSON for all other routes
app.use(express.json());

// Add routes
app.use('/api/user', userRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/admin', adminRoutes);


// Handle undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    message: err.message || 'Something went wrong'
  });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});