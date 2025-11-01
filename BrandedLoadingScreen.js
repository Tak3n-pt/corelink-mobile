import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  Easing,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const BrandedLoadingScreen = ({ visible = true }) => {
  const rotation1 = useRef(new Animated.Value(0)).current;
  const rotation2 = useRef(new Animated.Value(0)).current;
  const rotation3 = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const iconPulse = useRef(new Animated.Value(1)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Fade in animation
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Scale breathing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.8,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Center icon pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(iconPulse, {
            toValue: 1.2,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(iconPulse, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Ring rotations - different speeds for depth effect
      Animated.loop(
        Animated.timing(rotation1, {
          toValue: 1,
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      Animated.loop(
        Animated.timing(rotation2, {
          toValue: -1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      Animated.loop(
        Animated.timing(rotation3, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [visible]);

  if (!visible) return null;

  const rotate1 = rotation1.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const rotate2 = rotation2.interpolate({
    inputRange: [-1, 0],
    outputRange: ['360deg', '0deg'],
  });

  const rotate3 = rotation3.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[styles.fullScreenContainer, { opacity: fadeIn }]}>
      <View style={styles.backdrop} />
      
      <View style={styles.loadingContainer}>
        {/* Outer Ring with Invoice Icons */}
        <Animated.View
          style={[
            styles.ring,
            styles.ring1,
            {
              transform: [{ rotate: rotate1 }, { scale }],
            },
          ]}
        >
          <View style={[styles.iconContainer, styles.iconTop]}>
            <Ionicons name="document-text" size={20} color="#f39c12" />
          </View>
          <View style={[styles.iconContainer, styles.iconRight]}>
            <Ionicons name="receipt" size={20} color="#f39c12" />
          </View>
          <View style={[styles.iconContainer, styles.iconBottom]}>
            <MaterialCommunityIcons name="file-document" size={20} color="#f39c12" />
          </View>
          <View style={[styles.iconContainer, styles.iconLeft]}>
            <Ionicons name="newspaper" size={20} color="#f39c12" />
          </View>
        </Animated.View>

        {/* Middle Ring with Barcode Icons */}
        <Animated.View
          style={[
            styles.ring,
            styles.ring2,
            {
              transform: [{ rotate: rotate2 }, { scale }],
            },
          ]}
        >
          <View style={[styles.iconContainer, styles.iconTop]}>
            <MaterialCommunityIcons name="barcode-scan" size={16} color="#f39c12cc" />
          </View>
          <View style={[styles.iconContainer, styles.iconBottom]}>
            <Ionicons name="qr-code" size={16} color="#f39c12cc" />
          </View>
        </Animated.View>

        {/* Inner Ring with Product Icons */}
        <Animated.View
          style={[
            styles.ring,
            styles.ring3,
            {
              transform: [{ rotate: rotate3 }, { scale }],
            },
          ]}
        >
          <View style={[styles.iconContainer, styles.iconTop]}>
            <Ionicons name="cube" size={12} color="#f39c1299" />
          </View>
          <View style={[styles.iconContainer, styles.iconRight]}>
            <MaterialCommunityIcons name="package-variant" size={12} color="#f39c1299" />
          </View>
        </Animated.View>

        {/* Center Logo/Icon */}
        <Animated.View
          style={[
            styles.centerIcon,
            {
              transform: [{ scale: iconPulse }],
            },
          ]}
        >
          <MaterialCommunityIcons name="store" size={32} color="#f39c12" />
        </Animated.View>

        {/* Decorative Corner Elements */}
        <View style={[styles.corner, styles.cornerTopLeft]}>
          <View style={styles.cornerLine} />
          <View style={[styles.cornerLine, styles.cornerLineVertical]} />
        </View>
        <View style={[styles.corner, styles.cornerTopRight]}>
          <View style={styles.cornerLine} />
          <View style={[styles.cornerLine, styles.cornerLineVertical]} />
        </View>
        <View style={[styles.corner, styles.cornerBottomLeft]}>
          <View style={styles.cornerLine} />
          <View style={[styles.cornerLine, styles.cornerLineVertical]} />
        </View>
        <View style={[styles.corner, styles.cornerBottomRight]}>
          <View style={styles.cornerLine} />
          <View style={[styles.cornerLine, styles.cornerLineVertical]} />
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(26, 26, 46, 0.97)',
  },
  loadingContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: '#f39c1233',
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring1: {
    width: 160,
    height: 160,
    borderWidth: 2,
    borderStyle: 'dotted',
  },
  ring2: {
    width: 120,
    height: 120,
    borderWidth: 1.5,
    borderColor: '#f39c1255',
  },
  ring3: {
    width: 80,
    height: 80,
    borderWidth: 1,
    borderColor: '#f39c1277',
    borderStyle: 'dashed',
  },
  iconContainer: {
    position: 'absolute',
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 15,
  },
  iconTop: {
    top: -15,
  },
  iconRight: {
    right: -15,
  },
  iconBottom: {
    bottom: -15,
  },
  iconLeft: {
    left: -15,
  },
  centerIcon: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#f39c1244',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
  },
  cornerTopLeft: {
    top: -70,
    left: -70,
  },
  cornerTopRight: {
    top: -70,
    right: -70,
  },
  cornerBottomLeft: {
    bottom: -70,
    left: -70,
  },
  cornerBottomRight: {
    bottom: -70,
    right: -70,
  },
  cornerLine: {
    position: 'absolute',
    backgroundColor: '#f39c1222',
    width: 20,
    height: 2,
  },
  cornerLineVertical: {
    width: 2,
    height: 20,
  },
});

export default BrandedLoadingScreen;