<#
  Registers (or removes) the Windows Task Scheduler task that crawls the news once a day.

  Usage (PowerShell, no administrator rights needed):
    .\scripts\register-crawl-task.ps1               # register daily at 12:00
    .\scripts\register-crawl-task.ps1 -At 07:30     # register at another time
    .\scripts\register-crawl-task.ps1 -Remove       # remove the task

  Safe to run repeatedly: an existing task with the same name is overwritten (-Force),
  so the result is always the same. Nothing is registered until YOU run this script.

  Task settings:
    - Runs only while the user is logged on (LogonType Interactive, limited rights)
    - If the scheduled time is missed (PC off/asleep), runs once after the PC is back (StartWhenAvailable)
    - Never starts a second copy while one is running (MultipleInstances IgnoreNew)
    - Runs on battery too; stops after 3 hours at the latest
  The crawler itself also stops starting new articles after 1 h 50 min and records the run in crawl_runs.
  (Messages are in English on purpose: Windows PowerShell 5.1 misreads UTF-8 files without a BOM.)
#>
param(
    [string]$At = "12:00",
    [switch]$Remove
)

$ErrorActionPreference = "Stop"
$TaskName = "it-news-app-crawl"

if ($Remove) {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Removed task: $TaskName"
    }
    else {
        Write-Host "Task not registered: $TaskName (nothing to remove)"
    }
    exit 0
}

$time = [datetime]::MinValue
if (-not [datetime]::TryParseExact($At, [string[]]@("H:mm", "HH:mm"), [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::None, [ref]$time)) {
    throw "Invalid -At value '$At'. Use 24-hour HH:mm, for example 12:00 or 07:30."
}

$runBat = Join-Path $PSScriptRoot "run-crawl.bat"
if (-not (Test-Path $runBat)) {
    throw "Not found: $runBat"
}

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$runBat`""
$trigger = New-ScheduledTaskTrigger -Daily -At $time
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 3) `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "it-news-app: collect IT news once a day (see docs/spec.md 5.1 G4)" `
    -Force | Out-Null

Write-Host "Registered task: $TaskName (daily at $($time.ToString('HH:mm')), only while logged on)"
Get-ScheduledTask -TaskName $TaskName | Get-ScheduledTaskInfo | Format-List TaskName, LastRunTime, NextRunTime, LastTaskResult
