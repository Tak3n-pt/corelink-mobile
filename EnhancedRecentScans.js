/**
 * EnhancedRecentScans.js - Comprehensive recent scans display with full invoice details
 * Shows invoice images, complete item lists, and all invoice information
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

const { width, height } = Dimensions.get('window');

const EnhancedRecentScans = ({ visible, onClose }) => {
  const [recentScans, setRecentScans] = useState([]);
  const [selectedScan, setSelectedScan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [invoiceDetailsExpanded, setInvoiceDetailsExpanded] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (visible) {
      loadRecentScans();
    }
  }, [visible]);

  /**
   * Load recent scans from MOBILE LOCAL storage only
   */
  const loadRecentScans = async () => {
    try {
      setLoading(true);
      console.log('📱 Loading mobile recent scans from local storage...');
      
      const stored = await AsyncStorage.getItem('recentScans');
      if (stored) {
        const scans = JSON.parse(stored);
        // Sort by timestamp, newest first
        const sortedScans = scans.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setRecentScans(sortedScans);
      } else {
        setRecentScans([]);
      }
    } catch (error) {
      console.error('❌ Failed to load recent scans:', error);
      Alert.alert(t('common.error'), t('recentScans.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Refresh scans with pull-to-refresh
   */
  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecentScans();
    setRefreshing(false);
  };

  /**
   * Clear all recent scans
   */
  const clearAllScans = () => {
    Alert.alert(
      t('recentScans.clearAllTitle'),
      t('recentScans.clearAllMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('recentScans.clearAll'),
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('recentScans');
              setRecentScans([]);
              Alert.alert(t('common.success'), t('recentScans.allCleared'));
            } catch (error) {
              Alert.alert(t('common.error'), t('recentScans.clearFailed'));
            }
          }
        }
      ]
    );
  };

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return t('common.justNow');
    if (diffMinutes < 60) return t('common.minutesAgo', { minutes: diffMinutes });
    if (diffHours < 24) return t('common.hoursAgo', { hours: diffHours });
    if (diffDays < 7) return t('common.daysAgo', { days: diffDays });
    return date.toLocaleDateString();
  };

  /**
   * Normalize scan data to handle both mobile and desktop field formats
   */
  const normalizeScanData = (scan) => {
    return {
      ...scan,
      // Normalize field names - handle both camelCase and snake_case
      vendor: scan.vendor || scan.vendor_name || t('recentScans.unknownVendor'),
      invoiceNumber: scan.invoiceNumber || scan.invoice_number,
      invoiceDate: scan.invoiceDate || scan.invoice_date,
      totalItems: scan.totalItems || scan.total_items || (scan.items ? scan.items.length : 0),
      total: scan.total || scan.total_amount,
      productName: scan.productName || scan.product_name,
      // Ensure items array exists
      items: scan.items || [],
      // Handle image fields
      imageUri: scan.imageUri || scan.invoice_image_url || scan.invoiceImageUrl,
      imageUris: scan.imageUris || (scan.images ? scan.images.map(img => img.url || img.path) : []),
    };
  };

  /**
   * Get scan type icon and color
   */
  const getScanTypeInfo = (scan) => {
    if (scan.type === 'invoice') {
      return {
        icon: '📄',
        color: '#4CAF50',
        label: t('recentScans.invoice')
      };
    } else if (scan.type === 'barcode') {
      return {
        icon: '🔍',
        color: '#2196F3',
        label: t('recentScans.barcode')
      };
    }
    return {
      icon: '📋',
      color: '#9E9E9E',
      label: t('recentScans.scan')
    };
  };

  /**
   * Render scan summary card
   */
  const renderScanCard = (scan, index) => {
    const normalizedScan = normalizeScanData(scan);
    const typeInfo = getScanTypeInfo(normalizedScan);
    
    return (
      <TouchableOpacity
        key={scan.id || index}
        style={styles.scanCard}
        onPress={() => setSelectedScan(normalizedScan)}
      >
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)']}
          style={styles.scanCardGradient}
        >
          {/* Header */}
          <View style={styles.scanHeader}>
            <View style={styles.scanTypeContainer}>
              <Text style={styles.scanTypeIcon}>{typeInfo.icon}</Text>
              <View style={[styles.scanTypeBadge, { backgroundColor: typeInfo.color }]}>
                <Text style={styles.scanTypeText}>{typeInfo.label}</Text>
              </View>
            </View>
            <Text style={styles.scanTimestamp}>{formatTimestamp(scan.timestamp)}</Text>
          </View>

          {/* Invoice Image Preview - handles both single and multiple images */}
          {(normalizedScan.imageUri || (normalizedScan.imageUris && normalizedScan.imageUris.length > 0)) && (
            <View style={styles.imagePreviewContainer}>
              <Image
                source={{ uri: normalizedScan.imageUri || normalizedScan.imageUris[0] }}
                style={styles.imagePreview}
                resizeMode="cover"
              />
              <View style={styles.imageOverlay}>
                {normalizedScan.imageUris && normalizedScan.imageUris.length > 1 ? (
                  <Text style={styles.imageOverlayText}>{normalizedScan.imageUris.length}📄</Text>
                ) : (
                  <Text style={styles.imageOverlayText}>📷</Text>
                )}
              </View>
            </View>
          )}

          {/* Content */}
          {normalizedScan.type === 'invoice' ? (
            <View style={styles.invoiceContent}>
              <Text style={styles.vendorName}>{normalizedScan.vendor}</Text>
              <Text style={styles.invoiceDetails}>
                {normalizedScan.invoiceNumber ? t('recentScans.invoiceNumber', { number: normalizedScan.invoiceNumber }) : t('recentScans.noInvoiceNumber')}
              </Text>
              {normalizedScan.invoiceDate && (
                <Text style={styles.invoiceDetails}>
                  {t('recentScans.date')}: {new Date(normalizedScan.invoiceDate).toLocaleDateString()}
                </Text>
              )}
              
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{normalizedScan.totalItems}</Text>
                  <Text style={styles.statLabel}>{t('recentScans.items')}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    ${normalizedScan.total ? parseFloat(normalizedScan.total).toFixed(2) : '0.00'}
                  </Text>
                  <Text style={styles.statLabel}>{t('recentScans.total')}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { 
                    color: normalizedScan.isMultiPage ? '#FF9800' : '#4CAF50' 
                  }]}>
                    {normalizedScan.isMultiPage ? `${normalizedScan.pageCount}P` : '1P'}
                  </Text>
                  <Text style={styles.statLabel}>{t('recentScans.pages')}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.barcodeContent}>
              <Text style={styles.productName}>{normalizedScan.productName}</Text>
              <Text style={styles.barcodeNumber}>{normalizedScan.barcode}</Text>
            </View>
          )}

          {/* Status Indicator */}
          <View style={styles.statusIndicator}>
            <View style={[styles.statusDot, { 
              backgroundColor: normalizedScan.status === 'processed' ? '#4CAF50' : '#FF9800' 
            }]} />
            <Text style={styles.statusText}>
              {normalizedScan.status === 'processed' ? t('recentScans.processed') : t('recentScans.queued')}
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  /**
   * Render detailed scan view modal
   */
  const renderScanDetails = () => {
    if (!selectedScan) return null;

    const normalizedScan = normalizeScanData(selectedScan);
    const typeInfo = getScanTypeInfo(normalizedScan);

    return (
      <Modal
        visible={!!selectedScan}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setSelectedScan(null);
          setInvoiceDetailsExpanded(false);
        }}
      >
        <View style={styles.detailsContainer}>
          {/* Header */}
          <View style={styles.detailsHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setSelectedScan(null);
                setInvoiceDetailsExpanded(false);
              }}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.detailsTitle}>{t('recentScans.scanDetails')}</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.detailsContent}>
            {/* Type and Timestamp */}
            <View style={styles.detailsCard}>
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>{t('recentScans.type')}:</Text>
                <View style={styles.detailsTypeContainer}>
                  <Text style={styles.detailsTypeIcon}>{typeInfo.icon}</Text>
                  <Text style={[styles.detailsValue, { color: typeInfo.color }]}>
                    {typeInfo.label}
                  </Text>
                </View>
              </View>
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>{t('recentScans.time')}:</Text>
                <Text style={styles.detailsValue}>
                  {new Date(normalizedScan.timestamp).toLocaleString()}
                </Text>
              </View>
            </View>

            {/* Invoice Images - handles both single and multiple images */}
            {(normalizedScan.imageUri || (normalizedScan.imageUris && normalizedScan.imageUris.length > 0)) && (
              <View style={styles.detailsCard}>
                <Text style={styles.detailsCardTitle}>
                  {normalizedScan.imageUris && normalizedScan.imageUris.length > 1 
                    ? t('recentScans.invoiceImagesMultiple', { count: normalizedScan.imageUris.length })
                    : t('recentScans.invoiceImage')}
                </Text>
                {normalizedScan.imageUris && normalizedScan.imageUris.length > 1 ? (
                  // Multiple images - show all pages
                  <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.imageScrollContainer}>
                    {normalizedScan.imageUris.map((imageUri, index) => (
                      <View key={index} style={styles.imagePageContainer}>
                        <Text style={styles.imagePageLabel}>{t('recentScans.page', { page: index + 1 })}</Text>
                        <Image
                          source={{ uri: imageUri }}
                          style={styles.detailsImageMultiple}
                          resizeMode="contain"
                        />
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  // Single image
                  <Image
                    source={{ uri: normalizedScan.imageUri || normalizedScan.imageUris[0] }}
                    style={styles.detailsImage}
                    resizeMode="contain"
                  />
                )}
              </View>
            )}

            {/* Invoice Information */}
            {normalizedScan.type === 'invoice' && (
              <>
                <View style={styles.detailsCard}>
                  <TouchableOpacity 
                    style={styles.collapsibleHeader}
                    onPress={() => setInvoiceDetailsExpanded(!invoiceDetailsExpanded)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={invoiceDetailsExpanded 
                      ? (t('recentScans.collapseInvoiceDetails') || 'Collapse invoice details') 
                      : (t('recentScans.expandInvoiceDetails') || 'Expand invoice details')}
                    accessibilityHint={t('recentScans.tapToToggleDetails') || 'Tap to toggle invoice details'}
                  >
                    <View style={styles.collapsibleHeaderContent}>
                      <Text style={styles.collapsibleTitle}>
                        📋 {normalizedScan.vendor || t('recentScans.unknownVendor') || 'Unknown Vendor'} • ${normalizedScan.total ? parseFloat(normalizedScan.total).toFixed(2) : '0.00'}
                      </Text>
                      <Text style={styles.collapsibleSubtitle}>
                        {normalizedScan.totalItems || 0} {t('recentScans.items')} • {normalizedScan.timestamp ? formatTimestamp(normalizedScan.timestamp) : t('common.unknown') || 'Unknown time'}
                      </Text>
                    </View>
                    <Text style={[styles.expandIcon, { 
                      transform: [{ rotate: invoiceDetailsExpanded ? '90deg' : '0deg' }] 
                    }]}>
                      ▶️
                    </Text>
                  </TouchableOpacity>
                  
                  {invoiceDetailsExpanded && (
                    <View style={styles.expandedContent}>
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>{t('recentScans.vendor')}:</Text>
                        <Text style={styles.detailsValue}>{normalizedScan.vendor}</Text>
                      </View>
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>{t('recentScans.invoiceNumber')}:</Text>
                        <Text style={styles.detailsValue}>
                          {normalizedScan.invoiceNumber || t('recentScans.notAvailable')}
                        </Text>
                      </View>
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>{t('recentScans.date')}:</Text>
                        <Text style={styles.detailsValue}>
                          {normalizedScan.invoiceDate || t('recentScans.notAvailable')}
                        </Text>
                      </View>
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>{t('recentScans.total')}:</Text>
                        <Text style={[styles.detailsValue, styles.totalValue]}>
                          ${normalizedScan.total ? parseFloat(normalizedScan.total).toFixed(2) : '0.00'}
                        </Text>
                      </View>
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>{t('recentScans.pages')}:</Text>
                        <Text style={styles.detailsValue}>
                          {normalizedScan.isMultiPage ? t('recentScans.multiplePages', {count: normalizedScan.pageCount}) : t('recentScans.singlePage')}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Items List */}
                {normalizedScan.items && normalizedScan.items.length > 0 && (
                  <View style={styles.detailsCard}>
                    <Text style={styles.detailsCardTitle}>
                      {t('recentScans.itemsList', {count: normalizedScan.items.length})}
                    </Text>
                    {normalizedScan.items.map((item, index) => (
                      <View key={index} style={styles.itemRow}>
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemName}>
                            {item.name || item.description || t('recentScans.itemDefault', {number: index + 1})}
                          </Text>
                          <Text style={styles.itemDetails}>
                            {t('recentScans.itemQty')}: {item.quantity || 1} | {t('recentScans.itemCost')}: ${(item.costPrice || item.cost || item.unitPrice) ? parseFloat(item.costPrice || item.cost || item.unitPrice).toFixed(2) : '0.00'} | {t('recentScans.itemSell')}: ${item.sellingPrice ? parseFloat(item.sellingPrice).toFixed(2) : '0.00'}
                          </Text>
                          {item.barcode && (
                            <Text style={styles.itemBarcode}>{t('recentScans.barcode')}: {item.barcode}</Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Barcode Information */}
            {normalizedScan.type === 'barcode' && (
              <View style={styles.detailsCard}>
                <Text style={styles.detailsCardTitle}>{t('recentScans.productInformation')}</Text>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>{t('recentScans.productName')}:</Text>
                  <Text style={styles.detailsValue}>
                    {normalizedScan.productName}
                  </Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>{t('recentScans.barcode')}:</Text>
                  <Text style={[styles.detailsValue, styles.barcodeValue]}>
                    {normalizedScan.barcode}
                  </Text>
                </View>
              </View>
            )}

            {/* Technical Information */}
            <View style={styles.detailsCard}>
              <Text style={styles.detailsCardTitle}>{t('recentScans.technicalDetails')}</Text>
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>{t('recentScans.requestId')}:</Text>
                <Text style={[styles.detailsValue, styles.technicalValue]}>
                  {normalizedScan.requestId || t('recentScans.notAvailable')}
                </Text>
              </View>
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>{t('recentScans.status')}:</Text>
                <Text style={[styles.detailsValue, {
                  color: normalizedScan.status === 'processed' ? '#4CAF50' : '#FF9800'
                }]}>
                  {normalizedScan.status || t('common.unknown')}
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('recentScans.title')}</Text>
          <TouchableOpacity style={styles.clearButton} onPress={clearAllScans}>
            <Text style={styles.clearButtonText}>{t('recentScans.clearAll')}</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.loadingText}>{t('recentScans.loading')}</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#ffffff"
              />
            }
          >
            {recentScans.length > 0 ? (
              recentScans.map(renderScanCard)
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyText}>{t('recentScans.empty')}</Text>
                <Text style={styles.emptySubtext}>
                  {t('recentScans.emptySubtext')}
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* Scan Details Modal */}
        {renderScanDetails()}
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  clearButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.5)',
  },
  clearButtonText: {
    color: '#FF5252',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 0,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 10,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  emptySubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    textAlign: 'center',
  },
  
  // Scan Card Styles
  scanCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  scanCardGradient: {
    padding: 16,
  },
  scanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  scanTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanTypeIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  scanTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scanTypeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scanTimestamp: {
    color: '#666',
    fontSize: 12,
  },
  
  // Image Preview Styles
  imagePreviewContainer: {
    position: 'relative',
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageOverlayText: {
    fontSize: 16,
  },
  
  // Content Styles
  invoiceContent: {
    marginBottom: 12,
  },
  vendorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  invoiceDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  
  barcodeContent: {
    marginBottom: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  barcodeNumber: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
  },
  
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
  
  // Details Modal Styles
  detailsContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerSpacer: {
    width: 40,
  },
  detailsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  detailsContent: {
    flex: 1,
    padding: 16,
  },
  
  detailsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailsCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailsLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  detailsValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '400',
    flex: 1,
    textAlign: 'right',
  },
  detailsTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsTypeIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  
  detailsImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  
  // Multi-image styles
  imageScrollContainer: {
    flexDirection: 'row',
  },
  imagePageContainer: {
    marginRight: 12,
    alignItems: 'center',
  },
  imagePageLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  detailsImageMultiple: {
    width: 150,
    height: 200,
    borderRadius: 8,
  },
  
  totalValue: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#4CAF50',
  },
  
  barcodeValue: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  
  technicalValue: {
    fontFamily: 'monospace',
    fontSize: 11,
  },
  
  // Item Styles
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  itemBarcode: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  
  // Collapsible header styles
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  collapsibleHeaderContent: {
    flex: 1,
  },
  collapsibleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  collapsibleSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  expandIcon: {
    fontSize: 16,
    marginLeft: 12,
    color: '#007AFF',
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    paddingTop: 12,
    marginTop: 8,
  },
});

export default EnhancedRecentScans;