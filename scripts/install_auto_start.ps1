# =========================================================================
# سكربت تثبيت خدمة التشغيل التلقائي لمزامنة فواتير OraNT مع إقلاع ويندوز
# =========================================================================

$TaskName = "OraNT_ModernBuilding_Sync"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VbsPath = Join-Path $ScriptDir "run_silently.vbs"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " تثبيت خدمة التشغيل التلقائي لمزامنة فواتير OraNT مع ويندوز" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# التحقق من وجود الملف
if (-not (Test-Path $VbsPath)) {
    Write-Host "[خطأ] لم يتم العثور على الملف: $VbsPath" -ForegroundColor Red
    exit 1
}

# حذف المهمة القديمة إن وجدت
$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($ExistingTask) {
    Write-Host "[*] إزالة المهمة القديمة المسجلة..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# 1. الإجراء: تشغيل ملف VBS عبر wscript في الخلفية (بدون نافذة سوداء)
$Action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$VbsPath`"" -WorkingDirectory $ScriptDir

# 2. المشغل: عند تسجيل الدخول أو إقلاع النظام
$Trigger = New-ScheduledTaskTrigger -AtLogOn

# 3. الإعدادات المتقدمة: إعادة المحاولة في حال الخطأ وعدم الإيقاف
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Days 0) # لا يتوقف أبداً

# 4. تسجيل المهمة في Windows Task Scheduler
try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $Action `
        -Trigger $Trigger `
        -Settings $Settings `
        -Description "مزامنة فواتير أوراكل OraNT تلقائياً مع منصة modernbuildingsa.com/whatsapp عند إقلاع ويندوز" `
        -RunLevel Highest | Out-Null

    Write-Host "`n[نجاح] تم تثبيت المهمة بنجاح باسم: $TaskName" -ForegroundColor Green
    Write-Host "السكربت سيبدأ العمل تلقائياً في الخلفية عند فتح الجهاز في كل مرة." -ForegroundColor Green

    # تشغيل المهمة فوراً الآن
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "[*] تم إطلاق السكربت للعمل الآن في الخلفية." -ForegroundColor Cyan
    Write-Host "سجل الأحداث يتم حفظه في: $ScriptDir\sync_service.log`n" -ForegroundColor Gray
} catch {
    Write-Host "[خطأ] فشل تسجيل المهمة: $_" -ForegroundColor Red
    Write-Host "تأكد من تشغيل PowerShell كمسؤول (Run as Administrator)." -ForegroundColor Yellow
}
