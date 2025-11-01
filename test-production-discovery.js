/**
 * Test Production Discovery - Simulates Built APK Network Discovery
 * Tests our RobustDesktopFinder + SmartNetworkConfig implementation
 */

const RobustDesktopFinder = require('./RobustDesktopFinder');
const smartNetwork = require('./SmartNetworkConfig');

console.log('🧪 === SIMULATING PRODUCTION APK DISCOVERY ===');
console.log('📱 Simulating app startup without Metro bundler...\n');

async function simulateProductionDiscovery() {
  try {
    console.log('🚀 Step 1: Initializing SmartNetworkConfig (as production app would)...');
    await smartNetwork.initialize();
    console.log('✅ SmartNetworkConfig initialized');
    
    console.log('\n🔍 Step 2: Running bulletproof desktop discovery...');
    console.log('   (This simulates what happens when APK starts)');
    
    // Get current network endpoints
    const endpoints = smartNetwork.getEndpoints();
    console.log('📡 Current endpoints:', endpoints);
    
    // Test RobustDesktopFinder directly (what production APK uses)
    console.log('\n🎯 Step 3: Testing RobustDesktopFinder layers...');
    
    const finder = require('./RobustDesktopFinder');
    const status = finder.getStatus();
    console.log('🔧 Finder status:', status);
    
    // Simulate discovery as production build would do it
    console.log('\n🔍 Step 4: Running complete discovery (multi-layer approach)...');
    const startTime = Date.now();
    
    const discoveredIP = await finder.findDesktop();
    const duration = Date.now() - startTime;
    
    if (discoveredIP) {
      console.log(`\n✅ SUCCESS! Desktop discovered: ${discoveredIP}`);
      console.log(`⚡ Discovery took: ${duration}ms`);
      console.log(`🎯 Desktop URL: http://${discoveredIP}:4000`);
      
      // Test HTTP connection to verify it works
      console.log('\n🌐 Step 5: Testing HTTP connection to discovered desktop...');
      const testUrl = `http://${discoveredIP}:4000/health`;
      
      try {
        const response = await fetch(testUrl, { 
          method: 'GET',
          timeout: 5000 
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ HTTP connection successful!');
          console.log('📋 Server response:', data);
          
          // Test a typical API call the app would make
          console.log('\n🛒 Step 6: Testing typical inventory API call...');
          const productsUrl = `http://${discoveredIP}:4000/products`;
          const productsResponse = await fetch(productsUrl);
          
          if (productsResponse.ok) {
            const products = await productsResponse.json();
            console.log(`✅ Products API works! Found ${products.length} products`);
          }
          
        } else {
          console.log('❌ HTTP connection failed:', response.status);
        }
      } catch (httpError) {
        console.log('❌ HTTP test failed:', httpError.message);
      }
      
    } else {
      console.log('\n❌ FAILED! No desktop server found');
      console.log('🔍 This indicates an issue with our discovery system');
    }
    
    console.log('\n📊 Step 7: Network configuration status...');
    const networkStatus = smartNetwork.getStatus();
    console.log('🌐 Network status:', networkStatus);
    
  } catch (error) {
    console.error('❌ Discovery test failed:', error);
  }
}

// Simulate what happens in production
simulateProductionDiscovery()
  .then(() => {
    console.log('\n🎉 === PRODUCTION DISCOVERY SIMULATION COMPLETE ===');
    console.log('   This simulates how the built APK will discover the desktop server');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Simulation failed:', error);
    process.exit(1);
  });