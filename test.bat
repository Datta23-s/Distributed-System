@echo off
set "PATH=C:\Users\Datta Sable\AppData\Local\nodejs-portable\node-v22.16.0-win-x64;%PATH%"
echo =================================================================
echo Running UrbanPulse Distributed Systems Test Suite (20 Tests)...
echo =================================================================
node test/test_distributed.js
pause
