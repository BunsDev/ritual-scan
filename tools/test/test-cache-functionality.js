#!/usr/bin/env node

/**
 * Automated test to verify Smart Cache functionality
 * Tests WebSocket connection and cache population
 */

const puppeteer = require('puppeteer');

async function testSmartCache() {
  console.log('🧪 Starting Smart Cache Test...\n');
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Capture console messages
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      
      // Print important messages
      if (text.includes('WebSocket') || 
          text.includes('Cache') || 
          text.includes('Block') ||
          text.includes('conn_') ||
          text.includes('DEBUG')) {
        console.log(`  📝 ${text}`);
      }
    });
    
    console.log('1️⃣  Loading homepage...');
    await page.goto('http://localhost:5051', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('✅ Page loaded\n');
    
    console.log('2️⃣  Waiting 20 seconds for WebSocket to populate cache...');
    await page.waitForTimeout(20000);
    
    console.log('\n3️⃣  Checking cache state...\n');
    
    // Execute debugWebSocketCache in browser context
    const cacheState = await page.evaluate(() => {
      if (typeof window.debugWebSocketCache === 'function') {
        return window.debugWebSocketCache();
      } else {
        return { error: 'debugWebSocketCache not available' };
      }
    });
    
    console.log('📊 Cache State:');
    console.log(JSON.stringify(cacheState, null, 2));
    
    // Check if cache has blocks
    const hasBlocks = cacheState?.cache?.blocksCount > 0;
    const isConnected = cacheState?.connection?.isConnected;
    
    console.log('\n4️⃣  Test Results:');
    console.log(`  ${isConnected ? '✅' : '❌'} WebSocket Connected: ${isConnected}`);
    console.log(`  ${hasBlocks ? '✅' : '❌'} Cache Has Blocks: ${cacheState?.cache?.blocksCount || 0}`);
    
    if (hasBlocks) {
      console.log(`  ✅ First Cached Block: #${parseInt(cacheState.cache.firstBlock?.number || '0', 16)}`);
    }
    
    console.log('\n5️⃣  Testing Validators Page Cache Load...\n');
    
    // Clear console logs for validators page test
    consoleLogs.length = 0;
    
    await page.goto('http://localhost:5051/validators', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await page.waitForTimeout(3000);
    
    // Check if validators page used cache
    const usedCache = consoleLogs.some(log => log.includes('Using') && log.includes('cached blocks'));
    const cacheLoadMessage = consoleLogs.find(log => log.includes('cached blocks'));
    
    console.log(`  ${usedCache ? '✅' : '❌'} Validators Used Cache: ${usedCache}`);
    if (cacheLoadMessage) {
      console.log(`  📝 ${cacheLoadMessage}`);
    }
    
    // Final verdict
    console.log('\n' + '='.repeat(60));
    if (hasBlocks && usedCache) {
      console.log('🎉 SUCCESS! Smart Cache is working correctly!');
      console.log('✅ WebSocket receives blocks');
      console.log('✅ Cache populates with block data');
      console.log('✅ Validators page loads from cache');
    } else if (hasBlocks && !usedCache) {
      console.log('⚠️  PARTIAL SUCCESS - Cache populates but validators page not using it');
      console.log('   This might be a timing issue. Try waiting longer.');
    } else if (!hasBlocks) {
      console.log('❌ FAILED - Cache not populating with blocks');
      console.log('   Check WebSocket connection and message routing');
    }
    console.log('='.repeat(60) + '\n');
    
    return { hasBlocks, usedCache, isConnected };
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return { error: error.message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testSmartCache().then(result => {
  process.exit(result.hasBlocks && result.usedCache ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

