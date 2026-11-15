Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
BatPath = ScriptDir & "\run_sync_service.bat"
' 0 = hidden window (silent background execution)
WshShell.Run """" & BatPath & """", 0, False
