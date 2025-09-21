#!/usr/bin/env node

/**
 * Auto-renewal script for subscriptions
 * This script can be run as a cron job to automatically renew subscriptions
 * 
 * Usage:
 * - Direct: node scripts/runRenewals.js
 * - Cron: 0 0 * * * cd /path/to/project && node scripts/runRenewals.js
 */

import dotenv from 'dotenv';
import { SubscriptionService } from '../src/services/subscriptionService.js';

// Load environment variables
dotenv.config();

async function runRenewals() {
  console.log('🔄 Starting subscription renewals...');
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

  try {
    const result = await SubscriptionService.renewDueSubscriptions();
    
    console.log('✅ Renewal process completed');
    console.log(`📊 Results:`);
    console.log(`   - Total processed: ${result.results.length}`);
    console.log(`   - Successfully renewed: ${result.renewed}`);
    console.log(`   - Failed: ${result.failed}`);
    
    if (result.failed > 0) {
      console.log('❌ Failed renewals:');
      result.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`   - Subscription ${r.subscriptionId} (User: ${r.userId}): ${r.error}`);
        });
    }

    // Exit with appropriate code
    process.exit(result.failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('💥 Fatal error during renewal process:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the renewals
runRenewals();


