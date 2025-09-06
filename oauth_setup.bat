@echo off
REM ================================================================
REM OAuth Configuration for Micboard Integrations
REM ================================================================
REM Edit the values below with your actual OAuth credentials
REM Then run this file before starting run_server.bat
REM ================================================================

REM Planning Center OAuth
REM Get these from: https://api.planningcenteronline.com/oauth/applications
set PCO_CLIENT_ID=your_pco_client_id_here
set PCO_CLIENT_SECRET=your_pco_client_secret_here
set PCO_REDIRECT_URI=http://localhost:8058/api/pco/callback

REM Google Drive OAuth
REM Get these from: https://console.cloud.google.com/
set GOOGLE_CLIENT_ID=your_google_client_id_here
set GOOGLE_CLIENT_SECRET=your_google_client_secret_here
set GOOGLE_REDIRECT_URI=http://localhost:8058/api/drive/callback

REM Optional: Override default port
REM set MICBOARD_PORT=8058

echo OAuth environment variables set!
echo.
echo Now run: run_server.bat
echo.
pause
