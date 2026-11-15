# Remove auto-sync scheduled task
$TaskName = "OraNT_ModernBuilding_Sync"

Write-Host "Stopping and removing scheduled task: $TaskName..." -ForegroundColor Yellow

$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($ExistingTask) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "[OK] Scheduled task removed and auto-sync stopped." -ForegroundColor Green
} else {
    Write-Host "[INFO] Scheduled task is not currently installed." -ForegroundColor Cyan
}
