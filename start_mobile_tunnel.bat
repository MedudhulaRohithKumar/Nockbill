@echo off
echo Starting Fertilizer Shop Application Services...
echo.
echo 1. Backend Server: http://localhost:8000
echo 2. Frontend Local Server: http://localhost:5173
echo 3. Wi-Fi Local Network URL: http://192.168.1.3:5173
echo 4. Cloudflare Mobile Public URL: https://medium-supplies-weddings-joseph.trycloudflare.com
echo.
echo Launching Cloudflare Tunnel...
.\cloudflared.exe tunnel --url http://localhost:5173
pause
