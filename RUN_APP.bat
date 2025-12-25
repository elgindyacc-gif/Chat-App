@echo off
title Chat App Runner
color 0A

echo ==========================================
echo    Chat App - Professional Runner
echo ==========================================
echo.

:: Check for node_modules
if not exist "node_modules\" (
    echo [INFO] node_modules not found. Installing dependencies...
    call npm install
)

echo [SUCCESS] Starting the server...
echo [TIP] You can access the app from other devices on your network!
echo.

:: Run the dev server with host flag for mobile testing
call npm run dev -- --host

pause
