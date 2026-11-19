@echo off
setlocal
cd /d "%~dp0"
echo ========================================================
echo          GateVault GitHub Push Automation
echo ========================================================
powershell -ExecutionPolicy Bypass -File "%~dp0git-push.ps1" %*
pause
