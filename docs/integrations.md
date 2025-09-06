# Micboard Integrations

Micboard now supports integrations with Planning Center Services (PCO) and Google Drive to automatically update slot names and background images.

## Planning Center Services Integration

The PCO integration automatically syncs person assignments from your service plans to Micboard slots, updating the extended names in real-time.

### Setup

1. **Create a PCO App**
   - Go to https://api.planningcenteronline.com/oauth/applications
   - Click "New Application"
   - Set the redirect URI to `http://localhost:8058/api/pco/callback` (adjust the port if needed)
   - Save your Client ID and Client Secret

2. **Configure Environment Variables**
   ```bash
   export PCO_CLIENT_ID="your_client_id"
   export PCO_CLIENT_SECRET="your_client_secret"
   export PCO_REDIRECT_URI="http://localhost:8058/api/pco/callback"
   ```

3. **Authorize in Micboard**
   - Navigate to the Integrations settings (menu → integrations)
   - Click "Authorize Planning Center"
   - Log in with your PCO account and grant permissions
   - You'll be redirected back to Micboard

4. **Configure Service Types and Mappings**
   - Select the service types you want to monitor
   - For each slot, select the Team and Position that should be assigned
   - Set the lead time (how many hours before service to activate the plan)
   - Optionally set a manual plan ID to override automatic detection

### How It Works

- **Automatic Plan Detection**: Plans become "live" when they are within the configured lead time before the first service time
- **Name-based Mapping**: Team/Position mappings work across all selected service types
- **Status Filtering**: Only assignments with "confirmed" or "accepted" status are synced
- **Real-time Updates**: The sync runs every minute to catch changes quickly

### Configuration Schema

The PCO configuration is stored in `config.json`:

```json
{
  "integrations": {
    "planning_center": {
      "lead_time_hours": 2,
      "service_types": [
        {
          "id": "123456",
          "teams": [],
          "reuse_rules": [
            {
              "team_name": "Band",
              "position_name": "Vocals 1",
              "slot": 1
            }
          ]
        }
      ],
      "manual_plan_id": null,
      "tokens": {
        "access_token": "...",
        "refresh_token": "..."
      }
    }
  }
}
```

## Google Drive Integration

The Google Drive integration automatically downloads background images from a specified folder, making it easy to manage performer photos centrally.

### Setup

1. **Create a Google Cloud Project**
   - Go to https://console.cloud.google.com/
   - Create a new project or select an existing one
   - Enable the Google Drive API

2. **Create OAuth Credentials**
   - Go to APIs & Services → Credentials
   - Create OAuth 2.0 Client ID
   - Set the redirect URI to `http://localhost:8058/api/drive/callback`
   - Download the credentials

3. **Configure Environment Variables**
   ```bash
   export GOOGLE_CLIENT_ID="your_client_id"
   export GOOGLE_CLIENT_SECRET="your_client_secret"
   export GOOGLE_REDIRECT_URI="http://localhost:8058/api/drive/callback"
   ```

4. **Authorize in Micboard**
   - Navigate to the Integrations settings
   - Click "Authorize Google Drive"
   - Select your Google account and grant read-only Drive access
   - You'll be redirected back to Micboard

5. **Configure Folder**
   - Enter the Google Drive folder ID (from the folder's URL)
   - Save the settings

### File Naming

- **Automatic**: Files are downloaded with lowercase names matching the person's name
- **CSV Mapping**: Create a `mapping.csv` file in the Drive folder:
  ```csv
  original_filename.jpg,micboard_name.jpg
  IMG_1234.png,jane smith.png
  ```

### Supported Formats

- Images: `.jpg`, `.jpeg`, `.png`, `.gif`
- Videos: `.mp4`

### How It Works

- **Hourly Sync**: The integration checks for new or updated files every hour
- **Automatic Cleanup**: Files deleted from Drive are removed locally
- **Name Mapping**: Use the CSV file for custom filename mappings

### Configuration Schema

The Drive configuration is stored in `config.json`:

```json
{
  "integrations": {
    "google_drive": {
      "folder_id": "1A2B3C4D5E6F...",
      "tokens": {
        "access_token": "...",
        "refresh_token": "..."
      }
    }
  }
}
```

## Troubleshooting

### PCO Issues

- **No names appearing**: Check that assignments have "confirmed" or "accepted" status
- **Wrong service**: Verify lead time settings and check for manual plan ID
- **Authorization failed**: Ensure redirect URI matches exactly

### Drive Issues

- **Files not downloading**: Check folder ID and permissions
- **Wrong filenames**: Verify CSV mapping format
- **Large files**: Be patient, large video files may take time

### General

- **Check logs**: Integration errors are logged to `micboard.log`
- **Restart sync**: Save settings again to restart sync threads
- **Token refresh**: Tokens are automatically refreshed when needed
