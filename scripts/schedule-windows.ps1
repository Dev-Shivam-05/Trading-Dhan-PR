# P15 - run the NSE scan on this Windows PC at 09:20 and 09:25 IST, Mon-Fri, and push the log to
# the `scan-logs` branch. It works alongside the GitHub Actions workflow, not instead of it: GitHub
# can start late or get blocked by NSE, and this PC can be switched off. Whichever runs, logs land
# in the same place with different file names.
#
#   powershell -ExecutionPolicy Bypass -File scripts\schedule-windows.ps1 -Install    # create the tasks
#   powershell -ExecutionPolicy Bypass -File scripts\schedule-windows.ps1 -RunNow     # one scan + push, now
#   powershell -ExecutionPolicy Bypass -File scripts\schedule-windows.ps1 -Uninstall  # remove the tasks
#
# The task runs only while you are logged in ("Interactive"): NSE accepts only a headed Chrome, and
# a headed Chrome needs a desktop session. The machine's clock must be on IST - the trigger times
# are local times.

param(
  [switch]$Install,
  [switch]$Uninstall,
  [switch]$RunNow
)

# 'Continue', not 'Stop': in PowerShell 5.1 a native command writing to stderr (git's progress, npm's
# notices) becomes an ErrorRecord, and under 'Stop' that aborts a run that actually succeeded.
# Every native call below is judged by $LASTEXITCODE instead.
$ErrorActionPreference = 'Continue'
$Repo = Split-Path -Parent $PSScriptRoot
$LogsDir = Join-Path $Repo '.scan-logs'          # a git worktree of the scan-logs branch (gitignored)
$TaskNames = @('DhanNseScan0920', 'DhanNseScan0925')
$RunnerLog = Join-Path $Repo '.cache\scan-task.log'

function Write-RunnerLog([string]$msg) {
  New-Item -ItemType Directory -Force (Split-Path $RunnerLog) | Out-Null
  $line = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -Path $RunnerLog -Value $line -Encoding utf8
  Write-Output $line
}

if ($Uninstall) {
  foreach ($t in $TaskNames) {
    if (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue) {
      Unregister-ScheduledTask -TaskName $t -Confirm:$false
      Write-Output "removed $t"
    }
  }
  exit 0
}

if ($Install) {
  $tz = (Get-TimeZone).Id
  if ($tz -ne 'India Standard Time') { Write-Warning "This PC's time zone is '$tz', not India Standard Time. The tasks fire at 09:20 LOCAL time." }
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSCommandPath`" -RunNow" `
    -WorkingDirectory $Repo
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive
  $times = @('09:20', '09:25')
  for ($i = 0; $i -lt $TaskNames.Count; $i++) {
    $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday, Tuesday, Wednesday, Thursday, Friday -At $times[$i]
    Register-ScheduledTask -TaskName $TaskNames[$i] -Action $action -Trigger $trigger -Settings $settings `
      -Principal $principal -Description "Dhan terminal: NSE F&O scan at $($times[$i]), log pushed to scan-logs" -Force | Out-Null
    Write-Output "installed $($TaskNames[$i]) at $($times[$i]) Mon-Fri"
  }
  exit 0
}

if ($RunNow) {
  Set-Location $Repo
  Write-RunnerLog "scan start (repo $Repo)"

  # The log worktree is created once and reused. It never touches the main checkout's files.
  if (-not (Test-Path (Join-Path $LogsDir '.git'))) {
    git fetch -q origin scan-logs
    git worktree add -f $LogsDir origin/scan-logs 2>&1 | Out-Null
    Push-Location $LogsDir; git checkout -q -B scan-logs origin/scan-logs; Pop-Location
    Write-RunnerLog "created log worktree at $LogsDir"
  }
  Push-Location $LogsDir
  git pull -q --rebase origin scan-logs
  Pop-Location

  $output = & npm run -s scan:nse -- --runner local-windows --out $LogsDir 2>&1
  $scanExit = $LASTEXITCODE
  $output | ForEach-Object { Write-RunnerLog "  $_" }
  Write-RunnerLog "scan exit $scanExit"

  Push-Location $LogsDir
  git add -A
  git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    git commit -q -m ("scan: local-windows {0} IST (exit {1})" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $scanExit)
    $pushed = $false
    for ($i = 1; $i -le 5 -and -not $pushed; $i++) {
      git pull -q --rebase origin scan-logs
      git push -q origin HEAD:scan-logs
      if ($LASTEXITCODE -eq 0) { $pushed = $true } else { Start-Sleep -Seconds (3 * $i) }
    }
    Write-RunnerLog ("log push: {0}" -f $(if ($pushed) { 'ok' } else { 'FAILED - the log is committed locally in .scan-logs' }))
  }
  Pop-Location
  exit $scanExit
}

Write-Output 'Use -Install, -RunNow or -Uninstall.'
