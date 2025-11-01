/**
 * Test Desktop Stocking - Mimic the app stocking process without real invoices
 */

const SimpleStocking = require('./SimpleStocking.js');
const RobustDesktopFinder = require('./RobustDesktopFinder.js');

// Mock invoice data to simulate what the app would send
const mockInvoiceData = {
  vendor: 'Test Supplier Co.',
  invoiceNumber: `TEST-${Date.now()}`,
  invoiceDate: new Date().toISOString().split('T')[0],
  date: new Date().toISOString().split('T')[0],
  total: 150.00,
  imageUri: 'test-image-uri',
  imageUris: ['test-image-uri'],
  items: [
    {
      name: 'Test Product 1',
      description: 'First test product',
      quantity: 2,
      cost: 25.00,
      sellingPrice: 35.00,
      barcode: 'TEST001',
      category: 'Test Category'
    },
    {
      name: 'Test Product 2', 
      description: 'Second test product',
      quantity: 1,
      cost: 100.00,
      sellingPrice: 140.00,
      barcode: 'TEST002',
      category: 'Test Category'
    }
  ],
  processedAt: new Date().toISOString()
};

async function testDesktopStocking() {
  console.log('🧪 Starting Desktop Stocking Test...');
  console.log('📋 Mock invoice data:', {
    vendor: mockInvoiceData.vendor,
    items: mockInvoiceData.items.length,
    total: mockInvoiceData.total
  });

  try {
    // Step 1: Test desktop discovery
    console.log('\n🔍 Step 1: Testing desktop discovery...');
    const desktopIP = await RobustDesktopFinder.findDesktop();
    
    if (!desktopIP) {
      console.error('❌ Desktop discovery failed - no desktop found');
      return;
    }
    
    console.log(`✅ Desktop found at IP: ${desktopIP}`);
    
    // Step 2: Test desktop health
    console.log('\n🏥 Step 2: Testing desktop health...');
    const healthUrl = `http://${desktopIP}:4000/health`;
    
    try {
      const healthResponse = await fetch(healthUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        timeout: 5000
      });
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        console.log('✅ Desktop health check passed:', healthData);
      } else {
        console.error(`❌ Desktop health check failed: ${healthResponse.status}`);
        return;
      }
    } catch (error) {
      console.error('❌ Desktop health check error:', error.message);
      return;
    }

    // Step 3: Test the actual stocking process
    console.log('\n📦 Step 3: Testing stocking process...');
    const desktopUrl = `http://${desktopIP}:4000`;
    
    const result = await SimpleStocking.processAndStockInvoice(mockInvoiceData, desktopUrl);
    
    if (result.success) {
      if (result.method === 'direct') {
        console.log('🎉 SUCCESS: Direct stocking worked!');
        console.log('📊 Result:', {
          method: result.method,
          data: result.data
        });
      } else if (result.method === 'queued') {
        console.log('📥 QUEUED: Items were queued for later stocking');
        console.log('📊 Queue ID:', result.queueId);
        console.log('💡 This means desktop was unreachable during stocking');
      }
    } else {
      console.error('❌ Stocking failed:', result);
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testDesktopStocking().then(() => {
  console.log('\n✅ Desktop stocking test completed');
}).catch((error) => {
  console.error('\n❌ Test failed:', error);
});