<#
.SYNOPSIS
  Run the pinned Kev-4B locally on this Windows PC's NVIDIA GPU, loopback only.

.DESCRIPTION
  setup  Create an isolated venv, install PyTorch 2.8.0 (CUDA 12.8) and kev[serve] at the pinned
         source commit, save the package inventory, and prove a real CUDA tensor operation.
         -Python must be a Python 3.12 interpreter; it is only used to create the venv.
  start  Serve http://127.0.0.1:8009 in this window. Press Ctrl+C to stop.
  smoke  Run smoke.py and probe.py against the running local server.

  State lives in %LOCALAPPDATA%\rise-kev (venv, Hugging Face cache, API key, inventory), outside
  source control. The key is generated once, readable only by this user, never printed, and passed
  to Python only through the child process environment.

.EXAMPLE
  .\deploy\kev\local.ps1 setup -Python C:\path\to\python.exe
  .\deploy\kev\local.ps1 start
  .\deploy\kev\local.ps1 smoke
#>
param(
    [Parameter(Mandatory)][ValidateSet('setup', 'start', 'smoke')][string]$Command,
    [string]$Python
)
$ErrorActionPreference = 'Stop'

$KevSource = '9c41005b2180347c3c646dfc9e50c4428483ec6b'
$KevRevision = '139fdd94f1b6a6ad80cc15e08fcb99cac885a101'
$StateDir = Join-Path $env:LOCALAPPDATA 'rise-kev'
$Venv = Join-Path $StateDir 'venv'
$VenvPython = Join-Path $Venv 'Scripts\python.exe'
$KeyFile = Join-Path $StateDir 'api-key'
$Here = $PSScriptRoot

function Invoke-Checked([string]$Exe, [string[]]$Arguments) {
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Exe exited with $LASTEXITCODE" }
}

function Get-ApiKey {
    if (-not (Test-Path $KeyFile)) {
        $bytes = [byte[]]::new(48)
        [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
        $key = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
        New-Item -ItemType File -Path $KeyFile -Force | Out-Null
        Invoke-Checked icacls @($KeyFile, '/inheritance:r', '/grant:r', "${env:USERNAME}:(R,W)") | Out-Null
        Set-Content -Path $KeyFile -Value $key -NoNewline
    }
    $key = (Get-Content -Path $KeyFile -Raw).Trim()
    if (-not $key) { throw "$KeyFile is empty; delete it to generate a new key" }
    $key
}

function Use-KevEnvironment([scriptblock]$Body) {
    $saved = @{}
    $vars = @{
        KEV_API_KEY = (Get-ApiKey); KEV_BASE_URL = 'http://127.0.0.1:8009'
        KEV_MODEL = 'kev-latest'; KEV_REVISION = $KevRevision
        HF_HOME = (Join-Path $StateDir 'hf'); TOKENIZERS_PARALLELISM = 'false'; PYTHONUNBUFFERED = '1'
    }
    foreach ($name in $vars.Keys) {
        $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        [Environment]::SetEnvironmentVariable($name, $vars[$name], 'Process')
    }
    try { & $Body }
    finally {
        foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
    }
}

New-Item -ItemType Directory -Path $StateDir -Force | Out-Null
switch ($Command) {
    'setup' {
        if (-not $Python) { throw 'setup needs -Python <path to a Python 3.12 python.exe>' }
        Invoke-Checked $Python @('-c', 'import sys; assert sys.version_info[:2] == (3, 12), sys.version')
        if (-not (Test-Path $VenvPython)) { Invoke-Checked $Python @('-m', 'venv', $Venv) }
        Invoke-Checked $VenvPython @('-m', 'pip', 'install', '--upgrade', 'pip')
        Invoke-Checked $VenvPython @('-m', 'pip', 'install', 'torch==2.8.0', '--index-url', 'https://download.pytorch.org/whl/cu128')
        Invoke-Checked $VenvPython @('-m', 'pip', 'install', "kev[serve] @ https://github.com/jaredpalmer/kev/archive/$KevSource.zip")
        Invoke-Checked $VenvPython @('-m', 'pip', 'freeze') | Set-Content (Join-Path $StateDir 'packages.txt')
        Invoke-Checked $VenvPython @('-c', @'
import torch
assert torch.__version__ == "2.8.0+cu128", f"torch changed to {torch.__version__}"
assert torch.cuda.is_available(), "CUDA unavailable"
print(torch.__version__, torch.version.cuda, torch.cuda.get_device_name(0), torch.cuda.get_device_capability(0))
print("CUDA tensor check:", (torch.ones(8, device="cuda") * 2).sum().item())
'@)
        Write-Host "Setup done. Inventory: $(Join-Path $StateDir 'packages.txt')"
    }
    'start' {
        Use-KevEnvironment { Invoke-Checked $VenvPython @((Join-Path $Here 'local_app.py')) }
    }
    'smoke' {
        Use-KevEnvironment {
            Invoke-Checked $VenvPython @((Join-Path $Here 'smoke.py'), '--allow-loopback')
            & $VenvPython (Join-Path $Here 'probe.py') --allow-loopback   # a failed probe is a result to report, not a crash
        }
    }
}
