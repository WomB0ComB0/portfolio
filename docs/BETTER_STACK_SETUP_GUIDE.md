# Better Stack Status Page Setup Guide

This guide walks you through setting up your status page at `status.mikeodnis.dev`.

## Prerequisites

- ✅ Better Stack account (sign up at [betterstack.com](https://betterstack.com))
- ✅ Your API key: `AFhm3NfyrkCboB19GtjP4YCx`
- ✅ Your application deployed and accessible

## Step 1: Create Better Stack Account & Get API Key

1. Go to [Better Stack](https://betterstack.com)
2. Sign up or log in
3. Go to **Team Settings** → **API tokens**
4. Your global API key is: `AFhm3NfyrkCboB19GtjP4YCx`

## Step 2: Create Uptime Monitors

These monitors will check if your services are up and running.

### Navigate to Uptime

1. Go to [Better Stack Uptime](https://betterstack.com/uptime)
2. Click **"Create Monitor"**

### Monitor 1: Main Website

```
Name: Portfolio - Website
Monitor Type: HTTP
URL: https://mikeodnis.dev
Check Type: Status Code
Expected Status: 200
Check Frequency: Every 1 minute
Locations: Select multiple regions (US, EU, Asia)
```

### Monitor 2: API Health Check

```
Name: Portfolio - API Health
Monitor Type: HTTP
URL: https://mikeodnis.dev/api/health
Check Type: Keyword
Expected Keyword: "success": true
Check Frequency: Every 1 minute
Locations: Select multiple regions
```

### Monitor 3: API Liveness

```
Name: Portfolio - API Liveness
Monitor Type: HTTP
URL: https://mikeodnis.dev/api/health/live
Check Type: Keyword
Expected Keyword: "success": true
Check Frequency: Every 30 seconds
Locations: Select multiple regions
```

### Monitor 4: API Readiness

```
Name: Portfolio - API Readiness
Monitor Type: HTTP
URL: https://mikeodnis.dev/api/health/ready
Check Type: Keyword
Expected Keyword: "ready": true
Check Frequency: Every 1 minute
Locations: Select multiple regions
```

### Optional: API v1 Endpoints

You can also monitor specific API endpoints:

```
Name: Portfolio - Spotify API
URL: https://mikeodnis.dev/api/v1/now-playing
Check Type: Status Code
Expected: 200
```

## Step 3: Create Status Page

### 3.1 Create the Page

1. Go to [Better Stack Status Pages](https://betterstack.com/uptime/status-pages)
2. Click **"Create Status Page"**
3. Fill in:
   ```
   Name: Mike Odnis Portfolio
   Subdomain: Choose a subdomain (e.g., mikeodnis-status)
   ```
4. Click **"Create Status Page"**

### 3.2 Get Status Page ID

After creating the status page:

1. You'll be redirected to your status page settings
2. Look at the URL - it will be something like:
   ```
   https://betterstack.com/uptime/status-pages/123456/edit
   ```
3. The number `123456` is your **Status Page ID**
4. Copy this ID

### 3.3 Add to Environment Variables

Add the Status Page ID to your `.env.local`:

```bash
BETTERSTACK_API_KEY=AFhm3NfyrkCboB19GtjP4YCx
BETTERSTACK_STATUS_PAGE_ID=123456  # Replace with your actual ID
```

## Step 4: Add Monitors to Status Page

1. Go to your Status Page settings
2. Click on **"Resources"** or **"Components"** tab
3. Click **"Add Resource"**
4. For each monitor you created:
   - Select the monitor from the dropdown
   - Set a display name (e.g., "Website", "API", "Database")
   - Choose how to display it (e.g., "Operational/Down" or response time)
5. Click **"Save"**

Organize monitors into groups:

```
Website
  ├── Main Website
  └── API Health

API Services
  ├── API Liveness
  ├── API Readiness
  └── Spotify Integration
```

## Step 5: Configure Custom Domain

### 5.1 Add DNS Record

In your DNS provider (Vercel, Cloudflare, etc.), add:

```
Type: CNAME
Name: status
Value: statuspage.betteruptime.com
TTL: Auto or 300
```

**Full record:**

```
status.mikeodnis.dev → statuspage.betteruptime.com
```

### 5.2 Configure in Better Stack

1. In your Status Page settings
2. Go to **"Domain & SSL"** tab
3. Click **"Add Custom Domain"**
4. Enter: `status.mikeodnis.dev`
5. Click **"Add Domain"**
6. Wait 5-10 minutes for SSL certificate provisioning

### 5.3 Verify DNS

Check if DNS is propagated:

```bash
dig status.mikeodnis.dev CNAME
# Should return: statuspage.betteruptime.com
```

Or visit: https://dnschecker.org/#CNAME/status.mikeodnis.dev

## Step 6: Customize Status Page

### Branding

1. Go to **"Branding"** tab
2. Upload your logo
3. Set brand colors:
   ```
   Primary Color: Your theme color
   Background: Dark/Light based on preference
   ```
4. Add custom CSS if needed

### Content

1. Go to **"Content"** tab
2. Add a description:
   ```
   Real-time status and uptime monitoring for Mike Odnis Portfolio.
   Subscribe to get notifications about incidents and maintenance.
   ```
3. Add social links (optional)

### Notifications

1. Go to **"Subscribers"** tab
2. Enable email subscriptions
3. Enable webhook notifications (optional)
4. Enable RSS feed

## Step 7: Test Everything

### 7.1 Test Status Page

1. Visit: `https://status.mikeodnis.dev`
2. Verify all monitors are showing
3. Check that they're all green (operational)

### 7.2 Test API Endpoint

```bash
# Test your status API
curl https://mikeodnis.dev/api/status

# Should return:
{
  "success": true,
  "message": "Status retrieved",
  "data": {
    "state": "operational",
    "lastUpdated": "2025-11-09T..."
  }
}
```

### 7.3 Test Status Badge

1. Visit your portfolio site: `https://mikeodnis.dev`
2. Scroll to footer
3. Verify status badge appears
4. Click it - should go to `status.mikeodnis.dev`

### 7.4 Test Monitor Alerts (Optional)

1. Temporarily break one endpoint (e.g., return 500 error)
2. Wait for monitor to detect it (1-2 minutes)
3. Check that:
   - Email notification is sent
   - Status page shows incident
   - Your API returns `"state": "degraded"` or `"down"`
4. Fix the endpoint
5. Verify status returns to operational

## Step 8: Set Up Alerting

### 8.1 Configure Alert Recipients

1. Go to **"On-Call"** → **"Escalation Policies"**
2. Create policy:
   ```
   Name: Critical Alerts
   Step 1: Email to you immediately
   Step 2: SMS after 5 minutes if not acknowledged
   ```

### 8.2 Set Alert Rules

Create alert rules for different severity:

**Critical (Immediate)**

- Website down (status != 200)
- API health check failing
- Response time > 10 seconds

**Warning (5 min delay)**

- Response time > 3 seconds
- API degraded performance

**Info (No alert)**

- Response time > 1 second
- Monitor check successful after failure

## Step 9: Deploy & Verify

### 9.1 Deploy Your Changes

```bash
# Ensure env vars are set
echo $BETTERSTACK_API_KEY
echo $BETTERSTACK_STATUS_PAGE_ID

# Build and deploy
bun run build
git add .
git commit -m "feat: integrate Better Stack monitoring"
git push origin master
```

### 9.2 Verify in Production

After deployment:

1. **Check Monitors**
   - All should be green in Better Stack dashboard
   - No alerts triggered

2. **Check Status Page**
   - Visit `https://status.mikeodnis.dev`
   - All components operational
   - Uptime graphs showing data

3. **Check API**

   ```bash
   curl https://mikeodnis.dev/api/status | jq
   ```

4. **Check Logs**
   - Go to [Better Stack Logs](https://logs.betterstack.com)
   - Filter: `path="/api/*"`
   - Should see API requests flowing in

## Troubleshooting

### Status Page Not Accessible

**Problem:** `status.mikeodnis.dev` returns error

**Solutions:**

1. Check DNS propagation: `dig status.mikeodnis.dev`
2. Verify CNAME points to `statuspage.betteruptime.com`
3. Wait 5-10 minutes for SSL provisioning
4. Check Better Stack status page is "Published"

### Monitors Showing Down

**Problem:** All monitors show as down

**Solutions:**

1. Check if your site is actually accessible
2. Verify monitor URLs are correct (https, not http)
3. Check if monitors are paused
4. Review monitor configuration (expected status, keyword)

### Status API Returns "unknown"

**Problem:** `/api/status` always returns `state: "unknown"`

**Solutions:**

1. Check `BETTERSTACK_STATUS_PAGE_ID` is set correctly
2. Verify API key has correct permissions
3. Check Better Stack API is accessible
4. Review logs for errors

### Status Badge Not Showing

**Problem:** No status badge in footer

**Solutions:**

1. Check browser console for errors
2. Verify component is imported correctly
3. Check React Query is working
4. Try hard refresh (Ctrl+Shift+R)

## Next Steps

### 1. Add More Monitors

Consider monitoring:

- Database connectivity
- External API dependencies (Spotify, GitHub, etc.)
- CDN performance
- Email delivery

### 2. Set Up Maintenance Windows

Schedule maintenance:

1. Go to Better Stack → Maintenance
2. Create maintenance window
3. Automatically updates status page
4. Suppresses alerts during maintenance

### 3. Integrate with Slack/Discord

1. Go to Integrations
2. Connect Slack or Discord
3. Get incident notifications in team chat

### 4. Set Up Weekly Reports

1. Go to Reports
2. Enable weekly uptime reports
3. Get emailed summaries of performance

### 5. Add Custom Metrics

Track custom metrics:

- API response times
- Error rates
- User sign-ups
- Custom business metrics

## Resources

- [Better Stack Documentation](https://betterstack.com/docs)
- [Uptime Monitoring Docs](https://betterstack.com/docs/uptime)
- [Status Pages Docs](https://betterstack.com/docs/uptime/status-pages)
- [Logs Documentation](https://betterstack.com/docs/logs)
- [API Reference](https://betterstack.com/docs/uptime/api)

## Support

If you run into issues:

1. Check [Better Stack Status](https://status.betterstack.com)
2. Review [Better Stack Community](https://community.betterstack.com)
3. Contact Better Stack support
4. Check your project's GitHub issues

---

**Your Status Page Setup Checklist:**

- [ ] Created Better Stack account
- [ ] Created uptime monitors
- [ ] Created status page
- [ ] Added Status Page ID to `.env.local`
- [ ] Added monitors to status page
- [ ] Configured custom domain (status.mikeodnis.dev)
- [ ] Added DNS CNAME record
- [ ] Customized branding
- [ ] Tested status page
- [ ] Tested API endpoint
- [ ] Set up alerting
- [ ] Deployed to production
- [ ] Verified everything works

Once complete, share your status page: `https://status.mikeodnis.dev` 🎉
