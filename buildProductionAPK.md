# Building Production APK for Universal Installation

## Prerequisites Completed:
✅ Cloud Invoice Server: Working (https://invoice-processor-dot-my-invoice-server-2025.uc.r.appspot.com)
✅ Local Desktop Server: Working (when on same network)
✅ Smart Network Configuration: Implemented

## Step 1: Generate Keystore (One-time setup)
```bash
cd android/app
keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

Password: Choose a secure password (e.g., MyApp2025Secure!)
Remember this password - you'll need it for all future releases!

## Step 2: Configure Gradle for Signing
Add to `android/gradle.properties`:
```
MYAPP_RELEASE_STORE_FILE=my-release-key.keystore
MYAPP_RELEASE_KEY_ALIAS=my-key-alias
MYAPP_RELEASE_STORE_PASSWORD=YourPasswordHere
MYAPP_RELEASE_KEY_PASSWORD=YourPasswordHere
```

## Step 3: Build Release APK
```bash
cd "C:\Users\3440\Desktop\finalrezlt - Copy (3) - Copy\my-app-new"
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res
cd android
./gradlew assembleRelease
```

## Step 4: APK Location
Your signed APK will be at:
`android/app/build/outputs/apk/release/app-release.apk`

## Step 5: Install on Any Phone
1. Copy the APK to the phone
2. Enable "Install from Unknown Sources" in Settings
3. Install the APK
4. The app will automatically:
   - Use local servers when in-store
   - Use cloud servers when outside
   - Work offline with cached data

## Features Included:
- ✅ Barcode scanning (ML Kit)
- ✅ Invoice processing (Cloud AI)
- ✅ Inventory management
- ✅ Multi-language support (English, French, Arabic)
- ✅ Smart network switching
- ✅ Offline capability