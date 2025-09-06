# Micboard Setup Guide

## Quick Start

### Windows
```bash
# Run the server (will create virtual environment automatically)
run_server.bat
```

### macOS/Linux
```bash
# Make the script executable
chmod +x run_server.sh

# Run the server
./run_server.sh
```

## Manual Setup

### 1. Create Virtual Environment
```bash
# Windows
python -m venv myenv
myenv\Scripts\activate

# macOS/Linux
python3 -m venv myenv
source myenv/bin/activate
```

### 2. Install Dependencies
```bash
pip install -r py/requirements.txt
```

### 3. Configure OAuth (Optional)

For Planning Center and Google Drive integrations, set these environment variables:

#### Windows
```batch
set PCO_CLIENT_ID=your_pco_client_id
set PCO_CLIENT_SECRET=your_pco_client_secret
set GOOGLE_CLIENT_ID=your_google_client_id
set GOOGLE_CLIENT_SECRET=your_google_client_secret
```

#### macOS/Linux
```bash
export PCO_CLIENT_ID="your_pco_client_id"
export PCO_CLIENT_SECRET="your_pco_client_secret"
export GOOGLE_CLIENT_ID="your_google_client_id"
export GOOGLE_CLIENT_SECRET="your_google_client_secret"
```

### 4. Run the Server
```bash
python py/micboard.py
```

The server will start on http://localhost:8058

## Troubleshooting

### Windows Socket Errors
The Python server has been updated to handle Windows-specific socket limitations. If you still encounter issues:

1. Ensure you're using Python 3.12 or later
2. Run as Administrator if you get permission errors
3. Check Windows Firewall settings for multicast traffic

### Virtual Environment Issues
If the virtual environment isn't working:

1. Delete the `myenv` folder and recreate it
2. Ensure you have the correct Python version: `python --version`
3. On Windows, you may need to enable script execution:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

### Missing Dependencies
If you get import errors, ensure all dependencies are installed:
```bash
pip install --upgrade -r py/requirements.txt
```

## Building the Frontend

To rebuild the JavaScript bundles after making changes:

```bash
npm install
npm run build
```
