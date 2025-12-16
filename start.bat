@echo off
echo Starting Connectly Backend Server...
echo.

if not exist node_modules (
    echo Installing dependencies...
    call npm install
    echo.
)

echo Starting server on port 8080...
node server.js

if errorlevel 1 (
    echo.
    echo Error: Server failed to start!
    echo Please check the console output above for details.
    echo.
)

pause