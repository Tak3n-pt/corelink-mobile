// ==================== MULTI-IMAGE PRODUCT VIEW COMPONENT ====================
// Enhanced product display with multiple images, hover effects, and fallbacks

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  Modal,
  Alert,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const MultiImageProductView = ({ product, visible, onClose }) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [images, setImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [imageErrors, setImageErrors] = useState({});
  const [fallbackImages, setFallbackImages] = useState({});

  useEffect(() => {
    if (product && visible) {
      loadProductImages();
    }
  }, [product, visible]);

  const loadProductImages = async () => {
    setLoadingImages(true);
    const productImages = [];

    try {
      // Get images from product data
      const imageUrls = product.images || [];
      
      // If no images array, try common image fields
      if (imageUrls.length === 0) {
        const possibleImages = [
          product.image_url,
          product.imageUrl,
          product.photo,
          product.picture,
          `https://api.placeholder.com/400x400/0066CC/FFFFFF?text=${encodeURIComponent(product.name || 'Product')}`
        ].filter(Boolean);
        
        imageUrls.push(...possibleImages);
      }

      // Process each image URL
      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        if (imageUrl) {
          const processedImage = await processImageUrl(imageUrl, i);
          if (processedImage) {
            productImages.push(processedImage);
          }
        }
      }

      // Ensure at least one image (placeholder if needed)
      if (productImages.length === 0) {
        productImages.push({
          id: 'default',
          uri: `https://via.placeholder.com/400x400/0066CC/FFFFFF?text=${encodeURIComponent(product.name || 'No Image')}`,
          type: 'placeholder',
          index: 0
        });
      }

      setImages(productImages);
    } catch (error) {
      console.error('Error loading product images:', error);
    }
    
    setLoadingImages(false);
  };

  const processImageUrl = async (imageUrl, index) => {
    try {
      // Generate unique filename for caching
      const filename = `product_${product.id || product.barcode}_${index}.jpg`;
      const localPath = `${RNFS.DocumentDirectoryPath}/${filename}`;

      // Check if image exists locally
      const localExists = await RNFS.exists(localPath);
      
      if (localExists) {
        // Use local cached image
        return {
          id: `local_${index}`,
          uri: `file://${localPath}`,
          type: 'local',
          index
        };
      } else {
        // Download and cache image
        try {
          await RNFS.downloadFile({
            fromUrl: imageUrl,
            toFile: localPath,
            headers: {
              'User-Agent': 'CoreLink-App/1.0'
            },
            connectionTimeout: 10000,
            readTimeout: 15000
          }).promise;

          // Verify download was successful
          const downloadExists = await RNFS.exists(localPath);
          if (downloadExists) {
            return {
              id: `cached_${index}`,
              uri: `file://${localPath}`,
              type: 'cached',
              index
            };
          }
        } catch (downloadError) {
          console.log('Download failed, using direct URL:', downloadError);
        }

        // Fallback to direct URL
        return {
          id: `url_${index}`,
          uri: imageUrl,
          type: 'url',
          index
        };
      }
    } catch (error) {
      console.error('Error processing image URL:', error);
      return null;
    }
  };

  const handleImageError = (index) => {
    setImageErrors(prev => ({
      ...prev,
      [index]: true
    }));

    // Set fallback image
    const fallbackUri = `https://via.placeholder.com/400x400/CCCCCC/666666?text=Image+Error`;
    setFallbackImages(prev => ({
      ...prev,
      [index]: fallbackUri
    }));
  };

  const renderMainImage = () => {
    if (images.length === 0) return null;

    const currentImage = images[selectedImageIndex];
    const hasError = imageErrors[selectedImageIndex];
    const fallbackUri = fallbackImages[selectedImageIndex];

    return (
      <View style={styles.mainImageContainer}>
        <Image
          source={{ uri: hasError ? fallbackUri : currentImage.uri }}
          style={styles.mainImage}
          onError={() => handleImageError(selectedImageIndex)}
          resizeMode="contain"
        />
        
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
             currentImage.type === 'url' ? '🌐' : '🖼️'}
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
          const hasError = imageErrors[index];
          const fallbackUri = fallbackImages[index];

          return (
            <TouchableOpacity
              key={image.id}
              style={[
                styles.thumbnailWrapper,
                isSelected && styles.selectedThumbnail
              ]}
              onPress={() => setSelectedImageIndex(index)}
              activeOpacity={0.7}
            >
              <Image
                source={{ uri: hasError ? fallbackUri : image.uri }}
                style={styles.thumbnail}
                onError={() => handleImageError(index)}
                resizeMode="cover"
              />
              
              {/* Hover effect overlay */}
              {!isSelected && (
                <View style={styles.thumbnailOverlay} />
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

  const renderProductInfo = () => (
    <View style={styles.productInfo}>
      <Text style={styles.productName}>{product.name}</Text>
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

        {loadingImages ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0066CC" />
            <Text style={styles.loadingText}>Loading images...</Text>
          </View>
        ) : (
          <ScrollView style={styles.content}>
            {/* Main Image */}
            {renderMainImage()}

            {/* Thumbnails */}
            {renderThumbnails()}

            {/* Product Information */}
            {renderProductInfo()}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  // Add to cart or favorite functionality
                  Alert.alert('Feature', 'Add to cart/favorite functionality');
                }}
              >
                <Text style={styles.actionButtonText}>Add to Cart</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={() => {
                  // Share functionality
                  Alert.alert('Feature', 'Share product functionality');
                }}
              >
                <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
                  Share
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666666',
  },
  mainImageContainer: {
    position: 'relative',
    height: screenHeight * 0.4,
    backgroundColor: '#F8F8F8',
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mainImage: {
    width: '100%',
    height: '100%',
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
  thumbnailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
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
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 10,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#0066CC',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#0066CC',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#0066CC',
  },
});

export default MultiImageProductView;