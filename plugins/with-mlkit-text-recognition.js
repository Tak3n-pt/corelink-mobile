// Minimal no-op config plugin to satisfy Expo config plugin resolution
// Keeps ML Kit text recognition in the project without removing it
const { createRunOncePlugin } = require('@expo/config-plugins');

function withMlkitTextRecognition(config) {
  return config; // no-op; native modules autolink via CocoaPods during prebuild
}

module.exports = createRunOncePlugin(
  withMlkitTextRecognition,
  'with-mlkit-text-recognition',
  '1.0.0'
);

