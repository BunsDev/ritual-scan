#!/usr/bin/env node

const { chromium } = require('playwright');

async function testWindowStorage() {
  console.log('🧪 Testing window.__realtimeManager Storage\n');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:5051', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Check if window.__realtimeManager exists
    const test1 = await page.evaluate(() => {
      return {
        exists: !!window.__realtimeManager,
        type: typeof window.__realtimeManager,
        connectionId: window.__realtimeManager?.getConnectionStatus?.().connectionId,
        cacheSize: window.__realtimeManager?.getCachedBlocks?.().length
      };
    });
    
    console.log('After initial load:');
    console.log(`  window.__realtimeManager exists: ${test1.exists}`);
    console.log(`  Type: ${test1.type}`);
    console.log(`  Connection ID: ${test1.connectionId}`);
    console.log(`  Cache size: ${test1.cacheSize}`);
    console.log('');
    
    // Try calling getRealtimeManager() again
    const test2 = await page.evaluate(() => {
      const mgr = window.getRealtimeManager();
      return {
        connectionId: mgr.getConnectionStatus().connectionId,
        cacheSize: mgr.getCachedBlocks().length,
        sameInstance: window.__realtimeManager === mgr
      };
    });
    
    console.log('After calling getRealtimeManager() again:');
    console.log(`  Connection ID: ${test2.connectionId}`);
    console.log(`  Cache size: ${test2.cacheSize}`);
    console.log(`  Same instance as window.__realtimeManager: ${test2.sameInstance}`);
    console.log(`  IDs match: ${test1.connectionId === test2.connectionId}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testWindowStorage().then(() => process.exit(0));

