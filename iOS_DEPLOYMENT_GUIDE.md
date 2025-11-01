# CoreLink iOS Deployment Guide

## ✅ Pre-Deployment Checklist

The app has been fully configured and is ready for iOS deployment. All necessary configurations have been set up:

### 1. Configuration Files Ready
- ✅ `app.json` - Fully configured with iOS settings
- ✅ `eas.json` - EAS Build configuration for iOS
- ✅ `package.json` - All dependencies installed
- ✅ `ios.podfile.properties.json` - iOS build properties

### 2. iOS-Specific Settings Configured
- ✅ Bundle Identifier: `com.corelink.inventory`
- ✅ App Name: CoreLink
- ✅ Version: 1.0.0
- ✅ Build Number: 1
- ✅ All required permissions configured

### 3. Permissions Configured
- ✅ Camera access for barcode scanning
- ✅ Photo library access for invoice images
- ✅ Local network access for server connection
- ✅ Location access for server discovery

## 📱 Required for iOS Deployment

### Prerequisites (You Need to Provide)
1. **Apple Developer Account** ($99/year)
   - Sign up at: https://developer.apple.com/programs/

2. **Apple ID Credentials**
   - Update in `eas.json`:
     - `appleId`: Your Apple ID email
     - `ascAppId`: App Store Connect App ID
     - `appleTeamId`: Your Apple Team ID

3. **macOS System** (for local builds)
   - Xcode 14.0 or later
   - CocoaPods installed

## 🚀 Deployment Steps

### Option 1: Deploy Using EAS Build (Recommended - No Mac Required)

1. **Install EAS CLI** (if not already installed):
   ```bash
   npm install -g eas-cli
   ```

2. **Login to EAS**:
   ```bash
   eas login
   ```

3. **Configure your Apple credentials**:
   ```bash
   eas credentials
   ```
   - Select iOS
   - Follow prompts to set up certificates and provisioning profiles

4. **Build for iOS**:
   ```bash
   # For development/testing
   eas build --platform ios --profile development

   # For App Store submission
   eas build --platform ios --profile production
   ```

5. **Submit to App Store**:
   ```bash
   eas submit --platform ios
   ```

### Option 2: Local Build on macOS

1. **Generate iOS native project** (on macOS):
   ```bash
   cd my-app-new
   npx expo prebuild --platform ios
   ```

2. **Install iOS dependencies**:
   ```bash
   cd ios
   pod install
   ```

3. **Open in Xcode**:
   ```bash
   open CoreLink.xcworkspace
   ```

4. **Configure in Xcode**:
   - Select your team in Signing & Capabilities
   - Verify bundle identifier matches `com.corelink.inventory`
   - Check all capabilities are enabled

5. **Build and Archive**:
   - Select "Any iOS Device" as target
   - Product → Archive
   - Distribute App → App Store Connect

## 📝 App Store Submission Checklist

### Required Information
- [ ] App Name: CoreLink
- [ ] App Description (prepared below)
- [ ] Keywords: inventory, barcode, scanner, invoice, management
- [ ] Category: Business or Productivity
- [ ] Screenshots (5.5" and 6.5" iPhone, 12.9" iPad)
- [ ] App Icon (1024x1024)
- [ ] Privacy Policy URL
- [ ] Support URL

### Suggested App Store Description

**Title**: CoreLink - Inventory Scanner

**Subtitle**: Smart Inventory Management

**Description**:
CoreLink is a powerful mobile companion app for inventory management systems. Seamlessly scan barcodes, process invoices, and manage your inventory on the go.

**Key Features:**
• Fast barcode scanning with ML Kit technology
• Invoice processing with OCR extraction
• Real-time inventory synchronization
• Offline mode with automatic sync
• Multi-language support
• Secure local network connection

Perfect for retail stores, warehouses, and businesses needing mobile inventory management.

### Privacy Policy Template
```
CoreLink Privacy Policy

Last updated: [Date]

CoreLink ("we", "our", or "us") respects your privacy. This policy describes how we handle your information.

Information We Collect:
- Camera access for barcode scanning
- Photo library access for invoice processing
- Local network information for server connection

How We Use Information:
- Process inventory transactions
- Connect to your local inventory server
- Improve app functionality

Data Storage:
- All data is stored locally or on your own server
- We do not collect or store personal data on our servers

Contact: [Your contact information]
```

## 🔧 Troubleshooting

### Common Issues

1. **Build fails with "No provisioning profile"**
   - Run `eas credentials` and let EAS manage certificates

2. **Camera not working**
   - Verify Info.plist permissions are set
   - Test on real device (simulator has no camera)

3. **Network connection issues**
   - Ensure local network permission is granted
   - Check server is accessible from device

## 📊 Testing Checklist

Before submission, test these features:

- [ ] Barcode scanning works on real device
- [ ] Invoice image capture and upload
- [ ] Server connection and data sync
- [ ] Offline mode and queue system
- [ ] All UI elements display correctly
- [ ] App works on various iPhone sizes
- [ ] iPad compatibility (if enabled)

## 🎯 Next Steps

1. **Update Apple credentials** in `eas.json`
2. **Run EAS build** command for iOS
3. **Test on TestFlight** before App Store submission
4. **Submit for App Store review**

## 📞 Support

For backend server issues, check:
- Backend server is running
- IP address is correctly configured
- Bearer token is valid

The app is now fully configured and ready for iOS deployment. All you need to do is provide your Apple Developer credentials and run the build commands!