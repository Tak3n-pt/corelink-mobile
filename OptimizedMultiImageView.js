// ==================== OPTIMIZED MULTI-IMAGE PRODUCT VIEW ====================
// High-performance product image viewer with preloading and smooth transitions

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  Modal,
  ActivityIndicator,
  Animated
} from 'react-native';
import imageHandler from './ImageHandler';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const OptimizedMultiImageView = ({ product, visible, onClose }) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [images, setImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [preloadedImages, setPreloadedImages] = useState({});
  const [imageLoadingStates, setImageLoadingStates] = useState({});
  
  // Track current product to prevent auto-reset
  const [currentProductId, setCurrentProductId] = useState(null);
  const [isNewProduct, setIsNewProduct] = useState(true);

  // Early return if no product
  if (!product && visible) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Product Images</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.mainImageContainer, { justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={styles.loadingText}>No product selected</Text>
          </View>
        </View>
      </Modal>
    );
  }
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Memoized image URLs to prevent re-processing
  const imageUrls = useMemo(() => {
    if (!product) return [];
    
    const urls = [];
    
    // Extract all possible image URLs
    const imageFields = [
      'images', 'image_urls', 'photos', 'pictures',
      'image', 'image_url', 'imageUrl', 'photo', 'picture',
      'main_image', 'thumbnail', 'cover_image'
    ];

    imageFields.forEach(field => {
      const value = product[field];
      if (value) {
        if (Array.isArray(value)) {
          urls.push(...value.filter(url => url && typeof url === 'string'));
        } else if (typeof value === 'string') {
          urls.push(value);
        }
      }
    });

    // Remove duplicates and validate URLs
    const uniqueUrls = [...new Set(urls)].filter(url => 
      url && 
      typeof url === 'string' && 
      (url.startsWith('http') || url.startsWith('data:') || url.startsWith('file:'))
    );

    // Always ensure at least one image (placeholder)
    if (uniqueUrls.length === 0) {
      uniqueUrls.push(
        `https://via.placeholder.com/400x400/0066CC/FFFFFF?text=${encodeURIComponent((product?.name || 'Product').substring(0, 20))}`
      );
    }

    return uniqueUrls;
  }, [product]);

  // Check if this is a new product
  useEffect(() => {
    if (product) {
      const productId = product.id || product.barcode || product.name;
      const isNewProd = productId !== currentProductId;
      
      if (isNewProd) {
        setCurrentProductId(productId);
        setIsNewProduct(true);
        // Only reset to first image for new products
        setSelectedImageIndex(0);
      } else {
        setIsNewProduct(false);
      }
    }
  }, [product, currentProductId]);

  // Reset states when modal closes
  useEffect(() => {
    if (!visible) {
      // Reset states when modal is closed
      setPreloadedImages({});
      setImageLoadingStates({});
      // Don't reset selectedImageIndex here to maintain user's position
    }
  }, [visible]);

  // Load and preload images
  useEffect(() => {
    if (product && visible && imageUrls.length > 0) {
      loadImagesOptimized();
    }
  }, [product, visible, imageUrls]);

  const loadImagesOptimized = async () => {
    setLoadingImages(true);
    
    // Only reset to first image for new products
    // Don't auto-reset if user is browsing the same product
    
    try {
      // Process all images using the optimized ImageHandler
      const processedImages = await imageHandler.processProductImages(product);
      
      setImages(processedImages);
      
      // Start ultra-fast preloading for instant switching
      imageHandler.prepareForFastSwitching(processedImages);
      
      // Also start traditional preloading as backup
      preloadAllImages(processedImages);
      
    } catch (error) {
      console.error('Error loading optimized images:', error);
      // Fallback to simple placeholder
      setImages([{
        uri: `https://via.placeholder.com/400x400/0066CC/FFFFFF?text=${encodeURIComponent(product?.name || 'Error')}`,
        type: 'placeholder',
        index: 0,
        id: 'error_placeholder'
      }]);
    }
    
    setLoadingImages(false);
  };

  // Preload all images for instant switching
  const preloadAllImages = async (imagesToPreload) => {
    const preloadPromises = imagesToPreload.map(async (image, index) => {
      try {
        setImageLoadingStates(prev => ({ ...prev, [index]: true }));
        
        // Preload image by creating Image instance
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            setPreloadedImages(prev => ({ ...prev, [index]: image.uri }));
            setImageLoadingStates(prev => ({ ...prev, [index]: false }));
            resolve(image.uri);
          };
          img.onerror = () => {
            setImageLoadingStates(prev => ({ ...prev, [index]: false }));
            reject(new Error(`Failed to preload image ${index}`));
          };
          
          // For React Native, we use Image.prefetch instead
          if (Image.prefetch) {
            Image.prefetch(image.uri)
              .then(() => {
                setPreloadedImages(prev => ({ ...prev, [index]: image.uri }));
                setImageLoadingStates(prev => ({ ...prev, [index]: false }));
                resolve(image.uri);
              })
              .catch(() => {
                setImageLoadingStates(prev => ({ ...prev, [index]: false }));
                reject(new Error(`Failed to preload image ${index}`));
              });
          } else {
            // Fallback for web or other platforms
            img.src = image.uri;
          }
        });
      } catch (error) {
        console.log(`Preload failed for image ${index}:`, error);
        setImageLoadingStates(prev => ({ ...prev, [index]: false }));
      }
    });

    // Wait for all images to preload (with timeout)
    try {
      await Promise.allSettled(preloadPromises);
      console.log('🖼️ All images preloaded successfully');
    } catch (error) {
      console.log('⚠️ Some images failed to preload:', error);
    }
  };

  // Smooth image transition
  const handleImageChange = (newIndex) => {
    if (newIndex === selectedImageIndex) return;
    
    // Animate transition
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    setSelectedImageIndex(newIndex);
  };

  const renderMainImage = () => {
    if (images.length === 0 || loadingImages) {
      return (
        <View style={styles.mainImageContainer}>
          <ActivityIndicator size="large" color="#0066CC" />
          <Text style={styles.loadingText}>Loading images...</Text>
        </View>
      );
    }

    const currentImage = images[selectedImageIndex];
    const isImageLoading = imageLoadingStates[selectedImageIndex];

    return (
      <View style={styles.mainImageContainer}>
        <Animated.View
          style={[
            styles.animatedImageContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Image
            source={{ uri: currentImage.uri }}
            style={styles.mainImage}
            resizeMode="contain"
            onLoadStart={() => setImageLoadingStates(prev => ({ ...prev, [selectedImageIndex]: true }))}
            onLoadEnd={() => setImageLoadingStates(prev => ({ ...prev, [selectedImageIndex]: false }))}
            onError={() => setImageLoadingStates(prev => ({ ...prev, [selectedImageIndex]: false }))}
          />
          
          {/* Loading overlay for current image */}
          {isImageLoading && (
            <View style={styles.imageLoadingOverlay}>
              <ActivityIndicator size="small" color="#0066CC" />
            </View>
          )}
        </Animated.View>
        
        {/* Image counter */}
        <View style={styles.imageCounter}>
          <Text style={styles.imageCounterText}>
            {selectedImageIndex + 1} / {images.length}
          </Text>
        </View>

        {/* Image type indicator */}
        <View style={styles.imageTypeIndicator}>
          <Text style={styles.imageTypeText}>
            {currentImage.type === 'local' ? '📱' : 
             currentImage.type === 'cached' ? '💾' : 
             currentImage.type === 'downloaded' ? '💾' : 
             currentImage.type === 'url' || currentImage.type === 'direct' ? '🌐' : '🖼️'}
          </Text>
        </View>
      </View>
    );
  };

  const renderThumbnails = () => {
    if (images.length <= 1) return null;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.thumbnailContainer}
        contentContainerStyle={styles.thumbnailContent}
      >
        {images.map((image, index) => {
          const isSelected = index === selectedImageIndex;
          const isPreloaded = preloadedImages[index];
          const isLoading = imageLoadingStates[index];

          return (
            <TouchableOpacity
              key={`${image.id}_${index}`}
              style={[
                styles.thumbnailWrapper,
                isSelected && styles.selectedThumbnail
              ]}
              onPress={() => handleImageChange(index)}
              activeOpacity={0.7}
            >
              <Image
                source={{ uri: image.uri }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
              
              {/* Loading indicator for thumbnail */}
              {isLoading && (
                <View style={styles.thumbnailLoadingOverlay}>
                  <ActivityIndicator size="small" color="#0066CC" />
                </View>
              )}
              
              {/* Preload indicator */}
              {isPreloaded && !isSelected && (
                <View style={styles.preloadIndicator}>
                  <Text style={styles.preloadText}>✓</Text>
                </View>
              )}
              
              {/* Selection indicator */}
              {isSelected && (
                <View style={styles.selectionIndicator} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderProductInfo = () => {
    if (!product) return null;
    
    return (
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{product.name || 'Unknown Product'}</Text>
        {product.barcode && (
          <Text style={styles.productBarcode}>Barcode: {product.barcode}</Text>
        )}
        {product.price && (
          <Text style={styles.productPrice}>${product.price}</Text>
        )}
        {product.description && (
          <Text style={styles.productDescription}>{product.description}</Text>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Product Images</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Main Image */}
          {renderMainImage()}

          {/* Thumbnails */}
          {renderThumbnails()}

          {/* Product Information */}
          {renderProductInfo()}

          {/* Performance Info */}
          <View style={styles.performanceInfo}>
            <Text style={styles.performanceText}>
              🚀 Preloaded: {Object.keys(preloadedImages).length}/{images.length} images
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666666',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  mainImageContainer: {
    position: 'relative',
    height: screenHeight * 0.4,
    backgroundColor: '#F8F8F8',
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  animatedImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666666',
  },
  imageCounter: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCounterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  imageTypeIndicator: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageTypeText: {
    fontSize: 16,
  },
  thumbnailContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  thumbnailContent: {
    paddingRight: 20,
  },
  thumbnailWrapper: {
    position: 'relative',
    width: 80,
    height: 80,
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedThumbnail: {
    borderColor: '#0066CC',
    shadowColor: '#0066CC',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  preloadIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 200, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  preloadText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  selectionIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0066CC',
  },
  productInfo: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  productName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  productBarcode: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0066CC',
    marginBottom: 12,
  },
  productDescription: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 22,
  },
  performanceInfo: {
    padding: 20,
    paddingTop: 10,
    alignItems: 'center',
  },
  performanceText: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'monospace',
  },
});

export default OptimizedMultiImageView;