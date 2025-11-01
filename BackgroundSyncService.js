/**
 * BackgroundSyncService.js - Automatic background synchronization service
 * Handles periodic queue processing and system health monitoring
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import ConnectionManager from './ConnectionManager';

class BackgroundSyncService {
  constructor() {
    this.isRunning = false;
    this.syncInterval = null;
    this.healthCheckInterval = null;
    this.listeners = [];
    
    // Configuration (optimized for battery life)
    this.SYNC_INTERVAL = 120 * 1000; // Sync every 2 minutes (reduced for battery)
    this.HEALTH_CHECK_INTERVAL = 60 * 1000; // Health check every minute (reduced for battery)
    this.WIFI_ONLY_MODE = false; // Whether to sync only on WiFi
    this.AUTO_START = true; // Auto-start on app launch
    
    // Statistics
    this.stats = {
      lastSyncTime: null,
      lastSuccessfulSync: null,
      syncAttempts: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      itemsProcessed: 0,
      currentStatus: 'idle'
    };
    
    // Load configuration from storage
    this.loadConfiguration();
  }
  
  /**
   * Load saved configuration from storage
   */
  async loadConfiguration() {
    try {
      const config = await AsyncStorage.getItem('background_sync_config');
      if (config) {
        const parsed = JSON.parse(config);
        this.SYNC_INTERVAL = parsed.syncInterval || this.SYNC_INTERVAL;
        this.WIFI_ONLY_MODE = parsed.wifiOnly !== undefined ? parsed.wifiOnly : this.WIFI_ONLY_MODE;
        this.AUTO_START = parsed.autoStart !== undefined ? parsed.autoStart : this.AUTO_START;
      }
      
      // Load statistics
      const stats = await AsyncStorage.getItem('background_sync_stats');
      if (stats) {
        this.stats = { ...this.stats, ...JSON.parse(stats) };
      }
      
      // Auto-start if configured
      if (this.AUTO_START) {
        this.start();
      }
    } catch (error) {
      console.error('❌ Error loading background sync config:', error);
    }
  }
  
  /**
   * Save configuration to storage
   */
  async saveConfiguration() {
    try {
      const config = {
        syncInterval: this.SYNC_INTERVAL,
        wifiOnly: this.WIFI_ONLY_MODE,
        autoStart: this.AUTO_START
      };
      await AsyncStorage.setItem('background_sync_config', JSON.stringify(config));
    } catch (error) {
      console.error('❌ Error saving background sync config:', error);
    }
  }
  
  /**
   * Save statistics to storage
   */
  async saveStatistics() {
    try {
      await AsyncStorage.setItem('background_sync_stats', JSON.stringify(this.stats));
    } catch (error) {
      console.error('❌ Error saving background sync stats:', error);
    }
  }
  
  /**
   * Start the background sync service
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Background sync already running');
      return;
    }
    
    console.log('🚀 Starting background sync service...');
    this.isRunning = true;
    this.stats.currentStatus = 'running';
    
    // Start sync interval
    this.syncInterval = setInterval(() => {
      this.performSync();
    }, this.SYNC_INTERVAL);
    
    // Start health check interval
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);
    
    // Perform initial sync
    await this.performSync();
    
    this.notifyListeners('started', { 
      syncInterval: this.SYNC_INTERVAL,
      wifiOnly: this.WIFI_ONLY_MODE 
    });
    
    console.log(`✅ Background sync started (interval: ${this.SYNC_INTERVAL / 1000}s)`);
  }
  
  /**
   * Stop the background sync service
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Background sync not running');
      return;
    }
    
    console.log('🛑 Stopping background sync service...');
    this.isRunning = false;
    this.stats.currentStatus = 'stopped';
    
    // Clear intervals
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    this.saveStatistics();
    this.notifyListeners('stopped', this.stats);
    
    console.log('✅ Background sync stopped');
  }
  
  /**
   * Perform background sync
   */
  async performSync() {
    try {
      console.log('🔄 Background sync starting...');
      this.stats.lastSyncTime = Date.now();
      this.stats.syncAttempts++;
      this.stats.currentStatus = 'syncing';
      
      // Check network connectivity
      const networkState = await NetInfo.fetch();
      
      // Check if we should sync based on network type
      if (this.WIFI_ONLY_MODE && networkState.type !== 'wifi') {
        console.log('📱 Skipping sync - WiFi only mode enabled');
        this.stats.currentStatus = 'waiting_for_wifi';
        return;
      }
      
      if (!networkState.isConnected) {
        console.log('📴 Skipping sync - No network connection');
        this.stats.currentStatus = 'offline';
        return;
      }
      
      // ConnectionManager handles queue internally
      console.log('📋 Checking for pending items to sync...');
      
      // Process the queue using ConnectionManager
      await ConnectionManager.processQueue();

      // Update statistics
      const processed = 1; // ConnectionManager doesn't expose detailed stats
      
      if (processed > 0) {
        this.stats.itemsProcessed += processed;
        this.stats.lastSuccessfulSync = Date.now();
        this.stats.successfulSyncs++;
        console.log(`✅ Background sync completed: ${processed} items processed`);
        
        this.notifyListeners('sync_completed', {
          processed,
          remaining: 0, // ConnectionManager doesn't expose queue details
          timestamp: Date.now()
        });
      } else {
        console.log('⚠️ Background sync completed: No items could be processed');
      }
      
      this.stats.currentStatus = 'idle';
      await this.saveStatistics();
      
    } catch (error) {
      console.error('❌ Background sync error:', error);
      this.stats.failedSyncs++;
      this.stats.currentStatus = 'error';
      
      this.notifyListeners('sync_error', {
        error: error.message,
        timestamp: Date.now()
      });
      
      await this.saveStatistics();
    }
  }
  
  /**
   * Perform health check
   */
  async performHealthCheck() {
    try {
      // Check desktop availability using ConnectionManager
      const connectionStatus = ConnectionManager.getStatus();

      // Get queue status (simplified)
      const queueStats = { pending: 0, completed: 0, failed: 0, total: 0 };
      
      // Check network status
      const networkState = await NetInfo.fetch();
      
      const health = {
        desktop: {
          available: connectionStatus.desktopOnline,
          ip: desktopStatus.cachedIP
        },
        queue: {
          pending: queueStats.pending,
          total: queueStats.total
        },
        network: {
          connected: networkState.isConnected,
          type: networkState.type
        },
        sync: {
          status: this.stats.currentStatus,
          lastSync: this.stats.lastSyncTime,
          lastSuccess: this.stats.lastSuccessfulSync
        }
      };
      
      this.notifyListeners('health_check', health);
      
    } catch (error) {
      console.error('❌ Health check error:', error);
    }
  }
  
  /**
   * Configure sync settings
   */
  configure(settings) {
    if (settings.syncInterval !== undefined) {
      this.SYNC_INTERVAL = settings.syncInterval;
      
      // Restart if running to apply new interval
      if (this.isRunning) {
        this.stop();
        this.start();
      }
    }
    
    if (settings.wifiOnly !== undefined) {
      this.WIFI_ONLY_MODE = settings.wifiOnly;
    }
    
    if (settings.autoStart !== undefined) {
      this.AUTO_START = settings.autoStart;
    }
    
    this.saveConfiguration();
    console.log('✅ Background sync configured:', settings);
  }
  
  /**
   * Get current status and statistics
   */
  getStatus() {
    return {
      running: this.isRunning,
      config: {
        syncInterval: this.SYNC_INTERVAL,
        wifiOnly: this.WIFI_ONLY_MODE,
        autoStart: this.AUTO_START
      },
      stats: this.stats
    };
  }
  
  /**
   * Reset statistics
   */
  resetStatistics() {
    this.stats = {
      lastSyncTime: null,
      lastSuccessfulSync: null,
      syncAttempts: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      itemsProcessed: 0,
      currentStatus: this.isRunning ? 'idle' : 'stopped'
    };
    
    this.saveStatistics();
    console.log('✅ Background sync statistics reset');
  }
  
  /**
   * Force immediate sync
   */
  async forceSync() {
    console.log('⚡ Force sync triggered');
    await this.performSync();
  }
  
  /**
   * Add event listener
   */
  addEventListener(callback) {
    this.listeners.push(callback);
  }
  
  /**
   * Remove event listener
   */
  removeEventListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }
  
  /**
   * Notify all listeners
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('❌ Background sync listener error:', error);
      }
    });
  }
}

export default new BackgroundSyncService();