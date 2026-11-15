# =========================================================================
# Install Windows Scheduled Task for Automatic Onyx Pro -> Modern Building Sync
# =========================================================================

$TaskName = "OraNT_ModernBuilding_Sync"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VbsPath = Join-Path $ScriptDir "run_silently.vbs"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Installing OraNT -> Modern Building Auto-Sync Task" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not (Test-Path $VbsPath)) {
    Write-Host "[ERROR] File not found: $VbsPath" -ForegroundColor Red
    exit 1
}

$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($ExistingTask) {
    Write-Host "[*] Removing existing scheduled task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$Action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$VbsPath`"" -WorkingDirectory $ScriptDir
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $Action `
        -Trigger $Trigger `
        -Settings $Settings `
        -Description "Auto-sync Onyx Pro Oracle invoices to modernbuildingsa.com/whatsapp on Windows logon" `
        -RunLevel Highest | Out-Null

    Write-Host "`n[OK] Scheduled task installed: $TaskName" -ForegroundColor Green
    Write-Host "Sync will start automatically in the background on every Windows logon." -ForegroundColor Green

    Start-ScheduledTask -TaskName $TaskName
    Write-Host "[*] Background sync service started now." -ForegroundColor Cyan
    Write-Host "Log file: $ScriptDir\sync_service.log`n" -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] Failed to register task: $_" -ForegroundColor Red
    Write-Host "Make sure to run CMD/PowerShell as Administrator." -ForegroundColor Yellow
}
