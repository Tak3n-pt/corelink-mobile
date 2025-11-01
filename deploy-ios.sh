#!/bin/bash

echo "🍎 CoreLink iOS Deployment Script"
echo "================================="
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "⚠️  Warning: iOS builds work best on macOS"
    echo "   Using EAS Build for cloud-based building..."
    echo ""
fi

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "📦 Installing EAS CLI..."
    npm install -g eas-cli
fi

# Check if logged in to EAS
echo "🔐 Checking EAS login status..."
if ! eas whoami &> /dev/null; then
    echo "Please login to your Expo account:"
    eas login
fi

# Select build profile
echo ""
echo "📱 Select build profile:"
echo "1) Development (for testing)"
echo "2) Preview (internal distribution)"
echo "3) Production (App Store)"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        profile="development"
        echo "🔨 Building for development..."
        ;;
    2)
        profile="preview"
        echo "🔨 Building for preview..."
        ;;
    3)
        profile="production"
        echo "🔨 Building for production..."
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

# Run prebuild if on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo ""
    echo "🔧 Generating iOS native project..."
    npx expo prebuild --platform ios --clean
    
    echo ""
    echo "📦 Installing CocoaPods dependencies..."
    cd ios && pod install && cd ..
fi

# Start the build
echo ""
echo "🚀 Starting iOS build..."
eas build --platform ios --profile $profile

echo ""
echo "✅ Build submitted successfully!"
echo ""
echo "📱 Next steps:"
echo "1. Wait for build to complete (you'll receive an email)"
echo "2. Download the build from Expo dashboard"
echo "3. Test on device using TestFlight (for preview/production)"
echo "4. Submit to App Store (for production builds)"
echo ""
echo "For more details, see iOS_DEPLOYMENT_GUIDE.md"