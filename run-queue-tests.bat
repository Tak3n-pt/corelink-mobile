@echo off
echo ========================================
echo Queue System Testing Suite
echo ========================================
echo.

echo What would you like to do?
echo.
echo 1. Rebuild Android App (with network fixes)
echo 2. Start Desktop Simulator
echo 3. Run Test Controller
echo 4. Run All Tests (automated)
echo 5. Check Cloud Server Status
echo 6. Exit
echo.

set /p choice="Enter your choice (1-6): "

if "%choice%"=="1" goto rebuild
if "%choice%"=="2" goto simulator
if "%choice%"=="3" goto controller
if "%choice%"=="4" goto autotest
if "%choice%"=="5" goto checkcloud
if "%choice%"=="6" exit /b 0

echo Invalid choice!
pause
exit /b 1

:rebuild
echo.
echo ========================================
echo Rebuilding Android App
echo ========================================
call rebuild-android.bat
goto end

:simulator
echo.
echo ========================================
echo Starting Desktop Simulator
echo ========================================
echo.
echo This will simulate the desktop server for testing.
echo Use Ctrl+C to stop it.
echo.
start cmd /k "node test-desktop-simulator.js"
echo Desktop simulator started in new window.
pause
goto end

:controller
echo.
echo ========================================
echo Starting Test Controller
echo ========================================
echo.
echo Use this to control the desktop simulator (online/offline).
echo.
node test-queue-control.js
goto end

:autotest
echo.
echo ========================================
echo Running Automated Tests
echo ========================================
echo.
echo Starting desktop simulator...
start cmd /k "node test-desktop-simulator.js"
timeout /t 3 /nobreak > nul

echo.
echo Testing cloud server connectivity...
node test-cloud-connectivity.js

echo.
echo ========================================
echo Manual Testing Required
echo ========================================
echo.
echo The desktop simulator is running.
echo.
echo Now please:
echo 1. Open the mobile app
echo 2. Try scanning an invoice
echo 3. Use the test controller to simulate offline/online
echo.
echo Would you like to open the test controller now? (Y/N)
set /p opencontrol=
if /i "%opencontrol%"=="Y" node test-queue-control.js
goto end

:checkcloud
echo.
echo ========================================
echo Checking Cloud Server Status
echo ========================================
node test-cloud-connectivity.js
pause
goto end

:end
echo.
echo ========================================
echo Test Complete
echo ========================================
echo.
echo Check TEST_QUEUE_SYSTEM.md for detailed test instructions.
echo.
pause