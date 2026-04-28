@echo off
title ML image service (port 8000)
cd /d "%~dp0"
echo ========================================
echo   Image AI  (FastAPI + CLIP + BLIP)
echo ========================================
echo.
echo If you use cmd.exe: do NOT type ^& before Python.
echo That symbol is for PowerShell only.
echo.
echo Starting on http://127.0.0.1:8000 ...
echo Keep this window OPEN while you test the website.
echo.
"C:\Users\oussema\AppData\Local\Programs\Python\Python311\python.exe" -m uvicorn main:app --host 0.0.0.0 --port 8000
echo.
echo Server stopped.
pause
