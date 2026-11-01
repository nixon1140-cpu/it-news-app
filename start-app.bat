@echo off
setlocal enabledelayedexpansion

rem Move to the app folder (path is hardcoded based on past troubleshooting).
cd C:\Users\okina\it-news-app

rem State/log folder. (The old last_boot_marker.txt is no longer used; it is left in place.)
set "STATE_DIR=%LOCALAPPDATA%\it-news-app"
set "LOG_FILE=%STATE_DIR%\start-app.log"
set "CHECK_OUT=%STATE_DIR%\crawl-check.out"

if not exist "%STATE_DIR%" mkdir "%STATE_DIR%"

rem Decide whether to run the crawler this time.
rem The decision is made by "crawl:check" (src/scripts/crawl-check.ts), which looks at the crawl_runs table:
rem   exit 0  = run (no successful crawl within the last 12 hours, and none running)
rem   exit 10 = skip (a crawl succeeded within 12 hours, or one is running)
rem   other   = the check itself failed; skip as a safe default (same policy as before)
set "RUN_CRAWLER=0"
set "REASON="
set "CHECK_LINE="

call :log "Checking whether to crawl (crawl_runs: success within 12h?)"
call npx tsx src/scripts/crawl-check.ts > "%CHECK_OUT%" 2>&1
set "CHECK_CODE=!ERRORLEVEL!"
if exist "%CHECK_OUT%" for /f "usebackq delims=" %%L in ("%CHECK_OUT%") do set "CHECK_LINE=%%L"
call :log "crawl:check exit code=!CHECK_CODE! / !CHECK_LINE!"

if "!CHECK_CODE!"=="0" goto decision_run
if "!CHECK_CODE!"=="10" goto decision_skip
goto decision_check_failed

:decision_run
set "RUN_CRAWLER=1"
set "REASON=No successful crawl within 12 hours and none running"
goto decision_done

:decision_skip
set "RUN_CRAWLER=0"
set "REASON=Successful crawl within 12 hours, or a crawl is already running"
goto decision_done

:decision_check_failed
set "RUN_CRAWLER=0"
set "REASON=crawl:check failed (exit code !CHECK_CODE!), skipping crawler as a safe default"
call :log "WARNING: !REASON!"
goto decision_done

:decision_done
call :log "Decision: RUN_CRAWLER=!RUN_CRAWLER! / Reason: !REASON!"

if "!RUN_CRAWLER!"=="1" goto run_crawler
goto skip_crawler

:run_crawler
echo Collecting IT News...
rem 0. Wait for Ollama (up to 120 s, 5 s steps) so the crawler does not start before it is up.
rem ping is used as a stdin-free delay (see notes below). Never blocks more than 120 s;
rem if Ollama stays down the crawler itself reports the error and the app still starts.
set "OLLAMA_WAIT_ATTEMPTS=0"

:ollama_wait_loop
curl -s -m 3 -o nul http://127.0.0.1:11434/api/version >nul 2>&1
if "!ERRORLEVEL!"=="0" goto ollama_ready
set /a OLLAMA_WAIT_ATTEMPTS+=1
if !OLLAMA_WAIT_ATTEMPTS! GEQ 24 goto ollama_wait_timeout
ping -n 6 127.0.0.1 >nul
goto ollama_wait_loop

:ollama_wait_timeout
call :log "WARNING: Ollama did not respond within 120 seconds. Continuing; the crawler will report the failure."
goto ollama_wait_done

:ollama_ready
call :log "Ollama is ready (waited !OLLAMA_WAIT_ATTEMPTS! checks)."

:ollama_wait_done
rem 1. Run the crawler to fetch the latest news (wait for completion).
call npm run crawl
call :log "Crawler executed."

goto after_crawler

:skip_crawler
echo Skipping crawler (recent success or already running)...
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
