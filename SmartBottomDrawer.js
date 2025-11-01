import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  StyleSheet,
  Platform,
  Easing,
} from 'react-native';
import { useTranslation } from 'react-i18next';

const { height: screenHeight } = Dimensions.get('window');
const DRAWER_HEIGHT = 280; // Increased height for 3 buttons
const COLLAPSED_HEIGHT = 90; // Slightly reduced for cleaner look

const SmartBottomDrawer = ({
  onInvoiceAnalysis,
  onProductSelling,
  onGalleryPicker,
  isProcessing,
  nativeScannerReady = true, // Replaced mlKitStatus
  onExpandChange,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const animatedHeight = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const toggleDrawer = () => {
    const toValue = isExpanded ? COLLAPSED_HEIGHT : DRAWER_HEIGHT;
    
    Animated.timing(animatedHeight, {
      toValue,
      duration: 300,
      useNativeDriver: false,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    }).start();
    
    const newState = !isExpanded;
    setIsExpanded(newState);
    if (onExpandChange) {
      onExpandChange(newState);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderGrant: (evt, gestureState) => {
        translateY.setOffset(translateY._value);
      },
      onPanResponderMove: (evt, gestureState) => {
        translateY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (evt, gestureState) => {
        translateY.flattenOffset();
        
        // If dragged up significantly, expand
        if (gestureState.dy < -30 && !isExpanded) {
          toggleDrawer();
        }
        // If dragged down significantly, collapse  
        else if (gestureState.dy > 30 && isExpanded) {
          toggleDrawer();
        }
        
        // Reset translation
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
          easing: require('react-native').Easing.out(require('react-native').Easing.quad),
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View style={[styles.drawer, { height: animatedHeight, transform: [{ translateY }] }]}>
      <View style={styles.handle} {...panResponder.panHandlers}>
        <TouchableOpacity 
          style={styles.handleButton} 
          onPress={toggleDrawer}
          activeOpacity={0.7}
        >
          <View style={styles.handleBar} />
          <Text style={styles.handleText}>
            {isExpanded ? t('drawer.collapse') : t('drawer.quickActions')}
          </Text>
        </TouchableOpacity>
      </View>

      {isExpanded && (
        <View style={styles.drawerContent}>
          <TouchableOpacity 
            style={[styles.drawerButton, styles.invoiceButton, isProcessing && styles.disabledButton]}
            onPress={onInvoiceAnalysis}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            <Text style={styles.drawerButtonIcon}>📄</Text>
            <Text style={styles.drawerButtonText}>{t('drawer.invoice')}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.drawerButton, styles.galleryButton, isProcessing && styles.disabledButton]}
            onPress={onGalleryPicker}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            <Text style={styles.drawerButtonIcon}>📷</Text>
            <Text style={styles.drawerButtonText}>{t('drawer.gallery')}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.drawerButton, styles.sellButton, isProcessing && styles.disabledButton]}
            onPress={onProductSelling}
            disabled={isProcessing || !nativeScannerReady}
            activeOpacity={0.8}
          >
            <Text style={styles.drawerButtonIcon}>🔍</Text>
            <Text style={styles.drawerButtonText}>{t('drawer.sell')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 15 : 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  handle: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handleButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginBottom: 8,
  },
  handleText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  drawerContent: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 30, // Increased padding for Android
    paddingTop: 10,
    justifyContent: 'space-between',
  },
  drawerButton: {
    flex: 1,
    marginHorizontal: 8,
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
  },
  invoiceButton: {
    backgroundColor: '#00D4E6',
    elevation: 4,
  },
  galleryButton: {
    backgroundColor: '#FF9500',
    elevation: 4,
  },
  sellButton: {
    backgroundColor: '#007AFF',
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: '#4A4A4A',
  },
  drawerButtonIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  drawerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default SmartBottomDrawer;