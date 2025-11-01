import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import CreativeLoadingScreen, {
  PulseGridLoader,
  OrbitalRingsLoader,
  WaveDotsLoader,
  MorphingHexagonLoader,
  DNAHelixLoader,
} from './CreativeLoadingScreen';

const { width: screenWidth } = Dimensions.get('window');

const LoadingAnimationShowcase = () => {
  const [selectedAnimation, setSelectedAnimation] = useState('orbital');
  const [showFullScreen, setShowFullScreen] = useState(false);

  const animations = [
    {
      type: 'pulse',
      name: 'Pulse Grid',
      description: 'Pulsing inventory slots',
      Component: PulseGridLoader,
    },
    {
      type: 'orbital',
      name: 'Orbital Rings',
      description: 'Rotating concentric rings',
      Component: OrbitalRingsLoader,
    },
    {
      type: 'wave',
      name: 'Wave Dots',
      description: 'Smooth wave motion',
      Component: WaveDotsLoader,
    },
    {
      type: 'morph',
      name: 'Morphing Shape',
      description: 'Shape-shifting animation',
      Component: MorphingHexagonLoader,
    },
    {
      type: 'dna',
      name: 'DNA Helix',
      description: 'Data processing visualization',
      Component: DNAHelixLoader,
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Choose Your Loading Animation</Text>
        <Text style={styles.subtitle}>Tap any animation to preview full screen</Text>

        <View style={styles.grid}>
          {animations.map((anim) => (
            <TouchableOpacity
              key={anim.type}
              style={[
                styles.card,
                selectedAnimation === anim.type && styles.selectedCard,
              ]}
              onPress={() => {
                setSelectedAnimation(anim.type);
                setShowFullScreen(true);
                setTimeout(() => setShowFullScreen(false), 3000);
              }}
            >
              <View style={styles.animationBox}>
                <anim.Component color="#f39c12" />
              </View>
              <Text style={styles.animName}>{anim.name}</Text>
              <Text style={styles.animDesc}>{anim.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.colorOptions}>
          <Text style={styles.sectionTitle}>Color Variations</Text>
          <View style={styles.colorRow}>
            <View style={styles.colorBox}>
              <OrbitalRingsLoader color="#f39c12" />
              <Text style={styles.colorLabel}>Gaming Gold</Text>
            </View>
            <View style={styles.colorBox}>
              <OrbitalRingsLoader color="#00C9FF" />
              <Text style={styles.colorLabel}>Tech Blue</Text>
            </View>
            <View style={styles.colorBox}>
              <OrbitalRingsLoader color="#32F5C8" />
              <Text style={styles.colorLabel}>Mint Fresh</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.demoButton}
          onPress={() => setShowFullScreen(true)}
        >
          <Text style={styles.demoButtonText}>
            Show Full Screen Demo ({selectedAnimation})
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {showFullScreen && (
        <TouchableOpacity
          style={styles.fullScreenDemo}
          onPress={() => setShowFullScreen(false)}
        >
          <CreativeLoadingScreen
            type={selectedAnimation}
            color="#f39c12"
            visible={true}
          />
          <Text style={styles.tapToClose}>Tap to close</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 30,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: (screenWidth - 50) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCard: {
    borderColor: '#f39c12',
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
  },
  animationBox: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  animName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 5,
  },
  animDesc: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 30,
    marginBottom: 20,
  },
  colorOptions: {
    marginTop: 20,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  colorBox: {
    alignItems: 'center',
  },
  colorLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 10,
  },
  demoButton: {
    backgroundColor: '#f39c12',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 30,
    alignSelf: 'center',
  },
  demoButtonText: {
    color: '#1A1A2E',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fullScreenDemo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  tapToClose: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    color: '#fff',
    fontSize: 16,
    opacity: 0.7,
  },
});

export default LoadingAnimationShowcase;