import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Dimensions,
  Animated,
  Platform,
  KeyboardAvoidingView,
  ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

const { width, height } = Dimensions.get('window');

const SaleConfirmationModal = ({
  visible,
  onClose,
  onConfirm,
  product
}) => {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState('');
  const [useCustomPrice, setUseCustomPrice] = useState(false);
  const [animation] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.9));

  useEffect(() => {
    if (visible) {
      // Reset states when modal opens
      setQuantity(1);
      setCustomPrice('');
      setUseCustomPrice(false);
      
      // Animation sequence
      Animated.parallel([
        Animated.timing(animation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(animation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible]);

  useEffect(() => {
    if (product && product.price) {
      setCustomPrice(product.price.toString());
    }
  }, [product]);

  const handleQuantityChange = (delta) => {
    const newQty = Math.max(1, Math.min(quantity + delta, product?.quantity || 999));
    setQuantity(newQty);
  };

  const handleQuantityInput = (text) => {
    const num = parseInt(text) || 1;
    if (num > 0 && num <= (product?.quantity || 999)) {
      setQuantity(num);
    }
  };

  const handlePriceInput = (text) => {
    // Allow only numbers and decimal point
    if (/^\d*\.?\d*$/.test(text)) {
      setCustomPrice(text);
      setUseCustomPrice(true);
    }
  };

  const getPrice = () => {
    if (useCustomPrice && customPrice) {
      return parseFloat(customPrice);
    }
    return product?.price || product?.selling_price || 0;
  };

  const getTotalAmount = () => {
    return (getPrice() * quantity).toFixed(2);
  };

  const handleConfirm = () => {
    onConfirm({
      barcode: product?.barcode,
      name: product?.name,
      quantity: quantity,
      price: getPrice(),
      total: parseFloat(getTotalAmount())
    });
  };

  if (!product) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        >
          <Animated.View 
            style={[
              styles.modalContent,
              {
                opacity: animation,
                transform: [{ scale: scaleAnim }]
              }
            ]}
          >
            <TouchableOpacity activeOpacity={1}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
              >
                <Text style={styles.headerTitle}>{t('selling.confirmSaleTitle')}</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </LinearGradient>

              <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                {/* Product Information */}
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.name || t('modals.unknownProduct')}</Text>
                  <View style={styles.productDetails}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{t('modals.barcode')}:</Text>
                      <Text style={styles.detailValue}>{product.barcode}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{t('modals.stock')}:</Text>
                      <Text style={[
                        styles.detailValue,
                        product.quantity <= 5 && styles.lowStock
                      ]}>
                        {product.quantity || 0} {t('modals.units')}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Quantity Selector */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('modals.quantity')}</Text>
                  <View style={styles.quantityContainer}>
                    <TouchableOpacity 
                      style={styles.quantityButton}
                      onPress={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1}
                    >
                      <Text style={[
                        styles.quantityButtonText,
                        quantity <= 1 && styles.disabledText
                      ]}>−</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.quantityInput}>
                      <Text style={styles.quantityInputText}>{quantity}</Text>
                    </View>
                    
                    <TouchableOpacity 
                      style={styles.quantityButton}
                      onPress={() => handleQuantityChange(1)}
                      disabled={quantity >= (product.quantity || 999)}
                    >
                      <Text style={[
                        styles.quantityButtonText,
                        quantity >= (product.quantity || 999) && styles.disabledText
                      ]}>+</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Quick quantity buttons */}
                  <View style={styles.quickQuantities}>
                    {[1, 2, 5, 10].map(qty => (
                      <TouchableOpacity
                        key={qty}
                        style={[
                          styles.quickQtyButton,
                          quantity === qty && styles.quickQtyButtonActive
                        ]}
                        onPress={() => setQuantity(qty)}
                        disabled={qty > (product.quantity || 999)}
                      >
                        <Text style={[
                          styles.quickQtyText,
                          quantity === qty && styles.quickQtyTextActive,
                          qty > (product.quantity || 999) && styles.disabledText
                        ]}>{qty}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Price Section */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('modals.unitPrice')}</Text>
                  <View style={styles.priceContainer}>
                    <Text style={styles.currencySymbol}>{t('common.currency')}</Text>
                    <TextInput
                      style={styles.priceInput}
                      value={customPrice}
                      onChangeText={handlePriceInput}
                      keyboardType="decimal-pad"
                      placeholder={product.price?.toString() || t('common.defaultPrice')}
                      placeholderTextColor="#999"
                      selectTextOnFocus
                    />
                  </View>
                  {!useCustomPrice && (
                    <Text style={styles.originalPrice}>
                      {t('modals.usingDefaultPrice')}: {t('common.currency')}{product.price || 0}
                    </Text>
                  )}
                </View>

                {/* Total Summary */}
                <View style={styles.summarySection}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>{t('modals.unitPrice')}:</Text>
                    <Text style={styles.summaryValue}>{t('common.currency')}{getPrice().toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>{t('modals.quantity')}:</Text>
                    <Text style={styles.summaryValue}>{t('common.multiply')} {quantity}</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>{t('modals.totalAmount')}:</Text>
                    <Text style={styles.totalValue}>{t('common.currency')}{getTotalAmount()}</Text>
                  </View>
                </View>
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.footer}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={onClose}
                >
                  <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.confirmButton}
                  onPress={handleConfirm}
                >
                  <LinearGradient
                    colors={['#00c851', '#00a846']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.confirmButtonGradient}
                  >
                    <Text style={styles.confirmButtonText}>
                      {t('selling.confirmSale')}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.9,
    maxWidth: 450,
    maxHeight: height * 0.85,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: height * 0.5,
  },
  productInfo: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  productName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  productDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  lowStock: {
    color: '#ff6b6b',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quantityButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 24,
    color: '#333',
    fontWeight: 'bold',
  },
  disabledText: {
    color: '#ccc',
  },
  quantityInput: {
    width: 80,
    height: 48,
    marginHorizontal: 16,
    borderWidth: 2,
    borderColor: '#667eea',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  quantityInputText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  quickQuantities: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  quickQtyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f8f9fa',
  },
  quickQtyButtonActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  quickQtyText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  quickQtyTextActive: {
    color: '#fff',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    backgroundColor: '#f8f9fa',
    width: '100%',
    maxWidth: '100%',
  },
  currencySymbol: {
    fontSize: 18,
    color: '#666',
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    fontSize: 18,
    color: '#333',
    fontWeight: '500',
    minWidth: 0,
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  summarySection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    textAlign: 'right',
    flexShrink: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00c851',
    textAlign: 'right',
    flexShrink: 1,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  confirmButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirmButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default SaleConfirmationModal;