#!/bin/bash
# Railway Setup Script for Personality Profiling App

echo "🚀 Setting up Railway project..."

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Link to your Railway project (if not already linked)
echo "📦 Linking to Railway project..."
# railway link

# Add PostgreSQL database
echo "🗄️  Adding PostgreSQL database..."
railway add --database postgres

# Wait for database to be ready
echo "⏳ Waiting for database to initialize (30 seconds)..."
sleep 30

# Set environment variables
echo "🔧 Setting environment variables..."

# You'll need to fill in these values:
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
ANTHROPIC_API_KEY="your-anthropic-api-key"

# Generate random secrets
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)

# Set variables
railway variables set GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID"
railway variables set GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET"
railway variables set GOOGLE_CALLBACK_URL="https://sage.up.railway.app/api/auth/google/callback"
railway variables set ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"
railway variables set JWT_ACCESS_SECRET="$JWT_ACCESS_SECRET"
railway variables set JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET"
railway variables set FRONTEND_URL="https://sage.up.railway.app"
railway variables set NODE_ENV="production"

# Get database URL
echo "📊 Getting database connection..."
DATABASE_URL=$(railway variables get DATABASE_URL)

# Run database schema
echo "🏗️  Creating database schema..."
railway run psql \$DATABASE_URL -f backend/schema.sql

echo "✅ Railway setup complete!"
echo ""
echo "Next steps:"
echo "1. Update GOOGLE_CLIENT_ID in this script with your actual OAuth client ID"
echo "2. Update GOOGLE_CLIENT_SECRET with your OAuth secret"
echo "3. Update ANTHROPIC_API_KEY with your Anthropic API key"
echo "4. Run this script again: bash railway-setup.sh"
echo "5. Deploy: git push"
