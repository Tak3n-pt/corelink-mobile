// ==================== ENHANCED IMAGE HANDLER UTILITY ====================
// Ensures images always display with smart fallbacks and caching

import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';

class ImageHandler {
  constructor() {
    this.cacheDir = `${RNFS.DocumentDirectoryPath}/images`;
    this.maxCacheSize = 100 * 1024 * 1024; // 100MB
    this.defaultImages = {
      product: 'https://via.placeholder.com/400x400/0066CC/FFFFFF?text=Product',
      error: 'https://via.placeholder.com/400x400/FF4444/FFFFFF?text=Error',
      loading: 'https://via.placeholder.com/400x400/CCCCCC/666666?text=Loading',
    };
    
    this.initializeCache();
  }

  async initializeCache() {
    try {
      // Create cache directory if it doesn't exist
      const dirExists = await RNFS.exists(this.cacheDir);
      if (!dirExists) {
        await RNFS.mkdir(this.cacheDir);
      }
    } catch (error) {
      console.error('Failed to initialize image cache:', error);
    }
  }

  // Generate consistent filename from URL
  generateCacheKey(url, productId, index = 0) {
    const urlHash = this.simpleHash(url);
    return `${productId || 'unknown'}_${index}_${urlHash}.jpg`;
  }

  // Simple hash function for URL
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Check if image exists in cache
  async isImageCached(cacheKey) {
    try {
      const filePath = `${this.cacheDir}/${cacheKey}`;
      return await RNFS.exists(filePath);
    } catch (error) {
      return false;
    }
  }

  // Download and cache image
  async downloadImage(url, cacheKey) {
    try {
      const filePath = `${this.cacheDir}/${cacheKey}`;
      
      const downloadResult = await RNFS.downloadFile({
        fromUrl: url,
        toFile: filePath,
        headers: {
          'User-Agent': 'CoreLink-App/1.0',
          'Accept': 'image/jpeg,image/png,image/webp,image/*,*/*;q=0.8'
        },
        connectionTimeout: 15000,
        readTimeout: 30000
      }).promise;

      if (downloadResult.statusCode === 200) {
        // Verify file was downloaded
        const exists = await RNFS.exists(filePath);
        if (exists) {
          // Update cache metadata
          await this.updateCacheMetadata(cacheKey, url);
          return `file://${filePath}`;
        }
      }
      
      throw new Error(`Download failed with status: ${downloadResult.statusCode}`);
    } catch (error) {
      console.error('Image download failed:', error);
      return null;
    }
  }

  // Update cache metadata for cleanup
  async updateCacheMetadata(cacheKey, originalUrl) {
    try {
      const metadata = await AsyncStorage.getItem('imageCache') || '{}';
      const cacheData = JSON.parse(metadata);
      
      cacheData[cacheKey] = {
        url: originalUrl,
        timestamp: Date.now(),
        accessed: Date.now()
      };
      
      await AsyncStorage.setItem('imageCache', JSON.stringify(cacheData));
    } catch (error) {
      console.error('Failed to update cache metadata:', error);
    }
  }

  // Get optimized image with fallbacks
  async getOptimizedImage(imageUrl, productId, index = 0) {
    if (!imageUrl || typeof imageUrl !== 'string') {
      return {
        uri: this.defaultImages.product,
        type: 'fallback',
        source: 'default'
      };
    }

    try {
      const cacheKey = this.generateCacheKey(imageUrl, productId, index);
      
      // Check if image is cached locally
      const isCached = await this.isImageCached(cacheKey);
      
      if (isCached) {
        const filePath = `${this.cacheDir}/${cacheKey}`;
        // Update access time
        await this.updateCacheMetadata(cacheKey, imageUrl);
        
        return {
          uri: `file://${filePath}`,
          type: 'cached',
          source: 'local'
        };
      }

      // Try to download and cache
      const cachedPath = await this.downloadImage(imageUrl, cacheKey);
      
      if (cachedPath) {
        return {
          uri: cachedPath,
          type: 'downloaded',
          source: 'cached'
        };
      }

      // Fallback to direct URL
      return {
        uri: imageUrl,
        type: 'direct',
        source: 'url'
      };

    } catch (error) {
      console.error('Error getting optimized image:', error);
      
      // Return error fallback
      return {
        uri: this.defaultImages.error,
        type: 'error',
        source: 'fallback'
      };
    }
  }

  // Process multiple images for a product
  async processProductImages(product) {
    const images = [];
    const imageUrls = this.extractImageUrls(product);
    
    for (let i = 0; i < imageUrls.length; i++) {
      const imageData = await this.getOptimizedImage(
        imageUrls[i],
        product.id || product.barcode,
        i
      );
      
      images.push({
        ...imageData,
        index: i,
        id: `${product.id || product.barcode}_${i}`,
        originalUrl: imageUrls[i]
      });
    }

    // Ensure at least one image
    if (images.length === 0) {
      images.push({
        uri: this.generatePlaceholder(product.name || 'Product'),
        type: 'placeholder',
        source: 'generated',
        index: 0,
        id: `${product.id || product.barcode}_placeholder`
      });
    }

    return images;
  }

  // Extract image URLs from product data
  extractImageUrls(product) {
    const urls = [];
    
    // Check various possible image fields
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

    // Remove duplicates and invalid URLs
    const uniqueUrls = [...new Set(urls)].filter(url => 
      url && 
      typeof url === 'string' && 
      (url.startsWith('http') || url.startsWith('data:'))
    );

    return uniqueUrls;
  }

  // Generate placeholder with product name
  generatePlaceholder(productName, size = '400x400', bgColor = '0066CC', textColor = 'FFFFFF') {
    const encodedName = encodeURIComponent(productName.substring(0, 20));
    return `https://via.placeholder.com/${size}/${bgColor}/${textColor}?text=${encodedName}`;
  }

  // Clean up old cache files
  async cleanupCache() {
    try {
      const metadata = await AsyncStorage.getItem('imageCache') || '{}';
      const cacheData = JSON.parse(metadata);
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      // Get all cache files
      const files = await RNFS.readDir(this.cacheDir);
      let totalSize = 0;
      const fileStats = [];

      for (const file of files) {
        const stats = await RNFS.stat(file.path);
        totalSize += stats.size;
        
        const cacheKey = file.name;
        const metadata = cacheData[cacheKey];
        
        fileStats.push({
          path: file.path,
          name: file.name,
          size: stats.size,
          age: now - (metadata?.timestamp || stats.mtime),
          lastAccessed: metadata?.accessed || stats.mtime
        });
      }

      // Remove old files if cache is too large
      if (totalSize > this.maxCacheSize) {
        // Sort by last accessed (oldest first)
        fileStats.sort((a, b) => a.lastAccessed - b.lastAccessed);
        
        let removedSize = 0;
        for (const file of fileStats) {
          if (totalSize - removedSize <= this.maxCacheSize * 0.8) break;
          
          await RNFS.unlink(file.path);
          delete cacheData[file.name];
          removedSize += file.size;
        }
      }

      // Remove files older than maxAge
      for (const file of fileStats) {
        if (file.age > maxAge) {
          await RNFS.unlink(file.path);
          delete cacheData[file.name];
        }
      }

      // Update metadata
      await AsyncStorage.setItem('imageCache', JSON.stringify(cacheData));
      
    } catch (error) {
      console.error('Cache cleanup failed:', error);
    }
  }

  // Get cache statistics
  async getCacheStats() {
    try {
      const files = await RNFS.readDir(this.cacheDir);
      let totalSize = 0;
      
      for (const file of files) {
        const stats = await RNFS.stat(file.path);
        totalSize += stats.size;
      }

      return {
        fileCount: files.length,
        totalSize: totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        maxSizeMB: (this.maxCacheSize / (1024 * 1024)).toFixed(2)
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Fast preload single image for instant switching
  async fastPreloadImage(imageUrl, productId, index = 0) {
    try {
      const cacheKey = this.generateCacheKey(imageUrl, productId, index);
      const isCached = await this.isImageCached(cacheKey);
      
      if (isCached) {
        const filePath = `${this.cacheDir}/${cacheKey}`;
        return {
          uri: `file://${filePath}`,
          type: 'cached',
          source: 'local',
          preloaded: true
        };
      }

      // Use React Native's Image.prefetch for fast preloading
      if (typeof Image !== 'undefined' && Image.prefetch) {
        await Image.prefetch(imageUrl);
        console.log(`⚡ Fast preload completed: ${imageUrl.substring(0, 50)}...`);
      }
      
      return {
        uri: imageUrl,
        type: 'preloaded',
        source: 'url',
        preloaded: true
      };
    } catch (error) {
      console.error('Fast preload failed:', error);
      return {
        uri: imageUrl,
        type: 'direct',
        source: 'url',
        preloaded: false
      };
    }
  }

  // Preload images for better performance
  async preloadImages(products, maxConcurrent = 3) {
    const results = [];
    
    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < products.length; i += maxConcurrent) {
      const batch = products.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(product => this.processProductImages(product));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        console.error('Batch preload failed:', error);
      }
    }

    return results;
  }

  // Ultra-fast image switching preparation
  async prepareForFastSwitching(images) {
    console.log('🚀 Preparing images for fast switching...');
    
    const preloadPromises = images.map(async (image, index) => {
      try {
        // Use React Native's prefetch for immediate availability
        if (typeof Image !== 'undefined' && Image.prefetch) {
          await Image.prefetch(image.uri);
          console.log(`✅ Image ${index + 1} ready for instant display`);
        }
        return { index, success: true };
      } catch (error) {
        console.log(`⚠️ Image ${index + 1} preload failed:`, error);
        return { index, success: false };
      }
    });

    const results = await Promise.allSettled(preloadPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    
    console.log(`🎯 Fast switching ready: ${successCount}/${images.length} images preloaded`);
    return results;
  }
}

// Export singleton instance
const imageHandler = new ImageHandler();
export default imageHandler;