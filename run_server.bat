@echo off
echo Starting Micboard server...

REM Activate virtual environment if it exists
if exist myenv\Scripts\activate.bat (
    echo Activating virtual environment...
    call myenv\Scripts\activate
) else (
    echo Virtual environment not found. Creating one...
    python -m venv myenv
    call myenv\Scripts\activate
    echo Installing dependencies...
    pip install -r py\requirements.txt
)
echo Building frontend...
call npm run build
echo Starting Micboard...
python py\micboard.py

echo.
echo ========================================
echo If you see errors above:
echo 1. Firewall: Allow Python through Windows Firewall
echo 2. Port 8058: Make sure no other app is using it
echo 3. Multicast: Some VPNs can interfere with multicast
echo ========================================

pause
