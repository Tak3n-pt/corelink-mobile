/**
 * ConnectionManager.js - HYBRID connection system (Cloud Primary + Local Fallback)
 * Cloud relay is primary method, with direct local connection as fallback
 *
 * Business Flow:
 * 1. Try cloud relay first (always available, works anywhere)
 * 2. If cloud fails, try direct local connection (faster when on same network)
 * 3. Desktop receives via WebSocket (from cloud) OR HTTP (direct local)
 * 4. Queue locally if both methods fail
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';

class ConnectionManager {
  constructor() {
    // Configuration - Hybrid approach
    this.config = {
      // Cloud relay server (PRIMARY method) - Using deployed cloud server
      cloudRelayUrl: 'https://invoice-processor-dot-my-invoice-server-2025.uc.r.appspot.com',

      // Desktop direct URL (FALLBACK method) - will use finalize endpoint
      desktopUrl: null,
      desktopUrlKey: 'DESKTOP_URL_CONFIG',

      // Store identification
      storeId: 'store_001', // TODO: Get from user settings

      // Settings
      maxRetries: 3,
      timeout: 5000, // 5 seconds for local, cloud has its own timeout
      cloudTimeout: 10000, // 10 seconds for cloud relay
      queueKey: 'HYBRID_QUEUE',
      checkInterval: 30000 // Check every 30 seconds
    };

    // State
    this.state = {
      isCloudReachable: true,
      isDesktopReachable: false,
      lastCloudCheck: 0,
      lastDesktopCheck: 0,
      queueProcessing: false,
      preferredMethod: 'cloud' // 'cloud' or 'local'
    };

    // Initialize
    this.init();
  }

  async init() {
    // Load store ID from settings
    const savedStoreId = await AsyncStorage.getItem('STORE_ID');
    if (savedStoreId) {
      this.config.storeId = savedStoreId;
      console.log('🏪 Store ID:', savedStoreId);
    }

    // Load saved desktop URL for fallback
    const savedUrl = await AsyncStorage.getItem(this.config.desktopUrlKey);
    if (savedUrl) {
      this.config.desktopUrl = savedUrl;
      console.log('📍 Desktop URL for fallback:', savedUrl);
    }

    // Start background queue processor
    this.startQueueProcessor();
  }

  /**
   * Main method - Submit invoice with cloud-first, local-fallback approach
   * @param {Object} invoice - Complete invoice data with items and images
   * @returns {Object} Result with success status and delivery method
   */
  async submitInvoice(invoice) {
    console.log('🚀 ConnectionManager: Starting hybrid invoice submission');

    try {
      // Step 1: Validate invoice data
      this.validateInvoiceData(invoice);

      // Step 2: Prepare data for submission
      const preparedData = await this.prepareInvoiceData(invoice);

      // Step 3: Try CLOUD RELAY first (primary method)
      console.log('☁️ Attempting cloud relay submission...');
      try {
        const cloudResult = await this.sendToCloudRelay(preparedData);

        if (cloudResult.success) {
          if (cloudResult.delivered) {
            console.log('✅ Invoice delivered via cloud relay');
            return {
              success: true,
              method: 'cloud_relay_delivered',
              message: 'Invoice delivered to desktop via cloud relay'
            };
          } else if (cloudResult.queued) {
            console.log('📦 Invoice queued in cloud for offline desktop');
            return {
              success: true,
              method: 'cloud_relay_queued',
              message: 'Desktop offline - invoice queued in cloud'
            };
          }
        }
      } catch (cloudError) {
        console.log('⚠️ Cloud relay failed:', cloudError.message);
      }

      // Step 4: Cloud failed - try DIRECT LOCAL connection (fallback)
      if (this.config.desktopUrl && await this.isDesktopDirectlyReachable()) {
        console.log('🏠 Attempting direct local connection...');

        try {
          const localResult = await this.sendToDesktopDirect(preparedData);

          if (localResult.success) {
            console.log('✅ Invoice delivered via direct local connection');
            return {
              success: true,
              method: 'direct_local',
              message: 'Invoice delivered directly to desktop (local network)'
            };
          }
        } catch (localError) {
          console.log('⚠️ Direct local connection failed:', localError.message);
        }
      }

      // Step 5: Both methods failed - save locally for retry
      console.log('📴 Both cloud and local failed - saving to queue');
      await this.queueLocally(preparedData);

      return {
        success: true,
        method: 'local_queue',
        message: 'No connection available - invoice saved for later sync'
      };

    } catch (error) {
      console.error('❌ Fatal error in submitInvoice:', error);
      throw error;
    }
  }

  /**
   * Send invoice to cloud relay server
   */
  async sendToCloudRelay(preparedData) {
    try {
      const response = await fetch(`${this.config.cloudRelayUrl}/relay/invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          storeId: this.config.storeId,
          invoice: preparedData
        }),
        timeout: this.config.cloudTimeout
      });

      if (!response.ok) {
        throw new Error(`Cloud relay returned ${response.status}`);
      }

      const result = await response.json();
      return result;

    } catch (error) {
      console.error('❌ Cloud relay error:', error);
      throw error;
    }
  }

  /**
   * Send invoice directly to desktop using finalize endpoint
   */
  async sendToDesktopDirect(preparedData) {
    if (!this.config.desktopUrl) {
      throw new Error('No desktop URL configured');
    }

    try {
      // Use the finalize endpoint as requested
      const url = `http://${this.config.desktopUrl}:4000/invoices/finalize`;

      console.log(`📡 Sending to desktop finalize endpoint: ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(preparedData),
        timeout: this.config.timeout
      });

      if (!response.ok) {
        throw new Error(`Desktop returned ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Desktop finalize successful:', result);

      return {
        success: true,
        data: result
      };

    } catch (error) {
      console.error('❌ Desktop direct connection failed:', error);
      throw error;
    }
  }

  /**
   * Check if desktop is directly reachable on local network
   */
  async isDesktopDirectlyReachable() {
    if (!this.config.desktopUrl) {
      return false;
    }

    // Cache check for 30 seconds
    const now = Date.now();
    if (now - this.state.lastDesktopCheck < this.config.checkInterval) {
      return this.state.isDesktopReachable;
    }

    try {
      const url = `http://${this.config.desktopUrl}:4000/health`;

      const response = await fetch(url, {
        method: 'GET',
        timeout: 2000 // Quick timeout for health check
      });

      this.state.isDesktopReachable = response.ok;
      this.state.lastDesktopCheck = now;

      console.log(`🏠 Desktop ${this.state.isDesktopReachable ? 'reachable' : 'unreachable'} on local network`);

      return this.state.isDesktopReachable;

    } catch (error) {
      this.state.isDesktopReachable = false;
      this.state.lastDesktopCheck = now;
      return false;
    }
  }

  /**
   * Validate invoice data before submission
   */
  validateInvoiceData(invoice) {
    if (!invoice) {
      throw new Error('Invoice data is required');
    }

    if (!invoice.items || invoice.items.length === 0) {
      throw new Error('Invoice must have at least one item');
    }

    // Validate each item has required fields
    invoice.items.forEach((item, index) => {
      if (!item.name) {
        throw new Error(`Item ${index + 1} missing name`);
      }
      if (item.quantity == null || item.quantity <= 0) {
        throw new Error(`Item ${index + 1} has invalid quantity`);
      }
      if (item.sellingPrice == null || item.sellingPrice < 0) {
        throw new Error(`Item ${index + 1} has invalid selling price`);
      }
    });

    console.log('✅ Invoice validation passed');
  }

  /**
   * Prepare invoice data for submission
   */
  async prepareInvoiceData(invoice) {
    const preparedData = {
      requestId: invoice.requestId || `mobile_${Date.now()}`,
      vendor: invoice.vendor || invoice.vendorName || 'Unknown Vendor',
      invoiceNumber: invoice.invoiceNumber || `INV-${Date.now()}`,
      invoiceDate: invoice.invoiceDate || new Date().toISOString(),
      items: invoice.items.map(item => ({
        barcode: item.barcode || item.productCode || '',
        name: item.name || item.description,
        quantity: parseInt(item.quantity) || 1,
        costPrice: parseFloat(item.unitPrice) || 0,
        sellingPrice: parseFloat(item.sellingPrice) || 0,
        total: (parseFloat(item.sellingPrice) || 0) * (parseInt(item.quantity) || 1)
      })),
      total: invoice.total || 0,
      subtotal: invoice.subtotal || 0,
      tax: invoice.tax || 0,
      metadata: {
        source: 'mobile_app',
        timestamp: Date.now(),
        isMultiPage: invoice.isMultiPage || false,
        pageCount: invoice.pageCount || 1
      }
    };

    // Convert images to base64 if present
    if (invoice.imageUris && invoice.imageUris.length > 0) {
      preparedData.invoiceImages = [];

      for (let i = 0; i < invoice.imageUris.length; i++) {
        try {
          const base64 = await FileSystem.readAsStringAsync(invoice.imageUris[i], {
            encoding: FileSystem.EncodingType.Base64
          });

          preparedData.invoiceImages.push({
            base64,
            pageNumber: i + 1,
            mimeType: 'image/jpeg'
          });

          console.log(`📸 Converted image ${i + 1}/${invoice.imageUris.length}`);
        } catch (error) {
          console.error(`Failed to convert image ${i + 1}:`, error);
        }
      }
    }

    console.log(`✅ Prepared invoice with ${preparedData.items.length} items`);
    return preparedData;
  }

  /**
   * Queue invoice locally for later sync
   */
  async queueLocally(preparedData) {
    try {
      const queue = await this.getQueue();

      const queueItem = {
        id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        data: preparedData,
        attempts: 0,
        status: 'pending',
        lastError: null
      };

      queue.push(queueItem);
      await AsyncStorage.setItem(this.config.queueKey, JSON.stringify(queue));

      console.log('💾 Queued locally:', queueItem.id);

      return queueItem.id;

    } catch (error) {
      console.error('❌ Local queue error:', error);
      throw error;
    }
  }

  /**
   * Get queue from storage
   */
  async getQueue() {
    try {
      const queueData = await AsyncStorage.getItem(this.config.queueKey);
      return queueData ? JSON.parse(queueData) : [];
    } catch (error) {
      console.error('Error reading queue:', error);
      return [];
    }
  }

  /**
   * Process queued items when connection available
   */
  async processQueue() {
    if (this.state.queueProcessing) {
      return; // Already processing
    }

    try {
      this.state.queueProcessing = true;

      const queue = await this.getQueue();
      const pending = queue.filter(item => item.status === 'pending' && item.attempts < this.config.maxRetries);

      if (pending.length === 0) {
        return;
      }

      console.log(`📤 Processing ${pending.length} queued items`);

      for (const item of pending) {
        try {
          item.attempts++;

          // Try cloud first, then local
          let result = null;

          try {
            result = await this.sendToCloudRelay(item.data);
            if (result.success) {
              item.status = 'completed';
              console.log(`✅ Queue item ${item.id} synced via cloud`);
            }
          } catch (cloudError) {
            // Cloud failed, try local
            if (await this.isDesktopDirectlyReachable()) {
              result = await this.sendToDesktopDirect(item.data);
              if (result.success) {
                item.status = 'completed';
                console.log(`✅ Queue item ${item.id} synced via local`);
              }
            }
          }

          if (item.status !== 'completed') {
            if (item.attempts >= this.config.maxRetries) {
              item.status = 'failed';
              console.error(`❌ Queue item ${item.id} failed after ${item.attempts} attempts`);
            }
          }

        } catch (error) {
          item.lastError = error.message;
          console.error(`❌ Error processing queue item ${item.id}:`, error.message);
        }
      }

      // Save updated queue
      await AsyncStorage.setItem(this.config.queueKey, JSON.stringify(queue));

    } finally {
      this.state.queueProcessing = false;
    }
  }

  /**
   * Start background queue processor
   */
  startQueueProcessor() {
    setInterval(() => {
      this.processQueue();
    }, this.config.checkInterval);

    console.log('🔄 Background queue processor started');
  }

  /**
   * Set desktop URL for local fallback
   */
  async setDesktopUrl(url) {
    this.config.desktopUrl = url;
    await AsyncStorage.setItem(this.config.desktopUrlKey, url);
    console.log('💾 Desktop URL saved:', url);
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      cloudReachable: this.state.isCloudReachable,
      desktopReachable: this.state.isDesktopReachable,
      desktopUrl: this.config.desktopUrl,
      cloudRelayUrl: this.config.cloudRelayUrl,
      storeId: this.config.storeId,
      preferredMethod: this.state.preferredMethod,
      queueProcessing: this.state.queueProcessing
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const queue = await this.getQueue();

    return {
      total: queue.length,
      pending: queue.filter(item => item.status === 'pending').length,
      completed: queue.filter(item => item.status === 'completed').length,
      failed: queue.filter(item => item.status === 'failed').length
    };
  }

  /**
   * Clear completed items from queue
   */
  async clearCompleted() {
    const queue = await this.getQueue();
    const filtered = queue.filter(item => item.status !== 'completed');

    await AsyncStorage.setItem(this.config.queueKey, JSON.stringify(filtered));

    console.log(`🧹 Cleared ${queue.length - filtered.length} completed items`);
  }

  /**
   * Retry failed items
   */
  async retryFailed() {
    const queue = await this.getQueue();

    queue.forEach(item => {
      if (item.status === 'failed') {
        item.status = 'pending';
        item.attempts = 0;
      }
    });

    await AsyncStorage.setItem(this.config.queueKey, JSON.stringify(queue));

    console.log('🔄 Reset failed items for retry');

    // Trigger immediate processing
    await this.processQueue();
  }
}

export default new ConnectionManager();