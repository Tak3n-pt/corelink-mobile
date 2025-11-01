import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Vibration
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import VisionCameraLiveScannerMLKit from './VisionCameraLiveScannerMLKit';
import { useTranslation } from 'react-i18next';

const { width, height } = Dimensions.get('window');

const EnhancedPriceEditorModal = ({
  visible,
  onClose,
  invoice,
  onSave,
  desktopServerUrl,
  fetchWithTimeout,
  BarcodeScanning,  // Receive from App.js
  TextRecognition   // Receive from App.js
}) => {
  const { t } = useTranslation();
  
  // Debug log to verify BarcodeScanning module
  useEffect(() => {
    console.log('📦 EnhancedPriceEditorModal - BarcodeScanning module:', BarcodeScanning ? '✅ Available' : '❌ Not available');
    console.log('📦 EnhancedPriceEditorModal - BarcodeScanning.scan:', BarcodeScanning?.scan ? '✅ Available' : '❌ Not available');
  }, [BarcodeScanning]);
  
  // State management
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [scanningItemIndex, setScanningItemIndex] = useState(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    quantity: '1',
    costPrice: '',
    barcode: '',
    sellingPrice: ''
  });
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  
  // Initialize and check desktop for each item
  useEffect(() => {
    if (visible && invoice) {
      loadAndEnrichItems();
      animateIn();
    }
  }, [visible, invoice]);
  
  // Animate modal entrance
  const animateIn = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true
      })
    ]).start();
  };
  
  // Load items and check desktop for existing products
  const loadAndEnrichItems = async () => {
    setIsLoading(true);
    
    try {
      // Start with invoice items
      const enrichedItems = [];
      
      // First check if desktop is available
      let desktopAvailable = false;
      if (desktopServerUrl) {
        try {
          const healthResponse = await fetchWithTimeout(
            `${desktopServerUrl}/health`,
            {},
            2000
          );
          desktopAvailable = healthResponse && healthResponse.ok;
          console.log(`Desktop server: ${desktopAvailable ? 'Online' : 'Offline'}`);
        } catch (error) {
          console.log('Desktop server offline, continuing without product enrichment');
        }
      }
      
      for (const item of (invoice?.items || [])) {
        let enrichedItem = { ...item };
        
        // Check if product exists in desktop by barcode or name
        if (desktopAvailable && desktopServerUrl) {
          try {
            // First try barcode if available
            if (item.barcode && item.barcode !== '' && !item.barcode.startsWith('TEMP')) {
              const response = await fetchWithTimeout(
                `${desktopServerUrl}/products/${encodeURIComponent(item.barcode)}`,
                {},
                5000
              );
              
              if (response.ok) {
                const productData = await response.json();
                // Handle both direct product response and success wrapper
                const product = productData.product || productData;
                if (product && (product.name || product.barcode)) {
                  enrichedItem = {
                    ...enrichedItem,
                    existsInInventory: true,
                    desktopProduct: product,
                    suggestedPrice: product.price || product.sellingPrice || product.selling_price,
                    currentStock: product.stock || product.quantity || 0,
                    barcode: product.barcode,
                    sellingPrice: enrichedItem.sellingPrice || product.price || product.sellingPrice || product.selling_price
                  };
                }
              }
            }
            
            // If not found by barcode, try by name
            if (!enrichedItem.existsInInventory && item.name) {
              const searchResponse = await fetchWithTimeout(
                `${desktopServerUrl}/api/products/search?q=${encodeURIComponent(item.name)}&limit=1`,
                {},
                5000
              );
              
              if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                if (searchData.products && searchData.products.length > 0) {
                  const product = searchData.products[0];
                  // Check name similarity (simple check)
                  const similarity = calculateSimilarity(item.name.toLowerCase(), product.name.toLowerCase());
                  
                  if (similarity > 0.7) { // 70% similarity threshold
                    enrichedItem = {
                      ...enrichedItem,
                      existsInInventory: true,
                      desktopProduct: product,
                      suggestedPrice: product.price || product.sellingPrice || product.selling_price,
                      currentStock: product.stock || product.quantity || 0,
                      barcode: product.barcode || enrichedItem.barcode,
                      sellingPrice: enrichedItem.sellingPrice || product.price || product.sellingPrice,
                      matchConfidence: similarity
                    };
                  }
                }
              }
            }
          } catch (error) {
            console.log(`Failed to check desktop for item: ${item.name}`, error);
          }
        }
        
        // Add status flags
        enrichedItem.needsBarcode = !enrichedItem.barcode || 
                                    enrichedItem.barcode.startsWith('TEMP') || 
                                    enrichedItem.barcode.startsWith('GEN_');
        enrichedItem.hasValidPrice = enrichedItem.sellingPrice && parseFloat(enrichedItem.sellingPrice) > 0;
        enrichedItem.isReady = !enrichedItem.needsBarcode && enrichedItem.hasValidPrice;
        
        enrichedItems.push(enrichedItem);
      }
      
      setItems(enrichedItems);
    } catch (error) {
      console.error('Error enriching items:', error);
      // Fallback to original items
      setItems(invoice?.items || []);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Calculate string similarity (simple Levenshtein-like)
  const calculateSimilarity = (str1, str2) => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };
  
  // Simple edit distance calculation
  const getEditDistance = (str1, str2) => {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  };
  
  // Handle barcode scan for existing item
  const handleBarcodeScan = (index) => {
    setScanningItemIndex(index);
    setShowBarcodeScanner(true);
  };
  
  // Handle barcode detected
  const onBarcodeDetected = async (barcode) => {
    setShowBarcodeScanner(false);
    
    // Check if this barcode already exists in desktop
    if (desktopServerUrl) {
      try {
        const response = await fetchWithTimeout(
          `${desktopServerUrl}/products/${encodeURIComponent(barcode)}`,
          {},
          5000
        );
        
        if (response.ok) {
          const data = await response.json();
          // Handle both direct product response and success wrapper
          const product = data.product || data;
          
          if (product && (product.name || product.barcode)) {
            // Product exists with this barcode
            Alert.alert(
              t('priceEditor.barcodeExists'),
              t('priceEditor.barcodeExistsMessage', { name: product.name }),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('priceEditor.useProduct') || 'Use This Product',
                  onPress: () => {
                    // Update item with existing product data
                    const updatedItems = [...items];
                    if (scanningItemIndex !== null && scanningItemIndex !== -1) {
                      updatedItems[scanningItemIndex] = {
                        ...updatedItems[scanningItemIndex],
                        barcode: product.barcode,
                        existsInInventory: true,
                        desktopProduct: product,
                        suggestedPrice: product.price || product.sellingPrice || product.selling_price,
                        sellingPrice: updatedItems[scanningItemIndex].sellingPrice || product.price || product.selling_price,
                        needsBarcode: false
                      };
                    } else if (scanningItemIndex === -1) {
                      // For new product
                      setNewProduct({
                        ...newProduct,
                        barcode: product.barcode,
                        name: product.name,
                        sellingPrice: product.price || product.sellingPrice || product.selling_price
                      });
                    }
                    setItems(updatedItems);
                    setScanningItemIndex(null);
                  }
                }
              ]
            );
            return;
          }
        }
      } catch (error) {
        console.log('Error checking barcode:', error);
      }
    }
    
    // Barcode doesn't exist, assign it to the item
    if (scanningItemIndex !== null && scanningItemIndex !== -1) {
      const updatedItems = [...items];
      updatedItems[scanningItemIndex] = {
        ...updatedItems[scanningItemIndex],
        barcode: barcode,
        needsBarcode: false
      };
      setItems(updatedItems);
      Vibration.vibrate(50);
      
      // Show success message
      console.log(`✅ Barcode ${barcode} added to product: ${updatedItems[scanningItemIndex].name}`);
      Alert.alert(
        '✅ ' + t('priceEditor.barcodeAdded') || 'Barcode Added',
        `${barcode} has been assigned to ${updatedItems[scanningItemIndex].name || 'the product'}`,
        [{ text: t('common.ok') || 'OK' }]
      );
    } else if (scanningItemIndex === -1) {
      // For new product
      setNewProduct({
        ...newProduct,
        barcode: barcode
      });
      Vibration.vibrate(50);
    }
    
    setScanningItemIndex(null);
  };
  
  // Update item price
  const updateItemPrice = (index, price) => {
    const updatedItems = [...items];
    updatedItems[index] = {
      ...updatedItems[index],
      sellingPrice: price,
      hasValidPrice: price && parseFloat(price) > 0,
      isReady: !updatedItems[index].needsBarcode && price && parseFloat(price) > 0
    };
    setItems(updatedItems);
  };
  
  // Update item quantity
  const updateItemQuantity = (index, quantity) => {
    const updatedItems = [...items];
    updatedItems[index] = {
      ...updatedItems[index],
      quantity: parseInt(quantity) || 1
    };
    setItems(updatedItems);
  };
  
  // Handle add new product
  const handleAddProduct = async () => {
    // Validate new product
    if (!newProduct.name || !newProduct.quantity || !newProduct.costPrice) {
      Alert.alert(t('common.error'), t('priceEditor.fillRequiredFields'));
      return;
    }
    
    if (!newProduct.barcode) {
      Alert.alert(t('common.error'), t('priceEditor.barcodeMissing'));
      return;
    }
    
    if (!newProduct.sellingPrice || parseFloat(newProduct.sellingPrice) <= 0) {
      Alert.alert(t('common.error'), t('priceEditor.priceMissing'));
      return;
    }
    
    // Create new item
    const newItem = {
      name: newProduct.name,
      description: newProduct.name,
      quantity: parseInt(newProduct.quantity) || 1,
      costPrice: parseFloat(newProduct.costPrice) || 0,
      unitPrice: parseFloat(newProduct.costPrice) || 0,
      barcode: newProduct.barcode,
      sellingPrice: parseFloat(newProduct.sellingPrice),
      isManuallyAdded: true,
      existsInInventory: false,
      needsBarcode: false,
      hasValidPrice: true,
      isReady: true
    };
    
    // Add to items
    setItems([...items, newItem]);
    
    // Reset and close modal
    setNewProduct({
      name: '',
      quantity: '1',
      costPrice: '',
      barcode: '',
      sellingPrice: ''
    });
    setShowAddProductModal(false);
    
    Vibration.vibrate(50);
  };
  
  // Handle save all
  const handleSaveAll = async () => {
    // Validate all items
    const invalidItems = items.filter(item => !item.isReady);
    
    if (invalidItems.length > 0) {
      Alert.alert(
        t('priceEditor.incompleteItems'),
        t('priceEditor.incompleteItemsMessage', { count: invalidItems.length }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('priceEditor.saveAnyway'), onPress: () => saveItems() }
        ]
      );
      return;
    }
    
    saveItems();
  };
  
  // Save items
  const saveItems = async () => {
    setIsSaving(true);
    
    try {
      // Prepare invoice with updated items matching submitPricesEnhanced format
      const updatedInvoice = {
        ...invoice,
        items: items.map(item => ({
          ...item,
          // Ensure all required fields for submitPricesEnhanced
          barcode: item.barcode || item.productCode,
          productCode: item.productCode || item.barcode,
          name: item.name || item.description,
          description: item.description || item.name,
          quantity: item.quantity || 1,
          costPrice: item.costPrice || item.unitPrice || 0,
          unitPrice: item.unitPrice || item.costPrice || 0,
          sellingPrice: parseFloat(item.sellingPrice || 0),
          price: parseFloat(item.sellingPrice || 0), // Desktop expects 'price' field
          existsInInventory: item.existsInInventory || false,
          found: item.existsInInventory || false
        })).filter(item => item.barcode && item.sellingPrice > 0) // Only items with barcode and price
      };
      
      // Call parent save handler
      await onSave(updatedInvoice);
      
      // Success animation and close
      Vibration.vibrate([50, 100, 50]);
      
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true
        }),
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 400,
          useNativeDriver: true
        })
      ]).start(() => {
        onClose();
      });
    } catch (error) {
      Alert.alert(t('common.error'), error.message);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Calculate progress
  const calculateProgress = () => {
    if (items.length === 0) return { ready: 0, total: 0, percentage: 0 };
    
    const ready = items.filter(item => item.isReady).length;
    const percentage = Math.round((ready / items.length) * 100);
    
    return { ready, total: items.length, percentage };
  };
  
  const progress = calculateProgress();
  
  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="overFullScreen"
      transparent={true}
    >
      <Animated.View 
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <BlurView intensity={95} style={StyleSheet.absoluteFillObject} />
        
        <View style={styles.modalContent}>
          {/* Header */}
          <LinearGradient
            colors={['#4A90E2', '#357ABD']}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <View>
                <Text style={styles.title}>{t('priceEditor.title') || 'Edit Prices'}</Text>
                <Text style={styles.subtitle}>
                  {invoice?.vendor || t('common.unknownVendor')} • {invoice?.invoiceDate || 'N/A'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
              >
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Invoice Information Card */}
          {invoice && (
            <View style={styles.invoiceInfoCard}>
              <Text style={styles.invoiceInfoTitle}>📋 Invoice Information</Text>
              <View style={styles.invoiceInfoGrid}>
                {invoice.invoiceNumber && (
                  <View style={styles.invoiceInfoItem}>
                    <Text style={styles.invoiceInfoLabel}>Invoice #:</Text>
                    <Text style={styles.invoiceInfoValue}>{invoice.invoiceNumber}</Text>
                  </View>
                )}
                {invoice.vendor && (
                  <View style={styles.invoiceInfoItem}>
                    <Text style={styles.invoiceInfoLabel}>Vendor:</Text>
                    <Text style={styles.invoiceInfoValue}>{invoice.vendor}</Text>
                  </View>
                )}
                {invoice.totalAmount && (
                  <View style={styles.invoiceInfoItem}>
                    <Text style={styles.invoiceInfoLabel}>Total:</Text>
                    <Text style={styles.invoiceInfoValue}>{invoice.totalAmount} DZD</Text>
                  </View>
                )}
                {invoice.invoiceDate && (
                  <View style={styles.invoiceInfoItem}>
                    <Text style={styles.invoiceInfoLabel}>Date:</Text>
                    <Text style={styles.invoiceInfoValue}>{invoice.invoiceDate}</Text>
                  </View>
                )}
              </View>
              
              {/* Additional Fields from Server */}
              {invoice.additionalFields && Object.keys(invoice.additionalFields).length > 0 && (
                <View style={styles.additionalFieldsSection}>
                  <Text style={styles.additionalFieldsTitle}>📎 Additional Information</Text>
                  {Object.entries(invoice.additionalFields).map(([key, value], index) => (
                    <View key={index} style={styles.additionalField}>
                      <Text style={styles.additionalFieldKey}>{key}:</Text>
                      <Text style={styles.additionalFieldValue}>{value}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
          
          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>
                {progress.ready} / {progress.total} {t('priceEditor.itemsReady') || 'items ready'}
              </Text>
              <Text style={styles.progressPercentage}>{progress.percentage}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { width: `${progress.percentage}%` }
                ]}
              />
            </View>
          </View>
          
          {/* Content */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.content}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4A90E2" />
                <Text style={styles.loadingText}>{t('priceEditor.checkingProducts') || 'Checking products...'}</Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {/* Item Cards */}
                {items.map((item, index) => (
                  <TouchableOpacity 
                    key={index}
                    style={[
                      styles.itemCard,
                      item.existsInInventory && styles.itemCardFound,
                      item.isReady && styles.itemCardReady,
                      item.isManuallyAdded && styles.itemCardManual
                    ]}
                    onPress={() => {
                      setSelectedItem({...item, index});
                      setShowDetailModal(true);
                    }}
                    activeOpacity={0.8}
                  >
                    {/* Status Badge */}
                    <View style={styles.statusBadgeContainer}>
                      {item.existsInInventory ? (
                        <View style={[styles.statusBadge, styles.badgeFound]}>
                          <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                          <Text style={styles.badgeText}>{t('priceEditor.inStock')}</Text>
                        </View>
                      ) : item.isManuallyAdded ? (
                        <View style={[styles.statusBadge, styles.badgeManual]}>
                          <Ionicons name="add-circle" size={16} color="#FFF" />
                          <Text style={styles.badgeText}>{t('priceEditor.manuallyAdded')}</Text>
                        </View>
                      ) : (
                        <View style={[styles.statusBadge, styles.badgeNew]}>
                          <Ionicons name="alert-circle" size={16} color="#FFF" />
                          <Text style={styles.badgeText}>{t('priceEditor.newProduct')}</Text>
                        </View>
                      )}
                      {item.matchConfidence && (
                        <Text style={styles.confidenceText}>
                          {Math.round(item.matchConfidence * 100)}% match
                        </Text>
                      )}
                    </View>
                    
                    {/* Product Info */}
                    <Text style={styles.itemName}>{item.name || item.description}</Text>
                    
                    <View style={styles.itemDetails}>
                      <View style={styles.detailBox}>
                        <Text style={styles.detailLabel}>{t('priceEditor.quantity') || 'Qty'}</Text>
                        <TextInput
                          style={styles.quantityInput}
                          value={(item.quantity || 1).toString()}
                          onChangeText={(value) => updateItemQuantity(index, value)}
                          keyboardType="numeric"
                          selectTextOnFocus={true}
                        />
                      </View>
                      <View style={styles.detailBox}>
                        <Text style={styles.detailLabel}>{t('priceEditor.cost')}</Text>
                        <Text style={styles.detailValue}>
                          {(item.costPrice || item.unitPrice || 0).toFixed(2)}
                        </Text>
                      </View>
                      {item.existsInInventory && (
                        <View style={styles.detailBox}>
                          <Text style={styles.detailLabel}>{t('priceEditor.stock')}</Text>
                          <Text style={styles.detailValue}>{item.currentStock || 0}</Text>
                        </View>
                      )}
                    </View>
                    
                    {/* Barcode Section */}
                    <View style={styles.barcodeSection}>
                      <Text style={styles.sectionLabel}>{t('priceEditor.barcode')}</Text>
                      {item.needsBarcode ? (
                        <TouchableOpacity
                          style={styles.scanButton}
                          onPress={() => handleBarcodeScan(index)}
                        >
                          <Ionicons name="camera" size={20} color="#FFF" />
                          <Text style={styles.scanButtonText}>{t('priceEditor.scanBarcode')}</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.barcodeDisplay}>
                          <Ionicons name="barcode" size={20} color="#4CAF50" />
                          <Text style={styles.barcodeText}>{item.barcode}</Text>
                        </View>
                      )}
                    </View>
                    
                    {/* Product Code Section (from Azure Document AI) */}
                    {item.productCode && item.productCode !== item.barcode && (
                      <View style={styles.productCodeSection}>
                        <Text style={styles.sectionLabel}>{t('priceEditor.productCode') || 'Product Code'}</Text>
                        <View style={styles.productCodeDisplay}>
                          <Ionicons name="qr-code-outline" size={20} color="#2196F3" />
                          <Text style={styles.productCodeText}>{item.productCode}</Text>
                        </View>
                      </View>
                    )}
                    
                    {/* Price Section */}
                    <View style={styles.priceSection}>
                      <Text style={styles.sectionLabel}>{t('priceEditor.sellingPrice')}</Text>
                      {item.suggestedPrice && (
                        <Text style={styles.suggestedPrice}>
                          {t('priceEditor.suggested')}: {item.suggestedPrice.toFixed(2)}
                        </Text>
                      )}
                      <View style={styles.priceInputContainer}>
                        <TextInput
                          style={[
                            styles.priceInput,
                            item.hasValidPrice && styles.priceInputValid
                          ]}
                          value={item.sellingPrice?.toString() || ''}
                          onChangeText={(value) => updateItemPrice(index, value)}
                          placeholder={item.suggestedPrice?.toString() || t('priceEditor.enterPrice')}
                          placeholderTextColor="#999"
                          keyboardType="decimal-pad"
                          selectTextOnFocus={true}
                        />
                        <Text style={styles.currency}>{t('common.currency')}</Text>
                      </View>
                      
                      {/* Price validation */}
                      {item.sellingPrice && item.costPrice && 
                       parseFloat(item.sellingPrice) <= parseFloat(item.costPrice) && (
                        <View style={styles.priceWarning}>
                          <Ionicons name="warning" size={16} color="#FF9800" />
                          <Text style={styles.warningText}>
                            {t('priceEditor.priceBelowCost')}
                          </Text>
                        </View>
                      )}
                    </View>
                    
                    {/* Item Status Indicator */}
                    <View style={styles.itemStatusBar}>
                      <View 
                        style={[
                          styles.statusDot,
                          item.isReady ? styles.statusDotReady : 
                          item.hasValidPrice || !item.needsBarcode ? styles.statusDotPartial : 
                          styles.statusDotIncomplete
                        ]}
                      />
                      <Text style={styles.statusText}>
                        {item.isReady ? t('priceEditor.ready') :
                         item.hasValidPrice || !item.needsBarcode ? t('priceEditor.partial') :
                         t('priceEditor.incomplete')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
                
                {/* Add Product Button */}
                <TouchableOpacity
                  style={styles.addProductButton}
                  onPress={() => setShowAddProductModal(true)}
                >
                  <LinearGradient
                    colors={['#4CAF50', '#45A049']}
                    style={styles.addProductGradient}
                  >
                    <Ionicons name="add-circle-outline" size={28} color="#FFF" />
                    <Text style={styles.addProductText}>{t('priceEditor.addMissedProduct')}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            )}
          </KeyboardAvoidingView>
          
          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.saveButton,
                isSaving && styles.saveButtonDisabled
              ]}
              onPress={handleSaveAll}
              disabled={isSaving}
            >
              <LinearGradient
                colors={['#4CAF50', '#45A049']}
                style={styles.saveButtonGradient}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                    <Text style={styles.saveButtonText}>{t('priceEditor.saveAll')}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Barcode Scanner Modal */}
        <VisionCameraLiveScannerMLKit
          visible={showBarcodeScanner}
          onClose={() => {
            setShowBarcodeScanner(false);
            setScanningItemIndex(null);
          }}
          onBarcodeDetected={onBarcodeDetected}
          BarcodeScanning={BarcodeScanning}
          TextRecognition={TextRecognition}
        />
        
        {/* Product Detail Modal */}
        <Modal
          visible={showDetailModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowDetailModal(false)}
        >
          <View style={styles.detailModalOverlay}>
            <View style={styles.detailModalContent}>
              <View style={styles.detailModalHeader}>
                <Text style={styles.detailModalTitle}>📦 Product Details</Text>
                <TouchableOpacity
                  style={styles.detailModalClose}
                  onPress={() => setShowDetailModal(false)}
                >
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              
              {selectedItem && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Product Name */}
                  <View style={styles.detailField}>
                    <Text style={styles.detailFieldLabel}>Product Name</Text>
                    <TextInput
                      style={styles.detailTextInput}
                      value={selectedItem.name || selectedItem.description || ''}
                      onChangeText={(text) => {
                        const updatedItems = [...items];
                        updatedItems[selectedItem.index] = {
                          ...updatedItems[selectedItem.index],
                          name: text,
                          description: text
                        };
                        setItems(updatedItems);
                        setSelectedItem({...selectedItem, name: text, description: text});
                      }}
                      placeholder="Product name..."
                    />
                  </View>
                  
                  {/* Quantity */}
                  <View style={styles.detailField}>
                    <Text style={styles.detailFieldLabel}>Quantity</Text>
                    <TextInput
                      style={styles.detailTextInput}
                      value={(selectedItem.quantity || 1).toString()}
                      onChangeText={(text) => {
                        const updatedItems = [...items];
                        updatedItems[selectedItem.index] = {
                          ...updatedItems[selectedItem.index],
                          quantity: parseFloat(text) || 1
                        };
                        setItems(updatedItems);
                        setSelectedItem({...selectedItem, quantity: parseFloat(text) || 1});
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  
                  {/* Cost Price */}
                  <View style={styles.detailField}>
                    <Text style={styles.detailFieldLabel}>Cost Price (DZD)</Text>
                    <TextInput
                      style={styles.detailTextInput}
                      value={(selectedItem.costPrice || selectedItem.unitPrice || 0).toString()}
                      onChangeText={(text) => {
                        const updatedItems = [...items];
                        updatedItems[selectedItem.index] = {
                          ...updatedItems[selectedItem.index],
                          costPrice: parseFloat(text) || 0,
                          unitPrice: parseFloat(text) || 0
                        };
                        setItems(updatedItems);
                        setSelectedItem({...selectedItem, costPrice: parseFloat(text) || 0});
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  
                  {/* Selling Price */}
                  <View style={styles.detailField}>
                    <Text style={styles.detailFieldLabel}>Selling Price (DZD)</Text>
                    <TextInput
                      style={styles.detailTextInput}
                      value={(selectedItem.sellingPrice || 0).toString()}
                      onChangeText={(text) => {
                        const updatedItems = [...items];
                        updatedItems[selectedItem.index] = {
                          ...updatedItems[selectedItem.index],
                          sellingPrice: parseFloat(text) || 0
                        };
                        setItems(updatedItems);
                        setSelectedItem({...selectedItem, sellingPrice: parseFloat(text) || 0});
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  
                  {/* Barcode */}
                  <View style={styles.detailField}>
                    <Text style={styles.detailFieldLabel}>Barcode</Text>
                    <View style={styles.detailBarcodeContainer}>
                      <TextInput
                        style={[styles.detailTextInput, {flex: 1}]}
                        value={selectedItem.barcode || ''}
                        onChangeText={(text) => {
                          const updatedItems = [...items];
                          updatedItems[selectedItem.index] = {
                            ...updatedItems[selectedItem.index],
                            barcode: text,
                            needsBarcode: !text || text.startsWith('TEMP')
                          };
                          setItems(updatedItems);
                          setSelectedItem({...selectedItem, barcode: text});
                        }}
                        placeholder="Scan or enter barcode..."
                      />
                      <TouchableOpacity
                        style={styles.detailScanButton}
                        onPress={() => {
                          setScanningItemIndex(selectedItem.index);
                          setShowDetailModal(false);
                          setShowBarcodeScanner(true);
                        }}
                      >
                        <Ionicons name="camera" size={24} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {/* Additional Info */}
                  {selectedItem.existsInInventory && (
                    <View style={styles.detailInfoSection}>
                      <Text style={styles.detailInfoTitle}>📊 Inventory Info</Text>
                      <Text style={styles.detailInfoText}>Stock: {selectedItem.currentStock || 0}</Text>
                      {selectedItem.suggestedPrice && (
                        <Text style={styles.detailInfoText}>Suggested Price: {selectedItem.suggestedPrice} DZD</Text>
                      )}
                      {selectedItem.matchConfidence && (
                        <Text style={styles.detailInfoText}>Match: {Math.round(selectedItem.matchConfidence * 100)}%</Text>
                      )}
                    </View>
                  )}
                </ScrollView>
              )}
              
              {/* Save Button */}
              <TouchableOpacity
                style={styles.detailSaveButton}
                onPress={() => setShowDetailModal(false)}
              >
                <Text style={styles.detailSaveButtonText}>✅ Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        
        {/* Add Product Modal */}
        <Modal
          visible={showAddProductModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={styles.addProductModal}>
            <View style={styles.addProductContent}>
              <View style={styles.addProductHeader}>
                <Text style={styles.addProductTitle}>{t('priceEditor.addNewProduct')}</Text>
                <TouchableOpacity
                  onPress={() => setShowAddProductModal(false)}
                  style={styles.addProductClose}
                >
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.addProductForm}>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t('priceEditor.productName')} *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newProduct.name}
                    onChangeText={(text) => setNewProduct({...newProduct, name: text})}
                    placeholder={t('priceEditor.enterProductName')}
                  />
                </View>
                
                <View style={styles.formRow}>
                  <View style={[styles.formGroup, styles.formGroupHalf]}>
                    <Text style={styles.formLabel}>{t('priceEditor.quantity')} *</Text>
                    <TextInput
                      style={styles.formInput}
                      value={newProduct.quantity}
                      onChangeText={(text) => setNewProduct({...newProduct, quantity: text})}
                      keyboardType="numeric"
                      placeholder="1"
                    />
                  </View>
                  
                  <View style={[styles.formGroup, styles.formGroupHalf]}>
                    <Text style={styles.formLabel}>{t('priceEditor.costPrice')} *</Text>
                    <TextInput
                      style={styles.formInput}
                      value={newProduct.costPrice}
                      onChangeText={(text) => setNewProduct({...newProduct, costPrice: text})}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                    />
                  </View>
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t('priceEditor.barcode')} *</Text>
                  <View style={styles.barcodeInputContainer}>
                    <TextInput
                      style={[styles.formInput, styles.barcodeInput]}
                      value={newProduct.barcode}
                      onChangeText={(text) => setNewProduct({...newProduct, barcode: text})}
                      placeholder={t('priceEditor.scanOrEnterBarcode')}
                    />
                    <TouchableOpacity
                      style={styles.barcodeScanBtn}
                      onPress={() => {
                        setScanningItemIndex(-1); // Special index for new product
                        setShowBarcodeScanner(true);
                      }}
                    >
                      <Ionicons name="camera" size={24} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t('priceEditor.sellingPrice')} *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newProduct.sellingPrice}
                    onChangeText={(text) => setNewProduct({...newProduct, sellingPrice: text})}
                    keyboardType="decimal-pad"
                    placeholder={t('priceEditor.enterSellingPrice')}
                  />
                </View>
              </ScrollView>
              
              <View style={styles.addProductActions}>
                <TouchableOpacity
                  style={styles.addProductCancel}
                  onPress={() => {
                    setShowAddProductModal(false);
                    setNewProduct({
                      name: '',
                      quantity: '1',
                      costPrice: '',
                      barcode: '',
                      sellingPrice: ''
                    });
                  }}
                >
                  <Text style={styles.addProductCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.addProductConfirm}
                  onPress={handleAddProduct}
                >
                  <Text style={styles.addProductConfirmText}>{t('priceEditor.addProduct')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    marginTop: Platform.OS === 'ios' ? 50 : 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: 'hidden',
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  scrollContent: {
    padding: 15,
  },
  itemCard: {
    backgroundColor: '#FFF',
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  itemCardFound: {
    borderColor: '#4CAF50',
  },
  itemCardReady: {
    backgroundColor: '#F1F8E9',
  },
  itemCardManual: {
    borderColor: '#2196F3',
  },
  statusBadgeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  badgeFound: {
    backgroundColor: '#4CAF50',
  },
  badgeNew: {
    backgroundColor: '#FF9800',
  },
  badgeManual: {
    backgroundColor: '#2196F3',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  confidenceText: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  itemDetails: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 10,
  },
  detailBox: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  quantityInput: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 50,
    textAlign: 'center',
  },
  barcodeSection: {
    marginBottom: 15,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9800',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  scanButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  barcodeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  barcodeText: {
    fontSize: 14,
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  productCodeSection: {
    marginBottom: 15,
    marginTop: -5,
  },
  productCodeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    gap: 8,
  },
  productCodeText: {
    fontSize: 14,
    color: '#1976D2',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  priceSection: {
    marginBottom: 10,
  },
  suggestedPrice: {
    fontSize: 12,
    color: '#4CAF50',
    marginBottom: 5,
    fontStyle: 'italic',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priceInput: {
    flex: 1,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: 'bold',
  },
  priceInputValid: {
    borderColor: '#4CAF50',
    backgroundColor: '#F1F8E9',
  },
  currency: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'bold',
  },
  priceWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 5,
  },
  warningText: {
    fontSize: 12,
    color: '#FF9800',
  },
  itemStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusDotReady: {
    backgroundColor: '#4CAF50',
  },
  statusDotPartial: {
    backgroundColor: '#FF9800',
  },
  statusDotIncomplete: {
    backgroundColor: '#F44336',
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
  addProductButton: {
    marginTop: 10,
    marginBottom: 20,
  },
  addProductGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    gap: 10,
  },
  addProductText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 15,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 10,
    gap: 8,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Product Detail Modal Styles
  detailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  detailModalContent: {
    backgroundColor: '#FFF',
    borderRadius: 15,
    maxHeight: '80%',
  },
  detailModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  detailModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  detailModalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailField: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailFieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailTextInput: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  detailBarcodeContainer: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  detailScanButton: {
    backgroundColor: '#FF9800',
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailInfoSection: {
    padding: 20,
    backgroundColor: '#F8F9FA',
  },
  detailInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  detailInfoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  detailSaveButton: {
    backgroundColor: '#4CAF50',
    margin: 20,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  detailSaveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Add Product Modal Styles
  addProductModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  addProductContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: height * 0.8,
  },
  addProductHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  addProductTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addProductClose: {
    padding: 5,
  },
  addProductForm: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formRow: {
    flexDirection: 'row',
    gap: 15,
  },
  formGroupHalf: {
    flex: 1,
  },
  formLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  barcodeInputContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  barcodeInput: {
    flex: 1,
  },
  barcodeScanBtn: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 15,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addProductActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  addProductCancel: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  addProductCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  addProductConfirm: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 10,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  addProductConfirmText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: 'bold',
  },
  
  // Invoice Information Card Styles
  invoiceInfoCard: {
    backgroundColor: '#FFF',
    margin: 15,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  invoiceInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  invoiceInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  invoiceInfoItem: {
    width: '48%',
    marginBottom: 10,
  },
  invoiceInfoLabel: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  invoiceInfoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    marginTop: 2,
  },
  additionalFieldsSection: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  additionalFieldsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  additionalField: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  additionalFieldKey: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    minWidth: 100,
  },
  additionalFieldValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
});

export default EnhancedPriceEditorModal;