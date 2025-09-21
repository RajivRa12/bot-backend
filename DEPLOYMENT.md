# Production Deployment Guide

## Prerequisites

- PostgreSQL database (version 12+)
- Node.js (version 18+)
- PM2 or similar process manager
- Nginx (optional, for reverse proxy)

## Environment Setup

### 1. Database Configuration

Set up your PostgreSQL database and update the `.env` file:

```env
DATABASE_URL="postgresql://username:password@your-db-host:5432/lenso_production"
DIRECT_URL="postgresql://username:password@your-db-host:5432/lenso_production"
```

### 2. Stripe Configuration

Get your production Stripe keys from the Stripe dashboard:

```env
STRIPE_SECRET_KEY="sk_live_your_live_stripe_secret_key"
STRIPE_WEBHOOK_SECRET="whsec_your_production_webhook_secret"
```

### 3. Security Configuration

```env
ADMIN_TOKEN="your_very_secure_admin_token_here"
CLERK_SECRET_KEY="your_clerk_production_secret_key"
NODE_ENV="production"
PORT=3000
```

## Deployment Steps

### 1. Install Dependencies

```bash
npm install --production
```

### 2. Database Migration

```bash
# Generate Prisma client
npm run build

# Push schema to production database
npm run migrate
```

### 3. Create Initial Plans

Run this SQL in your production database:

```sql
INSERT INTO "Plan" (id, name, "priceMonthly", "priceYearly", "dailyCredits", "monthlyCredits", "isDaily", description, features) VALUES
('free-plan-id', 'Free', 0.00, 0.00, 0, 2, false, 'Free trial with 2 credits', 'Basic face recognition'),
('pro-plan-id', 'Pro', 9.99, 99.99, 25, 0, true, 'Pro plan with 25 daily searches', 'Advanced face recognition, 25 searches per day'),
('premium-plan-id', 'Premium', 19.99, 199.99, 0, 1000, false, 'Premium plan with 1000 monthly credits', 'Unlimited face recognition, 1000 credits per month');
```

### 4. Start Application

#### Option A: Direct Start
```bash
npm start
```

#### Option B: PM2 (Recommended)
```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start server.js --name "lenso-backend"

# Save PM2 configuration
pm2 save
pm2 startup
```

### 5. Setup Auto-Renewals

Add to your crontab:

```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 2 AM)
0 2 * * * cd /path/to/your/app && npm run renew >> /var/log/lenso-renewals.log 2>&1
```

### 6. Nginx Configuration (Optional)

Create `/etc/nginx/sites-available/lenso-backend`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/lenso-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Monitoring

### 1. Application Logs

```bash
# PM2 logs
pm2 logs lenso-backend

# Or direct logs
tail -f /var/log/lenso-renewals.log
```

### 2. Health Check

Create a simple health check endpoint:

```bash
curl http://localhost:3000/api/user/getPlan
```

### 3. Database Monitoring

Monitor your PostgreSQL database for:
- Connection count
- Query performance
- Disk usage

## Security Considerations

1. **Environment Variables**: Never commit `.env` files
2. **Database Access**: Use connection pooling and limit access
3. **API Keys**: Rotate keys regularly
4. **CORS**: Restrict origins in production
5. **Rate Limiting**: Implement rate limiting for API endpoints
6. **HTTPS**: Use SSL certificates for production

## Backup Strategy

### 1. Database Backups

```bash
# Daily backup script
pg_dump -h your-db-host -U username -d lenso_production > backup_$(date +%Y%m%d).sql
```

### 2. Application Backups

```bash
# Backup application files
tar -czf lenso-backend-$(date +%Y%m%d).tar.gz /path/to/your/app
```

## Troubleshooting

### Common Issues

1. **Database Connection**: Check `DATABASE_URL` and network connectivity
2. **Stripe Webhooks**: Verify webhook URL and secret
3. **Memory Issues**: Monitor Node.js memory usage
4. **Renewal Failures**: Check cron job logs and database permissions

### Log Locations

- Application logs: PM2 logs or console output
- Renewal logs: `/var/log/lenso-renewals.log`
- Nginx logs: `/var/log/nginx/access.log` and `/var/log/nginx/error.log`

## Scaling

### Horizontal Scaling

1. Use load balancer (Nginx, HAProxy)
2. Multiple application instances
3. Database read replicas
4. Redis for session storage

### Vertical Scaling

1. Increase server resources
2. Optimize database queries
3. Implement caching strategies
4. Use CDN for static assets

## Maintenance

### Regular Tasks

1. **Weekly**: Check application logs and performance
2. **Monthly**: Review database performance and cleanup old data
3. **Quarterly**: Update dependencies and security patches
4. **Annually**: Review and rotate API keys and certificates

