@echo off
setlocal

set ROOT=%~dp0
set BACKEND=%ROOT%backend
set FRONTEND=%ROOT%frontend

echo ============================================
echo  ABAP Git and Versioning - Starting servers
echo ============================================

if not exist "%BACKEND%\venv312" (
    echo [backend] Creating virtual environment...
    py -3.12 -m venv "%BACKEND%\venv312"
)

echo [backend] Installing/updating dependencies...
call "%BACKEND%\venv312\Scripts\activate.bat" && pip install -q -r "%BACKEND%\requirements.txt"

if not exist "%FRONTEND%\node_modules" (
    echo [frontend] Installing npm dependencies...
    pushd "%FRONTEND%"
    call npm install
    popd
)

echo [backend] Launching FastAPI on http://0.0.0.0:8000 ...
start "ABAP Git - Backend" cmd /k "cd /d "%BACKEND%" && call venv312\Scripts\activate.bat && uvicorn app.main:app --host 0.0.0.0 --reload --port 8000"

echo [frontend] Launching Vite dev server on http://0.0.0.0:5173 ...
start "ABAP Git - Frontend" cmd /k "cd /d "%FRONTEND%" && npm run dev -- --host 0.0.0.0"

echo.
echo Both servers are starting in separate windows.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo.
endlocal
