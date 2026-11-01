@echo off
setlocal enabledelayedexpansion

rem Run by Task Scheduler (see scripts\register-crawl-task.ps1): crawls the news once.
rem The crawler itself waits for Ollama (up to 120 s), records the run in the crawl_runs table,
rem and skips if another crawl is already running. Output is appended to crawl-task.log.
rem NOTE: do not use "timeout" here (it fails when stdin is not a console); the crawler needs no delay.

cd /d "%~dp0.."

set "STATE_DIR=%LOCALAPPDATA%\it-news-app"
set "TASK_LOG=%STATE_DIR%\crawl-task.log"

if not exist "%STATE_DIR%" mkdir "%STATE_DIR%"

call :log "Scheduled crawl started"
call npm run crawl >> "%TASK_LOG%" 2>&1
set "CRAWL_CODE=!ERRORLEVEL!"
call :log "Scheduled crawl finished (exit code !CRAWL_CODE!)"

exit /b !CRAWL_CODE!

:log
powershell -NoProfile -Command "Add-Content -Path '%TASK_LOG%' -Value ('[' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '] ' + '%~1')"
exit /b 0
