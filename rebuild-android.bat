@echo off
echo ========================================
echo Rebuilding Android App with Network Fixes
echo ========================================
echo.

echo Step 1: Cleaning Android build...
cd android
call gradlew.bat clean
if %errorlevel% neq 0 (
    echo Error cleaning build. Continuing anyway...
)

echo.
echo Step 2: Going back to project root...
cd ..

echo.
echo Step 3: Running expo prebuild to regenerate native files...
call npx expo prebuild --clear
if %errorlevel% neq 0 (
    echo Error with prebuild. Check your configuration.
    pause
    exit /b 1
)

echo.
echo Step 4: Building Android app...
call npx expo run:android
if %errorlevel% neq 0 (
    echo.
    echo ========================================
    echo Build failed! 
    echo ========================================
    echo.
    echo If you see "No Android connected", please:
    echo 1. Connect your Android device via USB
    echo 2. Enable USB debugging in Developer Options
    echo 3. OR start an Android emulator
    echo.
    echo Then run this script again.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Build completed successfully!
echo ========================================
echo.
echo The app should now be installed on your device/emulator.
echo.
pause