// ==================== SMOOTH INVENTORY LIST COMPONENT ====================
// High-performance inventory list with FlatList for buttery smooth scrolling

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions
} from 'react-native';
import { useTranslation } from 'react-i18next';

const { width: screenWidth } = Dimensions.get('window');

const SmoothInventoryList = ({ 
  inventoryProducts, 
  activeInventoryTab, 
  inventorySearch,
  onProductPress,
  getTabCount
}) => {
  const { t } = useTranslation();

  // Memoized filtering function
  const filteredInventory = useMemo(() => {
    let filtered = inventoryProducts;
    
    // First filter by search term
    if (inventorySearch) {
      filtered = inventoryProducts.filter(product => 
        product.name?.toLowerCase().includes(inventorySearch.toLowerCase()) ||
        product.barcode?.toLowerCase().includes(inventorySearch.toLowerCase()) ||
        product.category_name?.toLowerCase().includes(inventorySearch.toLowerCase())
      );
    }
    
    // Then filter by tab type
    switch (activeInventoryTab) {
      case 'all':
        return filtered;
      case 'low-stock':
        return filtered.filter(product => (product.quantity || 0) > 0 && (product.quantity || 0) <= 10);
      case 'out-of-stock':
        return filtered.filter(product => (product.quantity || 0) === 0);
      case 'categories':
        return filtered.reduce((acc, product) => {
          const category = product.category_name || t('modals.uncategorized');
          if (!acc[category]) acc[category] = [];
          acc[category].push(product);
          return acc;
        }, {});
      default:
        return filtered;
    }
  }, [inventoryProducts, activeInventoryTab, inventorySearch, t]);

  // Memoized render item function for better performance
  const renderInventoryItem = useCallback(({ item: product }) => (
    <TouchableOpacity 
      style={styles.inventoryItem}
      onPress={() => onProductPress(product)}
      activeOpacity={0.8}
    >
      <View style={styles.inventoryItemHeader}>
        <Text style={styles.inventoryProductName}>{product.name}</Text>
        {product.barcode && (
          <Text style={styles.inventoryBarcode}>{product.barcode}</Text>
        )}
      </View>
      
      <View style={styles.inventoryItemDetails}>
        <View style={styles.inventoryDetailRow}>
          <Text style={styles.inventoryLabel}>{t('inventory.stock')}:</Text>
          <Text style={[
            styles.inventoryValue,
            product.quantity < 10 && styles.lowStockText
          ]}>
            {product.quantity || 0} {t('inventory.units')}
          </Text>
        </View>
        
        <View style={styles.inventoryDetailRow}>
          <Text style={styles.inventoryLabel}>{t('inventory.price')}:</Text>
          <Text style={styles.inventoryPrice}>
            {product.price ? `${product.price} DZD` : t('inventory.notSet')}
          </Text>
        </View>
        
        {product.vendor_name && (
          <View style={styles.inventoryDetailRow}>
            <Text style={styles.inventoryLabel}>{t('inventory.vendor')}:</Text>
            <Text style={styles.inventoryValue}>{product.vendor_name}</Text>
          </View>
        )}
        
        {product.category_name && (
          <View style={styles.inventoryDetailRow}>
            <Text style={styles.inventoryLabel}>{t('inventory.category')}:</Text>
            <Text style={styles.inventoryValue}>{product.category_name}</Text>
          </View>
        )}
        
        {product.quantity < 10 && (
          <View style={styles.lowStockWarning}>
            <Text style={styles.lowStockWarningText}>
              {t('inventory.lowStockWarning')}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  ), [onProductPress, t]);

  // Render category section
  const renderCategorySection = useCallback(({ item: [category, products] }) => (
    <View style={styles.categorySection}>
      <Text style={styles.categoryTitle}>
        🏷️ {category} ({products.length})
      </Text>
      <FlatList
        data={products}
        renderItem={renderInventoryItem}
        keyExtractor={(product) => `${product.id}_${category}`}
        scrollEnabled={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={5}
      />
    </View>
  ), [renderInventoryItem]);

  // Key extractor functions
  const keyExtractor = useCallback((item) => item.id?.toString() || item.barcode, []);
  const categoryKeyExtractor = useCallback(([category]) => category, []);

  // Empty component
  const EmptyComponent = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>{t('inventory.empty')}</Text>
    </View>
  ), [t]);

  // Header component with summary
  const ListHeader = useCallback(() => (
    <Text style={styles.inventorySummary}>
      {activeInventoryTab === 'all' && t('inventory.totalProducts', { count: inventoryProducts.length })}
      {activeInventoryTab === 'low-stock' && t('inventory.lowStockItems', { count: getTabCount('low-stock') })}
      {activeInventoryTab === 'out-of-stock' && t('inventory.outOfStockItems', { count: getTabCount('out-of-stock') })}
    </Text>
  ), [activeInventoryTab, inventoryProducts.length, getTabCount, t]);

  // Render categories view
  if (activeInventoryTab === 'categories') {
    return (
      <FlatList
        data={Object.entries(filteredInventory)}
        renderItem={renderCategorySection}
        keyExtractor={categoryKeyExtractor}
        style={styles.flatList}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={10}
        initialNumToRender={3}
        getItemLayout={(data, index) => ({
          length: 200, // Estimated height
          offset: 200 * index,
          index,
        })}
        ListEmptyComponent={EmptyComponent}
      />
    );
  }

  // Render regular list view
  return (
    <FlatList
      data={filteredInventory}
      renderItem={renderInventoryItem}
      keyExtractor={keyExtractor}
      style={styles.flatList}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={EmptyComponent}
      
      // Performance optimizations
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={10}
      initialNumToRender={8}
      updateCellsBatchingPeriod={50}
      
      // Memory optimizations
      getItemLayout={(data, index) => ({
        length: 120, // Estimated item height
        offset: 120 * index,
        index,
      })}
      
      // Additional performance props
      keyboardShouldPersistTaps="handled"
      maintainVisibleContentPosition={{
        minIndexForVisible: 0,
      }}
    />
  );
};

const styles = StyleSheet.create({
  flatList: {
    flex: 1,
  },
  inventoryItem: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginVertical: 8,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inventoryItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  inventoryProductName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    marginRight: 10,
  },
  inventoryBarcode: {
    fontSize: 12,
    color: '#666666',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontFamily: 'monospace',
  },
  inventoryItemDetails: {
    gap: 8,
  },
  inventoryDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inventoryLabel: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  inventoryValue: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '600',
  },
  inventoryPrice: {
    fontSize: 16,
    color: '#0066CC',
    fontWeight: 'bold',
  },
  lowStockText: {
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  lowStockWarning: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF6B35',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  lowStockWarningText: {
    color: '#FF6B35',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  inventorySummary: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginVertical: 15,
    paddingHorizontal: 20,
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0066CC',
    marginBottom: 10,
    marginLeft: 15,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#0066CC',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
});

export default SmoothInventoryList;