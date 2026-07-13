@echo off
setlocal enabledelayedexpansion

rem Move to the app folder (path is hardcoded based on past troubleshooting).
cd C:\Users\okina\it-news-app

rem State files used to run the crawler only once per Windows boot session.
set "STATE_DIR=%LOCALAPPDATA%\it-news-app"
set "MARKER_FILE=%STATE_DIR%\last_boot_marker.txt"
set "LOG_FILE=%STATE_DIR%\start-app.log"

if not exist "%STATE_DIR%" mkdir "%STATE_DIR%"

rem Get the current Windows boot time as a fixed yyyyMMddHHmmss string.
rem wmic is deprecated/removed on some systems, so use Get-CimInstance instead.
set "CURRENT_BOOT="
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "try { (Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToString('yyyyMMddHHmmss') } catch { '' }"`) do (
    set "CURRENT_BOOT=%%A"
)
rem Trim stray whitespace/newlines that for /f can introduce.
for /f "tokens=* delims= " %%B in ("!CURRENT_BOOT!") do set "CURRENT_BOOT=%%B"

call :log "Current boot time: [!CURRENT_BOOT!]"

set "PREVIOUS_BOOT="
if exist "%MARKER_FILE%" (
    for /f "usebackq delims=" %%C in ("%MARKER_FILE%") do set "PREVIOUS_BOOT=%%C"
    for /f "tokens=* delims= " %%D in ("!PREVIOUS_BOOT!") do set "PREVIOUS_BOOT=%%D"
)

rem Decide whether to run the crawler this time.
set "RUN_CRAWLER=0"
set "REASON="

if "!CURRENT_BOOT!"=="" goto decision_boot_time_failed
if not exist "%MARKER_FILE%" goto decision_first_run
if not "!CURRENT_BOOT!"=="!PREVIOUS_BOOT!" goto decision_boot_changed
goto decision_same_boot

:decision_boot_time_failed
set "RUN_CRAWLER=0"
set "REASON=Failed to read boot time (empty value), skipping crawler as a safe default"
call :log "WARNING: !REASON!"
goto decision_done

:decision_first_run
set "RUN_CRAWLER=1"
set "REASON=Marker file does not exist (first run)"
goto decision_done

:decision_boot_changed
set "RUN_CRAWLER=1"
set "REASON=Boot time differs from marker (first run after a PC restart)"
goto decision_done

:decision_same_boot
set "RUN_CRAWLER=0"
set "REASON=Boot time matches marker (re-run within the same boot session)"
goto decision_done

:decision_done
call :log "Decision: RUN_CRAWLER=!RUN_CRAWLER! / Reason: !REASON!"

if "!RUN_CRAWLER!"=="1" goto run_crawler
goto skip_crawler

:run_crawler
echo Collecting IT News...
rem 1. Run the crawler to fetch the latest news (wait for completion).
call npm run crawl
call :log "Crawler executed."

if "!CURRENT_BOOT!"=="" goto after_crawler
> "%MARKER_FILE%" echo !CURRENT_BOOT!
call :log "Marker file updated: !CURRENT_BOOT!"
goto after_crawler

:skip_crawler
echo Skipping crawler (already run this boot session)...
call :log "Crawler skipped."

:after_crawler
echo Building production bundle...
rem 2. Production build (so code updates are reflected every run; usually a few seconds).
call npm run build

echo Starting production server and opening browser...
rem 3. Start the Next.js production server in the background (minimized), not "npm run dev".
start /min cmd /c "npm run start"

rem 4. Wait 5 seconds for the server to come up.
rem "timeout" reads from console input and fails ("Input redirection is not
rem supported") when stdin is redirected/non-interactive (Task Scheduler,
rem or any non-console launch); that failure corrupts this script's own
rem later goto/label resolution. Use ping as a stdin-free ~5 second delay.
ping -n 6 127.0.0.1 >nul

rem 5. Open the app in the default browser.
start http://localhost:3001

call :log "it-news-app startup sequence complete."

rem ==========================================================
rem ArchitectAI auto-start. Runs strictly after it-news-app has
rem already started above; any failure below must never block
rem or fail the it-news-app startup.
rem ==========================================================
set "DOCKER_DESKTOP_EXE=C:\Program Files\Docker\Docker\Docker Desktop.exe"

docker info >nul 2>&1
if "!ERRORLEVEL!"=="0" goto docker_already_running

call :log "Docker Desktop not detected as running. Launching Docker Desktop (minimized)."
start /min cmd /c "%DOCKER_DESKTOP_EXE%"
goto docker_wait_start

:docker_already_running
call :log "Docker Desktop already running (docker info succeeded immediately)."
goto docker_ready

:docker_wait_start
rem Poll every 10 seconds, up to 5 minutes (30 attempts), based on the
rem ~50 second observed Docker Desktop startup time from manual testing.
set "DOCKER_WAIT_ATTEMPTS=0"
set "DOCKER_WAIT_MAX=30"

:docker_wait_loop
rem "timeout" reads from console input and fails ("Input redirection is not
rem supported") when stdin is redirected/non-interactive (Task Scheduler,
rem or any non-console launch), which then corrupts this script's own
rem goto/label resolution. Use ping as a stdin-free ~10 second delay instead.
ping -n 11 127.0.0.1 >nul
set /a DOCKER_WAIT_ATTEMPTS+=1
docker info >nul 2>&1
if "!ERRORLEVEL!"=="0" goto docker_ready
if !DOCKER_WAIT_ATTEMPTS! GEQ !DOCKER_WAIT_MAX! goto docker_wait_timeout
goto docker_wait_loop

:docker_wait_timeout
rem Distinguish "still starting (slow)" from "crashed" by checking whether
rem the Docker Desktop.exe process itself is still alive.
tasklist /FI "IMAGENAME eq Docker Desktop.exe" 2>nul | find /I "Docker Desktop.exe" >nul
if "!ERRORLEVEL!"=="0" goto docker_wait_timeout_slow
call :log "WARNING: Docker Desktop did not become ready within 5 minutes, and Docker Desktop.exe is NOT running (possible crash). Skipping ArchitectAI startup."
goto architect_ai_skip

:docker_wait_timeout_slow
call :log "WARNING: Docker Desktop did not become ready within 5 minutes, but Docker Desktop.exe is still running (startup appears delayed, not crashed). Skipping ArchitectAI startup."
goto architect_ai_skip

:docker_ready
call :log "Docker Desktop is ready (docker info succeeded)."
cd /d C:\Users\okina\architect-ai
docker compose up -d >nul 2>&1
if "!ERRORLEVEL!"=="0" goto architect_ai_started
call :log "WARNING: docker compose up -d failed for ArchitectAI (exit code !ERRORLEVEL!)."
goto architect_ai_done

:architect_ai_started
call :log "ArchitectAI containers started successfully (docker compose up -d)."
goto architect_ai_done

:architect_ai_skip
goto architect_ai_done

:architect_ai_done
cd /d C:\Users\okina\it-news-app

exit /b 0

:log
rem Append a timestamped line to the log file, since this runs unattended
rem and we need to be able to trace back the reasoning later.
powershell -NoProfile -Command "Add-Content -Path '%LOG_FILE%' -Value ('[' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '] ' + '%~1')"
exit /b 0
