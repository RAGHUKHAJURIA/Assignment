$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$pythonPath = Join-Path (Get-Location) '.venv\Scripts\python.exe'
if (!(Test-Path -LiteralPath $pythonPath)) {
    throw 'Python environment is missing. Run: python -m venv .venv; then .\.venv\Scripts\python.exe -m pip install -r copilot\requirements.txt'
}
& $pythonPath -c 'import fastapi, uvicorn, langgraph, groq, dotenv'
if ($LASTEXITCODE -ne 0) { throw 'Dependencies are missing. Run: .\.venv\Scripts\python.exe -m pip install -r copilot\requirements.txt' }
Write-Host 'Starting RCA Copilot at http://127.0.0.1:8001. Configuration is loaded from the project .env.'
& $pythonPath -m uvicorn copilot.main:app --host 127.0.0.1 --port 8001
