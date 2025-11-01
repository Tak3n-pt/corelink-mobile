import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  Dimensions
} from 'react-native';

const { width, height } = Dimensions.get('window');

const ProductSellModal = ({
  visible,
  onClose,
  textBlocks,
  onSelectLine,
  searchProgress,
  onManualSearch
}) => {
  const [manualSearchText, setManualSearchText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(null);

  // Color code text blocks based on likelihood of being product name
  const getBlockColor = (text) => {
    // Skip obvious non-products
    if (/^[\d\s\.,]+$/.test(text)) return '#FF6B6B'; // Red - likely price/number
    if (/^(prix|price|total|date|exp)/i.test(text)) return '#FF6B6B'; // Red - labels
    if (text.length < 3 || text.length > 50) return '#FFD93D'; // Yellow - unlikely length
    if (/\d{4}-\d{2}-\d{2}/.test(text)) return '#FF6B6B'; // Red - date
    
    // Good candidates
    if (text.length >= 5 && text.length <= 30 && /^[A-Za-z]/.test(text)) {
      return '#6BCF7F'; // Green - likely product name
    }
    
    return '#FFD93D'; // Yellow - uncertain
  };

  const handleLinePress = (line, index) => {
    setSelectedIndex(index);
    onSelectLine(line.text);
  };

  const handleManualSearch = () => {
    if (manualSearchText.trim().length > 0) {
      onManualSearch(manualSearchText.trim());
      setManualSearchText('');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>🔍 Select Product Name</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            Tap on the product name from detected text below
          </Text>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#6BCF7F' }]} />
              <Text style={styles.legendText}>Likely product</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#FFD93D' }]} />
              <Text style={styles.legendText}>Possible</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#FF6B6B' }]} />
              <Text style={styles.legendText}>Unlikely</Text>
            </View>
          </View>
        </View>

        {/* Search Progress */}
        {searchProgress.searching && (
          <View style={styles.progressContainer}>
            <ActivityIndicator size="small" color="#3498db" />
            <Text style={styles.progressText}>
              Auto-searching line {searchProgress.current} of {searchProgress.total}...
            </Text>
          </View>
        )}

        {/* Detected Text Lines */}
        <ScrollView style={styles.textBlocksContainer}>
          {textBlocks.map((block, blockIndex) => (
            <View key={blockIndex} style={styles.block}>
              {block.lines && block.lines.map((line, lineIndex) => {
                const globalIndex = `${blockIndex}-${lineIndex}`;
                const isSelected = selectedIndex === globalIndex;
                const borderColor = getBlockColor(line.text);
                
                return (
                  <TouchableOpacity
                    key={lineIndex}
                    style={[
                      styles.textLine,
                      { borderColor },
                      isSelected && styles.selectedLine,
                      searchProgress.current === lineIndex + 1 && styles.searchingLine
                    ]}
                    onPress={() => handleLinePress(line, globalIndex)}
                  >
                    <Text style={styles.lineText} numberOfLines={1}>
                      {line.text}
                    </Text>
                    {searchProgress.current === lineIndex + 1 && (
                      <ActivityIndicator size="small" color="#3498db" style={styles.lineSpinner} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>

        {/* Manual Search */}
        <View style={styles.manualSearchContainer}>
          <Text style={styles.manualSearchLabel}>Can't find it? Type product name:</Text>
          <View style={styles.manualSearchRow}>
            <TextInput
              style={styles.manualSearchInput}
              value={manualSearchText}
              onChangeText={setManualSearchText}
              placeholder="Enter product name..."
              placeholderTextColor="#999"
            />
            <TouchableOpacity 
              style={styles.searchButton}
              onPress={handleManualSearch}
            >
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
  },
  instructions: {
    backgroundColor: '#fff',
    padding: 15,
    marginTop: 1,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 10,
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 8,
  },
  progressText: {
    marginLeft: 10,
    color: '#1976d2',
    fontSize: 14,
  },
  textBlocksContainer: {
    flex: 1,
    padding: 15,
  },
  block: {
    marginBottom: 10,
  },
  textLine: {
    backgroundColor: '#fff',
    padding: 12,
    marginVertical: 4,
    borderRadius: 8,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedLine: {
    backgroundColor: '#e8f4fd',
    borderColor: '#2196f3',
  },
  searchingLine: {
    backgroundColor: '#fff3e0',
  },
  lineText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  lineSpinner: {
    marginLeft: 10,
  },
  manualSearchContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  manualSearchLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  manualSearchRow: {
    flexDirection: 'row',
  },
  manualSearchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#333',
    marginRight: 10,
  },
  searchButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProductSellModal;