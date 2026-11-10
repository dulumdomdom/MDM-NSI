@echo off
rem MDM NSI: start on an offline Windows PC. Double-click this file.
rem Optional: start-windows.cmd -Port 8081
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" %*
if errorlevel 1 pause
