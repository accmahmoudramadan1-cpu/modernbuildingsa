@echo off
chcp 65001 > nul
setlocal

cd /d "%~dp0"

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
rem Folder paths where Onyx exports invoice PDFs (separated by ;)
set ORACLE_PDF_EXPORT_DIR=D:\MSG\IAS1\PDF;D:\DOPDF

set "PY_EXE=python"
where python >nul 2>&1
if errorlevel 1 (
    if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" set "PY_EXE=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    if exist "C:\Program Files\Python311\python.exe" set "PY_EXE=C:\Program Files\Python311\python.exe"
    if exist "C:\Python311\python.exe" set "PY_EXE=C:\Python311\python.exe"
)

echo [%date% %time%] Starting Onyx Pro WhatsApp Sync Service (interval: 15s)... >> "%~dp0sync_service.log"

:LOOP
"%PY_EXE%" -u "%~dp0sync_orant_invoices.py" --loop 15 >> "%~dp0sync_service.log" 2>&1

echo [%date% %time%] Sync script stopped, retrying in 10 seconds... >> "%~dp0sync_service.log"
timeout /t 10 /nobreak > nul
goto LOOP
