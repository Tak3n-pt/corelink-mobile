import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  StatusBar,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform,
  I18nManager
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import ProductSellModal from './ProductSellModal';
// Using barcode scanner from backup
import VisionCameraLiveScannerMLKit from './VisionCameraLiveScannerMLKit';
import ErrorBoundary from './ErrorBoundary';
import EnhancedRecentScans from './EnhancedRecentScans';
import EnhancedPriceEditorModal from './EnhancedPriceEditorModal';
// Import barcode scanning modules with proper handling
let BarcodeScanning = null;
let TextRecognition = null;

try {
  // Try to import the modules
  BarcodeScanning = require('@react-native-ml-kit/barcode-scanning').default;
  TextRecognition = require('@react-native-ml-kit/text-recognition').default;
  
  console.log('✅ Barcode scanning modules loaded');
  console.log('BarcodeScanning:', BarcodeScanning);
  console.log('BarcodeScanning.scan:', BarcodeScanning?.scan);
} catch (error) {
  console.log('⚠️ Barcode scanning modules not available:', error.message);
  console.log('Barcode scanning will be disabled');
}

// Components loaded correctly
import SmartBottomDrawer from './SmartBottomDrawer';
import LanguageSwitcher from './LanguageSwitcher';
import memoryManager from './CrashProofMemoryManager';
import OptimizedInventoryList from './OptimizedInventoryList';
import LazyModal from './LazyModal';
import SplashScreen from './SplashScreen';
import OptimizedMultiImageView from './OptimizedMultiImageView';
import imageHandler from './ImageHandler';

// NEW CLEAN CONNECTION SYSTEM - Replaces ALL old network/queue logic
import ConnectionManager from './ConnectionManager';
import { submitPrices, configureDesktop } from './submitPricesSimplified';
import { processInvoiceImages } from './processInvoiceSimplified';
import SaleConfirmationModal from './SaleConfirmationModal';
import { io } from 'socket.io-client';
import BrandedLoadingScreen from './BrandedLoadingScreen';

// Import i18n configuration
import './i18n/i18n';

// Using expo-camera native barcode scanning for better performance
// No more dependencies, build issues, or memory leaks!

// Server configurations - Fixed server for OCR, dynamic for desktop stocking
const SERVER_CONFIGS = {
  LOCAL: 'http://192.168.1.14:3001',  // Local backend server for OCR
  CLOUD: 'https://invoice-processor-dot-my-invoice-server-2025.uc.r.appspot.com'
};

// Use CLOUD backend for invoice OCR (switched from LOCAL to online server)
const USE_SERVER = 'CLOUD';  // Using cloud server for online processing
let INVOICE_SERVER_URL = SERVER_CONFIGS[USE_SERVER];  // Fixed server for OCR
const DEFAULT_DESKTOP_URL = null;  // Desktop discovered dynamically for stocking

// Global fetch with timeout utility - React Native compatible
const fetchWithTimeout = async (url, options = {}, timeout = 15000) => {
  // Use AbortController for proper timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('❌ fetchWithTimeout error:', {
      name: error.name,
      message: error.message,
      url: url,
      timeout: timeout
    });
    
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    
    // Add more specific error messages
    if (error.message.includes('Network request failed')) {
      throw new Error(`Network connection failed. Please check your internet connection.`);
    }
    
    if (error.message.includes('fetch')) {
      throw new Error(`Failed to connect to server. Please check your network connection.`);
    }
    
    throw error;
  }
};

// Convert image URI to base64
const uriToBase64 = async (uri) => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result.split(',')[1]; // Remove data:image/jpeg;base64, prefix
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting URI to base64:', error);
    return null;
  }
};

export default function App() {
  const { t, i18n } = useTranslation();
  const [showSplashScreen, setShowSplashScreen] = useState(true);
  const [cameraPermission, setCameraPermission] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Manual Desktop IP Configuration
  const [manualDesktopIP, setManualDesktopIP] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [showNetworkTest, setShowNetworkTest] = useState(false);

  // Load manual IP from storage on app start
  useEffect(() => {
    const loadManualIP = async () => {
      try {
        const savedIP = await AsyncStorage.getItem('manual_desktop_ip');
        if (savedIP) {
          setManualDesktopIP(savedIP);
          console.log(`📱 [MANUAL] Loaded saved IP: ${savedIP}`);
        }
      } catch (error) {
        console.log('⚠️ [MANUAL] Failed to load saved IP:', error.message);
      }
    };
    loadManualIP();
  }, []);

  // Save manual IP to storage
  const saveManualIP = async (ip) => {
    try {
      await AsyncStorage.setItem('manual_desktop_ip', ip);
      setManualDesktopIP(ip);
      console.log(`💾 [MANUAL] Saved IP: ${ip}`);
    } catch (error) {
      console.log('❌ [MANUAL] Failed to save IP:', error.message);
    }
  };

  // Test connection to manual IP
  const testManualConnection = async () => {
    if (!manualDesktopIP.trim()) {
      Alert.alert('Error', 'Please enter a desktop IP address');
      return;
    }

    setIsTestingConnection(true);
    try {
      const url = `http://${manualDesktopIP.trim()}:4000/health`;
      console.log(`🔍 [TEST] Testing connection to: ${url}`);
      
      // Use XMLHttpRequest instead of fetch for hotspot compatibility
      const data = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.timeout = 10000;
        
        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data);
            } catch (e) {
              reject(new Error('Invalid JSON response'));
            }
          } else {
            reject(new Error(`Server responded with status: ${xhr.status}`));
          }
        };
        
        xhr.onerror = function() {
          reject(new Error('Network request failed'));
        };
        
        xhr.ontimeout = function() {
          reject(new Error('Request timed out'));
        };
        
        xhr.send();
      });
      
      Alert.alert('Success!', `Connected to desktop server!\nStatus: ${data.status}\nUptime: ${Math.round(data.uptime)}s`);
      await saveManualIP(manualDesktopIP.trim());
    } catch (error) {
      console.log('❌ [TEST] Connection test failed:', error.message);
      Alert.alert('Connection Failed', `Cannot connect to ${manualDesktopIP}:4000\n\nError: ${error.message}\n\nMake sure:\n• Desktop app is running\n• IP address is correct\n• Both devices on same network`);
    } finally {
      setIsTestingConnection(false);
    }
  };
  
  // Clear all app data function
  const clearAllAppData = async () => {
    try {
      console.log('🗑️ Clearing all app data...');
      await AsyncStorage.clear();
      console.log('✅ AsyncStorage cleared');
      
      // Reset all state to initial values
      setRecentScans([]);
      setRecentSales([]);
      setNetworkStatus('disconnected');
      setDesktopServerUrl('');
      setServerUrls({ desktop: '', invoice: '' });
      setCapturedImages([]);
      setCurrentInvoice(null);
      setIsProcessing(false);
      
      console.log('✅ All app data cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing app data:', error);
    }
  };

  // Setup crash prevention and memory management
  useEffect(() => {
    const cleanup = () => {
      console.log('🧹 App cleanup initiated');
      // Clear any running intervals/timeouts
      // Clear image cache
      setCapturedImages([]);
      setCurrentInvoice(null);
      setIsProcessing(false);
    };
    
    memoryManager.registerCleanup(cleanup);
    
    return () => {
      cleanup();
      memoryManager.cleanup();
    };
  }, []);
  
  // Real-time processing progress
  const [processingProgress, setProcessingProgress] = useState({
    step: 0,
    percentage: 0,
    message: '',
    details: ''
  });
  const [socket, setSocket] = useState(null);
  const [desktopSocket, setDesktopSocket] = useState(null); // WebSocket for desktop inventory updates
  const [inventoryUpdateCount, setInventoryUpdateCount] = useState(0); // Track real-time updates
  
  // Confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState({
    visible: false,
    title: '',
    message: '',
    buttons: []
  });
  
  // Invoice processing state
  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [showPriceEditor, setShowPriceEditor] = useState(false);
  
  // Multiple image state
  const [capturedImages, setCapturedImages] = useState([]);
  const [showImagePreview, setShowImagePreview] = useState(false);
  
  // Product selling state
  const [showTextSelector, setShowTextSelector] = useState(false);
  const [detectedTextBlocks, setDetectedTextBlocks] = useState([]);
  const [searchProgress, setSearchProgress] = useState({ current: 0, total: 0, searching: false });
  const [currentProductImage, setCurrentProductImage] = useState(null);
  const [autoSearchTimeout, setAutoSearchTimeout] = useState(null);
  const [showLiveScanner, setShowLiveScanner] = useState(false);
  const [recentScans, setRecentScans] = useState([]);
  const [showRecentScans, setShowRecentScans] = useState(false);
  const [recentSales, setRecentSales] = useState([]);
  const [showRecentSales, setShowRecentSales] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [inventoryProducts, setInventoryProducts] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [activeInventoryTab, setActiveInventoryTab] = useState('all');
  const [inventorySearch, setInventorySearch] = useState('');
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState(null);
  const [showMultiImageView, setShowMultiImageView] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  // Removed unused showScanDetails and selectedScan state - now handled by EnhancedRecentScans
  
  // Language switcher state
  const [showLanguageSwitcher, setShowLanguageSwitcher] = useState(false);
  
  // Sale confirmation modal state
  const [showSaleConfirmation, setShowSaleConfirmation] = useState(false);
  const [pendingProduct, setPendingProduct] = useState(null);
  
  // Using native expo-camera instead
  
  // Network discovery state
  const [networkStatus, setNetworkStatus] = useState('discovering');
  const [showNetworkSettings, setShowNetworkSettings] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [desktopServerUrl, setDesktopServerUrl] = useState(null);
  const [serverUrls, setServerUrls] = useState({
    desktop: null,
    invoice: INVOICE_SERVER_URL
  });

  useEffect(() => {
    // Using expo-camera native scanning
    let rediscoveryInterval;  // Declare interval variable here for cleanup
    
    // Initialize network discovery with SmartNetworkConfig and RobustDesktopFinder
    const initializeNetwork = async () => {
      console.log('🚀 Initializing Smart Network Configuration...');
      
      // Initialize SmartNetworkConfig for intelligent network management - DISABLED
      // await smartNetwork.initialize();
      
      // Invoice server is already configured (fixed)
      console.log(`📡 Invoice OCR server: ${INVOICE_SERVER_URL}`);
      
      // OLD CODE - DEPRECATED (using ConnectionManager now) - DISABLED
      /*try {
        const desktopIP = await RobustDesktopFinder.findDesktop();
        
        if (desktopIP) {
          // Desktop found - use it for inventory stocking
          const desktopUrl = `http://${desktopIP}:4000`;  // Port 4000 for inventory
          
          setDesktopServerUrl(desktopUrl);
          console.log(`✅ Desktop server discovered: ${desktopUrl}`);
          
          setServerUrls({ 
            desktop: desktopUrl,
            invoice: INVOICE_SERVER_URL  // Keep fixed invoice server
          });
          setNetworkStatus('connected');
        } else {
          // No desktop found - stocking will be queued
          console.warn('⚠️ Desktop not found - stocking will be queued');
          
          setServerUrls({ 
            desktop: null,
            invoice: INVOICE_SERVER_URL  // Keep fixed invoice server
          });
          setNetworkStatus('disconnected');
        }
      } catch (error) {
        console.error('❌ Network initialization error:', error);
        setNetworkStatus('disconnected');
      }*/
    };

    // initializeNetwork(); // DISABLED - using ConnectionManager instead
    
    // Periodic rediscovery to handle desktop IP changes (every 30 seconds) - DISABLED
    /*rediscoveryInterval = setInterval(async () => {
      console.log('🔄 Periodic desktop rediscovery...');
      try {
        const desktopIP = await RobustDesktopFinder.findDesktop();
        
        if (desktopIP) {
          const newDesktopUrl = `http://${desktopIP}:4000`;
          
          // Only update if IP changed
          if (newDesktopUrl !== desktopServerUrl) {
            console.log(`🔄 Desktop IP changed to: ${desktopIP}`);
            setDesktopServerUrl(newDesktopUrl);
            setServerUrls({ 
              desktop: newDesktopUrl,
              invoice: INVOICE_SERVER_URL  // Keep fixed invoice server
            });
            setNetworkStatus('connected');
            
            // Process queue with new connection
            if (offlineQueueCount > 0) {
              await SimpleQueue.processQueue();
            }
          }
        } else if (desktopServerUrl) {
          // Desktop was connected but now lost
          console.warn('⚠️ Desktop connection lost');
          setDesktopServerUrl(null);
          setServerUrls({ 
            desktop: null,
            invoice: INVOICE_SERVER_URL  // Keep fixed invoice server
          });
          setNetworkStatus('disconnected');
        }
      } catch (error) {
        console.error('❌ Rediscovery error:', error);
      }
    }, 30000);*/  // Every 30 seconds - DISABLED

    // Initialize simple queue system - DISABLED
    /*const initializeQueueManager = async () => {
      console.log('🚀 Initializing Simple Queue System...');
      try {
        // Helper function to update queue count
        const updateQueueCount = async () => {
          const stats = await SimpleQueue.getStats();
          setOfflineQueueCount(stats.pending);
        };

        // Set up queue event listeners
        SimpleQueue.addEventListener((event, data) => {
          switch (event) {
            case 'added':
              console.log('📊 Queue updated - invoice added:', data.id);
              updateQueueCount();
              break;
            case 'completed':
              console.log('✅ Queue item completed:', data.id);
              updateQueueCount();
              break;
            case 'batch_completed':
              console.log('✅ Batch sync complete:', data);
              if (data.successful > 0) {
                Alert.alert(
                  '✅ Sync Complete',
                  t('queue.syncSuccessful', { count: data.successful })
                );
              }
              updateQueueCount();
              break;
            case 'error':
              console.error('❌ Queue error:', data);
              Alert.alert(t('errors.queueError'), t('errors.queueOperationFailed', { message: data.message || t('errors.unknownError') }));
              break;
          }
        });
        
        // Get initial queue stats
        const stats = await SimpleQueue.getStats();
        console.log('📊 Initial queue stats:', stats);
        setOfflineQueueCount(stats.pending);
        
        // Try processing queue if we have pending items
        if (stats.pending > 0) {
          setTimeout(() => {
            SimpleQueue.processQueue();
          }, 5000);
        }
      } catch (error) {
        console.error('❌ Failed to initialize queue manager:', error);
      }
    };*/

    // initializeQueueManager(); // DISABLED

    // Start legacy network monitor as fallback - DISABLED
    /*networkMonitor.start();
    
    // Add listener for network changes
    networkMonitor.addListener(async (status, data) => {
      console.log('Network status:', status);
      if (status === 'connected' && data) {
        // Update desktop server URL when NetworkMonitor finds it
        setDesktopServerUrl(data);  // Use state instead of global
        setServerUrls({ desktop: data, invoice: INVOICE_SERVER_URL });  // Keep fixed invoice server
        
        setNetworkStatus('connected');
        
        // Process offline queue when connection restored using SimpleQueue
        console.log('📤 Processing offline queue after reconnection...');
        try {
          // Process queue with SimpleQueue (handles its own result reporting)
          await SimpleQueue.processQueue();
          console.log('✅ Queue processing initiated');
          
          // Update queue count after processing
          const stats = await SimpleQueue.getStats();
          setOfflineQueueCount(stats.pending);
        } catch (error) {
          console.error('❌ Failed to process offline queue:', error);
        }
      } else if (status === 'disconnected') {
        setNetworkStatus('disconnected');
        // Check queue status when disconnected
        const stats = await SimpleQueue.getStats();
        setOfflineQueueCount(stats.pending);
        if (stats.pending > 0) {
          console.log(`📦 ${stats.pending} items queued for sync when connection restored`);
        }
      } else if (status === 'discovering') {
        setNetworkStatus('discovering');
      }
    });*/

    // Load recent scans and sales
    loadRecentScans();
    loadRecentSales();

    // Check and process offline queue on startup - DISABLED
    /*const processStartupQueue = async () => {
      const stats = await SimpleQueue.getStats();
      setOfflineQueueCount(stats.pending);
      if (stats.pending > 0) {
        console.log(`📦 Found ${stats.pending} pending items in offline queue`);
        // Wait a bit for network to stabilize
        setTimeout(async () => {
          if (desktopServerUrl) {
            await SimpleQueue.processQueue();
            console.log('✅ Startup queue processing initiated');
            // Update queue count
            const newStats = await SimpleQueue.getStats();
            setOfflineQueueCount(newStats.pending);
          }
        }, 5000);
      }
    };
    processStartupQueue();*/

    // Set up RTL for Arabic
    const isRTL = i18n.language === 'ar';
    if (I18nManager.isRTL !== isRTL) {
      I18nManager.allowRTL(isRTL);
      I18nManager.forceRTL(isRTL);
    }
    
    return () => {
      // Cleanup all network listeners and managers
      console.log('🧹 Cleaning up network resources...');
      // clearInterval(rediscoveryInterval);  // DISABLED
      // networkMonitor.stop(); // DISABLED

      // SimpleQueue cleanup is handled internally - DISABLED
      // console.log('✅ SimpleQueue cleanup completed');

      // Disconnect any active sockets
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      if (desktopSocket) {
        desktopSocket.disconnect();
        setDesktopSocket(null);
      }
    };
  }, []);
  
  // Setup WebSocket connection to desktop for live inventory updates
  useEffect(() => {
    let reconnectAttempts = 0;
    let reconnectTimer = null;
    
    const connectToDesktopSocket = async () => {
      /*try {
        const desktopIP = await RobustDesktopFinder.findDesktop();
        if (!desktopIP) {
          console.log('⚠️ Desktop server not found, will retry...');
          // Retry with exponential backoff
          if (reconnectAttempts < 5) {
            const delay = Math.min(2000 * Math.pow(2, reconnectAttempts), 30000);
            reconnectTimer = setTimeout(() => {
              reconnectAttempts++;
              connectToDesktopSocket();
            }, delay);
          }
          return;
        }
        
        console.log('🔌 Connecting to desktop WebSocket for live updates...');
        const newSocket = io(`http://${desktopIP}:4000`, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 10000,
          timeout: 5000,
          autoConnect: true
        });
        
        newSocket.on('connect', () => {
          console.log('✅ Connected to desktop WebSocket');
          reconnectAttempts = 0; // Reset on successful connection
        });
        
        newSocket.on('connect_error', (error) => {
          console.error('🔌 Connection error:', error.message);
        });
        
        newSocket.on('inventory-update', (data) => {
          console.log('📦 Live inventory update received:', data);
          if (!data.error) {
            setInventoryUpdateCount(prev => prev + 1);
            // Refresh inventory if modal is open
            if (showInventory) {
              fetchInventoryProducts();
            }
          }
        });
        
        newSocket.on('product-update', (data) => {
          console.log('📦 Product update received:', data);
          if (data.error) {
            console.warn('⚠️ Product update error:', data.error);
            return;
          }
          
          // Update specific product in inventory if modal is open
          if (showInventory) {
            setInventoryProducts(prev => {
              if (data.action === 'deleted' || data.action === 'soft-deleted') {
                return prev.filter(p => p.id !== data.productId);
              } else if (data.product) {
                const index = prev.findIndex(p => p.id === data.product.id);
                if (index >= 0) {
                  const updated = [...prev];
                  updated[index] = data.product;
                  return updated;
                } else if (data.action === 'created') {
                  return [...prev, data.product];
                }
              }
              return prev;
            });
          }
          
          // Always increment counter for any product update
          setInventoryUpdateCount(prev => prev + 1);
        });
        
        newSocket.on('inventory-count', (data) => {
          console.log('📊 Inventory count:', data.count, data.cached ? '(cached)' : '');
        });
        
        newSocket.on('error', (data) => {
          console.warn('⚠️ Server error:', data.message);
        });
        
        newSocket.on('disconnect', (reason) => {
          console.log('🔌 Disconnected from desktop WebSocket:', reason);
          if (reason === 'io server disconnect') {
            // Server disconnected the client, don't auto-reconnect
            console.log('⚠️ Server forced disconnect, not reconnecting');
          }
        });
        
        newSocket.on('reconnect', (attemptNumber) => {
          console.log('🔌 Reconnected to desktop WebSocket after', attemptNumber, 'attempts');
        });
        
        setDesktopSocket(newSocket);
      } catch (error) {
        console.error('❌ Failed to setup WebSocket connection:', error);
      }*/
    };

    // Connect after a short delay to allow app to initialize - DISABLED
    // const timer = setTimeout(connectToDesktopSocket, 2000);
    
    return () => {
      // clearTimeout(timer); // DISABLED
      // clearTimeout(reconnectTimer); // DISABLED
      if (desktopSocket) {
        desktopSocket.disconnect();
      }
    };
  }, []); // Only connect once on mount
  
  // Update RTL when language changes
  useEffect(() => {
    const isRTL = i18n.language === 'ar';
    if (I18nManager.isRTL !== isRTL) {
      I18nManager.allowRTL(isRTL);
      I18nManager.forceRTL(isRTL);
      // Note: App needs to restart for RTL changes to take effect fully
      Alert.alert(
        t('common.info'),
        t('language.rtlRestartMessage') || 'Please restart the app for layout changes to take effect',
        [{ text: t('common.ok') }]
      );
    }
  }, [i18n.language]);
  
  // Test network connectivity
  const testNetworkConnectivity = async () => {
    console.log('🧪 Testing Network Connectivity...');
    
    const tests = [];
    
    // Test invoice server
    try {
      const invoiceTest = await fetchWithTimeout(`${INVOICE_SERVER_URL}/health`, {}, 5000);
      tests.push({
        name: t('network.invoiceServerCloud'),
        url: INVOICE_SERVER_URL,
        status: invoiceTest.ok ? '✅ Online' : '❌ Offline'
      });
    } catch (error) {
      tests.push({
        name: t('network.invoiceServerCloud'),
        status: '❌ Failed',
        error: error.message
      });
    }
    
    // Test desktop server
    try {
      if (desktopServerUrl) {
        const desktopTest = await fetchWithTimeout(`${desktopServerUrl}/health`, {}, 5000);
        tests.push({
          name: t('network.desktopServerLocal'),
          url: desktopServerUrl,
          status: desktopTest.ok ? '✅ Online' : '❌ Offline'
        });
      } else {
        tests.push({
          name: t('network.desktopServerLocal'),
          status: '❓ Not Discovered'
        });
      }
    } catch (error) {
      tests.push({
        name: t('network.desktopServerLocal'),
        status: '❌ Failed',
        error: error.message
      });
    }
    
    // Show results
    Alert.alert(
      t('network.connectivityTest'),
      `${t('network.status')}: ${networkStatus}\n\n` +
      `${t('network.invoice')}: ${tests[0]?.status || t('network.unknown')}\n` +
      `${t('network.desktop')}: ${tests[1]?.status || t('network.unknown')}\n\n` +
      `${t('network.queue')}: ${offlineQueueCount} ${t('network.pending')}`,
      [{ text: t('common.ok') }]
    );
  };

  // Auto-discover servers on the network
  const discoverServers = async () => {
    try {
      setNetworkStatus('discovering');
      console.log('🔍 Starting desktop server discovery...');

      // OLD CODE - DISABLED
      const desktopIP = null; // await RobustDesktopFinder.findDesktop();
      const desktopUrl = desktopIP ? `http://${desktopIP}:4000` : null;
      
      if (desktopUrl) {
        setDesktopServerUrl(desktopUrl);
        console.log(`✅ Desktop server: ${desktopUrl}`);
        
        setServerUrls({ desktop: desktopUrl, invoice: INVOICE_SERVER_URL });
        setNetworkStatus('connected');
      } else {
        setNetworkStatus('disconnected');
        console.warn('⚠️ Could not discover desktop server, using default');
      }
    } catch (error) {
      console.error('Network discovery failed:', error);
      setNetworkStatus('error');
    }
  };

  // Request camera permissions
  const requestPermissions = async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setCameraPermission(status === 'granted');
      
      if (status !== 'granted') {
        Alert.alert(
          t('permissions.cameraTitle'), 
          t('permissions.cameraMessage')
        );
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Permission error:', error);
      Alert.alert(t('errors.permissionDenied'), `${t('errors.cameraError')}: ${error.message}`);
      return false;
    }
  };

  // Test server connectivity
  const testServers = async () => {
    try {
      setIsProcessing(true);
      
      const testResults = await Promise.allSettled([
        fetchWithTimeout(`${INVOICE_SERVER_URL}/health`, {}, 5000),
        fetchWithTimeout(`${desktopServerUrl}/health`, {}, 5000)
      ]);
      
      const invoiceStatus = testResults[0].status === 'fulfilled' ? 
        `✅ Connected (${testResults[0].value.status})` : 
        `❌ Failed: ${testResults[0].reason?.message || t('modals.connectionFailed')}`;
        
      const desktopStatus = testResults[1].status === 'fulfilled' ? 
        `✅ Connected (${testResults[1].value.status})` : 
        `❌ Failed: ${testResults[1].reason?.message || t('modals.connectionFailed')}`;
      
      Alert.alert(
        t('settings.server'),
        `${t('network.invoiceServer')}: ${invoiceStatus}\n\n${t('network.desktopServer')}: ${desktopStatus}\n\n${t('network.barcodeScanner')}: ✅ ${t('network.nativeHardware')}`,
        [{ text: t('common.ok') }]
      );
    } catch (error) {
      Alert.alert(t('common.error'), error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Map backend progress to simplified user steps
  const mapBackendProgressToUserStep = (backendStep, percentage, backendMessage) => {
    // Map complex backend steps to 4 simple user-friendly steps
    if (percentage <= 10) {
      return {
        step: 1,
        percentage: Math.max(5, percentage * 2), // 0-10% becomes 5-20%
        message: t('processing.uploading') || '📤 Uploading invoice',
        details: t('processing.uploadingDetails') || 'Securely uploading your document'
      };
    } else if (percentage <= 60) {
      return {
        step: 2,
        percentage: 20 + ((percentage - 10) / 50) * 50, // 10-60% becomes 20-70%
        message: t('processing.analyzing') || '🔍 Analyzing content', 
        details: t('processing.analyzingDetails') || 'Reading text and identifying items'
      };
    } else if (percentage <= 85) {
      return {
        step: 3,
        percentage: 70 + ((percentage - 60) / 25) * 20, // 60-85% becomes 70-90%
        message: t('processing.organizing') || '📋 Organizing data',
        details: t('processing.organizingDetails') || 'Structuring invoice information'
      };
    } else {
      return {
        step: 4,
        percentage: Math.min(100, 90 + ((percentage - 85) / 15) * 10), // 85-100% becomes 90-100%
        message: t('processing.finalizing') || '✅ Finalizing results',
        details: t('processing.finalizingDetails') || 'Preparing your invoice data'
      };
    }
  };

  // Show styled confirmation modal instead of Alert.alert
  const showStyledConfirmation = (title, message, buttons) => {
    setConfirmationModal({
      visible: true,
      title,
      message,
      buttons: buttons.map(button => ({
        ...button,
        onPress: () => {
          setConfirmationModal(prev => ({ ...prev, visible: false }));
          if (button.onPress) button.onPress();
        }
      }))
    });
  };

  // Setup Socket.IO connection for real-time progress
  const setupSocketConnection = (requestId) => {
    if (socket) {
      socket.disconnect();
    }

    const newSocket = io(INVOICE_SERVER_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000
    });

    newSocket.on('connect', () => {
      console.log('🔌 Connected to invoice server for progress updates');
    });

    newSocket.on('processingProgress', (data) => {
      if (data.requestId === requestId) {
        const userProgress = mapBackendProgressToUserStep(
          data.step, 
          data.percentage, 
          data.message
        );
        setProcessingProgress(userProgress);
        console.log(`📊 Progress Update: Step ${userProgress.step}/4 (${userProgress.percentage}%) - ${userProgress.message}`);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 Disconnected from invoice server');
    });

    setSocket(newSocket);
    return newSocket;
  };

  // Process single or multiple invoice images with fixed offline handling
  const processInvoiceImages = async (imageUris) => {
    console.log(`🔄 processInvoiceImages called with ${imageUris.length} image(s)`);
    
    // Calculate the actual desktop URL to use - manual IP takes priority
    let actualDesktopUrl = desktopServerUrl;
    if (manualDesktopIP && manualDesktopIP.trim()) {
      actualDesktopUrl = `http://${manualDesktopIP.trim()}:4000`;
      console.log(`🎯 [MANUAL] processInvoiceImages using manual desktop IP: ${actualDesktopUrl}`);
    } else {
      console.log(`🔍 [AUTO] processInvoiceImages using discovered desktop: ${actualDesktopUrl || 'none'}`);
    }
    
    // Use simplified cloud processing
    return processInvoiceImages(imageUris, {
      INVOICE_SERVER_URL,
      setProcessingProgress,
      setCurrentInvoice,
      setShowPriceEditor,
      setIsProcessing,
      Alert,
      t
    });
  };
  
  // Legacy processing function (kept for reference)
  const processInvoiceImagesLegacy = async (imageUris) => {
    console.log(`🔄 processInvoiceImagesLegacy called with ${imageUris.length} image(s)`);
    console.log(`📋 Image URIs:`, imageUris.map((uri, i) => `Page ${i+1}: ${uri.substring(uri.lastIndexOf('/'))}`));
    
    // Initialize progress
    setProcessingProgress({
      step: 1,
      percentage: 0,
      message: t('processing.starting') || '🚀 Starting processing',
      details: t('processing.startingDetails') || 'Preparing your invoice'
    });

    try {
      const formData = new FormData();
      
      if (imageUris.length === 1) {
        // Single image - use single-page endpoint
        console.log('📤 Using SINGLE-PAGE pipeline - sending to /process-invoice');
        formData.append('file', {
          uri: imageUris[0],
          type: 'image/jpeg',
          name: 'invoice.jpg',
        });
        
        const response = await fetch(`${INVOICE_SERVER_URL}/process-invoice`, {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          }
        });
        
        const result_data = await response.json();
        console.log('📥 Server response:', result_data);
        
        // Setup socket connection for real-time progress if we have a requestId
        if (result_data.requestId) {
          setupSocketConnection(result_data.requestId);
        }
        
        if (response.ok && result_data.success) {
          // Server already checked desktop and provided suggested prices
          const itemsWithPrices = result_data.items?.map(item => ({
            ...item,
            found: item.existsInInventory || false,
            currentStock: item.currentStock || 0,
            sellingPrice: item.sellingPrice || item.suggestedPrice || item.unitPrice || 0
          })) || [];
          
          // Add image URI and use server data
          const resultWithImage = {
            ...result_data,
            items: itemsWithPrices,
            imageUri: imageUris[0], // Store the original image URI
            imageUris: imageUris, // Store ALL images
            isMultiPage: imageUris.length > 1,
            pageCount: imageUris.length
          };
          setCurrentInvoice(resultWithImage);
          await saveInvoiceToRecentScans(resultWithImage);
          setShowPriceEditor(true);
          
          const foundCount = itemsWithPrices.filter(item => item.existsInInventory).length;
          Alert.alert(
            t('invoice.success'),
            t('invoice.processedMessage', { 
              itemCount: result_data.items?.length || 0, 
              vendor: result_data.vendor || t('modals.unknownVendor'),
              foundCount: foundCount,
              needPricingCount: itemsWithPrices.length - foundCount
            }) || `Found ${result_data.items?.length || 0} items from ${result_data.vendor || t('modals.unknownVendor')}\n\n` +
            `✅ ${foundCount} products matched in database\n` +
            `⚠️ ${itemsWithPrices.length - foundCount} ${t('modals.needManualPricing')}\n\n` +
            `Please review and adjust selling prices.`
          );
        } else {
          Alert.alert(t('invoice.failed'), result_data.error || result_data.message || t('invoice.processingFailed') || 'Failed to process invoice');
        }
        
      } else {
        // Multiple images - this is a multi-page invoice (NOT bulk, since we only process one invoice at a time)
        console.log(`📤 Using MULTI-PAGE pipeline - sending ${imageUris.length} pages to /process-multi-page-invoice`);
        
        // Use the multi-page invoice endpoint with 'pages' field
        imageUris.forEach((uri, index) => {
          formData.append('pages', {
            uri: uri,
            type: 'image/jpeg',
            name: `page_${index + 1}.jpg`,
          });
        });
        
        // Add page order (sequential by default) - use 0-based indices for backend
        const pageOrder = imageUris.map((_, i) => i);
        console.log(`📋 Page order being sent: ${JSON.stringify(pageOrder)}`);
        formData.append('pageOrder', JSON.stringify(pageOrder));
        
        const response = await fetch(`${INVOICE_SERVER_URL}/process-multi-page-invoice`, {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          }
        });
        
        const result_data = await response.json();
        console.log('📥 Multi-page invoice response:', result_data);
        
        // Setup socket connection for real-time progress if we have a requestId
        if (result_data.requestId) {
          setupSocketConnection(result_data.requestId);
        }
        
        if (response.ok && result_data.success) {
          // Process multi-page invoice response
          const itemsWithPrices = result_data.items?.map(item => ({
            ...item,
            found: item.existsInInventory || false,
            currentStock: item.currentStock || 0,
            sellingPrice: item.sellingPrice || item.suggestedPrice || item.unitPrice || 0
          })) || [];
          
          const resultWithImage = {
            ...result_data,
            items: itemsWithPrices,
            imageUri: imageUris[0], // Store the first image URI
            isMultiPage: true,
            pageCount: imageUris.length
          };
          
          setCurrentInvoice(resultWithImage);
          await saveInvoiceToRecentScans(resultWithImage);
          setShowPriceEditor(true);
          
          const foundCount = itemsWithPrices.filter(item => item.existsInInventory).length;
          Alert.alert(
            t('invoice.multiPageSuccess') || '✅ Multi-Page Invoice Processed',
            t('invoice.multiPageProcessedMessage', { 
              pageCount: imageUris.length,
              vendor: result_data.vendor || t('modals.unknownVendor'),
              itemCount: result_data.items?.length || 0,
              foundCount: foundCount,
              needPricingCount: itemsWithPrices.length - foundCount
            }) || `Processed ${imageUris.length} pages from ${result_data.vendor || 'Unknown Vendor'}\n\n` +
            `📦 Found ${result_data.items?.length || 0} items\n` +
            `✅ ${foundCount} products matched in database\n` +
            `⚠️ ${itemsWithPrices.length - foundCount} ${t('modals.needManualPricing')}\n\n` +
            `Please review and adjust selling prices.`
          );
        } else {
          Alert.alert(
            t('invoice.multiPageFailed') || '❌ Multi-Page Processing Failed', 
            result_data.error || result_data.message || t('invoice.processingFailed') || 'Failed to process multi-page invoice'
          );
        }
      }
      
    } catch (error) {
      console.error('Invoice processing error:', error);
      Alert.alert(t('common.error'), `${t('invoice.failed')}: ${error.message}`);
    } finally {
      setIsProcessing(false);
      // Disconnect socket when processing finishes
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      // Reset progress
      setProcessingProgress({
        step: 0,
        percentage: 0,
        message: '',
        details: ''
      });
    }
  };

  // Capture single image and add to collection
  const captureImage = async (existingImages = null) => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled) {
        console.log('📸 User canceled camera');
        return;
      }

      const image = result.assets[0];
      console.log(`📸 Image captured: ${image.uri}`);
      
      // Use passed images or current state
      const currentImages = existingImages || capturedImages;
      console.log(`📋 Current images collection:`, currentImages.length, 'images');
      
      // Add to captured images
      const newImages = [...currentImages, image.uri];
      setCapturedImages(newImages);
      
      console.log(`📱 Total images captured: ${newImages.length}`);
      
      // Handle different scenarios based on number of images
      if (newImages.length === 1) {
        // First image captured - ask if it's multi-page
        showStyledConfirmation(
          t('camera.imageCaptured'),
          t('camera.multiPageQuestion'),
          [
            { 
              text: t('camera.addNextPage'),
              style: 'primary',
              icon: '📄',
              onPress: () => {
                console.log(`📸 User wants to add more pages, current count: ${newImages.length}, capturing next...`);
                // Pass the accumulated images to the next capture
                captureImage(newImages); // Pass accumulated images
              }
            },
            { 
              text: t('camera.processInvoice') || 'No, Process Invoice',
              style: 'secondary', 
              icon: '🚀',
              onPress: () => {
                console.log(`📤 Processing ${newImages.length} image(s) as single-page invoice`);
                setIsProcessing(true);
                processInvoiceImages(newImages);
              }
            }
          ]
        );
      } else {
        // Multiple images captured - ask what to do
        showStyledConfirmation(
          t('camera.pageAdded', { pageNumber: newImages.length }),
          t('camera.whatNext'),
          [
            { 
              text: t('camera.addAnotherPage'),
              style: 'tertiary',
              icon: '📄',
              onPress: () => {
                console.log(`📸 Adding page ${newImages.length + 1}...`);
                captureImage(newImages); // Pass accumulated images
              }
            },
            { 
              text: t('camera.processMultiPage', { count: newImages.length }) || `Process ${newImages.length} Pages`,
              style: 'primary',
              icon: '🚀', 
              onPress: () => {
                console.log(`📤 Processing ${newImages.length} pages as multi-page invoice`);
                setIsProcessing(true);
                processInvoiceImages(newImages);
              }
            },
            {
              text: t('camera.reviewPages') || 'Review Pages',
              style: 'secondary',
              icon: '👁️',
              onPress: () => {
                console.log(`📸 ${newImages.length} images captured, showing preview`);
                setShowImagePreview(true);
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('📸 Camera error:', error);
      Alert.alert(t('errors.cameraError'), error.message || t('errors.cameraFailed') || 'Failed to open camera');
    }
  };

  // Invoice Analysis - Button 1
  const handleInvoiceAnalysis = async () => {
    console.log('🎬 Starting invoice analysis, resetting captured images');
    // Reset captured images
    setCapturedImages([]);
    
    // Start capturing images
    console.log('📸 Opening camera for first image...');
    await captureImage();
  };

  // Gallery Picker for Invoice Images
  const pickFromGallery = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      console.log('📷 Opening gallery for multiple invoice images...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 20, // Max 20 images
      });

      if (result.canceled) {
        console.log('📷 User canceled gallery selection');
        return;
      }

      // Reset captured images and add gallery images
      const selectedImages = result.assets.map(asset => asset.uri);
      setCapturedImages(selectedImages);

      console.log(`📷 Selected ${selectedImages.length} images from gallery`);
      
      // Show preview modal
      setShowImagePreview(true);
      
      Alert.alert(
        t('camera.imagesSelected') || '✅ Images Selected',
        t('camera.imagesSelectedMessage', { count: selectedImages.length }) || `${selectedImages.length} image${selectedImages.length > 1 ? 's' : ''} selected from gallery!\n\nReview and process when ready.`,
        [{ text: t('common.ok') }]
      );

    } catch (error) {
      console.error('📷 Gallery error:', error);
      Alert.alert(t('errors.galleryError') || '❌ Gallery Error', error.message || t('errors.galleryFailed') || 'Failed to select images from gallery');
    }
  };

  // Process product image with cloud OCR
  // New interactive product search function
  const searchProductByText = async (searchText) => {
    try {
      console.log(`🔍 Searching for product: "${searchText}"`);
      
      if (!desktopServerUrl) {
        throw new Error('Desktop server not configured');
      }
      
      const searchResponse = await fetchWithTimeout(`${desktopServerUrl}/api/products/search?q=${encodeURIComponent(searchText)}`, {}, 10000);
      
      if (searchResponse.ok) {
        const searchResults = await searchResponse.json();
        
        if (searchResults.products && searchResults.products.length > 0) {
          const product = searchResults.products[0];
          console.log('📦 Product found:', product);
          
          // Close the text selector modal
          setShowTextSelector(false);
          setSearchProgress({ current: 0, total: 0, searching: false });
          
          // Show product popup
          Alert.alert(
            t('product.found'),
            `📦 ${product.name || t('modals.unknownProduct')}\n\n` +
            `💰 Price: ${product.price || product.selling_price || 0} DZD\n` +
            `📊 Stock: ${product.quantity || 0} units\n` +
            `🏷️ Barcode: ${product.barcode || t('common.notAvailable')}`,
            [
              { text: t('common.cancel'), style: 'cancel' },
              { 
                text: t('sale.sellOne'), 
                onPress: () => sellProduct(
                  product.barcode, 
                  1, 
                  product.price || product.selling_price || 0, 
                  product.name
                )
              }
            ]
          );
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Search error:', error);
      return false;
    }
  };

  // Handle text line selection from modal
  const handleTextLineSelect = async (text) => {
    // Stop any ongoing auto-search
    setSearchProgress({ current: 0, total: 0, searching: true });
    const found = await searchProductByText(text);
    
    if (!found) {
      Alert.alert(
        t('product.notFound'), 
        t('product.notFoundForText', { text: text }),
        [{ text: t('common.ok'), style: 'cancel' }]
      );
      setSearchProgress({ current: 0, total: 0, searching: false });
    }
  };

  // Auto search through all lines
  const autoSearchTextLines = async (blocks) => {
    // Check if modal is still open
    if (!blocks || blocks.length === 0) return;
    
    let totalLines = 0;
    blocks.forEach(block => {
      if (block.lines) totalLines += block.lines.length;
    });
    
    setSearchProgress({ current: 0, total: totalLines, searching: true });
    
    let currentLine = 0;
    for (const block of blocks) {
      if (!block.lines) continue;
      
      for (const line of block.lines) {
        currentLine++;
        setSearchProgress({ current: currentLine, total: totalLines, searching: true });
        
        const searchText = line.text.trim();
        
        // Skip obvious non-products
        if (searchText.length < 3 || 
            /^\d+[\.,]\d+$/.test(searchText) || 
            /^[0-9\s]+$/.test(searchText) ||
            /^(prix|price|total|date)/i.test(searchText)) {
          continue;
        }
        
        const found = await searchProductByText(searchText);
        if (found) {
          return; // Stop searching once found
        }
        
        // Add small delay between searches
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // If nothing found after searching all lines
    setSearchProgress({ current: 0, total: 0, searching: false });
    Alert.alert(
      t('product.notFound'),
      t('product.notFoundInDatabase'),
      [{ text: t('common.ok'), style: 'cancel' }]
    );
  };

  const processProductImage = async (imageUri) => {
    try {
      // Photo processing now uses server OCR for better accuracy
      console.log('🔍 Processing image with cloud OCR...');
      
      // Note: For barcodes, use the live scanner instead of photo processing
      // Photo processing is now focused on invoice text extraction only
      
      console.log('📝 Extracting text from image...');
      
      // Process image for invoice text extraction using cloud OCR
      // Note: For barcode scanning, use the live scanner button instead
      
      // Send image to cloud for OCR processing
      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'invoice.jpg',
      });
      
      console.log('🌐 Sending to cloud OCR service...');
      const response = await fetchWithTimeout(`${INVOICE_SERVER_URL}/process-invoice`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }, 30000);
      
      if (response.ok) {
        const result = await response.json();
        console.log('📄 Cloud OCR result:', result);
        
        // Process the cloud OCR result
        if (result.items && result.items.length > 0) {
          console.log('📋 Showing invoice items from cloud OCR');
          
          // Convert cloud result to text blocks format
          const cloudTextBlocks = result.items.map((item, index) => ({
            text: `${item.description || ''} ${item.price || ''}`.trim(),
            boundingBox: null, // Cloud OCR doesn't provide exact positions
            cornerPoints: null,
            recognizedLanguages: [{ languageCode: 'en' }]
          }));
          
          setDetectedTextBlocks(cloudTextBlocks);
          setCurrentProductImage(imageUri);
          setShowTextSelector(true);
          setIsProcessing(false);
          setSearchProgress({ current: 0, total: 0, searching: false });
          
          // Clear any existing timeout
          if (autoSearchTimeout) {
            clearTimeout(autoSearchTimeout);
          }
          
          // Start auto-search after 2 seconds
          const timeout = setTimeout(() => {
            setSearchProgress((currentProgress) => {
              if (!currentProgress.searching) {
                autoSearchTextLines(cloudTextBlocks);
              }
              return currentProgress;
            });
          }, 2000);
          
          setAutoSearchTimeout(timeout);
        } else {
          // No items found in cloud OCR result
          Alert.alert(
            t('scanning.noProductsFound'),
            t('scanning.noItemsDetected') || 'No invoice items detected in the image. Please try with a clearer photo.',
            [{ text: t('common.ok'), style: 'cancel' }]
          );
        }
      } else {
        // Cloud OCR request failed
        console.error('❌ Cloud OCR failed:', response.status);
        Alert.alert(
          t('common.error'),
          t('scanning.processingFailed') || 'Failed to process image. Please try again or use the barcode scanner.',
          [{ text: t('common.ok'), style: 'cancel' }]
        );
      }
      
    } catch (error) {
      console.error('❌ Image processing error:', error);
      Alert.alert(
        t('common.error'), 
        t('scanning.imageProcessingFailed', { error: error.message }) || `Image processing failed: ${error.message}. Try using the barcode scanner instead.`,
        [{ text: t('common.ok'), style: 'cancel' }]
      );
    } finally {
      setIsProcessing(false);
      setSearchProgress({ current: 0, total: 0, searching: false });
    }
  };

  // Handle barcode detected from live scanner  
  const [lastProcessedBarcode, setLastProcessedBarcode] = useState(null);
  const [isProcessingBarcode, setIsProcessingBarcode] = useState(false);

  const handleLiveBarcodeDetected = async (barcode) => {
    try {
      console.log('🎯 Barcode detected:', barcode);
      
      // Validate barcode
      if (!barcode || typeof barcode !== 'string' || barcode.trim().length === 0) {
        console.log('⚠️ Invalid barcode data:', barcode);
        return;
      }
      
      // Debounce: Skip if we're already processing this barcode
      if (isProcessingBarcode || barcode === lastProcessedBarcode) {
        console.log('⏭️ Skipping duplicate barcode:', barcode);
        return;
      }
      
      console.log('✅ Processing new barcode:', barcode);
      setIsProcessingBarcode(true);
      setLastProcessedBarcode(barcode);
    
    if (!desktopServerUrl) {
      console.error('❌ TEST: No desktop server URL available');
      setShowLiveScanner(false);
      Alert.alert(
        '❌ ' + t('common.error'),
        t('desktop.notConnected'),
        [
          { 
            text: t('common.ok'),
            onPress: () => {
              setLastProcessedBarcode(null);
              setIsProcessingBarcode(false);
            }
          }
        ]
      );
      return;
    }
    
    console.log('🔵 TEST: Looking up product in desktop server...');
    console.log('🔵 TEST: API URL:', `${desktopServerUrl}/products/${barcode}`);
    
    // Lookup product by barcode
    try {
      const response = await fetchWithTimeout(`${desktopServerUrl}/products/${barcode}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      
      console.log('🔵 TEST: API Response status:', response.status);
      if (response.ok) {
        const product = await response.json();
        console.log('✅ TEST: Product found in desktop database!');
        console.log('🔵 TEST: Product details:', {
          name: product.name,
          price: product.price,
          quantity: product.quantity,
          barcode: barcode
        });
        product.barcode = barcode;
        
        // Close scanner to show confirmation modal
        console.log('🔵 TEST: Closing scanner, showing sale confirmation...');
        setShowLiveScanner(false);
        
        // Save to mobile storage only (don't send to desktop yet)
        await saveBarcodeToRecentScansLocal(barcode, product.name);
        
        // Show the new confirmation modal
        setPendingProduct(product);
        setShowSaleConfirmation(true);
        console.log('✅ TEST: Sale confirmation modal should be visible now');
        
        // Reset barcode processing states
        setLastProcessedBarcode(null);
        setIsProcessingBarcode(false);
      } else {
        console.log('❌ TEST: Product not found in database, status:', response.status);
        setShowLiveScanner(false);
        Alert.alert(
          t('selling.productNotFound'), 
          t('selling.productNotFoundDetails', { barcode }),
          [
            { 
              text: t('scanning.keepScanning'), 
              onPress: () => {
                setShowLiveScanner(true);
                // Reset states for next scan
                setLastProcessedBarcode(null);
                setIsProcessingBarcode(false);
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('❌ API Lookup error:', error);
      setShowLiveScanner(false);
      Alert.alert(t('common.error'), `${t('product.notFound')}: ${error.message}`, [
        { 
          text: t('scanning.keepScanning'), 
          onPress: () => {
            setShowLiveScanner(true);
            // Reset states for next scan
            setLastProcessedBarcode(null);
            setIsProcessingBarcode(false);
          }
        }
      ]);
    } finally {
      // Reset processing state after 2 seconds to allow new scans
      setTimeout(() => {
        setIsProcessingBarcode(false);
        setLastProcessedBarcode(null);
      }, 2000);
    }
    } catch (globalError) {
      console.error('🚨 CRITICAL: Barcode handler crashed:', globalError);
      // Force cleanup to prevent app crash
      try {
        setIsProcessingBarcode(false);
        setLastProcessedBarcode(null);
        setShowLiveScanner(false);
        memoryManager.forceCleanup();
      } catch (cleanupError) {
        console.error('🚨 CRITICAL: Cleanup also failed:', cleanupError);
      }
    }
  };
  
  // Handle text blocks from live scanner
  const handleLiveTextDetected = (textBlocks) => {
    console.log('📝 Live text detected, showing selector');
    setShowLiveScanner(false);
    setDetectedTextBlocks(textBlocks);
    setShowTextSelector(true);
    
    // Start auto-search after delay
    if (autoSearchTimeout) clearTimeout(autoSearchTimeout);
    const timeout = setTimeout(() => {
      setSearchProgress((currentProgress) => {
        if (!currentProgress.searching) {
          autoSearchTextLines(textBlocks);
        }
        return currentProgress;
      });
    }, 2000);
    setAutoSearchTimeout(timeout);
  };
  
  // Product Selling with Native Barcode Scanner - Button 2
  const handleProductSelling = async () => {
    try {
      console.log('🔵 TEST: Sell button pressed');
      console.log('🔵 TEST: Desktop URL:', desktopServerUrl);
      console.log('🔵 TEST: Native scanner ready');
      
      // Check desktop server connection first
      if (!desktopServerUrl) {
        console.log('❌ TEST: No desktop server connection');
        Alert.alert(
          '❌ ' + t('common.error'),
          t('desktop.notConnected'),
          [{ text: t('common.ok') }]
        );
        return;
      }
      
      // Native expo-camera scanning - always ready!
      
      // Open live scanner
      console.log('✅ TEST: Opening camera scanner...');
      setShowLiveScanner(true);
    } catch (error) {
      console.error('❌ TEST: Product selling error:', error);
      Alert.alert(t('common.error'), `${t('errors.cameraFailed')}: ${error.message}`);
    }
  };

  // Handle sale confirmation
  const handleSaleConfirmation = async (saleData) => {
    setShowSaleConfirmation(false);
    await sellProduct(saleData.barcode, saleData.quantity, saleData.price, saleData.name);
    // Sale completed - no need to send scan notification (only sale notification is sent)
    console.log('✅ Sale completed - scan notification skipped to avoid duplicate');
    // Reopen scanner after successful sale
    setShowLiveScanner(true);
  };

  // Handle sale cancellation  
  const handleSaleCancellation = () => {
    setShowSaleConfirmation(false);
    
    // FIXED: Send scan notification since user looked up product but didn't buy
    if (pendingProduct) {
      console.log('📋 Sale cancelled - sending standalone scan notification');
      saveBarcodeToRecentScans(pendingProduct.barcode, pendingProduct.name);
    }
    
    setPendingProduct(null);
    // Reopen scanner
    setShowLiveScanner(true);
  };

  // Sell product function
  const sellProduct = async (barcode, quantity, price, name) => {
    try {
      setIsProcessing(true);
      console.log(`💰 Selling product: ${barcode}, qty: ${quantity}, price: ${price}`);
      
      if (!desktopServerUrl) {
        Alert.alert(
          '❌ ' + t('common.error'),
          t('desktop.notConnected'),
          [{ text: t('common.ok') }]
        );
        setIsProcessing(false);
        return;
      }
      
      const response = await fetchWithTimeout(`${desktopServerUrl}/stock/sell`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barcode: barcode || undefined,
          name: name || undefined,
          qty: quantity
        })
      });
      
      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error('Invalid response from server');
      }
      console.log('💰 Sale result:', result);
      
      if (response.ok && !result.error) {
        // Save to recent sales history
        await saveToRecentSales({
          productName: name,
          barcode: barcode,
          quantity: quantity,
          unitPrice: price,
          total: price * quantity,
          remainingStock: result.newStock || result.remainingStock
        });

        Alert.alert(
          t('selling.saleComplete'),
          t('selling.saleSuccessDetails', {
            quantity: quantity,
            name: name || t('modals.unknownProduct'),
            total: (price * quantity).toFixed(2),
            stock: result.newStock || result.remainingStock || t('common.notAvailable')
          })
        );
      } else {
        Alert.alert(t('selling.saleFailed'), t('selling.saleErrorDetails', { error: result.error || t('common.error') }));
      }
      
    } catch (error) {
      console.error('Sale error:', error);
      
      // Check if it's a network error
      if (error.message && (error.message.includes('timeout') || error.message.includes('network'))) {
        Alert.alert(
          t('selling.saleFailed'),
          t('errors.networkError') || 'Network error. Please check your connection and ensure the desktop app is running.',
          [{ text: t('common.ok') }]
        );
      } else {
        Alert.alert(
          t('selling.saleFailed'), 
          t('selling.saleErrorDetails', { error: error.message || 'Unknown error' }),
          [{ text: t('common.ok') }]
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Update item price in price editor
  const updateItemPrice = (index, newPrice) => {
    if (!currentInvoice) return;
    
    const updatedInvoice = { ...currentInvoice };
    updatedInvoice.items[index] = {
      ...updatedInvoice.items[index],
      sellingPrice: parseFloat(newPrice) || 0
    };
    setCurrentInvoice(updatedInvoice);
  };

  // Update item price in bulk invoice
  const updateBulkItemPrice = (invoiceIndex, itemIndex, newPrice) => {
    if (!currentInvoice || !currentInvoice.isBulk) return;
    
    const updatedInvoice = { ...currentInvoice };
    updatedInvoice.invoices[invoiceIndex].items[itemIndex] = {
      ...updatedInvoice.invoices[invoiceIndex].items[itemIndex],
      sellingPrice: parseFloat(newPrice) || 0
    };
    setCurrentInvoice(updatedInvoice);
  };

  // Load recent scans from AsyncStorage
  const loadRecentScans = async () => {
    try {
      console.log('📖 Loading recent scans from AsyncStorage...');
      
      if (!AsyncStorage || !AsyncStorage.getItem) {
        console.error('❌ AsyncStorage not available for loading');
        return;
      }
      
      const stored = await AsyncStorage.getItem('recentScans');
      console.log('📖 Stored data from AsyncStorage:', stored ? `${stored.length} characters` : 'null');
      
      if (stored) {
        const scans = JSON.parse(stored);
        const validScans = scans.slice(0, 10); // Keep only last 10 scans
        setRecentScans(validScans);
        console.log(`✅ Loaded ${validScans.length} recent scans`);
      } else {
        console.log('📖 No recent scans found in storage');
      }
    } catch (error) {
      console.error('❌ Failed to load recent scans:', error);
      console.error('Error details:', error.message, error.stack);
    }
  };

  // Load recent sales from AsyncStorage
  const loadRecentSales = async () => {
    try {
      console.log('📖 Loading recent sales from AsyncStorage...');
      
      if (!AsyncStorage || !AsyncStorage.getItem) {
        console.error('❌ AsyncStorage not available for loading sales');
        return;
      }
      
      const stored = await AsyncStorage.getItem('recentSales');
      console.log('📖 Stored sales data from AsyncStorage:', stored ? `${stored.length} characters` : 'null');
      
      if (stored) {
        const sales = JSON.parse(stored);
        const validSales = sales.slice(0, 10); // Keep only last 10 sales
        setRecentSales(validSales);
        console.log(`✅ Loaded ${validSales.length} recent sales`);
      } else {
        console.log('📖 No recent sales found in storage');
      }
    } catch (error) {
      console.error('❌ Failed to load recent sales:', error);
      console.error('Error details:', error.message, error.stack);
    }
  };

  // Fetch inventory products - Hybrid Mode (Desktop + Cloud Cache)
  const fetchInventoryProducts = async () => {
    try {
      setInventoryLoading(true);
      setShowInventory(true);
      
      console.log('📦 [HYBRID] Fetching inventory products...');
      
      // Try desktop server first (in-store scenario)
      try {
        console.log('📦 [HYBRID] Attempting desktop server connection...');
        const desktopResponse = await fetchWithTimeout(`${desktopServerUrl}/products`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 8000  // 8 second timeout for desktop
        });
        
        const desktopData = await desktopResponse.json();
        console.log('✅ [HYBRID] Desktop inventory loaded:', desktopData.products?.length || 0, 'products');
        
        if (desktopData.products && Array.isArray(desktopData.products)) {
          setInventoryProducts(desktopData.products);
          return; // Success - use desktop data
        }
      } catch (desktopError) {
        console.log('⚠️ [HYBRID] Desktop server not available:', desktopError.message);
      }
      
      // Fallback to smart cloud inventory with auto-refresh
      console.log('☁️ [HYBRID] Falling back to smart cloud inventory...');
      try {
        // Use smart endpoint that handles caching and persistence
        const cloudResponse = await fetch(`${INVOICE_SERVER_URL}/inventory/smart?forceRefresh=false`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 15000  // 15 second timeout for cloud
        });
        
        const cloudData = await cloudResponse.json();
        console.log('☁️ [HYBRID] Cloud cached inventory loaded:', cloudData.products?.length || 0, 'products');
        
        if (cloudData.products && Array.isArray(cloudData.products)) {
          setInventoryProducts(cloudData.products);
          
          // Show warning if data is stale
          if (cloudData.metadata?.isStale) {
            Alert.alert(
              t('inventory.cachedDataTitle') || '⚠️ Cached Data',
              t('inventory.cachedDataMessage') || 'Using cached inventory data from cloud. Some information might be outdated. Connect to store network for real-time data.',
              [{ text: t('common.ok') }]
            );
          } else {
            // Show success message for fresh cached data
            Alert.alert(
              t('inventory.remoteAccessTitle') || '☁️ Remote Access',
              t('inventory.remoteAccessMessage') || 'Using cached inventory from cloud server. Data is up to date.',
              [{ text: t('common.ok') }]
            );
          }
          return; // Success - use cloud cache
        } else {
          throw new Error('No cached inventory available');
        }
        
      } catch (cloudError) {
        console.error('❌ [HYBRID] Cloud cache also failed:', cloudError.message);
        
        // Both desktop and cloud failed
        setInventoryProducts([]);
        Alert.alert(
          t('errors.connectionError') || '❌ Connection Error',
          t('inventory.noAccessError') || 'Cannot access inventory. Neither desktop server nor cloud cache is available. Please check your network connection.',
          [{ text: t('common.ok') }]
        );
      }
      
    } catch (error) {
      console.error('❌ [HYBRID] Unexpected error in fetchInventoryProducts:', error);
      setInventoryProducts([]);
      Alert.alert(
        t('common.error') || '❌ Error',
        t('inventory.unexpectedError') || 'An unexpected error occurred while fetching inventory.',
        [{ text: t('common.ok') }]
      );
    } finally {
      setInventoryLoading(false);
    }
  };

  // Helper functions for inventory tabs
  const getFilteredInventory = (tabType) => {
    // First filter by search term
    let filtered = inventoryProducts;
    if (inventorySearch) {
      filtered = inventoryProducts.filter(product => 
        product.name?.toLowerCase().includes(inventorySearch.toLowerCase()) ||
        product.barcode?.toLowerCase().includes(inventorySearch.toLowerCase()) ||
        product.category_name?.toLowerCase().includes(inventorySearch.toLowerCase())
      );
    }
    
    // Then filter by tab type
    switch (tabType) {
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
  };

  const getTabCount = (tabType) => {
    const filtered = getFilteredInventory(tabType);
    if (tabType === 'categories') {
      return Object.keys(filtered).length;
    }
    return Array.isArray(filtered) ? filtered.length : 0;
  };

  // Save individual barcode scan to mobile storage only (no desktop notification)
  const saveBarcodeToRecentScansLocal = async (barcode, productName = null) => {
    try {
      const newScan = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        type: 'barcode',
        barcode: barcode,
        productName: productName || `Product ${barcode}`,
        total: 0,
        imageUri: null,
        requestId: `barcode_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      };
      
      const updatedScans = [newScan, ...recentScans].slice(0, 10);
      setRecentScans(updatedScans);
      
      if (AsyncStorage && AsyncStorage.setItem) {
        await AsyncStorage.setItem('recentScans', JSON.stringify(updatedScans));
        console.log('✅ Barcode scan saved to mobile storage only (no desktop notification)');
      }
      
    } catch (error) {
      console.error('❌ Failed to save barcode scan locally:', error);
    }
  };

  // Save individual barcode scan to recent history (WITH desktop notification)
  const saveBarcodeToRecentScans = async (barcode, productName = null) => {
    try {
      const newScan = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        type: 'barcode',
        barcode: barcode,
        productName: productName || `Product ${barcode}`,
        total: 0,
        imageUri: null,
        requestId: `barcode_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      };
      
      const updatedScans = [newScan, ...recentScans].slice(0, 10);
      setRecentScans(updatedScans);
      
      if (AsyncStorage && AsyncStorage.setItem) {
        await AsyncStorage.setItem('recentScans', JSON.stringify(updatedScans));
        console.log('✅ Barcode scan saved to recent scans');
      }
      
      // FIXED: Also send barcode scans to desktop for SCANS notifications
      try {
        if (desktopServerUrl) {
          const response = await fetchWithTimeout(`${desktopServerUrl}/recent-scans`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(newScan)
          });
          
          if (response.ok) {
            console.log('✅ Barcode scan saved to desktop server (SCANS notification)');
          } else {
            console.log('⚠️ Failed to save barcode scan to desktop server');
          }
        }
      } catch (desktopError) {
        console.log('⚠️ Desktop server unavailable for barcode scan notification');
      }
      
    } catch (error) {
      console.error('❌ Failed to save barcode scan:', error);
    }
  };


  // Save invoice scan to recent history (for invoices with multiple items)
  const saveInvoiceToRecentScans = async (scanData) => {
    try {
      console.log('📝 Saving scan to recent history...', { 
        vendor: scanData.vendor, 
        items: scanData.items?.length
      });
      
      const newScan = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        type: scanData.type || 'invoice',
        vendor: scanData.vendor || t('modals.unknownVendor'),
        vendorDetails: scanData.vendorDetails || null, // Vendor with confidence
        totalItems: scanData.totalItems || scanData.items?.length || 0,
        total: scanData.totalValidation?.finalTotal || scanData.totals?.total || scanData.total || 0,
        items: scanData.items || [], // Store ALL items with confidence scores
        imageUri: scanData.imageUri || null, // Store the invoice image (first/single image)
        imageUris: scanData.imageUris || (scanData.imageUri ? [scanData.imageUri] : []), // Store ALL images
        requestId: scanData.requestId || null, // Store request ID for backend reference
        
        // Invoice details
        invoiceNumber: scanData.invoiceNumber || null,
        invoiceDate: scanData.invoiceDate || null,
        totals: scanData.totals || null,
        
        // Additional fields from Content Understanding
        additionalFields: scanData.additionalFields || {},
        metadata: scanData.metadata || {},
        processingMethod: scanData.processingMethod || 'legacy',
        
        // Quality info
        qualityAnalysis: scanData.qualityAnalysis || null,
        totalValidation: scanData.totalValidation || null
      };
      
      console.log('📝 New scan object created:', newScan);
      
      // Save to mobile AsyncStorage only
      const updatedScans = [newScan, ...recentScans].slice(0, 10);
      setRecentScans(updatedScans);
      
      if (AsyncStorage && AsyncStorage.setItem) {
        await AsyncStorage.setItem('recentScans', JSON.stringify(updatedScans));
        console.log('✅ Recent scans saved to mobile storage');
      }
      
      // FIXED: Desktop Recent Scans needs notification in scans_sync_notifications table
      // /invoices/finalize creates invoice record, but Recent Scans UI pulls from notifications!
      try {
        if (desktopServerUrl) {
          console.log('📨 Sending scan notification to desktop Recent Scans...');
          
          const response = await fetchWithTimeout(`${desktopServerUrl}/recent-scans`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'invoice',
              vendor: newScan.vendor,
              totalItems: newScan.totalItems,
              total: newScan.total,
              imageUri: newScan.imageUri,
              requestId: newScan.requestId,
              invoiceNumber: newScan.invoiceNumber,
              invoiceDate: newScan.invoiceDate,
              items: newScan.items,
              isMultiPage: scanData.isMultiPage || false,
              pageCount: scanData.pageCount || 1,
              // Include image paths for desktop display
              imageUris: scanData.imageUris || (newScan.imageUri ? [newScan.imageUri] : []),
              timestamp: newScan.timestamp
            })
          }, 10000);
          
          if (response.ok) {
            console.log('✅ Scan notification sent to desktop Recent Scans');
          } else {
            console.log('⚠️ Failed to send scan notification to desktop');
          }
        }
      } catch (error) {
        console.log('⚠️ Desktop scan notification failed:', error.message);
      }
      
    } catch (error) {
      console.error('❌ Failed to save recent scan:', error);
      console.error('Error details:', error.message, error.stack);
    }
  };

  // Save sale to recent history (mobile + desktop)
  const saveToRecentSales = async (saleData) => {
    try {
      console.log('📝 Saving sale to recent history...', { 
        product: saleData.productName, 
        quantity: saleData.quantity, 
        total: saleData.total 
      });
      
      const newSale = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        type: 'sale',
        productName: saleData.productName || t('modals.unknownProduct'),
        barcode: saleData.barcode || null,
        quantity: saleData.quantity || 1,
        unitPrice: saleData.unitPrice || 0,
        total: saleData.total || 0,
        remainingStock: saleData.remainingStock || null
      };
      
      console.log('📝 New sale object created:', newSale);
      
      // Save to mobile AsyncStorage
      const updatedSales = [newSale, ...recentSales].slice(0, 10);
      setRecentSales(updatedSales);
      
      if (AsyncStorage && AsyncStorage.setItem) {
        await AsyncStorage.setItem('recentSales', JSON.stringify(updatedSales));
        console.log('✅ Recent sales saved to mobile storage');
      }
      
      // Also save to desktop server for synchronization
      try {
        const response = await fetchWithTimeout(`${desktopServerUrl}/recent-sales`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newSale)
        });
        
        if (response.ok) {
          console.log('✅ Sale saved to desktop server');
        } else {
          console.log('⚠️ Failed to save to desktop server');
        }
      } catch (error) {
        console.log('⚠️ Desktop server not available - sale notification will not be created');
        console.log('💡 Sales are not queued - they require direct desktop connection');
        // Sales don't need to be queued, they are immediate transactions
        // The sale is already saved locally to mobile storage above
      }
      
    } catch (error) {
      console.error('❌ Failed to save recent sale:', error);
      console.error('Error details:', error.message, error.stack);
    }
  };

  // CLEAN: Submit invoice using ConnectionManager
  const handleSubmitPrices = async () => {
    await submitPrices({
      currentInvoice,
      setIsProcessing,
      setShowPriceEditor,
      setCurrentInvoice,
      t
    });

    // Save to recent scans after successful submission
    if (currentInvoice) {
      await saveInvoiceToRecentScans({
        ...currentInvoice,
        status: 'processed'
      });
    }
  };
  
  // Legacy submit prices function (kept for reference)
  const submitPricesLegacy = async () => {
    if (!currentInvoice) return;
    
    try {
      setIsProcessing(true);
      
      if (currentInvoice.isBulk) {
        // Handle bulk invoice updates
        const bulkUpdates = [];
        let totalItems = 0;
        
        currentInvoice.invoices.forEach(invoice => {
          const updatedItems = invoice.items
            .filter(item => (item.barcode || item.productCode) && item.sellingPrice > 0)
            .map(item => ({
              barcode: item.barcode || item.productCode,
              sellingPrice: parseFloat(item.sellingPrice),
              name: item.description || item.name || t('modals.unknownItem')
            }));
          
          if (updatedItems.length > 0) {
            bulkUpdates.push({
              requestId: invoice.requestId,
              updatedItems: updatedItems
            });
            totalItems += updatedItems.length;
          }
        });
        
        if (bulkUpdates.length === 0) {
          Alert.alert(t('invoice.noValidItems') || '❌ No Valid Items', t('invoice.noValidItemsMessage') || 'No items with valid barcode and selling price found.');
          return;
        }
        
        console.log('📤 Submitting bulk price updates:', bulkUpdates);
        
        // Server doesn't have bulk endpoint, send as individual batch requests
        const updatePromises = bulkUpdates.map(update => 
          fetch(`${INVOICE_SERVER_URL}/update-batch-selling-prices`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(update)
          })
        );
        
        const responses = await Promise.all(updatePromises);
        const results = await Promise.all(responses.map(r => r.json()));
        console.log('📥 Bulk price update results:', results);
        
        const successCount = results.filter(r => r.success).length;
        
        if (successCount > 0) {
          // After prices are updated, finalize invoices to create products in desktop DB
          console.log('📤 Finalizing bulk invoices in desktop database...');
          try {
            const finalizePromises = currentInvoice.invoices.map(invoice =>
              fetch(`${INVOICE_SERVER_URL}/finalize-invoice`, {
                method: 'POST',
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ requestId: invoice.requestId })
              })
            );
            
            await Promise.all(finalizePromises);
            console.log('✅ All invoices finalized in desktop database');
          } catch (finalizeError) {
            console.warn('⚠️ Warning: Failed to finalize some invoices in desktop database:', finalizeError);
          }
          
          Alert.alert(
            t('invoice.pricesUpdated') || '✅ Prices Updated',
            t('invoice.pricesUpdatedMessage', { totalItems, successCount, total: bulkUpdates.length }) || `Successfully updated prices for ${totalItems} items across ${successCount}/${bulkUpdates.length} invoices.\n\nProducts have been added to inventory.`,
            [
              { text: t('common.done'), onPress: () => { setShowPriceEditor(false); setCurrentInvoice(null); }}
            ]
          );
        } else {
          Alert.alert(t('invoice.updateFailed') || '❌ Update Failed', t('invoice.updateFailedMessage') || 'Failed to update prices for any invoices');
        }
        
      } else {
        // Handle single invoice update
        const updatedItems = currentInvoice.items
          .filter(item => (item.barcode || item.productCode) && item.sellingPrice > 0)
          .map(item => ({
            barcode: item.barcode || item.productCode,
            sellingPrice: parseFloat(item.sellingPrice),
            name: item.description || item.name || t('common.unknownItem')
          }));
        
        if (updatedItems.length === 0) {
          Alert.alert(t('invoice.noValidItems') || '❌ No Valid Items', t('invoice.noValidItemsMessage') || 'No items with valid barcode and selling price found.');
          return;
        }
        
        console.log('📤 Submitting price updates:', updatedItems);
        
        let offlineQueueSuccess = false; // Track if offline queue was used
        
        const response = await fetch(`${INVOICE_SERVER_URL}/update-batch-selling-prices`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requestId: currentInvoice.requestId,
            updatedItems: updatedItems
          })
        });
        
        const result = await response.json();
        console.log('📥 Price update result:', result);
        
        if (result.success) {
          // Cloud server acknowledged - now update desktop database directly
          console.log('✅ Cloud server acknowledged price update request');
          console.log('📱 Mobile app now handling desktop database operations...');
          
          let desktopSuccess = false;
          let queueSuccess = false;
          
          try {
            // Re-discover desktop server before attempting update for fresh URL - DISABLED
            console.log('🔄 Re-discovering desktop server for fresh URL...');
            const desktopIP = null; // await RobustDesktopFinder.findDesktop(); // DISABLED
            const freshDesktopUrl = desktopIP ? `http://${desktopIP}:4000` : desktopServerUrl;
            const desktopUrl = freshDesktopUrl;
            console.log(`🏪 Attempting desktop update at: ${desktopUrl}`);
            
            // First check if desktop is reachable
            const healthCheck = await fetchWithTimeout(
              `${desktopUrl}/health`,
              { method: 'GET' },
              3000
            ).catch(() => null);
            
            if (!healthCheck || !healthCheck.ok) {
              throw new Error('Desktop server not reachable');
            }
            
            // Update prices in desktop database
            const desktopPriceResponse = await fetchWithTimeout(
              `${desktopUrl}/api/update-batch-selling-prices`,
              {
                method: 'POST',
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  requestId: currentInvoice.requestId,
                  updatedItems: updatedItems
                })
              },
              15000
            );
            
            if (desktopPriceResponse.ok) {
              const priceResult = await desktopPriceResponse.json();
              console.log('✅ Prices updated in desktop database:', priceResult);
              
              // Now finalize invoice in desktop database
              const finalizeResponse = await fetchWithTimeout(
                `${desktopUrl}/invoices/finalize`,
                {
                  method: 'POST',
                  headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    requestId: currentInvoice.requestId,
                    vendor: currentInvoice.vendor || currentInvoice.supplier,
                    invoiceNumber: currentInvoice.invoiceNumber || currentInvoice.invoice_id,
                    invoiceDate: currentInvoice.invoiceDate || currentInvoice.date || new Date().toISOString(),
                    invoiceImage: currentInvoice.imageBase64 ? {
                      base64: currentInvoice.imageBase64,
                      mimeType: 'image/jpeg',
                      originalName: `invoice_${currentInvoice.requestId}.jpg`
                    } : null,
                    total: currentInvoice.total,
                    items: currentInvoice.items,
                    // Send ALL extracted data to desktop
                    totals: currentInvoice.totals,
                    processingNotes: currentInvoice.processingNotes,
                    qualityAnalysis: currentInvoice.qualityAnalysis,
                    hasInvoiceImage: currentInvoice.hasInvoiceImage || !!currentInvoice.imageBase64,
                    // Additional fields from Content Understanding
                    additionalFields: currentInvoice.additionalFields,
                    confidence: currentInvoice.confidence,
                    extractionMethod: currentInvoice.processingInfo?.extractionMethod || 'custom_analyzer'
                  })
                },
                15000
              );
              
              if (finalizeResponse.ok) {
                const finalizeResult = await finalizeResponse.json();
                console.log('✅ Invoice finalized in desktop database:', finalizeResult);
                desktopSuccess = true;
              } else {
                const errorText = await finalizeResponse.text();
                console.warn('⚠️ Warning: Failed to finalize invoice in desktop database');
                console.error('Finalize response:', errorText);
              }
            } else {
              // Log the actual error for debugging
              const errorText = await desktopPriceResponse.text();
              console.warn('⚠️ Warning: Failed to update prices in desktop database');
              console.error('Desktop response status:', desktopPriceResponse.status);
              console.error('Desktop response:', errorText);
              
              // Try to parse error if it's JSON
              try {
                const errorJson = JSON.parse(errorText);
                console.error('Desktop error details:', errorJson);
              } catch (e) {
                // Not JSON, already logged as text
              }
            }
          } catch (desktopError) {
            console.warn('⚠️ Desktop direct update failed:', desktopError.message);
            console.log('📡 Switching to queue mode - storing updates in cloud for later sync');
            console.log(`🔄 Queue mode activated due to: ${desktopError.message}`);
            
            // FIXED: Queue the updates in cloud server WITH scan data and images
            try {
              // Convert image to base64 for cloud queue
              let imageBase64ForCloudQueue = currentInvoice.imageBase64;
              let imagesBase64ArrayForCloudQueue = currentInvoice.imagesBase64 || [];
              
              if (currentInvoice.isMultiPage && currentInvoice.imageUris && currentInvoice.imageUris.length > 0) {
                console.log(`🖼️ Converting ${currentInvoice.imageUris.length} pages for cloud queue...`);
                const FileSystem = await import('expo-file-system');
                
                for (let i = 0; i < currentInvoice.imageUris.length; i++) {
                  try {
                    const base64 = await FileSystem.default.readAsStringAsync(currentInvoice.imageUris[i], {
                      encoding: FileSystem.default.EncodingType.Base64
                    });
                    imagesBase64ArrayForCloudQueue.push(base64);
                    console.log(`✅ Cloud Queue: Page ${i + 1} converted`);
                  } catch (conversionError) {
                    console.warn(`⚠️ Cloud Queue: Could not convert page ${i + 1}`);
                    imagesBase64ArrayForCloudQueue.push(null);
                  }
                }
                imageBase64ForCloudQueue = imagesBase64ArrayForCloudQueue[0];
              } else if (!imageBase64ForCloudQueue && currentInvoice.imageUri) {
                console.log('🖼️ Converting single image for cloud queue...');
                try {
                  const FileSystem = await import('expo-file-system');
                  imageBase64ForCloudQueue = await FileSystem.default.readAsStringAsync(currentInvoice.imageUri, {
                    encoding: FileSystem.default.EncodingType.Base64
                  });
                  console.log(`✅ Image converted for cloud queue (${imageBase64ForCloudQueue ? imageBase64ForCloudQueue.length : 0} chars)`);
                } catch (conversionError) {
                  console.warn('⚠️ Could not convert image for cloud queue:', conversionError);
                }
              }
              
              const queueResponse = await fetchWithTimeout(
                `${INVOICE_SERVER_URL}/inventory/queue-update`,
                {
                  method: 'POST',
                  headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    requestId: currentInvoice.requestId,
                    updatedItems: updatedItems,
                    // FIXED: Include scan data with images for cloud queue
                    scanData: {
                      id: Date.now().toString(),
                      timestamp: new Date().toISOString(),
                      type: 'invoice',
                      vendor: currentInvoice.vendor || currentInvoice.supplier || 'Unknown',
                      totalItems: currentInvoice.items?.length || 0,
                      total: currentInvoice.total || 0,
                      items: currentInvoice.items?.slice(0, 5) || [],
                      imageUri: currentInvoice.imageUri,
                      imageUris: currentInvoice.imageUris || [currentInvoice.imageUri],
                      imageBase64: imageBase64ForCloudQueue,
                      imagesBase64: imagesBase64ArrayForCloudQueue,
                      hasInvoiceImage: !!(imageBase64ForCloudQueue || imagesBase64ArrayForCloudQueue.length > 0 || currentInvoice.imageUri),
                      isMultiPage: currentInvoice.isMultiPage || false,
                      pageCount: currentInvoice.pageCount || 1,
                      requestId: currentInvoice.requestId
                    },
                    metadata: {
                      source: 'remote_mobile',
                      vendor: currentInvoice.vendor || currentInvoice.supplier,
                      invoiceNumber: currentInvoice.invoiceNumber,
                      timestamp: new Date().toISOString()
                    }
                  })
                },
                15000 // Longer timeout for image data
              );
              
              if (queueResponse.ok) {
                const queueResult = await queueResponse.json();
                console.log('✅ Stock updates successfully queued in cloud');
                console.log(`🆔 Queue ID: ${queueResult.queueId}`);
                console.log(`📊 Items queued: ${queueResult.itemsQueued || updatedItems.length}`);
                console.log(`⏰ Will be processed at next desktop sync`);
                queueSuccess = true;
              } else {
                console.warn('⚠️ Failed to queue stock updates in cloud');
              }
            } catch (queueError) {
              console.error('❌ Failed to queue updates:', queueError.message);
              
              // If both desktop and cloud are unavailable, use enhanced offline queue
              console.log('📦 Both servers unavailable, using enhanced offline queue...');
              
              // FIXED: Convert image to base64 before queuing
              let imageBase64ForQueue = currentInvoice.imageBase64;
              if (!imageBase64ForQueue && currentInvoice.imageUri) {
                console.log('🖼️ Converting image for offline queue...');
                try {
                  const FileSystem = await import('expo-file-system');
                  imageBase64ForQueue = await FileSystem.default.readAsStringAsync(currentInvoice.imageUri, {
                    encoding: FileSystem.default.EncodingType.Base64
                  });
                  console.log(`✅ Image converted for offline queue (${imageBase64ForQueue ? imageBase64ForQueue.length : 0} chars)`);
                } catch (conversionError) {
                  console.warn('⚠️ Could not convert image for offline queue:', conversionError);
                }
              }

              // OLD QUEUE CODE - DISABLED (using ConnectionManager now)
              /*const queueId = await SimpleQueue.addInvoice({
                vendor: currentInvoice.vendor || currentInvoice.supplier,
                invoiceNumber: currentInvoice.invoiceNumber || currentInvoice.invoice_id,
                date: currentInvoice.invoiceDate || currentInvoice.date || new Date().toISOString(),
                items: updatedItems,
              });
              offlineQueueSuccess = true;
              console.log('✅ Invoice queued with SimpleQueue:', queueId);*/
            }
          }
          
          // FIXED: Send scan notification only after successful desktop sync
          if (desktopSuccess) {
            console.log('✅ Desktop sync successful - creating scan notification with image');
            try {
              // Convert image URI(s) to base64 for desktop storage
              let imageBase64Data = currentInvoice.imageBase64;
              let imagesBase64Array = currentInvoice.imagesBase64 || [];
              
              // Handle multi-page invoices
              if (currentInvoice.isMultiPage && currentInvoice.imageUris && currentInvoice.imageUris.length > 0) {
                console.log(`🖼️ Converting ${currentInvoice.imageUris.length} invoice pages to base64...`);
                const FileSystem = await import('expo-file-system');
                
                for (let i = 0; i < currentInvoice.imageUris.length; i++) {
                  try {
                    console.log(`📍 Converting page ${i + 1}/${currentInvoice.imageUris.length}: ${currentInvoice.imageUris[i]}`);
                    const base64 = await FileSystem.default.readAsStringAsync(currentInvoice.imageUris[i], {
                      encoding: FileSystem.default.EncodingType.Base64
                    });
                    imagesBase64Array.push(base64);
                    console.log(`✅ Page ${i + 1} converted (${base64 ? base64.length : 0} chars)`);
                  } catch (conversionError) {
                    console.warn(`⚠️ Could not convert page ${i + 1}:`, conversionError.message);
                    imagesBase64Array.push(null);
                  }
                }
                
                // For backward compatibility, also set the first image as imageBase64
                imageBase64Data = imagesBase64Array[0];
                console.log(`✅ All ${imagesBase64Array.length} pages processed`);
                
              } else if (!imageBase64Data && currentInvoice.imageUri) {
                // Single page invoice
                console.log('🖼️ Converting single invoice image to base64...');
                console.log('📍 Image URI:', currentInvoice.imageUri);
                try {
                  const FileSystem = await import('expo-file-system');
                  imageBase64Data = await FileSystem.default.readAsStringAsync(currentInvoice.imageUri, {
                    encoding: FileSystem.default.EncodingType.Base64
                  });
                  console.log(`✅ Invoice image converted to base64 (length: ${imageBase64Data ? imageBase64Data.length : 0})`);
                } catch (conversionError) {
                  console.warn('⚠️ Could not convert image to base64:', conversionError);
                  console.warn('Error details:', conversionError.message);
                  imageBase64Data = null;
                }
              } else {
                console.log('📍 Image base64 status:', {
                  hasExistingBase64: !!imageBase64Data,
                  hasImageUri: !!currentInvoice.imageUri,
                  imageUriValue: currentInvoice.imageUri
                });
              }
              
              await saveInvoiceToRecentScans({
                ...currentInvoice,
                type: 'invoice',
                vendor: currentInvoice.vendor || currentInvoice.supplier || 'Unknown',
                totalItems: currentInvoice.items?.length || 0,
                total: currentInvoice.total || 0,
                imageUri: currentInvoice.imageUri,
                imageUris: currentInvoice.imageUris || (currentInvoice.imageUri ? [currentInvoice.imageUri] : []),
                isMultiPage: currentInvoice.isMultiPage || false,
                pageCount: currentInvoice.pageCount || 1,
                requestId: currentInvoice.requestId,
                // Include base64 image data for desktop display
                imageBase64: imageBase64Data, // First page for backward compatibility
                imagesBase64: imagesBase64Array, // All pages for multi-page invoices
                hasInvoiceImage: !!(imageBase64Data || imagesBase64Array.length > 0 || currentInvoice.imageUri)
              }, true); // Pass true to send to desktop with image
              console.log('✅ Scan notification created for successful sync with image data');
            } catch (scanError) {
              console.error('⚠️ Failed to create scan notification:', scanError);
            }
          } else {
            console.log('📦 Desktop offline - creating queued scan notification with image');
            
            // FIXED: For offline/queued scenario, also convert image(s) and prepare scan data
            try {
              let imageBase64DataForQueue = currentInvoice.imageBase64;
              let imagesBase64ArrayForQueue = currentInvoice.imagesBase64 || [];
              
              // Handle multi-page invoices for queue
              if (currentInvoice.isMultiPage && currentInvoice.imageUris && currentInvoice.imageUris.length > 0) {
                console.log(`🖼️ Converting ${currentInvoice.imageUris.length} pages for queued notification...`);
                const FileSystem = await import('expo-file-system');
                
                for (let i = 0; i < currentInvoice.imageUris.length; i++) {
                  try {
                    const base64 = await FileSystem.default.readAsStringAsync(currentInvoice.imageUris[i], {
                      encoding: FileSystem.default.EncodingType.Base64
                    });
                    imagesBase64ArrayForQueue.push(base64);
                    console.log(`✅ Queue: Page ${i + 1} converted (${base64 ? base64.length : 0} chars)`);
                  } catch (conversionError) {
                    console.warn(`⚠️ Queue: Could not convert page ${i + 1}:`, conversionError.message);
                    imagesBase64ArrayForQueue.push(null);
                  }
                }
                imageBase64DataForQueue = imagesBase64ArrayForQueue[0]; // First page for compatibility
              } else if (!imageBase64DataForQueue && currentInvoice.imageUri) {
                console.log('🖼️ Converting single invoice image for queued notification...');
                try {
                  const FileSystem = await import('expo-file-system');
                  imageBase64DataForQueue = await FileSystem.default.readAsStringAsync(currentInvoice.imageUri, {
                    encoding: FileSystem.default.EncodingType.Base64
                  });
                  console.log(`✅ Image converted for queue (length: ${imageBase64DataForQueue ? imageBase64DataForQueue.length : 0})`);
                } catch (conversionError) {
                  console.warn('⚠️ Could not convert image for queue:', conversionError);
                }
              }
              
              // Create scan data with image(s) for queue
              const queuedScanData = {
                ...currentInvoice,
                type: 'invoice',
                vendor: currentInvoice.vendor || currentInvoice.supplier || 'Unknown',
                totalItems: currentInvoice.items?.length || 0,
                total: currentInvoice.total || 0,
                imageUri: currentInvoice.imageUri,
                imageUris: currentInvoice.imageUris || [currentInvoice.imageUri],
                imageBase64: imageBase64DataForQueue, // Single image for compatibility
                imagesBase64: imagesBase64ArrayForQueue, // All pages for multi-page
                hasInvoiceImage: !!(imageBase64DataForQueue || imagesBase64ArrayForQueue.length > 0 || currentInvoice.imageUri),
                isMultiPage: currentInvoice.isMultiPage || false,
                pageCount: currentInvoice.pageCount || 1,
                requestId: currentInvoice.requestId
              };
              
              // Store scan data for when queue syncs
              if (offlineQueueSuccess || queueSuccess) {
                console.log('💾 Storing scan data with image for queued sync');
                // This will be sent to desktop when queue processes
              }
            } catch (queueScanError) {
              console.error('⚠️ Failed to prepare queued scan:', queueScanError);
            }
          }
          
          // Show appropriate success message
          Alert.alert(
            t('invoice.pricesUpdated') || '✅ Prices Updated',
            desktopSuccess 
              ? (t('invoice.singlePriceUpdateMessage', { count: result.totalUpdated || updatedItems.length }) || `Successfully updated prices for ${result.totalUpdated || updatedItems.length} items.\n\nProducts have been added to inventory.`)
              : queueSuccess
              ? `Successfully updated prices for ${result.totalUpdated || updatedItems.length} items.\n\n📱 Remote mode: Stock updates queued for next sync.`
              : offlineQueueSuccess
              ? `Successfully updated prices for ${result.totalUpdated || updatedItems.length} items.\n\n📦 Offline mode: Invoice saved locally and will sync when connection restored.`
              : `Successfully updated prices for ${result.totalUpdated || updatedItems.length} items.\n\n⚠️ Remote mode: Stock updates could not be queued.`,
            [
              { text: t('common.done'), onPress: () => { setShowPriceEditor(false); setCurrentInvoice(null); }}
            ]
          );
        } else {
          Alert.alert(t('invoice.updateFailed') || '❌ Update Failed', result.error || t('invoice.updateFailedMessage') || 'Failed to update prices');
        }
      }
      
    } catch (error) {
      console.error('Price update error:', error);
      Alert.alert(t('common.error'), `${t('invoice.priceUpdateError') || 'Failed to update prices'}: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Show splash screen first
  if (showSplashScreen) {
    return (
      <SplashScreen 
        onFinish={() => setShowSplashScreen(false)}
      />
    );
  }

  return (
    <LinearGradient
      colors={['#000000', '#001a1a', '#00f7ff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <View style={styles.headerContainer}>
        <Text style={styles.title}>{t('brand.name')}</Text>
        
        {/* Network and Offline Queue Status */}
        <View style={styles.statusIndicators}>
          {networkStatus === 'disconnected' && (
            <View style={styles.offlineIndicator}>
              <Text style={styles.offlineText}>🔴 Offline</Text>
            </View>
          )}
          {offlineQueueCount > 0 && (
            <TouchableOpacity 
              style={styles.queueIndicator}
              onPress={async () => {
                // OLD QUEUE CODE - DISABLED
                /*const stats = await SimpleQueue.getStats();

                Alert.alert(
                  '📦 Offline Queue',
                  `${stats.pending} items waiting to sync\n${stats.failed} failed items\n${stats.completed} completed items\n\n` +
                  `Queue will process automatically when connection restored.`,
                  [
                    { text: 'Retry Failed', onPress: async () => {
                      const totalRetried = await SimpleQueue.retryFailed();
                      if (totalRetried > 0) {
                        Alert.alert(t('queue.success'), t('queue.resetMessage', { count: totalRetried }));
                      }
                    }},
                    { text: 'Force Sync', onPress: async () => {
                      Alert.alert(t('queue.syncing'), t('queue.syncingMessage'));
                      await SimpleQueue.processQueue();
                    }},
                    { text: 'OK' }
                  ]
                );*/
                Alert.alert('Queue System', 'Old queue system disabled. Using ConnectionManager now.');
              }}
            >
              <Text style={styles.queueText}>📦 {offlineQueueCount}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Manual Desktop IP Configuration */}
      <View style={styles.manualIPContainer}>
        <Text style={styles.manualIPLabel}>🖥️ Desktop IP Address:</Text>
        <View style={styles.manualIPInputRow}>
          <TextInput
            style={styles.manualIPInput}
            value={manualDesktopIP}
            onChangeText={setManualDesktopIP}
            placeholder="e.g. 10.121.189.86"
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
          />
          <TouchableOpacity
            style={[
              styles.testButton,
              isTestingConnection && styles.testButtonDisabled
            ]}
            onPress={testManualConnection}
            disabled={isTestingConnection}
          >
            {isTestingConnection ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.testButtonText}>Test</Text>
            )}
          </TouchableOpacity>
        </View>
        {manualDesktopIP.trim() && (
          <Text style={styles.manualIPStatus}>
            ✅ Will connect to: {manualDesktopIP.trim()}:4000
          </Text>
        )}
      </View>

      {/* Network Test Button */}
      <TouchableOpacity
        style={[styles.testButton, { marginHorizontal: 20, marginBottom: 10 }]}
        onPress={() => setShowNetworkTest(true)}
      >
        <Text style={styles.testButtonText}>🔧 Network Test</Text>
      </TouchableOpacity>

      {/* Dashboard Cards */}
      <ScrollView 
        style={styles.dashboardContainer} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContentContainer}>
        {/* Quick Stats Row - REMOVED AS REQUESTED */}

        {/* Recent Scans Card */}
        <TouchableOpacity 
          style={styles.dashboardCard}
          onPress={() => setShowRecentScans(true)}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t('camera.recentScans')}</Text>
            <Text style={styles.cardCount}>{recentScans.length}</Text>
          </View>
          <View style={styles.cardContent}>
            {recentScans.length === 0 ? (
              <Text style={styles.emptyCardText}>{t('recentScans.empty')}</Text>
            ) : (
              <View>
                {recentScans.slice(0, 2).map((scan) => (
                  <View key={scan.id} style={styles.cardItem}>
                    <View style={styles.cardItemHeader}>
                      <Text style={styles.cardItemTitle}>{scan.vendor}</Text>
                      <Text style={styles.cardItemDate}>
                        {new Date(scan.timestamp).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={styles.cardItemDetails}>
                      {scan.totalItems} items • {scan.total} DZD
                    </Text>
                  </View>
                ))}
                {recentScans.length > 2 && (
                  <Text style={styles.seeMoreText}>+{recentScans.length - 2} {t('common.more') || 'more'}</Text>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Recent Sales Card */}
        <TouchableOpacity 
          style={styles.dashboardCard}
          onPress={() => setShowRecentSales(true)}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t('camera.recentSales')}</Text>
            <Text style={styles.cardCount}>{recentSales.length}</Text>
          </View>
          <View style={styles.cardContent}>
            {recentSales.length === 0 ? (
              <Text style={styles.emptyCardText}>{t('recentSales.empty')}</Text>
            ) : (
              <View>
                {recentSales.slice(0, 2).map((sale) => (
                  <View key={sale.id} style={styles.cardItem}>
                    <View style={styles.cardItemHeader}>
                      <Text style={styles.cardItemTitle}>{sale.productName}</Text>
                      <Text style={styles.cardItemDate}>
                        {new Date(sale.timestamp).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={styles.cardItemDetails}>
                      {sale.quantity} x {sale.unitPrice} DZD = {sale.total} DZD
                    </Text>
                  </View>
                ))}
                {recentSales.length > 2 && (
                  <Text style={styles.seeMoreText}>+{recentSales.length - 2} {t('common.more') || 'more'}</Text>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Utility Buttons */}
        <View style={styles.utilitySection}>
          <Text style={styles.sectionTitle}>{t('settings.system') || 'System'}</Text>
          <View style={styles.utilityButtons}>

            <TouchableOpacity 
              style={[styles.utilityButton, styles.inventoryButton]}
              onPress={() => {
                setInventoryUpdateCount(0); // Reset counter when opened
                fetchInventoryProducts();
              }}
              disabled={isProcessing}
            >
              <Text style={styles.utilityButtonText}>{t('camera.inventory')}</Text>
              {inventoryUpdateCount > 0 && (
                <View style={styles.updateBadge}>
                  <Text style={styles.updateBadgeText}>
                    {inventoryUpdateCount > 99 ? '99+' : inventoryUpdateCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.utilityButton, styles.networkButton]}
              onPress={() => setShowNetworkSettings(true)}
              disabled={isProcessing}
            >
              <Text style={styles.utilityButtonText}>{t('camera.network')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.utilityButton, styles.settingsButton]}
              onPress={() => setShowLanguageSwitcher(true)}
              disabled={isProcessing}
            >
              <Text style={styles.utilityButtonText}>{t('camera.language')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Real-time Processing Modal for Invoice Processing */}
      <Modal 
        visible={isProcessing} 
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
      >
        <View style={styles.processingModalOverlay}>
          <BrandedLoadingScreen visible={true} />
          <View style={[styles.processingModalContent, { backgroundColor: 'transparent', opacity: 0 }]}>
            
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${processingProgress.percentage}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressPercentage}>
                {Math.round(processingProgress.percentage)}%
              </Text>
            </View>

            {/* Current Step */}
            <Text style={styles.processingModalTitle}>
              {processingProgress.message || (t('invoice.analyzing') || '🔍 Analyzing Invoice')}
            </Text>
            
            <Text style={styles.processingModalText}>
              {processingProgress.details || (t('scanning.processing') || 'Processing your invoice...')}
            </Text>

            {/* Step Indicators */}
            <View style={styles.processingSteps}>
              {[1, 2, 3, 4].map(stepNumber => (
                <View key={stepNumber} style={styles.stepIndicatorRow}>
                  <View style={[
                    styles.stepIndicator,
                    processingProgress.step >= stepNumber ? styles.stepCompleted : styles.stepPending
                  ]}>
                    <Text style={[
                      styles.stepNumber,
                      processingProgress.step >= stepNumber ? styles.stepNumberCompleted : styles.stepNumberPending
                    ]}>
                      {processingProgress.step > stepNumber ? '✓' : stepNumber}
                    </Text>
                  </View>
                  <Text style={[
                    styles.stepLabel,
                    processingProgress.step >= stepNumber ? styles.stepLabelCompleted : styles.stepLabelPending
                  ]}>
                    {stepNumber === 1 && (t('processing.uploading') || '📤 Uploading')}
                    {stepNumber === 2 && (t('processing.analyzing') || '🔍 Analyzing')}
                    {stepNumber === 3 && (t('processing.organizing') || '📋 Organizing')}
                    {stepNumber === 4 && (t('processing.finalizing') || '✅ Finalizing')}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={styles.processingHint}>
              {t('invoice.processingHint') || 'This may take 5-20 seconds...'}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Styled Confirmation Modal */}
      <Modal 
        visible={confirmationModal.visible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
      >
        <View style={styles.confirmationModalOverlay}>
          <View style={styles.confirmationModalContent}>
            {/* Icon */}
            <View style={styles.confirmationIconContainer}>
              <Text style={styles.confirmationIcon}>📸</Text>
            </View>

            {/* Title */}
            <Text style={styles.confirmationTitle}>
              {confirmationModal.title}
            </Text>

            {/* Message */}
            <Text style={styles.confirmationMessage}>
              {confirmationModal.message}
            </Text>

            {/* Buttons */}
            <View style={styles.confirmationButtonsContainer}>
              {confirmationModal.buttons.map((button, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.confirmationButton,
                    button.style === 'primary' && styles.confirmationButtonPrimary,
                    button.style === 'secondary' && styles.confirmationButtonSecondary,
                    button.style === 'tertiary' && styles.confirmationButtonTertiary,
                  ]}
                  onPress={button.onPress}
                  activeOpacity={0.8}
                >
                  <View style={styles.confirmationButtonContent}>
                    {button.icon && (
                      <Text style={[
                        styles.confirmationButtonIcon,
                        button.style === 'primary' && styles.confirmationButtonIconPrimary,
                        button.style === 'secondary' && styles.confirmationButtonIconSecondary,
                        button.style === 'tertiary' && styles.confirmationButtonIconTertiary,
                      ]}>
                        {button.icon}
                      </Text>
                    )}
                    <Text style={[
                      styles.confirmationButtonText,
                      button.style === 'primary' && styles.confirmationButtonTextPrimary,
                      button.style === 'secondary' && styles.confirmationButtonTextSecondary,
                      button.style === 'tertiary' && styles.confirmationButtonTextTertiary,
                    ]}>
                      {button.text}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Enhanced Image Preview Modal */}
      <Modal visible={showImagePreview} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.enhancedModalContainer}>
          <View style={styles.modalBackdrop} />
          
          {/* Modern Gradient Header */}
          <LinearGradient
            colors={['rgba(243, 156, 18, 0.95)', 'rgba(230, 126, 34, 0.9)', 'rgba(26, 26, 46, 0.95)']}
            style={styles.enhancedModalHeader}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.modalHeaderContent}>
              <View style={styles.modalTitleRow}>
                <View style={styles.modalTitleContainer}>
                  <Text style={styles.enhancedModalTitle}>📋 {t('modals.invoiceReview') || 'Invoice Review'}</Text>
                  <Text style={styles.modalSubtitle}>
                    {capturedImages.length} {capturedImages.length === 1 ? t('invoice.page') : t('invoice.pages')} {t('invoice.captured')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.enhancedCloseButton}
                  onPress={() => setShowImagePreview(false)}
                >
                  <Text style={styles.enhancedCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              {/* Modern Progress Bar */}
              <View style={styles.modernProgressContainer}>
                <View style={styles.modernProgressBar}>
                  <View 
                    style={[
                      styles.modernProgressFill, 
                      { width: `${(capturedImages.length / 20) * 100}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.modernProgressText}>
                  {capturedImages.length}/20 {t('invoice.pages')} • {20 - capturedImages.length} {t('invoice.slotsRemaining')}
                </Text>
              </View>
            </View>
            
            {/* Decorative Corner Elements */}
            <View style={[styles.modalCorner, styles.modalCornerTopLeft]}>
              <View style={styles.modalCornerLine} />
              <View style={[styles.modalCornerLine, styles.modalCornerLineVertical]} />
            </View>
            <View style={[styles.modalCorner, styles.modalCornerTopRight]}>
              <View style={styles.modalCornerLine} />
              <View style={[styles.modalCornerLine, styles.modalCornerLineVertical]} />
            </View>
          </LinearGradient>

          <ScrollView style={styles.enhancedModalContent} showsVerticalScrollIndicator={false}>
            
            {/* Modern Image Grid */}
            <View style={styles.modernImageGrid}>
              {capturedImages.map((imageUri, index) => (
                <View key={index} style={styles.modernImageCard}>
                  <View style={styles.modernImageCardHeader}>
                    <View style={styles.modernPageIndicator}>
                      <Text style={styles.modernPageNumber}>{t('invoice.page')} {index + 1}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.modernRemoveButton}
                      onPress={() => {
                        const newImages = capturedImages.filter((_, i) => i !== index);
                        setCapturedImages(newImages);
                        if (newImages.length === 0) {
                          setShowImagePreview(false);
                        }
                      }}
                    >
                      <Text style={styles.modernRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.modernImageWrapper}
                    onPress={() => {
                      Alert.alert(
                        `📄 ${t('invoice.page')} ${index + 1}`,
                        t('camera.imageCaptured'),
                        [{ text: t('common.ok') }]
                      );
                    }}
                    activeOpacity={0.9}
                  >
                    <Image 
                      source={{ uri: imageUri }} 
                      style={styles.modernPreviewImage}
                      resizeMode="contain"
                    />
                    <View style={styles.modernImageOverlay}>
                      <View style={styles.overlayContent}>
                        <Text style={styles.overlayPageText}>{t('invoice.page')} {index + 1}</Text>
                        <View style={styles.overlayStatusIndicator}>
                          <View style={styles.statusDot} />
                          <Text style={styles.overlayStatusText}>{t('common.ready')}</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                  
                  <View style={styles.modernImageCardFooter}>
                    <View style={styles.cardFooterLeft}>
                      <View style={styles.readyIndicator}>
                        <View style={styles.readyDot} />
                        <Text style={styles.readyText}>{t('common.ready')}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardIndexText}>{index + 1}/{capturedImages.length}</Text>
                  </View>
                </View>
              ))}
              
              {/* Modern Add More Card */}
              {capturedImages.length < 20 && (
                <TouchableOpacity 
                  style={styles.modernAddMoreCard}
                  onPress={() => {
                    setShowImagePreview(false);
                    captureImage();
                  }}
                >
                  <View style={styles.addMoreIconContainer}>
                    <Text style={styles.modernAddMoreIcon}>📷</Text>
                  </View>
                  <View style={styles.addMoreContent}>
                    <Text style={styles.modernAddMoreText}>{t('capture.addPage') || 'Add Page'}</Text>
                    <Text style={styles.modernAddMoreHint}>{t('capture.tapToCapture') || 'Tap to capture'}</Text>
                  </View>
                  <View style={styles.addMoreBorder} />
                </TouchableOpacity>
              )}
            </View>

            {/* Modern Action Buttons Section */}
            <View style={styles.modernActionSection}>
              <View style={styles.modernStatsRow}>
                <View style={styles.modernStatItem}>
                  <View style={styles.statIconContainer}>
                    <Text style={styles.statIcon}>📄</Text>
                  </View>
                  <View style={styles.statContent}>
                    <Text style={styles.modernStatValue}>{capturedImages.length}</Text>
                    <Text style={styles.modernStatLabel}>{t('capture.pages')}</Text>
                  </View>
                </View>
                <View style={styles.modernStatItem}>
                  <View style={styles.statIconContainer}>
                    <Text style={styles.statIcon}>⚡</Text>
                  </View>
                  <View style={styles.statContent}>
                    <Text style={styles.modernStatValue}>~{capturedImages.length * 2}s</Text>
                    <Text style={styles.modernStatLabel}>{t('capture.estimatedTime')}</Text>
                  </View>
                </View>
                <View style={styles.modernStatItem}>
                  <View style={styles.statIconContainer}>
                    <Text style={styles.statIcon}>🤖</Text>
                  </View>
                  <View style={styles.statContent}>
                    <Text style={styles.modernStatValue}>Processing</Text>
                    <Text style={styles.modernStatLabel}>{t('capture.processing') || 'Processing'}</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.modernProcessButton, isProcessing && styles.modernDisabledButton]}
                onPress={() => {
                  setShowImagePreview(false);
                  setIsProcessing(true);
                  processInvoiceImages(capturedImages);
                }}
                disabled={isProcessing || capturedImages.length === 0}
              >
                <LinearGradient
                  colors={['#f39c12', '#e67e22']}
                  style={styles.processButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <View style={styles.modernProcessButtonContent}>
                    <View style={styles.processButtonIconContainer}>
                      <Text style={styles.modernProcessButtonIcon}>🚀</Text>
                    </View>
                    <View style={styles.processButtonTextContainer}>
                      <Text style={styles.modernProcessButtonText}>
                        {t('modals.processInvoiceButton')}
                      </Text>
                      <Text style={styles.modernProcessButtonSubtext}>
                        {t('modals.readyForAnalysis', { count: capturedImages.length })}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modernCancelButton}
                onPress={() => {
                  setCapturedImages([]);
                  setShowImagePreview(false);
                }}
              >
                <Text style={styles.modernCancelButtonText}>{t('modals.cancelStartOver') || 'Cancel & Start Over'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Enhanced Price Editor Modal - Now using separate component */}
      <EnhancedPriceEditorModal
        visible={showPriceEditor}
        onClose={() => setShowPriceEditor(false)}
        invoice={currentInvoice}
        onSave={handleSubmitPrices}
        desktopServerUrl={serverUrls.desktop}
        fetchWithTimeout={fetchWithTimeout}
        BarcodeScanning={BarcodeScanning}
        TextRecognition={TextRecognition}
      />

      {/* Enhanced Recent Scans Modal */}
      <EnhancedRecentScans 
        visible={showRecentScans}
        onClose={() => setShowRecentScans(false)}
      />


      {/* Recent Sales Modal */}
      <Modal visible={showRecentSales} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('recentSales.title')}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowRecentSales(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {recentSales.length === 0 ? (
              <Text style={styles.emptyText}>{t('recentSales.empty')}</Text>
            ) : (
              recentSales.map((sale) => (
                <TouchableOpacity 
                  key={sale.id} 
                  style={styles.scanItem}
                  onPress={() => {
                    Alert.alert(
                      t('recentSales.saleDetails'),
                      `${t('recentSales.product')}: ${sale.productName || t('modals.unknownProduct')}\n` +
                      `${t('recentSales.quantity')}: ${sale.quantity}\n` +
                      `${t('recentSales.unitPrice')}: ${sale.unitPrice} DZD\n` +
                      `${t('recentSales.total')}: ${sale.total} DZD\n` +
                      `${t('recentSales.date')}: ${new Date(sale.timestamp).toLocaleString()}\n` +
                      `${sale.barcode ? `${t('recentSales.barcode')}: ${sale.barcode}\n` : ''}` +
                      `${sale.remainingStock !== null ? `${t('recentSales.stockAfterSale')}: ${sale.remainingStock}` : ''}`
                    );
                  }}
                >
                  <View style={styles.scanItemContainer}>
                    <View style={styles.scanTextContent}>
                      <View style={styles.scanItemHeader}>
                        <Text style={styles.scanVendor}>{sale.productName || t('modals.unknownProduct')}</Text>
                        <Text style={styles.scanDate}>{new Date(sale.timestamp).toLocaleDateString()}</Text>
                      </View>
                      <View style={styles.scanItemDetails}>
                        <Text style={styles.scanDetail}>📦 {t('recentSales.quantityLabel', { quantity: sale.quantity })}</Text>
                        <Text style={styles.scanDetail}>💰 {t('recentSales.priceLabel', { price: sale.total })}</Text>
                        {sale.remainingStock !== null && (
                          <Text style={styles.scanDetail}>📊 {t('recentSales.stockLabel', { stock: sale.remainingStock })}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
      
      {/* Inventory View Modal with Tabs */}
      <LazyModal visible={showInventory} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('inventory.title')}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowInventory(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          {/* Inventory Tabs */}
          <View style={styles.tabContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScrollView}>
              {[
                { key: 'all', label: t('inventory.all'), icon: '📦' },
                { key: 'low-stock', label: t('inventory.lowStock'), icon: '⚠️' },
                { key: 'out-of-stock', label: t('inventory.outOfStock'), icon: '❌' },
                { key: 'categories', label: t('inventory.categories'), icon: '🏷️' }
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.tab,
                    activeInventoryTab === tab.key && styles.activeTab
                  ]}
                  onPress={() => setActiveInventoryTab(tab.key)}
                >
                  <Text style={styles.tabIcon}>{tab.icon}</Text>
                  <Text style={[
                    styles.tabText,
                    activeInventoryTab === tab.key && styles.activeTabText
                  ]}>
                    {tab.label}
                  </Text>
                  <Text style={[
                    styles.tabCount,
                    activeInventoryTab === tab.key && styles.activeTabCount
                  ]}>
                    {getTabCount(tab.key)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          
          {inventoryLoading ? (
            <BrandedLoadingScreen visible={true} />
          ) : (
            <View style={styles.modalContent}>
              <OptimizedInventoryList
                products={inventoryProducts}
                activeTab={activeInventoryTab}
                onProductPress={(product) => {
                  console.log('🖼️ Opening multi-image view for product:', product.name);
                  setSelectedProduct(product);
                  setShowMultiImageView(true);
                }}
                t={t}
                styles={styles}
                loading={inventoryLoading}
              />
            </View>
          )}
        </View>
      </LazyModal>

      {/* Barcode Scanner from working backup */}
      <ErrorBoundary>
        <VisionCameraLiveScannerMLKit
          visible={showLiveScanner}
          onClose={() => setShowLiveScanner(false)}
          onBarcodeDetected={handleLiveBarcodeDetected}
          onTextDetected={null}
          BarcodeScanning={BarcodeScanning}
          TextRecognition={TextRecognition}
        />
      </ErrorBoundary>
      
      {/* Product Selling Text Selector Modal */}
      <ProductSellModal
        visible={showTextSelector}
        onClose={() => {
          setShowTextSelector(false);
          setSearchProgress({ current: 0, total: 0, searching: false });
          // Clear auto-search timeout if exists
          if (autoSearchTimeout) {
            clearTimeout(autoSearchTimeout);
            setAutoSearchTimeout(null);
          }
        }}
        textBlocks={detectedTextBlocks}
        onSelectLine={handleTextLineSelect}
        searchProgress={searchProgress}
        onManualSearch={searchProductByText}
      />

      {/* Backdrop blur when drawer is expanded */}
      {drawerExpanded && (
        <TouchableOpacity 
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setDrawerExpanded(false)}
        >
          <View style={styles.backdropBlur} />
        </TouchableOpacity>
      )}

      {/* Smart Bottom Drawer */}
      <SmartBottomDrawer
        onInvoiceAnalysis={handleInvoiceAnalysis}
        onProductSelling={handleProductSelling}
        onGalleryPicker={pickFromGallery}
        isProcessing={isProcessing}
        nativeScannerReady={true}
        onExpandChange={setDrawerExpanded}
      />

      {/* Language Switcher Modal */}
      <LanguageSwitcher
        visible={showLanguageSwitcher}
        onClose={() => setShowLanguageSwitcher(false)}
      />
      
      {/* Sale Confirmation Modal */}
      <SaleConfirmationModal
        visible={showSaleConfirmation}
        onClose={handleSaleCancellation}
        onConfirm={handleSaleConfirmation}
        product={pendingProduct}
      />
      
      {/* Network Settings Modal with Test Button - DISABLED */}
      {/*<NetworkSettings
        visible={showNetworkSettings}
        onClose={() => setShowNetworkSettings(false)}
        onTestNetwork={testNetworkConnectivity}
        onServerChange={(newUrl) => {
          console.log('Desktop server URL changed:', newUrl);
          setDesktopServerUrl(newUrl);  // Use state instead of global
          setServerUrls({ desktop: newUrl, invoice: INVOICE_SERVER_URL });
          setNetworkStatus('connected');
        }}
      />*/

      {/* Image Viewer Modal */}
      <Modal visible={showImageViewer} animationType="fade" presentationStyle="overFullScreen">
        <View style={styles.imageViewerContainer}>
          <View style={styles.imageViewerHeader}>
            <Text style={styles.imageViewerTitle}>{t('recentScans.viewImage')}</Text>
            <TouchableOpacity
              style={styles.imageViewerCloseButton}
              onPress={() => {
                setShowImageViewer(false);
                setSelectedImageUri(null);
              }}
            >
              <Text style={styles.imageViewerCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          {selectedImageUri && (
            <View style={styles.imageViewerContent}>
              <Image 
                source={{ uri: selectedImageUri }} 
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            </View>
          )}
          
          <View style={styles.imageViewerFooter}>
            <Text style={styles.imageViewerHint}>
              {t('common.close')} • {selectedImageUri ? '📷 Invoice Image' : ''}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Simple Queue Status Indicator */}
      <View style={styles.queueStatusContainer}>
        <TouchableOpacity 
          style={styles.queueStatusButton}
          onPress={async () => {
            try {
              const status = await SimpleStocking.getStockingStatus();
              Alert.alert(
                t('queue.status'),
                `Desktop: ${status.desktop.available ? '✅ Online' : '❌ Offline'}\n` +
                `Queue: ${status.queue.pending || 0} pending, ${status.queue.completed || 0} completed\n` +
                `${status.queue.processing ? '🔄 Processing...' : '⏸️ Idle'}`
              );
            } catch (error) {
              Alert.alert(t('common.error'), t('queue.failedToGetStatus'));
            }
          }}
        >
          <Text style={styles.queueStatusText}>📋 Queue</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.queueActionButton}
          onPress={async () => {
            try {
              await SimpleStocking.processQueue();
              Alert.alert(t('common.success'), t('queue.processingTriggered'));
            } catch (error) {
              Alert.alert(t('common.error'), t('queue.failedToProcess'));
            }
          }}
        >
          <Text style={styles.queueActionText}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Optimized Multi-Image Product View */}
      <OptimizedMultiImageView
        product={selectedProduct}
        visible={showMultiImageView}
        onClose={() => {
          setShowMultiImageView(false);
          setSelectedProduct(null);
        }}
      />

      {/* Network Test Modal */}
      <Modal
        visible={showNetworkTest}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowNetworkTest(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ddd' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Network Connectivity Test</Text>
            <TouchableOpacity onPress={() => setShowNetworkTest(false)}>
              <Text style={{ fontSize: 16, color: '#007AFF' }}>Close</Text>
            </TouchableOpacity>
          </View>
          <NetworkTest />
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 160, // More space for expanded drawer
  },
  headerContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  statusIndicators: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  offlineIndicator: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  offlineText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
  },
  queueIndicator: {
    backgroundColor: 'rgba(255, 159, 10, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 10, 0.3)',
  },
  queueText: {
    fontSize: 12,
    color: '#FF9F0A',
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 16,
    color: '#30D158',
    marginBottom: 30,
    textAlign: 'center',
    fontWeight: '500',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    flex: 1,
    marginTop: 20,
  },
  // Dashboard Styles
  dashboardContainer: {
    flex: 1,
    width: '100%',
    marginTop: 20,
  },
  scrollContentContainer: {
    paddingBottom: 100, // Ensures content goes under button drawer
    flexGrow: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  dashboardCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cardContent: {
    minHeight: 40,
  },
  cardItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    flex: 1,
  },
  cardItemDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  cardItemDetails: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  emptyCardText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  seeMoreText: {
    fontSize: 12,
    color: '#30D158',
    textAlign: 'right',
    marginTop: 8,
    fontWeight: '500',
  },
  utilitySection: {
    marginTop: 20,
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  utilityButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  utilityButton: {
    flex: 1,
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  utilityButtonIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  utilityButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  // Inventory Tabs Styles
  tabContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabScrollView: {
    flexGrow: 0,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 80,
  },
  activeTab: {
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    borderColor: '#007AFF',
  },
  tabIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  tabCount: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
    minWidth: 20,
    textAlign: 'center',
  },
  activeTabCount: {
    color: '#007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 12,
    paddingHorizontal: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 122, 255, 0.3)',
  },
  button: {
    width: '100%',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 6,
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  invoiceButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    borderColor: 'rgba(0, 122, 255, 0.3)',
  },
  sellButton: {
    backgroundColor: 'rgba(48, 209, 88, 0.9)',
    borderColor: 'rgba(48, 209, 88, 0.3)',
  },
  testButton: {
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  disabledButton: {
    opacity: 0.4,
    backgroundColor: 'rgba(28, 28, 30, 0.6)',
  },
  buttonText: {
    fontSize: 26,
    marginBottom: 6,
  },
  buttonLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 3,
  },
  buttonDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontWeight: '400',
  },
  // Processing Modal styles
  processingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '85%',
    maxWidth: 350,
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.3)',
    shadowColor: '#f39c12',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  processingModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f39c12',
    marginTop: 20,
    marginBottom: 10,
  },
  processingModalText: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20,
  },
  // Modern Progress Bar
  progressContainer: {
    width: '100%',
    marginVertical: 20,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#333333',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f39c12',
    borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  progressPercentage: {
    fontSize: 14,
    color: '#f39c12',
    fontWeight: '600',
  },

  // Modern Step Indicators
  processingSteps: {
    marginTop: 20,
    marginBottom: 20,
    width: '100%',
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 10,
  },
  stepIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepCompleted: {
    backgroundColor: '#27ae60',
    borderWidth: 2,
    borderColor: '#2ecc71',
    shadowColor: '#27ae60',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  stepPending: {
    backgroundColor: '#2c2c2c',
    borderWidth: 2,
    borderColor: '#444444',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  stepNumberCompleted: {
    color: '#ffffff',
  },
  stepNumberPending: {
    color: '#888888',
  },
  stepLabel: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  stepLabelCompleted: {
    color: '#ffffff',
  },
  stepLabelPending: {
    color: '#888888',
  },
  processingHint: {
    fontSize: 13,
    color: '#aaaaaa',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
    letterSpacing: 0.5,
  },

  // Modern Confirmation Modal Styles
  confirmationModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  confirmationModalContent: {
    backgroundColor: '#1e1e1e',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '88%',
    maxWidth: 400,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  confirmationIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(243, 156, 18, 0.3)',
  },
  confirmationIcon: {
    fontSize: 40,
    textAlign: 'center',
  },
  confirmationTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  confirmationMessage: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
    letterSpacing: 0.3,
  },
  confirmationButtonsContainer: {
    width: '100%',
    gap: 12,
  },
  confirmationButton: {
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  confirmationButtonPrimary: {
    backgroundColor: '#f39c12',
    borderColor: '#f39c12',
    shadowColor: '#f39c12',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmationButtonSecondary: {
    backgroundColor: 'transparent',
    borderColor: '#27ae60',
  },
  confirmationButtonTertiary: {
    backgroundColor: 'transparent',
    borderColor: '#666666',
  },
  confirmationButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmationButtonIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  confirmationButtonIconPrimary: {
    color: '#1a1a1a',
  },
  confirmationButtonIconSecondary: {
    color: '#27ae60',
  },
  confirmationButtonIconTertiary: {
    color: '#cccccc',
  },
  confirmationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  confirmationButtonTextPrimary: {
    color: '#1a1a1a',
  },
  confirmationButtonTextSecondary: {
    color: '#27ae60',
  },
  confirmationButtonTextTertiary: {
    color: '#cccccc',
  },

  // Old styles kept for compatibility
  processingContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  processingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#f39c12',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Enhanced Modal styles
  enhancedModalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  enhancedModalHeader: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  modalHeaderContent: {
    paddingHorizontal: 20,
  },
  modalTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  modalTitleContainer: {
    flex: 1,
  },
  enhancedModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textShadowColor: 'rgba(243, 156, 18, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  enhancedCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  enhancedCloseText: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  progressContainer: {
    marginTop: 10,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f39c12',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#666666',
    marginTop: 5,
  },
  enhancedModalContent: {
    flex: 1,
    backgroundColor: '#000000',
  },
  instructionsCard: {
    backgroundColor: '#1a1a1a',
    margin: 15,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f39c12',
    marginBottom: 10,
  },
  instructionsText: {
    fontSize: 14,
    color: '#cccccc',
    lineHeight: 22,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    justifyContent: 'space-between',
  },
  enhancedImageCard: {
    width: '48%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  imageCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
  },
  pageIndicator: {
    backgroundColor: '#f39c12',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pageNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
  },
  enhancedRemoveButton: {
    padding: 5,
  },
  enhancedRemoveText: {
    fontSize: 16,
  },
  imageWrapper: {
    position: 'relative',
    height: 250,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  enhancedPreviewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
  },
  imageOverlayText: {
    color: '#FFFFFF',
    fontSize: 12,
    textAlign: 'center',
  },
  imageCardFooter: {
    padding: 10,
    backgroundColor: '#0d0d0d',
  },
  imageStatus: {
    fontSize: 12,
    color: '#4cd964',
    fontWeight: '600',
  },
  addMoreCard: {
    width: '48%',
    height: 280,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#f39c12',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  addMoreIcon: {
    fontSize: 40,
    color: '#f39c12',
    marginBottom: 10,
  },
  addMoreText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f39c12',
    marginBottom: 5,
  },
  addMoreHint: {
    fontSize: 12,
    color: '#666666',
  },
  enhancedActionSection: {
    padding: 20,
    backgroundColor: '#0d0d0d',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 15,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f39c12',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#888888',
  },
  enhancedProcessButton: {
    backgroundColor: '#f39c12',
    borderRadius: 12,
    padding: 18,
    marginBottom: 15,
  },
  processButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processButtonIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  processButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  processButtonSubtext: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.7)',
    marginTop: 2,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#ff3b30',
    fontWeight: '600',
  },
  
  // 📸 Enhanced Image Capture Workflow Styles
  captureWorkflowContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  captureHeader: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  captureTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  captureSubtitle: {
    fontSize: 16,
    color: '#30D158',
    textAlign: 'center',
    fontWeight: '500',
  },
  captureStageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.3)',
  },
  stageIcon: {
    fontSize: 28,
    marginRight: 12,
    color: '#f39c12',
  },
  stageText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f39c12',
    textAlign: 'center',
    flex: 1,
  },
  
  // 📄 Additional Pages Capture Styles
  multiPageIndicator: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  multiPageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34c759',
    textAlign: 'center',
    marginBottom: 8,
  },
  multiPageCount: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.8,
  },
  
  // 📷 Gallery Selection Styles
  gallerySelectionHeader: {
    backgroundColor: 'rgba(0, 122, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.3)',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  galleryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  galleryDescription: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 20,
  },
  galleryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 122, 255, 0.2)',
  },
  galleryStatItem: {
    alignItems: 'center',
  },
  galleryStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  galleryStatLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.7,
  },
  
  // Enhanced Action Buttons for Capture Process
  captureActionContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100, // Space for bottom drawer
  },
  primaryCaptureButton: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  primaryCaptureContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCaptureIcon: {
    fontSize: 32,
    marginRight: 15,
    color: '#FFFFFF',
  },
  primaryCaptureTextContainer: {
    flex: 1,
  },
  primaryCaptureText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  primaryCaptureHint: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  
  secondaryCaptureButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  secondaryCaptureContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryCaptureIcon: {
    fontSize: 24,
    marginRight: 12,
    color: '#FFFFFF',
  },
  secondaryCaptureText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // Processing Status Styles
  processingIndicator: {
    backgroundColor: 'rgba(255, 159, 10, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 10, 0.3)',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  processingIcon: {
    fontSize: 40,
    color: '#FF9F0A',
    marginBottom: 10,
  },
  processingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF9F0A',
    marginBottom: 8,
    textAlign: 'center',
  },
  processingDescription: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 20,
  },
  
  // Success State Styles
  successIndicator: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  successIcon: {
    fontSize: 48,
    color: '#34C759',
    marginBottom: 10,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#34C759',
    marginBottom: 8,
    textAlign: 'center',
  },
  successDescription: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 20,
  },
  
  // 💵 Selling Process Workflow Styles
  sellingContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  sellingHeader: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sellingTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  sellingSubtitle: {
    fontSize: 16,
    color: '#30D158',
    textAlign: 'center',
    fontWeight: '500',
  },
  
  // 🔍 Barcode Scanning Stage
  barcodeScanningStageThen: {
    backgroundColor: 'rgba(0, 122, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.3)',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  scanningIcon: {
    fontSize: 48,
    color: '#007AFF',
    marginBottom: 15,
  },
  scanningTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  scanningProgress: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 20,
  },
  scanningInstructions: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
  
  // ✅ Product Found Stage
  productFoundContainer: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
    borderRadius: 16,
    padding: 25,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  productFoundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  productFoundIcon: {
    fontSize: 32,
    color: '#34C759',
    marginRight: 10,
  },
  productFoundTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#34C759',
  },
  productDetailsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
  },
  productName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  productDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  productDetailLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  productDetailValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  productDetailPrice: {
    fontSize: 16,
    color: '#30D158',
    fontWeight: '700',
  },
  
  // 💵 Sale Actions
  saleActionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  primarySaleButton: {
    backgroundColor: '#30D158',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#30D158',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  primarySaleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primarySaleIcon: {
    fontSize: 28,
    color: '#000000',
    marginRight: 12,
  },
  primarySaleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  
  secondarySaleButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  secondarySaleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondarySaleIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    marginRight: 10,
  },
  secondarySaleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // 🔄 Sale Processing
  saleProcessingContainer: {
    backgroundColor: 'rgba(255, 159, 10, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 10, 0.3)',
    borderRadius: 16,
    padding: 25,
    marginHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  processingSpinner: {
    marginBottom: 15,
  },
  saleProcessingIcon: {
    fontSize: 48,
    color: '#FF9F0A',
    marginBottom: 15,
  },
  saleProcessingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF9F0A',
    marginBottom: 10,
    textAlign: 'center',
  },
  saleProcessingText: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 20,
  },
  
  // ✅ Sale Complete
  saleCompleteContainer: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
    borderRadius: 16,
    padding: 25,
    marginHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  saleCompleteIcon: {
    fontSize: 56,
    color: '#34C759',
    marginBottom: 15,
  },
  saleCompleteTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#34C759',
    marginBottom: 15,
    textAlign: 'center',
  },
  saleDetailsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    marginBottom: 20,
  },
  saleDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  saleDetailLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  saleDetailValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  saleTotal: {
    fontSize: 20,
    color: '#30D158',
    fontWeight: '700',
  },
  
  // ❌ Sale Failed
  saleFailedContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
    borderRadius: 16,
    padding: 25,
    marginHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  saleFailedIcon: {
    fontSize: 48,
    color: '#FF3B30',
    marginBottom: 15,
  },
  saleFailedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF3B30',
    marginBottom: 10,
    textAlign: 'center',
  },
  saleFailedText: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 20,
  },
  
  // 📊 Stock Status Indicators
  stockStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginTop: 10,
  },
  stockStatusInStock: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
  },
  stockStatusLowStock: {
    backgroundColor: 'rgba(255, 159, 10, 0.2)',
  },
  stockStatusOutOfStock: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
  },
  stockStatusIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  stockStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  stockStatusInStockText: {
    color: '#34C759',
  },
  stockStatusLowStockText: {
    color: '#FF9F0A',
  },
  stockStatusOutOfStockText: {
    color: '#FF3B30',
  },
  
  // 📷 Image Viewer Modal Styles
  imageViewerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  imageViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  imageViewerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  imageViewerCloseButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 40,
    alignItems: 'center',
  },
  imageViewerCloseText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  imageViewerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
  },
  imageViewerFooter: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
  },
  imageViewerHint: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  
  // Keep original modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  vendorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 15,
    textAlign: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  invoiceDetailsContainer: {
    backgroundColor: 'rgba(28, 28, 30, 0.8)',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 247, 255, 0.3)',
  },
  invoiceDetailText: {
    fontSize: 14,
    color: '#00f7ff',
    fontWeight: '500',
    marginBottom: 8,
    paddingLeft: 10,
  },
  itemContainer: {
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    padding: 15,
    marginVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  itemDetails: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 5,
  },
  priceRow: {
    marginTop: 10,
  },
  costPrice: {
    fontSize: 14,
    color: '#30D158',
    fontWeight: '600',
    marginBottom: 8,
  },
  sellingPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    flex: 1,
  },
  priceInput: {
    flex: 2,
    height: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    color: '#FFFFFF',
    marginLeft: 10,
    marginRight: 8,
    textAlign: 'right',
  },
  currencyText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    width: 35,
  },
  foundItemContainer: {
    borderColor: 'rgba(76, 175, 80, 0.3)',
    backgroundColor: 'rgba(28, 30, 28, 0.9)',
  },
  productStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  foundIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  foundText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  stockText: {
    color: '#90CAF9',
    fontSize: 12,
  },
  notFoundIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notFoundText: {
    color: '#FFA726',
    fontSize: 12,
    fontWeight: '600',
  },
  suggestedPrice: {
    color: '#4CAF50',
    fontSize: 12,
    fontStyle: 'italic',
  },
  suggestedPriceInput: {
    borderColor: 'rgba(76, 175, 80, 0.5)',
  },
  submitButton: {
    backgroundColor: '#30D158',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    margin: 20,
    borderWidth: 1,
    borderColor: 'rgba(48, 209, 88, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  bulkSummaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.3)',
  },
  invoiceSection: {
    backgroundColor: 'rgba(28, 28, 30, 0.6)',
    margin: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  invoiceHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  historyButton: {
    backgroundColor: 'rgba(48, 209, 88, 0.9)',
    borderColor: 'rgba(48, 209, 88, 0.3)',
  },
  inventoryButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    borderColor: 'rgba(0, 122, 255, 0.3)',
    position: 'relative',
  },
  updateBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1a1a2e',
  },
  updateBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  settingsButton: {
    backgroundColor: 'rgba(148, 92, 255, 0.9)',
    borderColor: 'rgba(148, 92, 255, 0.3)',
  },
  networkButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    padding: 40,
    fontStyle: 'italic',
  },
  scanItem: {
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    padding: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  scanItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scanVendor: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  scanDate: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  scanItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scanDetail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  scanItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
  },
  scanTextContent: {
    flex: 1,
  },
  // Scan Details Modal Styles
  invoiceDetailSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  detailLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  lineItemCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  lowConfidenceItem: {
    borderColor: '#FF4444',
    backgroundColor: 'rgba(255, 68, 68, 0.05)',
  },
  lineItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lineItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  lowConfidenceBadge: {
    fontSize: 12,
    color: '#FF4444',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  lineItemCode: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 8,
  },
  lineItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lineItemDetail: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  lineItemTotal: {
    fontWeight: '600',
    color: '#34C759',
  },
  totalRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#007AFF',
    borderBottomWidth: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#34C759',
  },
  viewImageButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 20,
    alignItems: 'center',
  },
  viewImageButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  inventorySummary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 15,
    textAlign: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inventoryItem: {
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    padding: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  inventoryItemHeader: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    paddingBottom: 8,
  },
  inventoryProductName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  inventoryBarcode: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  inventoryItemDetails: {
    marginTop: 8,
  },
  inventoryDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  inventoryLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
  },
  inventoryValue: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  inventoryPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#30D158',
  },
  lowStockText: {
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  lowStockWarning: {
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    borderColor: '#FFC107',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  lowStockWarningText: {
    color: '#FFC107',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 50,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  itemInput: {
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    fontSize: 16,
    color: '#FFFFFF',
  },
  rowInputs: {
    flexDirection: 'row',
    marginHorizontal: -4, // Negative margin to offset child margins
  },
  halfInput: {
    flex: 2,
    marginHorizontal: 4,
  },
  quarterInput: {
    flex: 1,
    marginHorizontal: 4,
  },
  // Temporary barcode styles
  barcodeInputContainer: {
    flex: 2,
    position: 'relative',
  },
  tempBarcodeIndicator: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: [{ translateY: -10 }],
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  tempBarcodeText: {
    fontSize: 10,
    color: '#FF9800',
    fontWeight: '600',
  },
  // Backdrop styles
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 998,
  },
  backdropBlur: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  // Search bar styles
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 30, 40, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 247, 255, 0.3)',
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#00f7ff',
  },
  clearSearch: {
    fontSize: 16,
    color: 'rgba(0, 247, 255, 0.5)',
    padding: 5,
  },
  closeButtonCyber: {
    position: 'absolute',
    right: 20,
    top: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 247, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 247, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Cyber theme card styles
  statCardCyan: {
    borderColor: 'rgba(0, 247, 255, 0.5)',
    backgroundColor: 'rgba(0, 247, 255, 0.05)',
  },
  statCardPurple: {
    borderColor: 'rgba(147, 51, 234, 0.5)',
    backgroundColor: 'rgba(147, 51, 234, 0.05)',
  },
  statCardBlue: {
    borderColor: 'rgba(59, 130, 246, 0.5)',
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  statCardInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    width: '100%',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statGlow: {
    position: 'absolute',
    top: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 247, 255, 0.3)',
    opacity: 0.2,
  },
  // Cyber theme price editor styles
  modalTitleCyber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#00f7ff',
    textShadowColor: '#00f7ff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  cyberSummaryCard: {
    backgroundColor: 'rgba(0, 30, 40, 0.8)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 247, 255, 0.3)',
  },
  cyberSummaryText: {
    fontSize: 16,
    color: '#00f7ff',
    marginBottom: 8,
    fontWeight: '500',
  },
  invoiceHeaderCyber: {
    backgroundColor: 'rgba(0, 20, 30, 0.9)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 247, 255, 0.4)',
  },
  invoiceHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00f7ff',
    marginBottom: 5,
  },
  vendorTextCyber: {
    fontSize: 14,
    color: 'rgba(0, 247, 255, 0.8)',
    fontWeight: '400',
  },
  itemContainerCyber: {
    backgroundColor: 'rgba(0, 15, 20, 0.7)',
    padding: 15,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 247, 255, 0.3)',
    shadowColor: '#00f7ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  
  // Enhanced Price UX Styles
  enhancedPriceSection: {
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.2)',
  },
  priceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceInfoItem: {
    flex: 1,
    alignItems: 'center',
  },
  priceInfoLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    opacity: 0.8,
    marginBottom: 4,
  },
  priceInfoValue: {
    fontSize: 14,
    color: '#30D158',
    fontWeight: '700',
  },
  suggestedPriceValue: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '700',
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  quickActionButton: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
    minWidth: 80,
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: 12,
    color: '#34c759',
    fontWeight: '600',
  },
  enhancedPriceInputSection: {
    marginTop: 8,
  },
  enhancedPriceLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enhancedPriceInput: {
    flex: 1,
    height: 48,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
  },
  foundItemPriceInput: {
    borderColor: 'rgba(76, 175, 80, 0.5)',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  filledPriceInput: {
    borderColor: '#007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  enhancedCurrencyText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 12,
    minWidth: 40,
  },
  priceWarningContainer: {
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.3)',
  },
  priceWarning: {
    fontSize: 12,
    color: '#FF453A',
    fontWeight: '600',
    textAlign: 'center',
  },
  priceConfirmContainer: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  priceConfirm: {
    fontSize: 12,
    color: '#34c759',
    fontWeight: '600',
    textAlign: 'center',
  },
  // Additional fields from Content Understanding
  additionalFieldsContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  additionalFieldsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  additionalFieldText: {
    fontSize: 12,
    color: '#666',
    marginVertical: 2,
  },
  // Processing method indicator
  processingMethodIndicator: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
  },
  processingMethodText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '500',
    textAlign: 'center',
  },
  // Confidence indicator styles
  confidenceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#F0F0F0',
  },
  lowConfidenceIndicator: {
    backgroundColor: '#FFEBEE',
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '500',
  },
  
  // Enhanced Price Editor Styles with Cyber Design
  priceEditorModalContainer: {
    backgroundColor: '#0a0a0a',
    flex: 1,
  },
  priceEditorHeader: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(243, 156, 18, 0.3)',
    shadowColor: '#f39c12',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  priceEditorHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  priceEditorTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
    textShadowColor: 'rgba(243, 156, 18, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  priceEditorSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  priceEditorCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  priceEditorCloseText: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  
  // Invoice Info Card Styles
  invoiceInfoCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  invoiceInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(243, 156, 18, 0.2)',
  },
  invoiceInfoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f39c12',
  },
  proModeBadge: {
    backgroundColor: 'rgba(46, 204, 113, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.4)',
  },
  proModeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2ecc71',
  },
  invoiceInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  invoiceInfoItem: {
    width: '50%',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  invoiceInfoLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  invoiceInfoValue: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '600',
  },
  invoiceTotalValue: {
    color: '#2ecc71',
    fontSize: 18,
    fontWeight: '700',
  },
  validationSuccess: {
    color: '#2ecc71',
  },
  validationWarning: {
    color: '#f39c12',
  },
  qualityHigh: {
    color: '#2ecc71',
  },
  qualityMedium: {
    color: '#f39c12',
  },
  qualityLow: {
    color: '#e74c3c',
  },
  
  // Additional Fields Styles
  additionalFieldsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(243, 156, 18, 0.2)',
  },
  additionalFieldsHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f39c12',
    marginBottom: 12,
  },
  additionalFieldsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  additionalFieldItem: {
    width: '50%',
    marginBottom: 8,
  },
  additionalFieldKey: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 2,
  },
  additionalFieldValue: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  
  // Processing Notes Styles
  processingNotesSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(243, 156, 18, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.1)',
  },
  processingNotesHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f39c12',
    marginBottom: 8,
  },
  processingNote: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
    paddingLeft: 8,
  },
  
  // Items Section Styles
  itemsSectionHeader: {
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.2)',
  },
  itemsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f39c12',
    marginBottom: 4,
  },
  itemsSectionSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  
  // Enhanced Item Card Styles
  enhancedItemCard: {
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  foundItemCard: {
    borderColor: 'rgba(46, 204, 113, 0.3)',
    backgroundColor: 'rgba(46, 204, 113, 0.05)',
  },
  lowConfidenceCard: {
    borderColor: 'rgba(231, 76, 60, 0.5)',
    borderWidth: 2,
    backgroundColor: 'rgba(231, 76, 60, 0.05)',
  },
  
  // Enhanced Confidence Indicator
  enhancedConfidenceIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  lowConfidenceWarning: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderColor: 'rgba(231, 76, 60, 0.3)',
  },
  confidenceContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  confidenceHint: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
    fontStyle: 'italic',
  },

  // Modern Image Preview Modal Styles
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(26, 26, 46, 0.97)',
  },
  modernProgressContainer: {
    width: '100%',
    marginTop: 20,
    alignItems: 'center',
  },
  modernProgressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  modernProgressFill: {
    height: '100%',
    backgroundColor: '#f39c12',
    borderRadius: 2,
  },
  modernProgressText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  modalCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
  },
  modalCornerTopLeft: {
    top: 20,
    left: 20,
  },
  modalCornerTopRight: {
    top: 20,
    right: 20,
  },
  modalCornerLine: {
    position: 'absolute',
    backgroundColor: '#f39c12',
    width: 15,
    height: 2,
    opacity: 0.6,
  },
  modalCornerLineVertical: {
    width: 2,
    height: 15,
  },
  modernInstructionsCard: {
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    margin: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.3)',
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  instructionsIconContainer: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(243, 156, 18, 0.2)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  instructionsIcon: {
    fontSize: 18,
  },
  modernInstructionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f39c12',
  },
  instructionsContent: {
    space: 8,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  instructionBullet: {
    width: 6,
    height: 6,
    backgroundColor: '#f39c12',
    borderRadius: 3,
    marginRight: 12,
  },
  modernInstructionsText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    flex: 1,
  },
  modernImageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    justifyContent: 'space-between',
  },
  modernImageCard: {
    width: '48%',
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.3)',
    overflow: 'hidden',
  },
  modernImageCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
  },
  modernPageIndicator: {
    backgroundColor: 'rgba(243, 156, 18, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modernPageNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f39c12',
  },
  modernRemoveButton: {
    width: 28,
    height: 28,
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.5)',
  },
  modernRemoveText: {
    fontSize: 14,
    color: '#e74c3c',
    fontWeight: '600',
  },
  modernImageWrapper: {
    position: 'relative',
    aspectRatio: 0.7,
    margin: 8,
  },
  modernPreviewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  modernImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    padding: 8,
  },
  overlayContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overlayPageText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  overlayStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    backgroundColor: '#27ae60',
    borderRadius: 3,
    marginRight: 4,
  },
  overlayStatusText: {
    fontSize: 10,
    color: '#27ae60',
    fontWeight: '500',
  },
  modernImageCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  cardFooterLeft: {
    flex: 1,
  },
  readyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readyDot: {
    width: 8,
    height: 8,
    backgroundColor: '#27ae60',
    borderRadius: 4,
    marginRight: 6,
  },
  readyText: {
    fontSize: 12,
    color: '#27ae60',
    fontWeight: '600',
  },
  cardIndexText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500',
  },
  modernAddMoreCard: {
    width: '48%',
    height: 180,
    backgroundColor: 'rgba(26, 26, 46, 0.6)',
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(243, 156, 18, 0.3)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  addMoreIconContainer: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(243, 156, 18, 0.2)',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modernAddMoreIcon: {
    fontSize: 24,
  },
  addMoreContent: {
    alignItems: 'center',
  },
  modernAddMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f39c12',
    marginBottom: 4,
  },
  modernAddMoreHint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  addMoreBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.5)',
    opacity: 0,
  },
  modernActionSection: {
    padding: 20,
    paddingBottom: 40,
  },
  modernStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.2)',
  },
  modernStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(243, 156, 18, 0.2)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statContent: {
    alignItems: 'center',
  },
  modernStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f39c12',
    marginBottom: 2,
  },
  modernStatLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  modernProcessButton: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  processButtonGradient: {
    padding: 20,
    borderRadius: 16,
  },
  modernProcessButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  processButtonIconContainer: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  modernProcessButtonIcon: {
    fontSize: 24,
  },
  processButtonTextContainer: {
    flex: 1,
  },
  modernProcessButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  modernProcessButtonSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  modernDisabledButton: {
    opacity: 0.5,
  },
  modernCancelButton: {
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
  },
  modernCancelButtonText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  
  // Simple Queue Status Styles
  queueStatusContainer: {
    position: 'absolute',
    bottom: 180,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  queueStatusButton: {
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 8,
  },
  queueStatusText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '600',
  },
  queueActionButton: {
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueActionText: {
    fontSize: 16,
  },
  // Smart field display styles
  productInfoContainer: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 8,
    marginVertical: 5,
  },
  productInfoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
    fontWeight: '600',
  },
  productInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  infoChip: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    color: '#333',
    marginRight: 5,
    marginBottom: 3,
  },
  
  // Manual IP Configuration Styles
  manualIPContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 247, 255, 0.3)',
  },
  manualIPLabel: {
    color: '#00f7ff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  manualIPInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  manualIPInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  testButton: {
    backgroundColor: '#00f7ff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  testButtonDisabled: {
    backgroundColor: '#666',
  },
  testButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  manualIPStatus: {
    color: '#00ff00',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});