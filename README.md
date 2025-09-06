<p align="center">
  <a href="https://micboard.io"><img width="90px" height="90px" src="docs/img/logo.png"></a>
</p>

<h1 align="center">Micboard</h1>

A visual monitoring tool for network enabled Shure devices.  Micboard simplifies microphone monitoring and storage for artists, engineers, and volunteers.  View battery, audio, and RF levels from any device on the network.

![Micboard Storage Photo](docs/img/wccc.jpg)


![micboard diagram](docs/img/slug.png)

## Screenshots
#### Desktop
![Desktop](docs/img/desktop_ui.png)


#### Mobile
<p align="center">
  <img width="33%" src="docs/img/phone_home.png"><img width="33%" src="docs/img/phone_ui.png"><img width="33%" src="docs/img/phone_ui_exp.png">
</p>

#### Mic Storage
![mic storage](docs/img/tv_imagebg.png)

## Compatible Devices
Micboard supports the following devices -
* Shure UHF-R
* Shure QLX-D<sup>[1](#qlxd)</sup>
* Shure ULX-D
* Shure Axient Digital
* Shure PSM 1000

Micboard uses IP addresses to connect to RF devices.  RF devices can be addressed through static or reserved IPs.  They just need to be consistent.


## New Features (v0.8.5+)
* **Planning Center Services Integration** - Automatically sync performer names from your service plans
* **Google Drive Integration** - Automatically download background images from a shared folder
* **Python 3.12+ Support** - Updated for modern Python versions
* **Node.js 20+ Support** - Updated frontend build tools
* **OAuth Integration Setup** - Easy setup scripts for both integrations

## Requirements
* Python 3.12 or later
* Node.js 20 or later (for development)
* Windows, macOS, or Linux

## Quick Start
### Windows
```
run_server.bat
```

### macOS/Linux
```bash
chmod +x run_server.sh
./run_server.sh
```

Then open http://localhost:8058 in your browser.

## Docker Deployment

For containerized deployment:

**Prerequisites:**
- Docker Desktop must be installed and running
- On Windows: Start Docker Desktop from the Start menu

```bash
# Build the image
docker build -t micboard .

# Run the container
docker run -p 8058:8058 micboard
```

The Docker image includes:
- Python 3.12 with all required dependencies
- Node.js 20+ for frontend building
- Pre-built frontend assets
- Non-root user for security
- Optimized layer caching

## Integrations Setup

Micboard supports two powerful integrations to automate your workflow:

### Planning Center Services (PCO) Integration

Automatically sync performer names from your service plans to Micboard slots.

#### Quick Setup:
1. **Create PCO OAuth App**:
   - Go to [PCO OAuth Applications](https://api.planningcenteronline.com/oauth/applications)
   - Click "New Application"
   - Set redirect URI to: `http://localhost:8058/api/pco/callback`
   - Copy your Client ID and Client Secret

2. **Set Environment Variables**:
   ```bash
   # Windows (edit oauth_setup.bat)
   set PCO_CLIENT_ID=your_client_id_here
   set PCO_CLIENT_SECRET=your_client_secret_here
   
   # macOS/Linux (edit oauth_setup.sh)
   export PCO_CLIENT_ID="your_client_id_here"
   export PCO_CLIENT_SECRET="your_client_secret_here"
   ```

3. **Run Setup & Start Server**:
   ```bash
   # Windows
   oauth_setup.bat
   run_server.bat
   
   # macOS/Linux
   source oauth_setup.sh
   ./run_server.sh
   ```

4. **Authorize in Micboard**:
   - Open http://localhost:8058
   - Click menu (☰) → "integrations"
   - Click "Authorize Planning Center"
   - Log in and grant permissions
   - Configure service types and team mappings

### Google Drive Integration

Automatically download background images from a shared Google Drive folder.

#### Quick Setup:
1. **Create Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create new project or select existing
   - Enable Google Drive API
   - Create OAuth 2.0 credentials
   - Set redirect URI to: `http://localhost:8058/api/drive/callback`

2. **Set Environment Variables**:
   ```bash
   # Windows (edit oauth_setup.bat)
   set GOOGLE_CLIENT_ID=your_client_id_here
   set GOOGLE_CLIENT_SECRET=your_client_secret_here
   
   # macOS/Linux (edit oauth_setup.sh)
   export GOOGLE_CLIENT_ID="your_client_id_here"
   export GOOGLE_CLIENT_SECRET="your_client_secret_here"
   ```

3. **Run Setup & Start Server**:
   ```bash
   # Windows
   oauth_setup.bat
   run_server.bat
   
   # macOS/Linux
   source oauth_setup.sh
   ./run_server.sh
   ```

4. **Authorize in Micboard**:
   - Open http://localhost:8058
   - Click menu (☰) → "integrations"
   - Click "Authorize Google Drive"
   - Log in and grant permissions
   - Enter your Google Drive folder ID

#### File Naming:
- **Automatic**: Files named with lowercase person names (e.g., `jane smith.jpg`)
- **CSV Mapping**: Create `mapping.csv` in Drive folder for custom names:
  ```csv
  original_filename.jpg,micboard_name.jpg
  IMG_1234.png,jane smith.png
  ```

### Integration Features:
- **Real-time Sync**: PCO updates every minute, Drive syncs hourly
- **Automatic Cleanup**: Deleted Drive files are removed locally
- **Status Filtering**: Only confirmed/accepted PCO assignments sync
- **Lead Time Control**: Set how early before service to activate PCO plans

For detailed setup instructions, see [OAuth Setup Guide](docs/OAUTH_SETUP_GUIDE.md) and [Integrations Documentation](docs/integrations.md).

### Troubleshooting Integrations

**Common Issues:**
- **"Invalid client" error**: Check that CLIENT_ID and CLIENT_SECRET are set correctly
- **"Redirect URI mismatch"**: Ensure redirect URI matches exactly: `http://localhost:8058/api/[pco|drive]/callback`
- **Authorization button does nothing**: Ensure OAuth credentials are set BEFORE starting the server
- **Files not downloading (Drive)**: Check folder ID and permissions
- **No names appearing (PCO)**: Verify assignments have "confirmed" or "accepted" status

**Getting Help:**
- Check `micboard.log` for detailed error messages
- Restart the server after setting OAuth credentials
- Ensure JavaScript bundles are built (`npm run build`)

## Documentation
* [Installation](docs/installation.md)
* [Configuration](docs/configuration.md)
* [Integrations (PCO & Google Drive)](docs/integrations.md)
* [Micboard MultiVenue](docs/multivenue.md)
* [Windows Setup Guide](README_WINDOWS.md)

#### Developer Info
* [Building the Electron wrapper for macOS](docs/electron.md)
* [Extending micboard using the API](docs/api.md)


## Known Issues
<a name="qlxd">1</a>: [QLX-D Firmware](docs/qlxd.md)
