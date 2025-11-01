# Enhanced Offline Queue System with Recent Scans Sync

## Overview

The enhanced queue system now supports complete invoice data synchronization including:
- ✅ Full invoice images (single and multi-page)
- ✅ Complete recent scans data sync to desktop
- ✅ Automatic sync when desktop comes online
- ✅ Duplicate prevention with image data
- ✅ Persistent storage with enhanced metadata

## Architecture

### Core Components

1. **EnhancedOfflineQueueManagerFixed.js**
   - Enhanced queue storage with complete invoice data
   - Recent scans data structure for desktop sync
   - Improved sync process with image handling

2. **processInvoiceImagesDirect.js** 
   - Updated to include image URIs in queue data
   - Enhanced recent scans saving with image data

3. **test-desktop-simulator.js**
   - New `/recent-scans/sync` endpoint
   - Desktop storage simulation for recent scans

## Key Features

### 1. Complete Invoice Data Storage

```javascript
// Queue item structure with enhanced data
const queueItem = {
  id: 'inv_timestamp_random',
  data: { /* invoice items and prices */ },
  
  // NEW: Enhanced recent scan data for desktop sync
  recentScanData: {
    vendor: 'Supplier Name',
    totalItems: 5,
    total: 250.50,
    items: [...], // ALL items for desktop
    imageUri: 'file:///single-page.jpg', // Single page
    imageUris: ['page1.jpg', 'page2.jpg'], // Multi-page
    isMultiPage: true,
    pageCount: 2,
    requestId: 'req_001'
  }
}
```

### 2. Desktop Sync Process

When desktop comes online, the system:

1. **Syncs Recent Scan Data** → `POST /recent-scans/sync`
   - Complete invoice details with image metadata
   - All pages for multi-page invoices
   - Desktop stores scan history with image info

2. **Updates Product Prices** → `POST /products/update-prices`
   - Batch price updates for all items

3. **Finalizes Invoice** → `POST /invoices/finalize`
   - Completes the invoice processing
   - Desktop inventory updated

### 3. Duplicate Prevention

Enhanced duplicate detection considers:
- Request ID and vendor combination
- First item name and total amount
- 30-second window for duplicate submissions
- Works with single and multi-page invoices

## Usage Scenarios

### Scenario 1: Store Owner Outside (Desktop Offline)

```
📱 Mobile App: Process invoice with 3 pages
📦 Queue: Store complete data + 3 image URIs
💾 Storage: Persist to AsyncStorage with images
⏳ Wait: Desktop unavailable, items queued
```

### Scenario 2: Return to Store (Desktop Online)

```
🔄 Network: Detects desktop available
📋 Sync Recent Scans: Send complete invoice data + images
💰 Update Prices: Batch update selling prices  
📄 Finalize: Complete desktop inventory update
✅ Success: Queue item marked as completed
```

### Scenario 3: Duplicate Detection

```
📱 App: Same invoice processed again
🔍 Check: Request ID + vendor + total + first item
⚠️  Duplicate: Rejected within 30-second window
💡 Result: "Already in queue" message shown
```

## API Endpoints

### Desktop Server

#### Recent Scans Sync
```
POST /recent-scans/sync
Content-Type: application/json

{
  "queueId": "inv_123456_abc",
  "scanData": {
    "vendor": "Test Supplier",
    "totalItems": 5,
    "total": 250.50,
    "items": [...],
    "imageUri": "file:///invoice.jpg",
    "imageUris": ["page1.jpg", "page2.jpg"],
    "isMultiPage": true,
    "pageCount": 2,
    "requestId": "req_001"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "source": "mobile_queue_sync"
}
```

Response:
```json
{
  "success": true,
  "scanId": "scan_123456_def",
  "queueId": "inv_123456_abc",
  "message": "Recent scan data synchronized successfully",
  "imageCount": 2
}
```

## Testing

### Automated Tests
Run the comprehensive test suite:
```bash
node test-enhanced-queue-scenarios.js
```

Tests cover:
- ✅ Single-page invoice queuing with images
- ✅ Multi-page invoice queuing (3 pages)
- ✅ Desktop sync with recent scans data
- ✅ Duplicate prevention
- ✅ Recent scans verification

### Manual Integration Testing

1. **Start Desktop Simulator**
   ```bash
   node test-desktop-simulator.js
   ```

2. **Simulate Desktop Offline**
   ```bash
   curl -X POST http://localhost:3001/test/go-offline
   ```

3. **Process Invoices in Mobile App**
   - Upload single-page invoice
   - Upload multi-page invoice (2-3 pages)
   - Verify both are queued

4. **Check Queue Status**
   ```bash
   # In mobile app, check queue stats
   await enhancedQueueManager.getQueueStats()
   ```

5. **Bring Desktop Online**
   ```bash
   curl -X POST http://localhost:3001/test/go-online
   ```

6. **Verify Sync Results**
   ```bash
   curl http://localhost:3001/test/status
   ```

Expected response:
```json
{
  "isOnline": true,
  "receivedInvoices": 2,
  "recentScans": 2,
  "scans": [
    {
      "vendor": "Supplier A",
      "items": 3,
      "images": 1,
      "multiPage": false
    },
    {
      "vendor": "Supplier B", 
      "items": 5,
      "images": 3,
      "multiPage": true
    }
  ]
}
```

## Configuration

### Queue Settings
```javascript
// In EnhancedOfflineQueueManagerFixed.js
this.MAX_RETRIES = 5;
this.RETRY_DELAYS = [5000, 10000, 30000, 60000, 120000];
this.DUPLICATE_WINDOW = 30000; // 30 seconds
this.MAX_QUEUE_SIZE = 100;
this.BATCH_SIZE = 5;
```

### Storage Keys
```javascript
this.QUEUE_KEY = '@invoice_queue_v2';
this.PROCESSED_KEY = '@processed_invoices_v2';
this.DUPLICATE_CHECK_KEY = '@duplicate_check_v2';
```

## Error Handling

### Common Issues and Solutions

1. **Recent Scans Sync Fails**
   - Continue with price update and finalization
   - Log warning but don't fail entire sync
   - Desktop may not support recent scans endpoint

2. **Image URI Access Issues**
   - Images stored as URIs, not raw data
   - Desktop receives metadata about images
   - Actual image transfer would require file upload

3. **Queue Full**
   - Automatically removes old completed items
   - Maintains maximum of 100 items
   - Prioritizes recent pending items

## Performance Considerations

### Memory Usage
- Image URIs stored as strings (minimal memory)
- Complete item data preserved for desktop sync
- Automatic cleanup of old completed items

### Network Efficiency
- Batch operations (5 items per batch)
- Exponential backoff for failed attempts
- Debounced sync attempts (5-second minimum)

### Storage Optimization
- JSON serialization for AsyncStorage
- Duplicate cleanup (removes entries >1 hour old)
- Queue size limits prevent unbounded growth

## Future Enhancements

### Potential Improvements
1. **Image Compression** - Reduce storage size
2. **Partial Sync Recovery** - Resume interrupted syncs
3. **Priority Queuing** - High-priority invoices first
4. **Background Sync** - Sync while app in background
5. **Conflict Resolution** - Handle concurrent modifications

### Security Considerations
1. **Data Encryption** - Encrypt sensitive invoice data
2. **Authentication** - Secure desktop sync endpoints
3. **Data Validation** - Validate all queue data integrity
4. **Access Control** - Limit queue operations by user

## Conclusion

The enhanced queue system provides robust offline support with complete invoice data preservation. Store owners can process invoices anywhere and automatically sync when returning to the store network, with full recent scans history including image data.

**Key Benefits:**
- 📦 Complete offline capability
- 🖼️ Full image data preservation  
- 🔄 Automatic sync when available
- 🛡️ Duplicate prevention
- 📊 Recent scans desktop integration
- ⚡ High performance and reliability