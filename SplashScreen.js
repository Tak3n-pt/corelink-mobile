import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Image,
  Text,
  Animated,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

const { width, height } = Dimensions.get('window');

const SplashScreen = ({ onFinish }) => {
  const { t } = useTranslation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start the logo animation
    Animated.sequence([
      // First, animate logo appearance
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      // Then animate text
      Animated.timing(textFadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      // Hold for a moment
      Animated.delay(1000),
    ]).start(() => {
      // Animation completed, call onFinish
      if (onFinish) {
        onFinish();
      }
    });
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#f8f9fa', '#ffffff', '#f1f3f5']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.content}>
          {/* REVOTEC Logo */}
          <Animated.View 
            style={[
              styles.logoContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              }
            ]}
          >
            <Image
              source={require('./assets/revotec-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>

          {/* App Name and Tagline */}
          <Animated.View 
            style={[
              styles.textContainer,
              { opacity: textFadeAnim }
            ]}
          >
            <Text style={styles.poweredBy}>{t('brand.poweredBy')}</Text>
            <Text style={styles.appName}>{t('brand.coreLink')}</Text>
            <View style={styles.divider} />
            <Text style={styles.tagline}>{t('brand.description')}</Text>
          </Animated.View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    marginBottom: 60,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  logo: {
    width: 120,
    height: 120,
  },
  textContainer: {
    alignItems: 'center',
  },
  poweredBy: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  divider: {
    width: 60,
    height: 2,
    backgroundColor: '#f39c12',
    marginBottom: 16,
    borderRadius: 1,
  },
  tagline: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: width * 0.8,
  },
});

export default SplashScreen;