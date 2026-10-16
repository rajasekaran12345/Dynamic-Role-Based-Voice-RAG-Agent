@echo off
echo ========================================================
echo Starting Thaagam Foundations Role-Based AI Agent Server
echo ========================================================

start "Thaagam Backend" cmd /k ".\venv\Scripts\python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload"
start "Thaagam Frontend" cmd /k "cd frontend && npm run dev"

echo Backend running on http://127.0.0.1:8000
echo Frontend running on http://localhost:5173
pause
