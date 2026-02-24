# GuardianAgent — Local Development Script
# Builds, tests, checks dependencies, and starts the system.
#
# Usage:
#   .\scripts\dev.ps1              # Full build + test + start
#   .\scripts\dev.ps1 -SkipTests   # Build + start (skip tests)
#   .\scripts\dev.ps1 -BuildOnly   # Build + test only (don't start)
#   .\scripts\dev.ps1 -StartOnly   # Start without rebuilding

param(
    [switch]$SkipTests,
    [switch]$BuildOnly,
    [switch]$StartOnly
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$OriginalDir = Get-Location
Set-Location $Root

try {

# --- ASCII Art Banner ---
Write-Host ""
# Block letter GUARDIAN
Write-Host "  ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗ ██╗ █████╗ ███╗   ██╗" -ForegroundColor Green
Write-Host "  ██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗██║██╔══██╗████╗  ██║" -ForegroundColor Green
Write-Host "  ██║  ███╗██║   ██║███████║██████╔╝██║  ██║██║███████║██╔██╗ ██║" -ForegroundColor DarkGreen
Write-Host "  ██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║██║██╔══██║██║╚██╗██║" -ForegroundColor DarkGreen
Write-Host "  ╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝██║██║  ██║██║ ╚████║" -ForegroundColor DarkGreen
Write-Host "   ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝" -ForegroundColor DarkGreen
Write-Host ""
# Block letter AGENT
Write-Host "       █████╗  ██████╗ ███████╗███╗   ██╗████████╗" -ForegroundColor Green
Write-Host "      ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝" -ForegroundColor Green
Write-Host "      ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   " -ForegroundColor DarkGreen
Write-Host "      ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   " -ForegroundColor DarkGreen
Write-Host "      ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   " -ForegroundColor DarkGreen
Write-Host "      ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   " -ForegroundColor DarkGreen
# Vaporwave perspective grid
Write-Host "  ═══════════════════════════════════════════════════════════════════" -ForegroundColor DarkCyan
Write-Host "       ─────────────────────────────────────────────────────────" -ForegroundColor DarkCyan
Write-Host "            ═══════════════════════════════════════════════" -ForegroundColor DarkCyan
Write-Host "                  ─────────────────────────────────────" -ForegroundColor DarkCyan
Write-Host "                        ═════════════════════════" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "        Three-Layer Defense  |  Real-Time Dashboard" -ForegroundColor DarkGreen
Write-Host ""

# --- Step 1: Check Node.js ---
Write-Host "[1/6] Checking Node.js..." -ForegroundColor DarkCyan
try {
    $nodeVersion = node --version
    $major = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($major -lt 18) {
        Write-Host "  ERROR: Node.js >= 18 required (found $nodeVersion)" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# --- Step 2: Install dependencies ---
Write-Host "[2/6] Checking dependencies..." -ForegroundColor DarkCyan
$needsInstall = $false

if (-not (Test-Path (Join-Path $Root "node_modules"))) {
    $needsInstall = $true
    Write-Host "  node_modules not found" -ForegroundColor DarkCyan
} elseif (-not (Test-Path (Join-Path $Root "node_modules\@rollup\rollup-win32-x64-msvc"))) {
    $needsInstall = $true
    Write-Host "  Dependencies installed from WSL/Linux - reinstalling for Windows..." -ForegroundColor DarkCyan
}

if ($needsInstall) {
    Write-Host "  Running npm install..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: npm install failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  Dependencies: OK" -ForegroundColor Green
}

if (-not $StartOnly) {
    # --- Step 3: Build ---
    Write-Host "[3/6] Building TypeScript..." -ForegroundColor DarkCyan
    $distPath = Join-Path $Root "dist"
    if (Test-Path $distPath) {
        Remove-Item -Recurse -Force $distPath
    }
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: Build failed" -ForegroundColor Red
        exit 1
    }

    $indexJs = Join-Path $Root "dist\index.js"
    $firstLine = Get-Content $indexJs -First 1
    if ($firstLine -eq "#!/usr/bin/env node") {
        Write-Host "  Build: OK (shebang present)" -ForegroundColor Green
    } else {
        Write-Host "  Build: OK (WARNING: missing shebang)" -ForegroundColor DarkCyan
    }

    # --- Step 4: Tests ---
    if (-not $SkipTests) {
        Write-Host "[4/6] Running tests..." -ForegroundColor DarkCyan
        $vitestPath = Join-Path $Root "node_modules\vitest\vitest.mjs"
        node $vitestPath run
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ERROR: Tests failed" -ForegroundColor Red
            exit 1
        }
        Write-Host "  Tests: PASSED" -ForegroundColor Green
    } else {
        Write-Host "[4/6] Tests: SKIPPED" -ForegroundColor DarkCyan
    }
} else {
    Write-Host "[3/6] Build: SKIPPED (-StartOnly)" -ForegroundColor DarkCyan
    Write-Host "[4/6] Tests: SKIPPED (-StartOnly)" -ForegroundColor DarkCyan

    $indexJs = Join-Path $Root "dist\index.js"
    if (-not (Test-Path $indexJs)) {
        Write-Host "  ERROR: dist/index.js not found. Run without -StartOnly first." -ForegroundColor Red
        exit 1
    }
}

if ($BuildOnly) {
    Write-Host ""
    Write-Host "[5/6] Start: SKIPPED (-BuildOnly)" -ForegroundColor DarkCyan
    Write-Host "[6/6] Done." -ForegroundColor DarkCyan
    Write-Host ""
    Write-Host "=== Build Complete ===" -ForegroundColor Green
    Write-Host "  To start manually: npm run dev" -ForegroundColor DarkGreen
    Write-Host ""
    exit 0
}

# --- Step 5: Check Ollama (default LLM provider) ---
Write-Host "[5/6] Checking Ollama..." -ForegroundColor DarkCyan
$ollamaRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -TimeoutSec 3 -ErrorAction Stop
    $ollamaRunning = $true
    $models = ($response.Content | ConvertFrom-Json).models
    $modelCount = $models.Count
    if ($modelCount -gt 0) {
        $modelNames = ($models | ForEach-Object { $_.name }) -join ", "
        Write-Host "  Ollama: Running - $modelCount models available ($modelNames)" -ForegroundColor Green
    } else {
        Write-Host "  Ollama: Running but no models installed" -ForegroundColor DarkCyan
        Write-Host "  Run: ollama pull llama3.2" -ForegroundColor DarkCyan
    }
} catch {
    Write-Host "  Ollama: Not running" -ForegroundColor DarkCyan
    Write-Host "  The CLI will start but LLM responses will fail without a provider." -ForegroundColor DarkCyan
    Write-Host "  To fix: Start Ollama and run 'ollama pull llama3.2'" -ForegroundColor DarkCyan
    Write-Host "  Or: Configure an API provider (Anthropic/OpenAI) in config.yaml" -ForegroundColor DarkCyan
}

# --- Check config file ---
$configDir = Join-Path $env:USERPROFILE ".guardianagent"
$configFile = Join-Path $configDir "config.yaml"

if (-not (Test-Path $configFile)) {
    Write-Host ""
    Write-Host "  No config file found. Creating default at $configFile" -ForegroundColor DarkCyan

    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }

    $defaultConfig = @'
# GuardianAgent Configuration
# Docs: https://github.com/alexkenley/guardian-agent

llm:
  ollama:
    provider: ollama
    baseUrl: http://127.0.0.1:11434
    model: llama3.2

  # Uncomment to use Anthropic:
  # claude:
  #   provider: anthropic
  #   apiKey: ${ANTHROPIC_API_KEY}
  #   model: claude-sonnet-4-20250514

  # Uncomment to use OpenAI:
  # gpt:
  #   provider: openai
  #   apiKey: ${OPENAI_API_KEY}
  #   model: gpt-4o

defaultProvider: ollama

channels:
  cli:
    enabled: true
  telegram:
    enabled: false
    # botToken: ${TELEGRAM_BOT_TOKEN}
    # allowedChatIds: []
  web:
    enabled: true
    port: 3000
    # authToken: ${WEB_AUTH_TOKEN}

guardian:
  enabled: true
  logDenials: true
  inputSanitization:
    enabled: true
    blockThreshold: 3
  rateLimit:
    maxPerMinute: 30
    maxPerHour: 500
    burstAllowed: 5
  outputScanning:
    enabled: true
    redactSecrets: true
  sentinel:
    enabled: true
    schedule: '*/5 * * * *'
  auditLog:
    maxEvents: 10000

runtime:
  maxStallDurationMs: 60000
  watchdogIntervalMs: 10000
  logLevel: info
'@

    Set-Content -Path $configFile -Value $defaultConfig -Encoding UTF8
    Write-Host "  Config created: $configFile" -ForegroundColor Green
} else {
    Write-Host "  Config: $configFile" -ForegroundColor Green
}

# --- Check if web channel is enabled in existing config ---
$webEnabled = $false
$webPort = 3000
if (Test-Path $configFile) {
    $configContent = Get-Content $configFile -Raw
    if ($configContent -match 'web:\s*\n\s*enabled:\s*true') {
        $webEnabled = $true
    }
    if ($configContent -match 'port:\s*(\d+)') {
        $webPort = [int]$Matches[1]
    }
    # Auto-enable web channel if it's disabled
    if (-not $webEnabled -and $configContent -match 'web:\s*\n\s*enabled:\s*false') {
        Write-Host "  Enabling web dashboard in config..." -ForegroundColor DarkCyan
        $configContent = $configContent -replace '(web:\s*\n\s*enabled:\s*)false', '${1}true'
        Set-Content -Path $configFile -Value $configContent -Encoding UTF8
        $webEnabled = $true
    }
}

# --- Start ---
Write-Host ""
Write-Host "[6/6] Starting GuardianAgent..." -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  ┌──────────────────────────────────────────────┐" -ForegroundColor DarkGreen
Write-Host "  │" -NoNewline -ForegroundColor DarkGreen; Write-Host "         SYSTEM STATUS                    " -NoNewline -ForegroundColor Green; Write-Host "│" -ForegroundColor DarkGreen
Write-Host "  ├──────────────────────────────────────────────┤" -ForegroundColor DarkGreen
Write-Host "  │" -NoNewline -ForegroundColor DarkGreen; Write-Host "  Guardian:  " -NoNewline -ForegroundColor DarkCyan; Write-Host "ACTIVE" -NoNewline -ForegroundColor Green; Write-Host " (3-layer defense)      " -NoNewline -ForegroundColor DarkGreen; Write-Host "│" -ForegroundColor DarkGreen
Write-Host "  │" -NoNewline -ForegroundColor DarkGreen; Write-Host "  Channels:  " -NoNewline -ForegroundColor DarkCyan; Write-Host "CLI + Web Dashboard            " -NoNewline -ForegroundColor DarkCyan; Write-Host "│" -ForegroundColor DarkGreen
Write-Host "  │" -NoNewline -ForegroundColor DarkGreen; Write-Host "  Dashboard: " -NoNewline -ForegroundColor DarkCyan; Write-Host "http://localhost:$webPort" -NoNewline -ForegroundColor Green
$pad = " " * (32 - "http://localhost:$webPort".Length)
Write-Host "$pad" -NoNewline; Write-Host "│" -ForegroundColor DarkGreen
if ($ollamaRunning) {
    Write-Host "  │" -NoNewline -ForegroundColor DarkGreen; Write-Host "  LLM:       " -NoNewline -ForegroundColor DarkCyan; Write-Host "Ollama (localhost:11434)        " -NoNewline -ForegroundColor Green; Write-Host "│" -ForegroundColor DarkGreen
} else {
    Write-Host "  │" -NoNewline -ForegroundColor DarkGreen; Write-Host "  LLM:       " -NoNewline -ForegroundColor DarkCyan; Write-Host "Not connected                  " -NoNewline -ForegroundColor DarkGray; Write-Host "│" -ForegroundColor DarkGreen
}
Write-Host "  └──────────────────────────────────────────────┘" -ForegroundColor DarkGreen
Write-Host ""
if ($webEnabled) {
    Write-Host "  Dashboard: " -NoNewline -ForegroundColor DarkCyan; Write-Host "http://localhost:$webPort" -ForegroundColor Green
}
Write-Host ""
Write-Host "  Spawning GuardianAgent... please wait" -ForegroundColor DarkCyan
Write-Host "  Press " -NoNewline -ForegroundColor DarkGreen; Write-Host "Ctrl+C" -NoNewline -ForegroundColor Green; Write-Host " to stop." -ForegroundColor DarkGreen
Write-Host ""

# Open browser to dashboard
if ($webEnabled) {
    Start-Process "http://localhost:$webPort"
}

# Run with tsx for dev mode (TypeScript direct execution)
$tsxPath = Join-Path $Root "node_modules\.bin\tsx.cmd"
if (Test-Path $tsxPath) {
    & $tsxPath (Join-Path $Root "src\index.ts")
} else {
    node (Join-Path $Root "dist\index.js")
}

} finally {
    Set-Location $OriginalDir
}
