Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
BatPath = ScriptDir & "\run_sync_service.bat"
' 0 يعني تشغيل في الخلفية تماماً بدون ظهور نافذة سوداء
WshShell.Run """" & BatPath & """", 0, False
