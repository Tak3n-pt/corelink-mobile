import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Animated,
  Easing
} from 'react-native';
import { Haptics } from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import {
  Camera,
  useCameraDevice,
  useCameraPermission
} from 'react-native-vision-camera';

const { width, height } = Dimensions.get('window');

const VisionCameraLiveScannerMLKit = ({
  visible,
  onClose,
  onBarcodeDetected,
  onTextDetected,
  BarcodeScanning,
  TextRecognition
}) => {
  const { t, i18n } = useTranslation();
  const { hasPermission, requestPermission } = useCameraPermission();
  
  const [isActive, setIsActive] = useState(false);
  const [scanStatus, setScanStatus] = useState('Initializing...');
  const [lastBarcode, setLastBarcode] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanInterval, setScanInterval] = useState(null);
  const [scanIntervalTime, setScanIntervalTime] = useState(1500); // Dynamic interval
  
  const device = useCameraDevice('back');
  const cameraRef = useRef(null);
  const lastProcessedTime = useRef(0);

  // Animation values
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const frameGlowAnim = useRef(new Animated.Value(0)).current;
  const statusOpacityAnim = useRef(new Animated.Value(0)).current;

  // Performance monitoring
  const successfulScans = useRef(0);
  const totalScans = useRef(0);
  const performanceCheckInterval = useRef(null);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission]);

  // Performance-based interval adjustment
  useEffect(() => {
    if (visible) {
      performanceCheckInterval.current = setInterval(() => {
        const successRate = totalScans.current > 0 ? successfulScans.current / totalScans.current : 0;
        
        // Adjust scan interval based on success rate
        if (successRate > 0.8) {
          // High success rate - can scan faster
          setScanIntervalTime(1200);
        } else if (successRate > 0.5) {
          // Medium success rate - normal speed
          setScanIntervalTime(1500);
        } else if (successRate > 0.2) {
          // Lower success rate - scan slower for better quality
          setScanIntervalTime(2000);
        } else {
          // Very low success - much slower
          setScanIntervalTime(2500);
        }
        
        // Reset counters every check
        successfulScans.current = 0;
        totalScans.current = 0;
      }, 10000); // Check every 10 seconds
    }

    return () => {
      if (performanceCheckInterval.current) {
        clearInterval(performanceCheckInterval.current);
      }
    };
  }, [visible]);

  // Start animations when scanner opens
  useEffect(() => {
    if (visible) {
      // Fade in status
      Animated.timing(statusOpacityAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

      // Start scan line animation
      const scanAnimation = Animated.loop(
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      scanAnimation.start();

      return () => {
        scanAnimation.stop();
        scanLineAnim.setValue(0);
        statusOpacityAnim.setValue(0);
      };
    }
  }, [visible, i18n.language]);

  useEffect(() => {
    console.log('📊 Camera state change: visible=' + visible + ' permission=' + hasPermission + ' device=' + !!device);
    if (visible && hasPermission && device) {
      console.log('✅ Activating camera and starting scan...');
      // Reset all state when opening
      setLastBarcode(null);
      setIsProcessing(false);
      setScanStatus('Initializing camera...');
      
      // Small delay to ensure modal is fully rendered and camera is ready
      setTimeout(() => {
        setIsActive(true);
        setScanStatus('Camera ready - point at barcode...');
      }, 300);
    } else {
      console.log('❌ Deactivating camera: visible=' + visible + ' permission=' + hasPermission + ' device=' + !!device);
      setIsActive(false);
      stopContinuousScanning();
      // Reset all scanning state
      setLastBarcode(null);
      setIsProcessing(false);
      setScanStatus('Camera stopped');
    }

    return () => {
      console.log('🧹 Camera cleanup');
      setIsActive(false);
      stopContinuousScanning();
    };
  }, [visible, hasPermission, device]);

  // Start continuous scanning
  const startContinuousScanning = () => {
    console.log('🎬 startContinuousScanning called, current interval:', !!scanInterval);
    if (scanInterval) {
      console.log('⚠️ Scanning already active, skipping...');
      return;
    }
    
    console.log('🚀 Starting continuous scanning with interval:', scanIntervalTime);
    const interval = setInterval(async () => {
      console.log('🔍 Scan check: camera=' + !!cameraRef.current + ' processing=' + isProcessing + ' active=' + isActive);
      if (cameraRef.current && !isProcessing && isActive) {
        console.log('📸 Auto scanning...');
        await performScan();
      } else {
        console.log('⏭️ Scan skipped - conditions not met');
      }
    }, scanIntervalTime); // Dynamic interval based on performance
    
    setScanInterval(interval);
  };

  // Stop continuous scanning
  const stopContinuousScanning = () => {
    console.log('🛑 stopContinuousScanning called, current interval:', !!scanInterval);
    if (scanInterval) {
      console.log('🔄 Clearing scan interval...');
      clearInterval(scanInterval);
      setScanInterval(null);
    }
  };

  // Perform a single scan
  const performScan = async () => {
    if (!cameraRef.current || isProcessing) {
      console.log('❌ Scan blocked: camera=' + !!cameraRef.current + ' processing=' + isProcessing);
      return;
    }
    
    const now = Date.now();
    if (now - lastProcessedTime.current < 1000) return; // More conservative debouncing
    lastProcessedTime.current = now;
    
    console.log('🔍 Starting scan...');
    setIsProcessing(true);
    setScanStatus('Scanning...');
    totalScans.current++; // Track scan attempts
    
    try {
      // Check if camera is still active before taking photo
      if (!isActive || !cameraRef.current) {
        setScanStatus('Camera not ready, retrying...');
        return;
      }
      
      // Take a photo for ML Kit processing
      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: 'speed',
        enableAutoRedEyeReduction: false,
        enableAutoStabilization: false,  // Disable for faster capture
        flash: 'off'  // Ensure flash is off for speed
      });
      
      if (photo.path) {
        // Convert path to proper URI format
        const imageUri = Platform.OS === 'android' 
          ? `file://${photo.path}`
          : photo.path;
        
        // BARCODE ONLY - Simple and fast
        if (BarcodeScanning && BarcodeScanning.scan) {
          try {
            const barcodes = await BarcodeScanning.scan(imageUri);
            
            if (barcodes && barcodes.length > 0) {
              const barcode = barcodes[0];
              if (barcode.value && barcode.value !== lastBarcode) {
                setLastBarcode(barcode.value);
                setScanStatus(`Found: ${barcode.value}`);
                successfulScans.current++; // Track successful scans
                
                // Success animations and feedback
                Animated.sequence([
                  Animated.timing(frameGlowAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: false,
                  }),
                  Animated.timing(frameGlowAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: false,
                  }),
                ]).start();

                // Haptic feedback
                try {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch (error) {
                  console.log('Haptic feedback not available');
                }
                
                if (onBarcodeDetected) {
                  onBarcodeDetected(barcode.value);
                  // DON'T return here - let finally block run
                }
              }
            } else {
              setScanStatus('Scanning...');
            }
          } catch (error) {
            console.error('Barcode error:', error);
            setScanStatus('Scan error');
          }
        } else {
          setScanStatus('Scanner not available');
        }
      }
    } catch (error) {
      console.error('Scan error:', error);
      if (error.message && (error.message.includes('Camera is closed') || error.message.includes('ViewNotFoundError') || error.message.includes('view (ID') || error.message.includes('was not found'))) {
        console.log('🚨 Camera view error - stopping scanning temporarily...');
        setScanStatus('Camera error, retrying...');
        // Stop scanning and restart after a delay
        stopContinuousScanning();
        setTimeout(() => {
          console.log('🔄 Restarting scanning after camera error...');
          if (isActive && visible) {
            startContinuousScanning();
          }
        }, 2000);
      } else {
        setScanStatus('Scan failed, retrying...');
      }
    } finally {
      setIsProcessing(false);
    }
  };



  if (!device) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.container}>
          <Text style={styles.errorText}>No camera device found</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  if (!hasPermission) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.container}>
          <Text style={styles.errorText}>Camera permission required</Text>
          <TouchableOpacity 
            style={styles.button} 
            onPress={requestPermission}
          >
            <Text style={styles.buttonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        {device && (
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isActive}
            photo={true}
            enableZoomGesture={true}
            onStarted={() => {
              console.log('📹 Camera started - ready for scanning!');
              console.log('🎥 Camera ref available:', !!cameraRef.current);
              // Start scanning when camera is truly ready
              setTimeout(() => {
                console.log('⚡ Starting scanning with camera ref:', !!cameraRef.current);
                startContinuousScanning();
              }, 500);
            }}
            onError={(error) => {
              console.log('❌ Camera error:', error);
              setScanStatus('Camera error - retrying...');
              // Reset and retry after error
              setIsActive(false);
              setTimeout(() => {
                if (visible) {
                  console.log('🔄 Recovering from camera error...');
                  setIsActive(true);
                  setScanStatus('Camera recovered - ready to scan');
                }
              }, 1000);
            }}
          />
        )}
        
        {/* Gradient Overlay for Better Depth */}
        <View style={styles.gradientOverlay}>
          <View style={styles.gradientTop} />
          <View style={styles.gradientBottom} />
        </View>

        {/* Scan Frame Overlay */}
        <View style={styles.overlay}>
          <Animated.View 
            style={[
              styles.scanFrame,
              {
                shadowOpacity: frameGlowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 0.8],
                }),
                shadowRadius: frameGlowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 25],
                }),
              }
            ]}
          >
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            
            {/* Animated Scan Line */}
            <Animated.View
              style={[
                styles.scanLine,
                {
                  transform: [
                    {
                      translateY: scanLineAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, height * 0.3],
                      }),
                    },
                  ],
                },
              ]}
            />
          </Animated.View>
        </View>

        {/* Glass-morphism Status Display */}
        <Animated.View 
          style={[
            styles.statusContainer,
            {
              opacity: statusOpacityAnim,
            }
          ]}
        >
          <Text style={styles.statusText}>{scanStatus}</Text>
          {isProcessing && <ActivityIndicator color="#4CAF50" size="small" />}
        </Animated.View>

        {/* Control Buttons */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>
              {i18n.language === 'ar' ? 'إغلاق الماسح' : 
               i18n.language === 'fr' ? 'Fermer le Scanner' : 
               'Close Scanner'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: width * 0.8,
    height: height * 0.3,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 20,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    position: 'relative',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#4CAF50',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 20,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 20,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 20,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 20,
  },
  statusContainer: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  modeText: {
    color: '#4CAF50',
    fontSize: 14,
    marginBottom: 3,
  },
  mlkitText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  closeButton: {
    backgroundColor: '#f44336',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#f44336',
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 20,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 10,
  },
});

export default VisionCameraLiveScannerMLKit;