@echo off
echo ====================================
echo G-MAI - All Apps Startup Script
echo ====================================
echo.

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: npm is not installed or not in PATH
    pause
    exit /b 1
)

echo Starting all applications...
echo.
echo - Case Search RAG: http://localhost:5173
echo - Masking Checker: http://localhost:5174
echo - Business Flow:   http://localhost:3000 (frontend)
echo                    http://localhost:3002 (backend)
echo.
echo Press Ctrl+C to stop all applications
echo ====================================
echo.

npm run start-all
