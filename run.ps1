# PowerShell runner for ARVE (FastAPI Backend + Vite React Frontend)
$rootDir = $PSScriptRoot
$backendDir = Join-Path $rootDir "backend"
$frontendDir = Join-Path $rootDir "frontend"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " 🚀 ARVE Unified Dev Runner (PowerShell)" -ForegroundColor Cyan
Write-Host " Starting FastAPI Backend (Port 8000) & Vite Frontend (Port 5173)..." -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$backendProcess = Start-Process -FilePath "python" -ArgumentList "-m uvicorn app.main:app --reload --port 8000" -WorkingDirectory $backendDir -PassThru
$frontendProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory $frontendDir -PassThru

Write-Host "`n✅ Both servers launched in background processes:" -ForegroundColor Green
Write-Host "   - API Backend : http://localhost:8000" -ForegroundColor Yellow
Write-Host "   - API Docs    : http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host "   - Web UI      : http://localhost:5173" -ForegroundColor Yellow
Write-Host "`nPress Ctrl+C or close window to terminate processes.`n"

try {
    while ($true) {
        Start-Sleep -Seconds 2
        if ($backendProcess.HasExited -or $frontendProcess.HasExited) {
            break
        }
    }
} finally {
    Write-Host "`nShutting down processes..." -ForegroundColor Red
    if (-not $backendProcess.HasExited) { Stop-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue }
    if (-not $frontendProcess.HasExited) { Stop-Process -Id $frontendProcess.Id -ErrorAction SilentlyContinue }
    Write-Host "Stopped cleanly." -ForegroundColor Green
}
