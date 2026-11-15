@echo off
chcp 65001 > nul
setlocal

:: تحديد مسار المجلد الحالي للسكربت
cd /d "%~dp0"

:: الرابط والمفتاح الافتراضي وبيانات أوراكل (يمكن تخصيصهم هنا أو في بيئة النظام)
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
set MODERN_BUILDING_API_URL=https://www.modernbuildingsa.com/api/oracle-orders
set ORACLE_SYNC_API_KEY=modern_building_orant_sync_secret_2026
set ORACLE_HOST=onyxserver
set ORACLE_PORT=1521
set ORACLE_SID=orcl
set ORACLE_USER=ONYX_READONLY
set ORACLE_PASS=ModernSync_2026
set ORACLE_SCHEMA=IAS20261

:: حلقة التكرار كل 30 ثانية للمزامنة المستمرة
echo [%date% %time%] بدء تشغيل خدمة مزامنة عمليات Onyx Pro مع modernbuildingsa.com >> "%~dp0sync_service.log"

:LOOP
python -u "%~dp0sync_orant_invoices.py" --loop 30 >> "%~dp0sync_service.log" 2>&1

:: في حال توقف السكربت أو حدث استثناء، إعادة التشغيل بعد 10 ثوانٍ تلقائياً
echo [%date% %time%] السكربت توقف، جاري إعادة المحاولة خلال 10 ثوانٍ... >> "%~dp0sync_service.log"
timeout /t 10 /nobreak > nul
goto LOOP
