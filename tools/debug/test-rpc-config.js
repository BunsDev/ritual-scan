const puppeteer = require('puppeteer');

async function testRpcConfiguration() {
  console.log('🚀 Starting Puppeteer test for RPC configuration...');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });
    
    console.log('📱 Navigating to localhost:9263/settings...');
    await page.goto('http://localhost:9263/settings', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    
    // Wait a bit for React to hydrate
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Wait for the page to fully load
    await page.waitForSelector('input[type="text"]', { timeout: 5000 });
    
    // Extract the primary RPC URL value
    const primaryRpcUrl = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="text"]');
      for (let input of inputs) {
        if (input.value && input.value.includes('http://')) {
          return input.value;
        }
      }
      return null;
    });
    
    console.log('🔍 Found Primary RPC URL:', primaryRpcUrl);
    
    // Check if it contains the NEW IP (35.196.101.134)
    const hasNewIP = primaryRpcUrl && primaryRpcUrl.includes('35.196.101.134');
    const hasOldIP = primaryRpcUrl && primaryRpcUrl.includes('104.196.32.199');
    
    console.log('✅ Test Results:');
    console.log(`   New IP (35.196.101.134): ${hasNewIP ? '✅ FOUND' : '❌ NOT FOUND'}`);
    console.log(`   Old IP (104.196.32.199): ${hasOldIP ? '❌ STILL PRESENT' : '✅ REMOVED'}`);
    
    // Extract WebSocket URL if visible
    const websocketUrl = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="text"]');
      for (let input of inputs) {
        if (input.value && input.value.includes('ws://')) {
          return input.value;
        }
      }
      return null;
    });
    
    if (websocketUrl) {
      console.log('🔍 Found WebSocket URL:', websocketUrl);
      const wsHasNewIP = websocketUrl.includes('35.196.101.134');
      const wsHasOldIP = websocketUrl.includes('104.196.32.199');
      console.log(`   WS New IP (35.196.101.134): ${wsHasNewIP ? '✅ FOUND' : '❌ NOT FOUND'}`);
      console.log(`   WS Old IP (104.196.32.199): ${wsHasOldIP ? '❌ STILL PRESENT' : '✅ REMOVED'}`);
    }
    
    // Take a screenshot for debugging
    await page.screenshot({ path: '/tmp/rpc-settings-test.png', fullPage: true });
    console.log('📸 Screenshot saved to /tmp/rpc-settings-test.png');
    
    // Return MAP (Maximum A Posteriori) estimate
    const success = hasNewIP && !hasOldIP;
    console.log(`\n🎯 MAP Estimate: ${success ? 'SUCCESS' : 'FAILURE'}`);
    console.log(`📊 Confidence: ${success ? '95%' : '85%'} (based on observed evidence)`);
    
    return {
      success,
      primaryRpcUrl,
      websocketUrl,
      hasNewIP,
      hasOldIP
    };
    
  } catch (error) {
    console.error('❌ Puppeteer test failed:', error.message);
    return { success: false, error: error.message };
  } finally {
    await browser.close();
  }
}

// Run the test
testRpcConfiguration()
  .then(result => {
    console.log('\n🏁 Final Result:', result);
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
