param([switch]$SkipTests, [switch]$BuildOnly, [switch]$StartOnly, [int]$Port = 3000)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
  if (-not $StartOnly) {
    if (-not $SkipTests) { npm run test:security-workspace; if ($LASTEXITCODE) { throw 'Security tests failed' } }
    npm run check
    if ($LASTEXITCODE) { throw 'Type checks failed' }
    npm run build
    if ($LASTEXITCODE) { throw 'Build failed' }
  }
  if ($BuildOnly) { return }
  if (-not (Test-Path -LiteralPath 'web/security/dist/index.html')) { throw 'Build the security UI first: npm run build' }
  $securityDataDir = if ($env:GUARDIAN_SECURITY_HOME) { $env:GUARDIAN_SECURITY_HOME } else { Join-Path $env:USERPROFILE '.guardianagent/security-v2' }
  if (-not (Test-Path -LiteralPath (Join-Path $securityDataDir 'admin-token.txt'))) {
    node dist/security-main.js init --data-dir $securityDataDir
    if ($LASTEXITCODE) { throw 'Administrator initialization failed' }
  }
  Write-Host "Guardian security workspace: http://127.0.0.1:$Port"
  Write-Host 'Existing Guardian processes are not stopped. Choose another -Port if the old assistant is still running.'
  node dist/security-main.js serve --data-dir $securityDataDir --port $Port
  if ($LASTEXITCODE) { throw 'Guardian exited with an error' }
} finally { Pop-Location }
