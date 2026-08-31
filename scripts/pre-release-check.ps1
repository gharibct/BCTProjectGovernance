<#
.SYNOPSIS
    Run before cutting a release: fresh SQLite backend + full pytest suite +
    frontend build + Playwright E2E + lint. Exits non-zero if anything fails.

.DESCRIPTION
    Never touches backend/.env (which points at the shared Postgres box) —
    the backend is started as a child process with env vars that override
    settings for this run only, pointed at a throwaway backend/e2e.db that
    gets wiped and reseeded every run. Playwright's own webServer config
    (frontend/playwright.config.ts) starts/stops the frontend; this script
    owns only the backend process, since it needs bootstrap/seed steps
    uvicorn itself can't do.

.USAGE
    Run from anywhere: pwsh scripts/pre-release-check.ps1
    Assumes `pip install -r requirements.txt` has already been run inside
    backend/.venv, and `npm install` (+ `npx playwright install chromium`)
    inside frontend/ — this script doesn't bootstrap dependencies, matching
    a manual pre-release check rather than a from-scratch CI runner.
#>

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$dbPath = Join-Path $backendDir "e2e.db"
$pythonExe = Join-Path $backendDir ".venv\Scripts\python.exe"

if (-not (Test-Path $pythonExe)) {
    Write-Host "backend/.venv not found — run 'python -m venv .venv; .venv\Scripts\pip install -r requirements.txt' in backend/ first." -ForegroundColor Red
    exit 1
}

$results = [ordered]@{}
$backendProc = $null

function Run-Step {
    param(
        [string]$Name,
        [scriptblock]$Block
    )
    Write-Host "`n==> $Name" -ForegroundColor Cyan
    try {
        & $Block
        $script:results[$Name] = "PASS"
    } catch {
        $script:results[$Name] = "FAIL: $($_.Exception.Message)"
        Write-Host "FAILED: $Name - $($_.Exception.Message)" -ForegroundColor Red
    }
}

try {
    Run-Step "Bootstrap + seed e2e.db" {
        if (Test-Path $dbPath) { Remove-Item $dbPath -Force }
        Push-Location $backendDir
        try {
            $env:DATABASE_URL = "sqlite+aiosqlite:///./e2e.db"
            & $pythonExe -m scripts.bootstrap_sqlite
            if ($LASTEXITCODE -ne 0) { throw "bootstrap_sqlite failed" }
            & $pythonExe -m scripts.seed_sqlite_dev
            if ($LASTEXITCODE -ne 0) { throw "seed_sqlite_dev failed" }
        } finally {
            Pop-Location
        }
    }

    Run-Step "Start backend (uvicorn)" {
        Push-Location $backendDir
        try {
            $env:DATABASE_URL = "sqlite+aiosqlite:///./e2e.db"
            $env:AUTH_TYPE = "no_password"
            $env:API_KEY = "local-dev-key"   # matches frontend/.env.local's NEXT_PUBLIC_API_KEY
            $env:SESSION_SECRET = "e2e-session-secret"
            $env:CORS_ORIGINS = "http://localhost:3000"
            $script:backendProc = Start-Process -FilePath $pythonExe `
                -ArgumentList "-m", "uvicorn", "app.main:app", "--port", "8000" `
                -PassThru -WindowStyle Hidden
        } finally {
            Pop-Location
        }

        $ready = $false
        for ($i = 0; $i -lt 30; $i++) {
            try {
                $r = Invoke-WebRequest "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 2
                if ($r.StatusCode -eq 200) { $ready = $true; break }
            } catch {
                Start-Sleep -Seconds 1
            }
        }
        if (-not $ready) { throw "Backend did not become healthy within 30s" }
        Write-Host "Backend ready (pid $($script:backendProc.Id))"
    }

    Run-Step "Backend pytest" {
        Push-Location $backendDir
        try {
            $env:DATABASE_URL = "sqlite+aiosqlite:///./e2e.db"
            & $pythonExe -m pytest
            if ($LASTEXITCODE -ne 0) { throw "pytest reported failures" }
        } finally {
            Pop-Location
        }
    }

    Run-Step "Frontend build" {
        Push-Location $frontendDir
        try {
            & npm run build
            if ($LASTEXITCODE -ne 0) { throw "next build failed" }
        } finally {
            Pop-Location
        }
    }

    Run-Step "Playwright E2E" {
        Push-Location $frontendDir
        try {
            $env:NEXT_PUBLIC_API_KEY = "local-dev-key"
            & npx playwright test
            if ($LASTEXITCODE -ne 0) { throw "playwright reported failures" }
        } finally {
            Pop-Location
        }
    }

    Run-Step "Frontend lint" {
        Push-Location $frontendDir
        try {
            & npm run lint
            if ($LASTEXITCODE -ne 0) { throw "eslint reported errors" }
        } finally {
            Pop-Location
        }
    }
}
finally {
    if ($backendProc -and -not $backendProc.HasExited) {
        Write-Host "`n==> Stopping backend (pid $($backendProc.Id))" -ForegroundColor Cyan
        Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "`n===== Pre-release check summary =====" -ForegroundColor Yellow
$failed = $false
foreach ($key in $results.Keys) {
    $status = $results[$key]
    if ($status -eq "PASS") {
        Write-Host ("{0,-30} {1}" -f $key, $status) -ForegroundColor Green
    } else {
        $failed = $true
        Write-Host ("{0,-30} {1}" -f $key, $status) -ForegroundColor Red
    }
}

if ($failed) {
    Write-Host "`nNOT ready to release." -ForegroundColor Red
    exit 1
} else {
    Write-Host "`nAll checks passed - ready to release." -ForegroundColor Green
    exit 0
}
