# OAuth Setup Guide for Micboard Integrations

## Quick Setup

### Windows Users
1. Edit `oauth_setup.bat` with your credentials
2. Run `oauth_setup.bat` 
3. Run `run_server.bat`

### macOS/Linux Users
1. Edit `oauth_setup.sh` with your credentials
2. Run `source oauth_setup.sh`
3. Run `./run_server.sh`

## Detailed Setup Instructions

### 1. Planning Center Services (PCO)

#### Create a PCO OAuth Application
1. Go to https://api.planningcenteronline.com/oauth/applications
2. Click "New Application"
3. Fill in the form:
   - **Name**: Micboard (or any name you prefer)
   - **Redirect URI**: `http://localhost:8058/api/pco/callback`
   - **Scope**: Services (read-only is sufficient)
4. Click "Submit"
5. Copy your **Client ID** and **Client Secret**

#### Set PCO Environment Variables

**Windows (`oauth_setup.bat`):**
```batch
set PCO_CLIENT_ID=your_actual_client_id_here
set PCO_CLIENT_SECRET=your_actual_secret_here
```

**macOS/Linux (`oauth_setup.sh`):**
```bash
export PCO_CLIENT_ID="your_actual_client_id_here"
export PCO_CLIENT_SECRET="your_actual_secret_here"
```

### 2. Google Drive

#### Create a Google Cloud Project
1. Go to https://console.cloud.google.com/
2. Create a new project or select an existing one
3. Enable the Google Drive API:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Drive API"
   - Click on it and press "Enable"

#### Create OAuth 2.0 Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen first:
   - Choose "External" user type
   - Fill in required fields (app name, email, etc.)
   - Add scope: `../auth/drive.readonly`
4. For the OAuth client:
   - **Application type**: Web application
   - **Name**: Micboard (or any name)
   - **Authorized redirect URIs**: `http://localhost:8058/api/drive/callback`
5. Click "Create"
6. Copy your **Client ID** and **Client Secret**

#### Set Google Drive Environment Variables

**Windows (`oauth_setup.bat`):**
```batch
set GOOGLE_CLIENT_ID=your_actual_client_id_here
set GOOGLE_CLIENT_SECRET=your_actual_secret_here
```

**macOS/Linux (`oauth_setup.sh`):**
```bash
export GOOGLE_CLIENT_ID="your_actual_client_id_here"
export GOOGLE_CLIENT_SECRET="your_actual_secret_here"
```

## Running Micboard with OAuth

### Windows
```batch
REM Option 1: Run both scripts
oauth_setup.bat
run_server.bat

REM Option 2: Edit run_server.bat to include credentials
```

### macOS/Linux
```bash
# Option 1: Source and run
source oauth_setup.sh
./run_server.sh

# Option 2: Edit run_server.sh to include credentials
```

## Using the Integrations

1. Start Micboard with OAuth credentials set
2. Open http://localhost:8058
3. Click menu (☰) → "integrations"
4. Click "Authorize Planning Center" or "Authorize Google Drive"
5. Log in with your account
6. Grant permissions
7. Configure your settings

## Troubleshooting

### "Invalid client" error
- Check that CLIENT_ID and CLIENT_SECRET are set correctly
- Ensure no extra spaces or quotes in Windows environment variables

### "Redirect URI mismatch" error
- Verify the redirect URI matches exactly: `http://localhost:8058/api/pco/callback`
- Check if you're using a different port (update MICBOARD_PORT if needed)

### Authorization button does nothing
- Check browser console for errors
- Ensure OAuth credentials are set BEFORE starting the server
- Try restarting the server after setting credentials

### Can't see integrations menu
- Refresh the page (Ctrl+F5)
- Ensure JavaScript bundles are built (`npm run build`)

## Security Notes

- **Never commit OAuth credentials to git**
- The `oauth_setup.bat` and `oauth_setup.sh` files are templates
- Consider using a `.env` file for production deployments
- Tokens are stored in `config.json` - keep this file secure

## Need Help?

- PCO API Documentation: https://developer.planning.center/docs
- Google Drive API: https://developers.google.com/drive/api/v3/about-sdk
- Micboard Issues: https://github.com/karlcswanson/micboard/issues
