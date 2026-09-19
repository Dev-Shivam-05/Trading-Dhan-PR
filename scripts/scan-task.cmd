@echo off
rem P17 - what the Windows scheduled task "DhanNseScan0920" runs at 09:20 Mon-Fri: one NSE scan,
rem the log in logs\scans, and a phone notification via the channels in .env (src/server/notify.ts).
rem No PowerShell, so no ExecutionPolicy prompt. Output is appended to .cache\scan-task.log.
cd /d "%~dp0.."
if not exist .cache mkdir .cache
echo ==== %date% %time% >> .cache\scan-task.log
call npm run -s scan:nse -- --runner local-pc >> .cache\scan-task.log 2>&1
