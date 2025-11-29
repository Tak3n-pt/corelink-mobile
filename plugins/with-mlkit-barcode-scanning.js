// Minimal no-op config plugin to satisfy Expo config plugin resolution
// Keeps ML Kit barcode scanning in the project without removing it
const { createRunOncePlugin } = require('@expo/config-plugins');

function withMlkitBarcodeScanning(config) {
  return config; // no-op; native modules autolink via CocoaPods during prebuild
}

module.exports = createRunOncePlugin(
  withMlkitBarcodeScanning,
  'with-mlkit-barcode-scanning',
  '1.0.0'
);

