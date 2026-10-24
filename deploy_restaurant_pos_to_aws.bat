@echo off
setlocal EnableExtensions

REM ============================================================
REM Restaurant POS deployment to the existing AWS EC2 Ubuntu host
REM Edit EC2_HOST or KEY_PATH below if your instance/key changes.
REM This deploys the GitHub master branch to the existing server.
REM ============================================================

set "EC2_HOST=16.192.165.13"
set "SSH_USER=ubuntu"
set "KEY_PATH=%USERPROFILE%\.ssh\restaurant-pos-poc-key.pem"

title Restaurant POS - AWS Deployment

echo.
echo ============================================================
echo  Restaurant POS deployment
echo  Server: %SSH_USER%@%EC2_HOST%
echo  Repository: /home/ubuntu/apps/restaurant-pos-mern
echo  Branch: master
echo ============================================================
echo.

where ssh >nul 2>&1
if errorlevel 1 (
    echo ERROR: OpenSSH client was not found.
    echo Install it in Windows Settings - Optional features - OpenSSH Client.
    goto :fail
)

if not exist "%KEY_PATH%" (
    echo ERROR: SSH private key was not found:
    echo %KEY_PATH%
    echo.
    echo Update KEY_PATH in this .bat file to the actual local .pem path.
    goto :fail
)

echo Checking SSH connectivity to %EC2_HOST% on port 22...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$r = Test-NetConnection -ComputerName '%EC2_HOST%' -Port 22 -WarningAction SilentlyContinue; if (-not $r.TcpTestSucceeded) { exit 1 }"
if errorlevel 1 (
    echo.
    echo ERROR: Port 22 is unreachable. Deployment was not started.
    echo Check the EC2 public IP, instance status, route table, and
    echo security-group inbound SSH rule for your current public IP /32.
    goto :fail
)

echo.
echo Starting remote deployment. Do not close this window.
echo You may be prompted to trust the SSH host key or enter a sudo password.
echo.

ssh -tt -i "%KEY_PATH%" -o IdentitiesOnly=yes -o ConnectTimeout=15 %SSH_USER%@%EC2_HOST% "bash -lc 'set -e; cd /home/ubuntu/apps/restaurant-pos-mern; echo === Pull latest master ===; git pull --ff-only origin master; echo === Install backend dependencies ===; cd apps/backend; npm ci; echo === Restart backend ===; pm2 restart restaurant-pos-api; echo === Build frontend ===; cd ../web; npm ci; npm run build; test -d dist; echo === Publish frontend ===; sudo cp -r dist/. /var/www/restaurant-pos/; echo === Validate and reload Nginx ===; sudo nginx -t; sudo systemctl reload nginx; echo === PM2 status ===; pm2 status; echo === Direct backend health ===; curl -fsS http://127.0.0.1:8001/api/health; echo; echo === Nginx API health ===; curl -fsS http://127.0.0.1/api/health; echo; echo DEPLOYMENT_COMPLETED_SUCCESSFULLY'"

set "DEPLOY_EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%DEPLOY_EXIT_CODE%"=="0" (
    echo ERROR: Deployment failed with exit code %DEPLOY_EXIT_CODE%.
    echo Review the command output above. The script stops on the first failed remote command.
    goto :fail
)

echo Deployment completed successfully.
echo Check the website in your browser and test login, orders, KOT, and billing.
goto :done

:fail
echo.
echo Deployment did not complete. Fix the reported issue and run this file again.
:done
echo.
pause
endlocal
