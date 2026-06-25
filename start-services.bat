@echo off
setlocal

set ROOT=%~dp0
set BACKEND=%ROOT%backend
set FRONTEND=%ROOT%frontend

echo ============================================
echo  ABAP Git and Versioning - Starting services
echo ============================================

echo [backend] Launching FastAPI on http://0.0.0.0:8000 ...
start "ABAP Git - Backend" cmd /k "cd /d "%BACKEND%" && call venv312\Scripts\activate.bat && uvicorn app.main:app --host 0.0.0.0 --reload --port 8000"

echo [frontend] Launching Vite dev server on http://0.0.0.0:5173 ...
start "ABAP Git - Frontend" cmd /k "cd /d "%FRONTEND%" && npm run dev -- --host 0.0.0.0"

echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo.
endlocal
