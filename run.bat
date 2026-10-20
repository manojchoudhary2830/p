@echo off
echo ========================================================
echo  Starting NextGen PG Booking Platform (Jaipur & NCR)
echo ========================================================
echo.

echo [1/2] Starting Python FastAPI Backend on port 8001...
start "NextGen PG Backend (8001)" cmd /k "cd backend && .\venv\Scripts\python server.py"

echo [2/2] Starting React Vite Frontend on port 3000...
start "NextGen PG Frontend (3000)" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================================
echo  Platform is launching!
echo  - Web Application: http://localhost:3000
echo  - API & Health:    http://localhost:8001/api/health
echo  - Interactive Docs: http://localhost:8001/docs
echo  - Styled Sitemap:  http://localhost:3000/api/sitemap.xml
echo ========================================================
pause
