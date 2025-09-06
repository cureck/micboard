#!/bin/bash
# ================================================================
# OAuth Configuration for Micboard Integrations
# ================================================================
# Edit the values below with your actual OAuth credentials
# Then source this file before starting run_server.sh
# Usage: source oauth_setup.sh
# ================================================================

# Planning Center OAuth
# Get these from: https://api.planningcenteronline.com/oauth/applications
export PCO_CLIENT_ID="your_pco_client_id_here"
export PCO_CLIENT_SECRET="your_pco_client_secret_here"
export PCO_REDIRECT_URI="http://localhost:8058/api/pco/callback"

# Google Drive OAuth
# Get these from: https://console.cloud.google.com/
export GOOGLE_CLIENT_ID="your_google_client_id_here"
export GOOGLE_CLIENT_SECRET="your_google_client_secret_here"
export GOOGLE_REDIRECT_URI="http://localhost:8058/api/drive/callback"

# Optional: Override default port
# export MICBOARD_PORT=8058

echo "OAuth environment variables set!"
echo ""
echo "Now run: ./run_server.sh"
echo ""
