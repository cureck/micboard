# Micboard Mac Setup Script - Production Ready

This script (`mac_setup.sh`) provides a complete production-ready setup solution for Micboard on macOS, handling all dependencies, configuration, and production features from scratch.

## What It Does

The script automatically:

1. **Checks system requirements** (macOS version, disk space, security)
2. **Installs Homebrew** (if not present)
3. **Installs Node.js 20+** (required for frontend build tools)
4. **Installs Python 3.12+** (required for the backend server)
5. **Installs additional dependencies** (git, curl, wget)
6. **Creates Python virtual environment** (`myenv/`)
7. **Installs Python dependencies** (tornado, requests, etc.)
8. **Installs Node.js dependencies** (webpack, babel, etc.)
9. **Builds frontend assets** (compiles SCSS, bundles JS)
10. **Creates production scripts** (start, stop, monitor)
11. **Sets up system service** (LaunchAgent for auto-start)
12. **Creates monitoring tools** (health checks, logging)
13. **Generates production configuration** (environment templates)

## Usage

### First Time Setup

```bash
# Make the script executable
chmod +x mac_setup.sh

# Run the setup script
./mac_setup.sh
```

### Starting Micboard

After setup, use the generated startup script:

```bash
./start_micboard.sh
```

### Setting Up Integrations (Optional)

1. **Edit OAuth credentials:**
   ```bash
   nano oauth_setup_template.sh
   ```

2. **Set your OAuth credentials:**
   ```bash
   source oauth_setup_template.sh
   ```

3. **Start with integrations:**
   ```bash
   ./start_micboard.sh
   ```

## Requirements

- **macOS** (any recent version)
- **Internet connection** (for downloading dependencies)
- **Administrator privileges** (for installing Homebrew and system packages)

## What Gets Installed

### System Dependencies (via Homebrew)
- **Homebrew** - Package manager for macOS
- **Node.js 20+** - JavaScript runtime for frontend build tools
- **Python 3.12+** - Python runtime for backend server
- **Git** - Version control (if not present)
- **curl, wget** - Network utilities

### Python Dependencies (in virtual environment)
- **tornado** - Web server framework
- **requests** - HTTP library
- **requests-oauthlib** - OAuth authentication
- **google-api-python-client** - Google APIs client
- **google-auth** - Google authentication
- **python-dateutil** - Date/time utilities

### Node.js Dependencies (in project)
- **webpack** - Module bundler
- **babel** - JavaScript compiler
- **sass** - CSS preprocessor
- **jquery, bootstrap** - Frontend libraries
- **electron** - Desktop app framework (dev dependency)

## Generated Files

After running the setup script, you'll have:

### Core Application
- `myenv/` - Python virtual environment
- `node_modules/` - Node.js dependencies
- `static/` - Built frontend assets

### Production Scripts
- `start_micboard.sh` - Production startup script with logging
- `stop_micboard.sh` - Graceful shutdown script
- `monitor_micboard.sh` - Health monitoring and status checking
- `oauth_setup_template.sh` - OAuth configuration template

### System Integration
- `~/Library/LaunchAgents/com.micboard.server.plist` - macOS LaunchAgent for auto-start
- `production.env` - Production environment configuration template

### Logging & Monitoring
- `setup.log` - Detailed setup process log
- `micboard.log` - Server runtime log
- `micboard.pid` - Process ID file for management

## Production Features

### 🚀 Auto-Start on Boot
Enable Micboard to start automatically when your Mac boots:

```bash
# Enable auto-start
launchctl load ~/Library/LaunchAgents/com.micboard.server.plist

# Disable auto-start
launchctl unload ~/Library/LaunchAgents/com.micboard.server.plist

# Check if enabled
launchctl list | grep micboard
```

### 📊 Monitoring & Management
The setup creates several monitoring tools:

```bash
# Check server status
./monitor_micboard.sh status

# View recent logs
./monitor_micboard.sh logs

# Health check
./monitor_micboard.sh health

# Start server (with logging)
./start_micboard.sh

# Stop server (graceful shutdown)
./stop_micboard.sh
```

### 🔧 Production Configuration
Customize your production environment:

```bash
# Copy and edit production settings
cp production.env .env
nano .env

# Key settings to review:
# - SECRET_KEY (change from default)
# - LOG_LEVEL (INFO, WARNING, ERROR)
# - MICBOARD_PORT (default: 8058)
# - Security settings
```

### 📝 Logging
Comprehensive logging for production monitoring:

- **Setup Log**: `setup.log` - Complete installation process
- **Server Log**: `micboard.log` - Runtime logs with timestamps
- **Health Checks**: Built-in endpoint monitoring
- **Process Management**: PID file for reliable process control

### 🛡️ Security Features
Production-ready security considerations:

- **Non-root execution** - Scripts warn against running as root
- **Secure defaults** - Production configuration template includes security settings
- **Environment isolation** - Python virtual environment
- **Process management** - Proper PID handling and graceful shutdowns

## Troubleshooting

### Common Issues

1. **"Permission denied" when running script:**
   ```bash
   chmod +x mac_setup.sh
   ```

2. **"Command not found: brew":**
   - The script will install Homebrew automatically
   - If it fails, install manually: https://brew.sh

3. **"Python version too old":**
   - The script installs Python 3.12+ automatically
   - If issues persist, check your PATH: `which python3`

4. **"Node version too old":**
   - The script installs Node.js 20+ automatically
   - If issues persist, check your PATH: `which node`

5. **"Port 8058 already in use":**
   ```bash
   # Find and kill the process
   lsof -ti:8058 | xargs kill -9
   ```

### Manual Steps (if needed)

If the script fails, you can run these steps manually:

```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install node@20 python@3.12 git curl wget

# Link versions
brew link --force node@20 python@3.12

# Setup Python environment
python3 -m venv myenv
source myenv/bin/activate
pip install -r py/requirements.txt

# Setup Node.js environment
npm install
npm run build

# Start server
./start_micboard.sh
```

## Development

For ongoing development:

- **Frontend changes:** Run `npm run build` after making changes
- **Python changes:** Restart the server (`./start_micboard.sh`)
- **Dependencies:** Add to `py/requirements.txt` (Python) or `package.json` (Node.js)

## Support

If you encounter issues:

1. Check the script output for error messages
2. Verify all requirements are met
3. Try running the manual steps above
4. Check the main [README.md](README.md) for additional troubleshooting

The script is designed to be idempotent - you can run it multiple times safely.
