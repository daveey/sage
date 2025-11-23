# Railway Setup Guide

## Option 1: Automated Setup (Recommended)

1. **Install Railway CLI** (if not already installed):
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**:
   ```bash
   railway login
   ```

3. **Link to your project**:
   ```bash
   cd /path/to/sage
   railway link
   ```
   Select your "sage" project from the list.

4. **Edit the setup script** with your credentials:
   ```bash
   nano railway-setup.sh
   ```
   Update these lines:
   - `GOOGLE_CLIENT_ID="your-actual-client-id"`
   - `GOOGLE_CLIENT_SECRET="your-actual-secret"`
   - `ANTHROPIC_API_KEY="sk-ant-your-key"`

5. **Run the setup script**:
   ```bash
   chmod +x railway-setup.sh
   ./railway-setup.sh
   ```

6. **Deploy**:
   ```bash
   git push origin claude/personality-profiling-app-019hiuCvwJCsDm1Tt8K1L7vH
   ```

---

## Option 2: Manual Setup (via Dashboard)

### Step 1: Add PostgreSQL Database

1. Go to https://railway.app/dashboard
2. Click on your "sage" project
3. Click "+ New" → "Database" → "Add PostgreSQL"
4. Wait for it to provision (~1 minute)
5. Railway automatically sets `DATABASE_URL` environment variable

### Step 2: Run Database Schema

**Option A - Using Railway CLI:**
```bash
railway run psql $DATABASE_URL -f backend/schema.sql
```

**Option B - Using psql directly:**
1. Copy the `DATABASE_URL` from Railway dashboard → Database → Connect → Connection URL
2. Run:
   ```bash
   psql "postgresql://user:pass@host:port/railway" -f backend/schema.sql
   ```

### Step 3: Set Environment Variables

In Railway dashboard → Your service → Variables tab, add:

| Variable | Value |
|----------|-------|
| `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth Client Secret |
| `GOOGLE_CALLBACK_URL` | `https://sage.up.railway.app/api/auth/google/callback` |
| `ANTHROPIC_API_KEY` | `sk-ant-your-api-key` |
| `JWT_ACCESS_SECRET` | Random 64-char string (use `openssl rand -hex 32`) |
| `JWT_REFRESH_SECRET` | Different random 64-char string |
| `FRONTEND_URL` | `https://sage.up.railway.app` |
| `NODE_ENV` | `production` |

**Generate random secrets:**
```bash
openssl rand -hex 32  # For JWT_ACCESS_SECRET
openssl rand -hex 32  # For JWT_REFRESH_SECRET
```

### Step 4: Get Google OAuth Credentials

1. Go to https://console.cloud.google.com/apis/credentials
2. Click "Create Credentials" → "OAuth 2.0 Client ID"
3. Application type: "Web application"
4. Name: "Personality Profiling App"
5. Authorized redirect URIs: `https://sage.up.railway.app/api/auth/google/callback`
6. Click "Create"
7. Copy the Client ID and Client Secret to Railway environment variables

### Step 5: Deploy

Railway will automatically redeploy when you push:
```bash
git push origin claude/personality-profiling-app-019hiuCvwJCsDm1Tt8K1L7vH
```

Or trigger manual deploy in the Railway dashboard.

---

## Verify Setup

Once deployed, test these endpoints:

1. **Health check**:
   ```bash
   curl https://sage.up.railway.app/api/health
   ```
   Should return: `{"status":"ok","timestamp":"...","version":"1.0.0-mvp"}`

2. **API status**:
   ```bash
   curl https://sage.up.railway.app/api/status
   ```
   Should show all features enabled.

3. **Google OAuth** (open in browser):
   ```
   https://sage.up.railway.app/api/auth/google
   ```
   Should redirect to Google sign-in.

---

## Troubleshooting

### Database connection error
- Check that PostgreSQL database is added and running
- Verify `DATABASE_URL` is set in environment variables
- Check logs: `railway logs` or in Railway dashboard

### OAuth errors
- Verify redirect URI matches exactly: `https://sage.up.railway.app/api/auth/google/callback`
- Check Google Cloud Console → Credentials → OAuth 2.0 Client IDs
- Ensure domain is authorized in Google Cloud Console

### CORS errors
- Verify `FRONTEND_URL` is set to `https://sage.up.railway.app`
- Check that your service has a public domain generated

### Schema not applied
- Run the schema SQL file against your database:
  ```bash
  railway run psql $DATABASE_URL -f backend/schema.sql
  ```
