$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')

function Stop-PortProcess {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($connection) {
        Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

Stop-PortProcess -Port 3000
Stop-PortProcess -Port 5000

$backend = Start-Process -FilePath (Join-Path $root '.venv\Scripts\python.exe') -ArgumentList 'backend\api_server.py' -WorkingDirectory $root -PassThru -WindowStyle Hidden
$frontend = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'dev:frontend' -WorkingDirectory $root -PassThru -WindowStyle Hidden

Write-Host "Backend PID: $($backend.Id)"
Write-Host "Frontend PID: $($frontend.Id)"
Write-Host 'Both services are starting. Press Ctrl+C to stop them.'

try {
    while (-not $backend.HasExited -and -not $frontend.HasExited) {
        Start-Sleep -Seconds 1
    }
    if ($backend.HasExited -and $backend.ExitCode -ne 0) {
        throw "Backend exited with code $($backend.ExitCode)"
    }
    if ($frontend.HasExited -and $frontend.ExitCode -ne 0) {
        throw "Frontend exited with code $($frontend.ExitCode)"
    }
}
finally {
    if (-not $backend.HasExited) {
        Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    }
    if (-not $frontend.HasExited) {
        Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue
    }
}