/**
 * Simple UDP Discovery Test - Tests if our desktop server is broadcasting
 * Simulates what RobustDesktopFinder would do
 */

const dgram = require('dgram');

console.log('🧪 === UDP DISCOVERY TEST ===');
console.log('📡 Testing desktop server UDP broadcasts on port 8765...\n');

function testUDPDiscovery() {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const SERVICE_ID = 'REVOTEC_INVENTORY_SYSTEM';
    const UDP_PORT = 8765;
    let discovered = false;
    
    const timeout = setTimeout(() => {
      if (!discovered) {
        console.log('❌ TIMEOUT: No UDP broadcasts received in 10 seconds');
        socket.close();
        resolve(false);
      }
    }, 10000);

    socket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        console.log(`📡 Received broadcast from ${rinfo.address}:${rinfo.port}`);
        console.log('📋 Message data:', data);
        
        if (data.service === SERVICE_ID && data.type === 'DESKTOP_SERVER') {
          console.log(`✅ FOUND DESKTOP SERVER!`);
          console.log(`🎯 Desktop IP: ${rinfo.address}`);
          console.log(`🚪 Desktop Port: ${data.port || 4000}`);
          console.log(`🏷️ Hostname: ${data.hostname || 'unknown'}`);
          console.log(`📍 All IPs: ${JSON.stringify(data.ips)}`);
          
          discovered = true;
          clearTimeout(timeout);
          socket.close();
          resolve(rinfo.address);
        }
      } catch (e) {
        console.log('⚠️ Received malformed message, ignoring...');
      }
    });

    socket.on('error', (err) => {
      console.log('❌ UDP socket error:', err.message);
      clearTimeout(timeout);
      socket.close();
      resolve(false);
    });

    socket.bind(UDP_PORT, () => {
      console.log(`👂 Listening for broadcasts on port ${UDP_PORT}...`);
      console.log('⏱️ Will timeout in 10 seconds if no broadcasts received\n');
    });
  });
}

async function testHTTPConnection(ip) {
  if (!ip) return false;
  
  console.log(`\n🌐 Testing HTTP connection to discovered server...`);
  const url = `http://${ip}:4000/health`;
  
  try {
    // Using node-fetch equivalent with timeout
    const https = require('http');
    const { URL } = require('url');
    
    return new Promise((resolve) => {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 4000,
        path: parsedUrl.pathname,
        method: 'GET',
        timeout: 5000
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const parsed = JSON.parse(data);
              console.log('✅ HTTP connection successful!');
              console.log('📋 Server response:', parsed);
              resolve(true);
            } catch (e) {
              console.log('✅ HTTP connection successful (non-JSON response)');
              resolve(true);
            }
          } else {
            console.log(`❌ HTTP failed with status: ${res.statusCode}`);
            resolve(false);
          }
        });
      });
      
      req.on('error', (err) => {
        console.log('❌ HTTP connection failed:', err.message);
        resolve(false);
      });
      
      req.on('timeout', () => {
        console.log('❌ HTTP connection timed out');
        req.destroy();
        resolve(false);
      });
      
      req.end();
    });
    
  } catch (error) {
    console.log('❌ HTTP test error:', error.message);
    return false;
  }
}

// Main test
async function runDiscoveryTest() {
  console.log('🚀 Starting UDP discovery test...\n');
  
  const discoveredIP = await testUDPDiscovery();
  
  if (discoveredIP) {
    // Test HTTP connection
    const httpWorks = await testHTTPConnection(discoveredIP);
    
    if (httpWorks) {
      console.log('\n🎉 === TEST PASSED ===');
      console.log('✅ Desktop server UDP broadcasting works');
      console.log('✅ HTTP API connection works');
      console.log('✅ Production APK will be able to discover desktop!');
    } else {
      console.log('\n⚠️ === PARTIAL SUCCESS ===');
      console.log('✅ UDP broadcasting works');
      console.log('❌ HTTP connection failed');
      console.log('🔧 Check if desktop server is properly running');
    }
  } else {
    console.log('\n❌ === TEST FAILED ===');
    console.log('❌ No UDP broadcasts detected');
    console.log('🔧 Check if desktop server is running and broadcasting');
    console.log('🔧 Check if port 8765 is blocked by firewall');
  }
  
  process.exit(0);
}

runDiscoveryTest().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});