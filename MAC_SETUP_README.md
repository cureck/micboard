# Micboard Mac Setup Script

This script (`mac_setup.sh`) provides a complete setup solution for Micboard on macOS, handling all dependencies and configuration from scratch.

## What It Does

The script automatically:

1. **Installs Homebrew** (if not present)
2. **Installs Node.js 20+** (required for frontend build tools)
3. **Installs Python 3.12+** (required for the backend server)
4. **Installs additional dependencies** (git, curl, wget)
5. **Creates Python virtual environment** (`myenv/`)
6. **Installs Python dependencies** (tornado, requests, etc.)
7. **Installs Node.js dependencies** (webpack, babel, etc.)
8. **Builds frontend assets** (compiles SCSS, bundles JS)
9. **Creates helper scripts** for easy startup and OAuth setup

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

- `myenv/` - Python virtual environment
- `node_modules/` - Node.js dependencies
- `static/` - Built frontend assets
- `start_micboard.sh` - Easy startup script
- `oauth_setup_template.sh` - OAuth configuration template

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
