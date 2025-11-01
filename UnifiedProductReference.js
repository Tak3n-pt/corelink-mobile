/**
 * UNIFIED PRODUCT REFERENCE - Mobile App Version
 * One field for all product identification needs
 */

export default class UnifiedProductReference {
  /**
   * Create a unified reference from invoice item
   * This replaces the confusing barcode || productCode logic
   */
  static createFromItem(item, requestId, index) {
    // Check all possible fields
    const barcode = item.barcode || item.Barcode;
    const productCode = item.productCode || item.product_code || item.ProductCode;
    const reference = item.reference || item.Reference;
    const sku = item.sku || item.SKU;
    
    // 1. Real barcode (numeric, 8-13 digits)
    if (barcode && /^\d{8,13}$/.test(barcode)) {
      return barcode;
    }
    
    // 2. Product code/SKU (add prefix if needed)
    if (productCode || reference || sku) {
      const code = productCode || reference || sku;
      if (!/^[A-Z]+_/.test(code)) {
        return `SKU_${code}`;
      }
      return code;
    }
    
    // 3. Non-standard barcode (add prefix)
    if (barcode) {
      if (!/^[A-Z]+_/.test(barcode)) {
        return `MAN_${barcode}`;
      }
      return barcode;
    }
    
    // 4. Generate new reference
    if (requestId && index !== undefined) {
      return `GEN_${requestId}_${index}`;
    }
    
    // 5. Fallback
    return `AUTO_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }
  
  /**
   * Display format for UI
   */
  static getDisplayText(reference) {
    if (!reference) return 'No Code';
    
    // Real barcode - show as-is
    if (/^\d{8,13}$/.test(reference)) {
      return reference;
    }
    
    // Generated - show shortened
    if (reference.startsWith('GEN_')) {
      const parts = reference.split('_');
      return `Gen-${parts[2] || '?'}`;
    }
    
    // Auto - show shortened
    if (reference.startsWith('AUTO_')) {
      return 'Auto-Gen';
    }
    
    // SKU - remove prefix
    if (reference.startsWith('SKU_')) {
      return reference.substring(4);
    }
    
    // Manual - remove prefix
    if (reference.startsWith('MAN_')) {
      return reference.substring(4);
    }
    
    return reference;
  }
  
  /**
   * Check if this is a real barcode or generated
   */
  static isRealBarcode(reference) {
    return reference && /^\d{8,13}$/.test(reference);
  }
  
  static isGenerated(reference) {
    return reference && (
      reference.startsWith('GEN_') || 
      reference.startsWith('AUTO_')
    );
  }
}