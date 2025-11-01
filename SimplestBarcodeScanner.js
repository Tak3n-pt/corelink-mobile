import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Camera } from 'expo-camera';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');

/**
 * SIMPLEST BARCODE SCANNER - GUARANTEED TO WORK
 * Uses the most basic expo-camera setup with minimal configuration
 */
const SimplestBarcodeScanner = ({
  visible,
  onClose,
  onBarcodeDetected
}) => {
  const { t } = useTranslation();
  const [hasPermission, setHasPermission] = useState(null);
  const [isScanning, setIsScanning] = useState(true);
  const [scannedData, setScannedData] = useState(null);
  const lastScanRef = useRef(0);

  // Request permission
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
      } catch (error) {
        console.error('Permission error:', error);
        setHasPermission(false);
      }
    })();
  }, []);

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setIsScanning(true);
      setScannedData(null);
      lastScanRef.current = 0;
    }
  }, [visible]);

  // Handle barcode scan
  const handleBarcodeScanned = ({ type, data }) => {
    const now = Date.now();
    
    // Simple debouncing - 1 second
    if (now - lastScanRef.current < 1000) {
      return;
    }
    lastScanRef.current = now;

    console.log('✅ Barcode scanned:', data);
    
    setScannedData(data);
    setIsScanning(false);

    // Call parent callback
    if (onBarcodeDetected) {
      onBarcodeDetected(data);
    }
  };

  // Reset for new scan
  const resetScanner = () => {
    setIsScanning(true);
    setScannedData(null);
    lastScanRef.current = 0;
  };

  // Handle close
  const handleClose = () => {
    setIsScanning(false);
    onClose();
  };

  // Loading state
  if (hasPermission === null) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#00ff00" />
          <Text style={styles.loadingText}>Starting camera...</Text>
        </View>
      </Modal>
    );
  }

  // Permission denied
  if (hasPermission === false) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>📷 Camera permission required</Text>
          <Text style={styles.infoText}>
            Please grant camera permission in settings to scan barcodes
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleClose}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreenModal">
      <View style={styles.container}>
        {/* SIMPLEST POSSIBLE CAMERA SETUP */}
        <Camera
          style={styles.camera}
          onBarCodeScanned={isScanning ? handleBarcodeScanned : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Barcode Scanner</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Scan Frame */}
          <View style={styles.scanArea}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            
            <Text style={styles.instruction}>
              {scannedData ? t('barcode.detected') : t('barcode.pointCamera')}
            </Text>
          </View>

          {/* Bottom Status */}
          <View style={styles.bottomContainer}>
            {scannedData ? (
              <View style={styles.resultContainer}>
                <Text style={styles.successText}>Scanned: {scannedData}</Text>
                <View style={styles.buttonRow}>
                  <TouchableOpacity style={styles.scanButton} onPress={resetScanner}>
                    <Text style={styles.scanButtonText}>Scan Another</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.doneButton} onPress={handleClose}>
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.statusContainer}>
                <ActivityIndicator size="small" color="#00ff00" />
                <Text style={styles.statusText}>Ready to scan...</Text>
              </View>
            )}
          </View>
        </Camera>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  camera: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingBottom: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scanArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: Math.min(width * 0.8, 280),
    height: 180,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 25,
    height: 25,
    borderColor: '#00ff00',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },
  instruction: {
    color: '#fff',
    fontSize: 16,
    marginTop: 25,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bottomContainer: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingVertical: 25,
    paddingHorizontal: 20,
  },
  resultContainer: {
    alignItems: 'center',
  },
  successText: {
    color: '#00ff00',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 15,
  },
  scanButton: {
    backgroundColor: '#00ff00',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  scanButtonText: {
    color: '#000',
    fontWeight: 'bold',
  },
  doneButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  doneButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 15,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  infoText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 30,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SimplestBarcodeScanner;