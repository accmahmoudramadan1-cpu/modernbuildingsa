# إزالة خدمة المزامنة التلقائية
$TaskName = "OraNT_ModernBuilding_Sync"

Write-Host "جاري إيقاف وحذف مهمة التشغيل التلقائي: $TaskName..." -ForegroundColor Yellow

$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($ExistingTask) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "[نجاح] تم حذف المهمة وإيقاف التشغيل التلقائي." -ForegroundColor Green
} else {
    Write-Host "[معلومة] المهمة ليست مثبتة مسبقاً." -ForegroundColor Cyan
}
