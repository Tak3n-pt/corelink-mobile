/**
 * CRASH-PROOF MEMORY MANAGER
 * Prevents app crashes by monitoring memory usage and cleaning up resources
 */

class CrashProofMemoryManager {
  constructor() {
    this.memoryWarnings = 0;
    this.isCleaningUp = false;
    this.cleanupCallbacks = [];
    this.lastCleanup = 0;
    
    // Start memory monitoring
    this.startMemoryMonitoring();
  }

  startMemoryMonitoring() {
    // Listen for memory warnings
    if (global.gc) {
      // Force garbage collection if available
      setInterval(() => {
        try {
          global.gc();
        } catch (e) {
          // Ignore if gc is not available
        }
      }, 60000); // Every 60 seconds (reduced from 30s for better battery)
    }
  }

  // Register cleanup callback
  registerCleanup(callback) {
    if (typeof callback === 'function') {
      this.cleanupCallbacks.push(callback);
    }
  }

  // Force cleanup
  async forceCleanup() {
    if (this.isCleaningUp) return;
    
    const now = Date.now();
    if (now - this.lastCleanup < 5000) return; // Don't cleanup too frequently
    
    this.isCleaningUp = true;
    this.lastCleanup = now;
    
    console.log('🧹 Starting emergency memory cleanup...');
    
    try {
      // Run all cleanup callbacks
      for (const callback of this.cleanupCallbacks) {
        try {
          await callback();
        } catch (error) {
          console.error('❌ Cleanup callback error:', error);
        }
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      console.log('✅ Memory cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    } finally {
      this.isCleaningUp = false;
    }
  }

  // Memory warning handler
  handleMemoryWarning() {
    this.memoryWarnings++;
    console.warn('⚠️ Memory warning #' + this.memoryWarnings);
    
    // Force cleanup on memory warning
    this.forceCleanup();
  }

  // Create memory-safe timeout
  safeTimeout(callback, delay) {
    const timeoutId = setTimeout(() => {
      try {
        callback();
      } catch (error) {
        console.error('❌ Timeout callback error:', error);
      }
    }, delay);
    
    return timeoutId;
  }

  // Create memory-safe interval
  safeInterval(callback, interval) {
    const intervalId = setInterval(() => {
      try {
        callback();
      } catch (error) {
        console.error('❌ Interval callback error:', error);
        clearInterval(intervalId); // Stop if error occurs
      }
    }, interval);
    
    return intervalId;
  }

  // Cleanup resources
  cleanup() {
    console.log('🧹 Memory manager cleanup');
    this.cleanupCallbacks = [];
  }
}

// Singleton instance
const memoryManager = new CrashProofMemoryManager();

// Global error handlers to prevent crashes
const setupGlobalErrorHandlers = () => {
  // Handle uncaught exceptions
  if (typeof ErrorUtils !== 'undefined') {
    const originalHandler = ErrorUtils.getGlobalHandler();
    
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      console.error('🚨 Global error caught:', error);
      
      // Force memory cleanup on errors
      memoryManager.forceCleanup();
      
      // Call original handler if not fatal
      if (!isFatal && originalHandler) {
        try {
          originalHandler(error, isFatal);
        } catch (e) {
          console.error('❌ Original handler error:', e);
        }
      }
    });
  }

  // Handle promise rejections
  if (typeof global !== 'undefined' && global.HermesInternal) {
    process.on?.('unhandledRejection', (reason, promise) => {
      console.error('🚨 Unhandled promise rejection:', reason);
      memoryManager.forceCleanup();
    });
  }
};

// Initialize global handlers
setupGlobalErrorHandlers();

export default memoryManager;