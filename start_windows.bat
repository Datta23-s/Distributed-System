@echo off
where node >nul 2>nul
if %errorlevel% neq 0 (
  set "PATH=C:\Users\Datta Sable\AppData\Local\nodejs-portable\node-v22.16.0-win-x64;%PATH%"
)
echo =================================================================
echo Starting UrbanPulse Distributed Nodes in Separate Windows...
echo =================================================================

start "Coordinator Process (RPC 9000, MOM 9100)" cmd /k "node nodes/coordinator.js"
timeout /t 2 /nobreak >nul

start "Driver 1 Node (P2P UDP 9021)" cmd /k "node nodes/driver.js driver-1 9021 20 30 9022 9023"
start "Driver 2 Node (P2P UDP 9022)" cmd /k "node nodes/driver.js driver-2 9022 50 60 9021 9023"
start "Driver 3 Node (P2P UDP 9023)" cmd /k "node nodes/driver.js driver-3 9023 80 40 9021 9022"
timeout /t 2 /nobreak >nul

start "Express Gateway & React Dashboard (Port 5000)" cmd /k "node server.js"

echo.
echo All processes launched in separate windows!
echo Open http://localhost:5000 in your browser.
pause
