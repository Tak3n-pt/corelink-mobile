import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  Easing,
  StyleSheet,
  Dimensions,
} from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// ============= PULSE GRID LOADER =============
export const PulseGridLoader = ({ color = '#f39c12' }) => {
  const animations = useRef(
    Array.from({ length: 9 }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    const animateGrid = () => {
      animations.forEach((anim, index) => {
        Animated.sequence([
          Animated.delay(index * 100),
          Animated.loop(
            Animated.sequence([
              Animated.timing(anim, {
                toValue: 1,
                duration: 600,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(anim, {
                toValue: 0.3,
                duration: 600,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
            ])
          ),
        ]).start();
      });
    };

    animateGrid();
  }, []);

  return (
    <View style={styles.pulseContainer}>
      {animations.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.pulseDot,
            {
              backgroundColor: color,
              opacity: anim,
              transform: [{ scale: anim }],
            },
          ]}
        />
      ))}
    </View>
  );
};

// ============= ORBITAL RINGS LOADER =============
export const OrbitalRingsLoader = ({ color = '#f39c12' }) => {
  const rotation1 = useRef(new Animated.Value(0)).current;
  const rotation2 = useRef(new Animated.Value(0)).current;
  const rotation3 = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Scale animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.1,
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

    // Rotation animations
    Animated.loop(
      Animated.timing(rotation1, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(rotation2, {
        toValue: -1,
        duration: 2500,
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
  }, []);

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
    <View style={styles.orbitalContainer}>
      <Animated.View
        style={[
          styles.ring,
          styles.ring1,
          {
            borderColor: color,
            transform: [{ rotate: rotate1 }, { scale }],
          },
        ]}
      >
        <View style={[styles.orb, { backgroundColor: color }]} />
      </Animated.View>
      
      <Animated.View
        style={[
          styles.ring,
          styles.ring2,
          {
            borderColor: `${color}99`,
            transform: [{ rotate: rotate2 }, { scale }],
          },
        ]}
      >
        <View style={[styles.orb, styles.orb2, { backgroundColor: `${color}99` }]} />
      </Animated.View>
      
      <Animated.View
        style={[
          styles.ring,
          styles.ring3,
          {
            borderColor: `${color}66`,
            transform: [{ rotate: rotate3 }, { scale }],
          },
        ]}
      >
        <View style={[styles.orb, styles.orb3, { backgroundColor: `${color}66` }]} />
      </Animated.View>
    </View>
  );
};

// ============= WAVE DOTS LOADER =============
export const WaveDotsLoader = ({ color = '#f39c12' }) => {
  const dots = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    dots.forEach((dot, index) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 100),
          Animated.timing(dot, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, []);

  return (
    <View style={styles.waveContainer}>
      {dots.map((dot, index) => {
        const translateY = dot.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -30],
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.waveDot,
              {
                backgroundColor: color,
                transform: [{ translateY }],
                opacity: dot.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 1],
                }),
              },
            ]}
          />
        );
      })}
    </View>
  );
};

// ============= MORPHING HEXAGON LOADER =============
export const MorphingHexagonLoader = ({ color = '#f39c12' }) => {
  const rotation = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const borderRadius = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.2,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.8,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(borderRadius, {
            toValue: 30,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(borderRadius, {
            toValue: 5,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      ),
    ]).start();
  }, []);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.morphContainer}>
      <Animated.View
        style={[
          styles.hexagon,
          {
            backgroundColor: color,
            borderRadius,
            transform: [{ rotate }, { scale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.hexagonInner,
          {
            backgroundColor: '#1A1A2E',
            borderRadius: Animated.subtract(borderRadius, 5),
            transform: [{ rotate: Animated.multiply(rotate, -1) }, { scale: Animated.multiply(scale, 0.6) }],
          },
        ]}
      />
    </View>
  );
};

// ============= DNA HELIX LOADER =============
export const DNAHelixLoader = ({ color = '#f39c12' }) => {
  const animations = useRef(
    Array.from({ length: 8 }, () => ({
      translateX: new Animated.Value(0),
      scale: new Animated.Value(1),
    }))
  ).current;

  useEffect(() => {
    animations.forEach((anim, index) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 100),
          Animated.parallel([
            Animated.sequence([
              Animated.timing(anim.translateX, {
                toValue: 1,
                duration: 1000,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
              Animated.timing(anim.translateX, {
                toValue: -1,
                duration: 1000,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
              Animated.timing(anim.translateX, {
                toValue: 0,
                duration: 1000,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(anim.scale, {
                toValue: 1.5,
                duration: 1500,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(anim.scale, {
                toValue: 1,
                duration: 1500,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
            ]),
          ]),
        ])
      ).start();
    });
  }, []);

  return (
    <View style={styles.dnaContainer}>
      {animations.map((anim, index) => {
        const translateX = anim.translateX.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [-30, 0, 30],
        });

        return (
          <View key={index} style={styles.dnaRow}>
            <Animated.View
              style={[
                styles.dnaDot,
                styles.dnaDotLeft,
                {
                  backgroundColor: color,
                  transform: [
                    { translateX: Animated.multiply(translateX, -1) },
                    { scale: anim.scale },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.dnaConnector,
                {
                  backgroundColor: `${color}33`,
                  transform: [{ scaleX: anim.scale }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.dnaDot,
                styles.dnaDotRight,
                {
                  backgroundColor: color,
                  transform: [
                    { translateX },
                    { scale: anim.scale },
                  ],
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
};

// ============= MAIN CREATIVE LOADING SCREEN =============
const CreativeLoadingScreen = ({ type = 'orbital', color = '#f39c12', visible = true }) => {
  if (!visible) return null;

  const loaders = {
    pulse: PulseGridLoader,
    orbital: OrbitalRingsLoader,
    wave: WaveDotsLoader,
    morph: MorphingHexagonLoader,
    dna: DNAHelixLoader,
  };

  const LoaderComponent = loaders[type] || OrbitalRingsLoader;

  return (
    <View style={styles.fullScreenContainer}>
      <View style={styles.backdrop} />
      <LoaderComponent color={color} />
    </View>
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
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
  },

  // Pulse Grid Styles
  pulseContainer: {
    width: 120,
    height: 120,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
  },
  pulseDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    margin: 5,
  },

  // Orbital Rings Styles
  orbitalContainer: {
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring1: {
    width: 120,
    height: 120,
  },
  ring2: {
    width: 90,
    height: 90,
  },
  ring3: {
    width: 60,
    height: 60,
  },
  orb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    top: -6,
  },
  orb2: {
    width: 10,
    height: 10,
    borderRadius: 5,
    top: -5,
  },
  orb3: {
    width: 8,
    height: 8,
    borderRadius: 4,
    top: -4,
  },

  // Wave Dots Styles
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
  },
  waveDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 8,
  },

  // Morphing Hexagon Styles
  morphContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hexagon: {
    width: 80,
    height: 80,
    position: 'absolute',
  },
  hexagonInner: {
    width: 50,
    height: 50,
    position: 'absolute',
  },

  // DNA Helix Styles
  dnaContainer: {
    height: 200,
    justifyContent: 'space-between',
  },
  dnaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
  },
  dnaDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dnaDotLeft: {
    position: 'absolute',
    left: 0,
  },
  dnaDotRight: {
    position: 'absolute',
    right: 0,
  },
  dnaConnector: {
    position: 'absolute',
    width: 100,
    height: 2,
    left: 0,
  },
});

export default CreativeLoadingScreen;