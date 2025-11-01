/**
 * processInvoiceSimplified.js - Clean invoice processing
 * Replaces the complex processInvoiceImagesDirect
 */

import * as FileSystem from 'expo-file-system';

/**
 * Process invoice images through cloud server
 * @param {Array} imageUris - Array of image URIs to process
 * @param {Object} options - Configuration options
 */
export async function processInvoiceImages(imageUris, options) {
  const {
    INVOICE_SERVER_URL,
    setProcessingProgress,
    setCurrentInvoice,
    setShowPriceEditor,
    setIsProcessing,
    Alert,
    t
  } = options;

  try {
    setIsProcessing(true);
    setProcessingProgress(0.1);

    console.log(`📸 Processing ${imageUris.length} invoice image(s)`);

    // Convert images to base64
    const images = [];
    for (let i = 0; i < imageUris.length; i++) {
      setProcessingProgress(0.1 + (i / imageUris.length) * 0.3);

      try {
        const base64 = await FileSystem.readAsStringAsync(imageUris[i], {
          encoding: FileSystem.EncodingType.Base64,
        });

        images.push({
          base64,
          mimeType: 'image/jpeg',
          pageNumber: i + 1
        });

        console.log(`✅ Converted page ${i + 1}/${imageUris.length}`);
      } catch (error) {
        console.error(`Failed to convert image ${i + 1}:`, error);
      }
    }

    if (images.length === 0) {
      throw new Error('No images could be processed');
    }

    setProcessingProgress(0.4);

    // Determine endpoint based on page count
    const endpoint = images.length === 1
      ? '/process-invoice'
      : '/process-multi-page-invoice';

    // Prepare request
    const formData = new FormData();

    if (images.length === 1) {
      // Single page - send as 'file'
      const blob = new Blob([Uint8Array.from(atob(images[0].base64), c => c.charCodeAt(0))], {
        type: 'image/jpeg'
      });
      formData.append('file', blob, 'invoice.jpg');
    } else {
      // Multi-page - send as 'pages'
      images.forEach((img, index) => {
        const blob = new Blob([Uint8Array.from(atob(img.base64), c => c.charCodeAt(0))], {
          type: 'image/jpeg'
        });
        formData.append('pages', blob, `page_${index + 1}.jpg`);
      });
    }

    setProcessingProgress(0.5);

    // Send to cloud server for processing
    console.log(`☁️ Sending to cloud server: ${INVOICE_SERVER_URL}${endpoint}`);

    const response = await fetch(`${INVOICE_SERVER_URL}${endpoint}`, {
      method: 'POST',
      body: formData
    });

    setProcessingProgress(0.8);

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Processing failed');
    }

    setProcessingProgress(0.9);

    // Prepare invoice data for price editor
    const invoice = {
      ...result,
      imageUri: imageUris[0],
      imageUris: imageUris,
      isMultiPage: imageUris.length > 1,
      pageCount: imageUris.length,
      requestId: result.requestId || `mobile_${Date.now()}`,
      // Ensure items have selling price field
      items: (result.items || []).map(item => ({
        ...item,
        sellingPrice: item.sellingPrice || item.unitPrice || 0
      }))
    };

    console.log(`✅ Invoice processed successfully with ${invoice.items?.length || 0} items`);

    // Show price editor
    setCurrentInvoice(invoice);
    setShowPriceEditor(true);
    setProcessingProgress(1);

    // Reset after delay
    setTimeout(() => {
      setProcessingProgress(0);
      setIsProcessing(false);
    }, 500);

    return invoice;

  } catch (error) {
    console.error('❌ Invoice processing failed:', error);

    Alert.alert(
      t('error.processingFailed') || 'Processing Failed',
      error.message || 'Failed to process invoice images'
    );

    setProcessingProgress(0);
    setIsProcessing(false);

    throw error;
  }
}