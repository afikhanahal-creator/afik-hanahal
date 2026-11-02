# Afik Hanahal video studio - installs OpenMontage on this Windows PC and adds the office's brand style + real-estate skill.
# Run from this folder:   powershell -ExecutionPolicy Bypass -File .\install-openmontage.ps1
# Safe to run again: every step checks first and skips what is already done. No API key is asked or stored here -
# keys go only into OpenMontage's own .env file, which you edit yourself.
param([string]$Root = "C:\Users\HP\Desktop\Downloads\OpenMontage-main")

$ErrorActionPreference = "Continue"
$Pack = Split-Path -Parent $MyInvocation.MyCommand.Path
function Step($m) { Write-Host ""; Write-Host "==> $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "    OK  $m" -ForegroundColor Green }
function Warn($m) { Write-Host "    !!  $m" -ForegroundColor Yellow }
function Have($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function RefreshPath { $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User") }

if (-not (Test-Path (Join-Path $Root "requirements.txt"))) {
  Write-Host "OpenMontage folder not found: $Root" -ForegroundColor Red
  Write-Host "Run again with the right folder:  .\install-openmontage.ps1 -Root 'C:\path\to\OpenMontage-main'"
  exit 1
}

Step "1/7  Python, Node.js and FFmpeg"
$need = @()
if (-not (Have "py") -and -not (Have "python")) { $need += @{ id = "Python.Python.3.12"; name = "Python 3.12" } }
if (-not (Have "node")) { $need += @{ id = "OpenJS.NodeJS.LTS"; name = "Node.js LTS" } }
if (-not (Have "ffmpeg")) { $need += @{ id = "Gyan.FFmpeg"; name = "FFmpeg" } }
if ($need.Count -gt 0) {
  if (-not (Have "winget")) {
    Write-Host "winget is missing. Install these by hand, then run this script again:" -ForegroundColor Red
    $need | ForEach-Object { Write-Host "  - $($_.name)" }
    Write-Host "  Python: https://www.python.org/downloads/  (tick 'Add python.exe to PATH')"
    Write-Host "  Node.js: https://nodejs.org/  (LTS)"
    Write-Host "  FFmpeg: https://www.gyan.dev/ffmpeg/builds/"
    exit 1
  }
  foreach ($n in $need) {
    Write-Host "    installing $($n.name)..."
    winget install --id $n.id -e --accept-source-agreements --accept-package-agreements --silent
  }
  RefreshPath
}
$py = if (Have "py") { "py" } else { "python" }
& $py --version; node --version
if (Have "ffmpeg") { Ok "ffmpeg found" } else { Warn "ffmpeg was installed but this window does not see it yet - close PowerShell, open it again and re-run" }

Set-Location $Root

Step "2/7  Python environment (.venv)"
if (-not (Test-Path ".venv\Scripts\python.exe")) {
  if ($py -eq "py") { py -3 -m venv .venv } else { python -m venv .venv }
}
$vpy = Join-Path $Root ".venv\Scripts\python.exe"
& $vpy -m pip install --upgrade pip --quiet
& $vpy -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { Write-Host "pip install failed - send Claude the red lines above" -ForegroundColor Red; exit 1 }
Ok "Python packages installed"

Step "3/7  Remotion (video renderer)"
Push-Location "remotion-composer"
npm install
if ($LASTEXITCODE -ne 0) { Warn "npm install failed - trying npx --yes npm install"; npx --yes npm install }
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "Remotion install failed - send Claude the red lines above" -ForegroundColor Red; exit 1 }
Pop-Location
Ok "Remotion installed"

Step "4/7  Free local voice (piper-tts, optional - English voices; Hebrew voice-over needs ElevenLabs or Google)"
& $vpy -m pip install piper-tts --quiet
if ($LASTEXITCODE -eq 0) { Ok "piper-tts installed" } else { Warn "piper-tts skipped (not required)" }

Step "5/7  .env file for API keys"
if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env"; Ok ".env created - add keys later in Notepad if you want paid AI generation" }
else { Ok ".env already exists (left untouched)" }

Step "6/7  Afik Hanahal style + real-estate skill"
Copy-Item (Join-Path $Pack "styles\afik-hanahal.yaml") "styles\afik-hanahal.yaml" -Force
Copy-Item (Join-Path $Pack "skills\creative\real-estate-afik.md") "skills\creative\real-estate-afik.md" -Force
$marker = "AFIK-HANAHAL-STUDIO"
$claude = Join-Path $Root "CLAUDE.md"
if (-not (Select-String -Path $claude -Pattern $marker -Quiet)) {
  $block = @"

<!-- $marker -->
## House rules for this machine (Afik Hanahal real-estate office)

For any real-estate / property / "נכס" / "דירה" / "מגרש" / "פרויקט" video, after AGENT_GUIDE.md also read
``skills/creative/real-estate-afik.md`` and use the style playbook ``afik-hanahal`` (``styles/afik-hanahal.yaml``).
Talk to the user in Hebrew. Property data and photos: https://www.afikhanahal.co.il/api/properties?one=<id>
"@
  Add-Content -Path $claude -Value $block -Encoding UTF8
  Ok "CLAUDE.md points Claude Code at the Afik skill"
} else { Ok "CLAUDE.md already has the Afik block" }
& $vpy -c "import json,yaml,jsonschema; jsonschema.validate(yaml.safe_load(open('styles/afik-hanahal.yaml',encoding='utf-8')), json.load(open('schemas/styles/playbook.schema.json',encoding='utf-8'))); print('    OK  style playbook is valid')"
if ($LASTEXITCODE -ne 0) { Warn "could not validate the style (jsonschema missing?) - it still works" }

Step "7/7  What this PC can do now"
& $vpy -c "from tools.tool_registry import registry; registry.discover(); e=registry.support_envelope(); import json; s=json.dumps(e)[:1500]; print(s)"

Write-Host ""
Write-Host "Done. Next:" -ForegroundColor Green
Write-Host "  1. Open this folder in Claude Code:   cd `"$Root`"; claude"
Write-Host "  2. Ask in Hebrew, e.g.:  'תכין רילס של 35 שניות לנכס 1761234567890 מהאתר'"
Write-Host "  3. Watch the production board:       .\.venv\Scripts\python -m backlot open   (http://localhost:4750)"
