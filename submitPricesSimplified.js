/**
 * submitPricesSimplified.js - CLEAN implementation using only ConnectionManager
 * Replaces the complex submitPricesEnhanced.js with 500+ lines of spaghetti code
 *
 * 💭 ARGUMENT: One simple flow, one connection manager, no redundancy
 */

import ConnectionManager from './ConnectionManager';
import { Alert } from 'react-native';

/**
 * Submit invoice prices - THE ONLY submission function you need
 * @param {Object} currentInvoice - Invoice with items and prices set by user
 * @param {Function} setIsProcessing - UI state setter
 * @param {Function} setShowPriceEditor - Close price editor modal
 * @param {Function} setCurrentInvoice - Clear current invoice
 * @param {Object} t - Translation function
 */
export const submitPrices = async ({
  currentInvoice,
  setIsProcessing,
  setShowPriceEditor,
  setCurrentInvoice,
  t
}) => {
  // Validation
  if (!currentInvoice) {
    console.error('No invoice to submit');
    return;
  }

  // Filter items with valid prices
  const validItems = currentInvoice.items.filter(item =>
    (item.barcode || item.productCode) &&
    item.sellingPrice > 0
  );

  if (validItems.length === 0) {
    Alert.alert(
      t('invoice.noValidItems') || '⚠️ No Valid Items',
      t('invoice.noValidItemsMessage') || 'Please set prices for items with barcodes.'
    );
    return;
  }

  try {
    setIsProcessing(true);
    console.log(`📤 Submitting ${validItems.length} items with prices`);

    // Prepare invoice with valid items
    const invoiceToSubmit = {
      ...currentInvoice,
      items: validItems
    };

    // 🎯 THE MAIN CALL - Everything else is handled internally
    const result = await ConnectionManager.submitInvoice(invoiceToSubmit);

    // Handle result based on method used
    if (result.success) {
      if (result.method === 'direct_desktop') {
        // Best case - desktop was online
        Alert.alert(
          '✅ Stock Updated',
          `Successfully updated ${validItems.length} items in inventory.\n\n` +
          `Desktop: ✅ Synced immediately\n` +
          `Status: Ready for sales`,
          [{
            text: 'Done',
            onPress: () => {
              setShowPriceEditor(false);
              setCurrentInvoice(null);
            }
          }]
        );

      } else if (result.method === 'cloud_relay_queued') {
        // Desktop offline - queued for later
        Alert.alert(
          '📦 Invoice Queued',
          `Processed ${validItems.length} items.\n\n` +
          `Cloud: ✅ Backed up\n` +
          `Desktop: 📦 Will sync when available\n\n` +
          `Items will appear in inventory once desktop comes online.`,
          [{
            text: 'OK',
            onPress: () => {
              setShowPriceEditor(false);
              setCurrentInvoice(null);
            }
          }]
        );
      }

    } else {
      // Failed but saved locally
      Alert.alert(
        '💾 Saved Locally',
        `Invoice saved on device.\n\n` +
        `Will retry automatically when connection is restored.\n` +
        `${validItems.length} items pending.`,
        [{
          text: 'OK',
          onPress: () => {
            setShowPriceEditor(false);
            setCurrentInvoice(null);
          }
        }]
      );
    }

  } catch (error) {
    console.error('❌ Submit error:', error);
    Alert.alert(
      t('common.error') || 'Error',
      `Failed to submit: ${error.message}`
    );

  } finally {
    setIsProcessing(false);
  }
};

/**
 * Configure desktop connection
 * 💭 ARGUMENT: Simple manual configuration, no complex discovery
 */
export const configureDesktop = async (ipAddress) => {
  try {
    const result = await ConnectionManager.setDesktopUrl(ipAddress);

    if (result.success) {
      Alert.alert(
        '✅ Desktop Connected',
        `Successfully connected to desktop at ${result.url}\n\n` +
        `Any queued invoices will now sync automatically.`
      );
      return true;
    } else {
      Alert.alert(
        '❌ Connection Failed',
        result.error
      );
      return false;
    }

  } catch (error) {
    Alert.alert(
      'Error',
      `Failed to configure: ${error.message}`
    );
    return false;
  }
};

/**
 * Get connection status
 */
export const getConnectionStatus = () => {
  return ConnectionManager.getStatus();
};

/**
 * Manual queue processing (for debug/testing)
 */
export const processQueueManually = async () => {
  try {
    await ConnectionManager.processQueue();
    Alert.alert('Queue Processing', 'Queue processing started');
  } catch (error) {
    Alert.alert('Error', `Queue processing failed: ${error.message}`);
  }
};