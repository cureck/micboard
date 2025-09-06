# Micboard on Windows - Quick Guide

## Running Micboard

Simply double-click `run_server.bat` or run it from Command Prompt:
```
run_server.bat
```

## Accessing Micboard

Once the server starts, open your browser and go to:
- http://localhost:8058

Even if you see discovery errors in the console, the web interface should still work.

## Common Windows Issues & Solutions

### 1. Multicast Discovery Errors
**Symptom**: `OSError: [WinError 10049]` or similar network errors

**Solutions**:
- This is normal if you don't have Shure devices on your network
- The web interface will still work normally
- If you have Shure devices, ensure Windows Firewall allows Python
- Disable VPNs which can interfere with multicast

### 2. Windows Firewall
When you first run Micboard, Windows may ask to allow Python through the firewall:
- Click "Allow access" for both Private and Public networks
- This enables device discovery on your network

### 3. Port Already in Use
**Symptom**: `OSError: [WinError 10048]`

**Solution**: Another application is using port 8058
- Change the port by setting environment variable: `set MICBOARD_PORT=8059`
- Or close the other application

### 4. Virtual Environment Issues
If the automatic virtual environment setup fails:
```batch
# Delete and recreate
rmdir /s /q myenv
python -m venv myenv
myenv\Scripts\activate
pip install -r py\requirements.txt
```

### 5. Python Version
Micboard requires Python 3.12 or later. Check your version:
```
python --version
```

## Features Working on Windows

✅ Web interface
✅ Manual device configuration
✅ Planning Center integration
✅ Google Drive integration
✅ Background images
✅ Extended names
✅ Groups and presets

⚠️ Automatic device discovery (requires multicast support)

## Tips

1. **No Shure Devices?** Use the demo mode or manually configure offline devices
2. **Integration Setup**: See `docs/integrations.md` for PCO and Drive setup
3. **Logs**: Check `micboard.log` in the config directory for detailed error info
