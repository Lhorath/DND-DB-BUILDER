@echo off
:: Get the full path of this script's directory
set "SCRIPT_DIR=%~dp0"

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo Requesting administrator access...
    powershell -NoExit -Command "Start-Process -FilePath '%~f0' -Verb runAs"
    exit /b
)

:: Change to script directory
cd /d "%SCRIPT_DIR%"

:: Launch PowerShell with the working directory set
start powershell -NoExit -Command "Set-Location -LiteralPath '%SCRIPT_DIR%'"
