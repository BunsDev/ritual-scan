#!/usr/bin/env node

/**
 * Simulate REAL user flow with timing
 */

const { chromium } = require('playwright');

async function testRealUserFlow() {
  console.log('👤 Simulating Real User Flow\n');
  console.log('='.repeat(80) + '\n');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const events = [];
  
  page.on('console', msg => {
    const text = msg.text();
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    
    if (text.includes('Creating NEW') || text.includes('Reusing existing')) {
      events.push(`[${timestamp}] ${text}`);
      console.log(`🔧 ${text}`);
    }
    if (text.includes('getCachedBlocks called')) {
      const match = text.match(/returning (\d+) blocks/);
      events.push(`[${timestamp}] Cache check: ${match ? match[1] : '?'} blocks`);
      console.log(`📦 Cache check returned: ${match ? match[1] : '?'} blocks`);
    }
    if (text.includes('Using') && text.includes('cached blocks')) {
      events.push(`[${timestamp}] ✅ ${text}`);
      console.log(`✅ ${text}`);
    }
    if (text.includes('No cached blocks')) {
      events.push(`[${timestamp}] ❌ ${text}`);
      console.log(`❌ ${text}`);
    }
    if (text.includes('Cache updated:') && text.includes('blocks cached')) {
      const match = text.match(/(\d+) blocks cached/);
      console.log(`📊 Cache size: ${match ? match[1] : '?'} blocks`);
    }
  });
  
  try {
    console.log('1️⃣  User opens landing page and waits 15 seconds...\n');
    await page.goto('http://localhost:5051', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    for (let i = 1; i <= 15; i++) {
      await page.waitForTimeout(1000);
      if (i % 3 === 0) {
        const cache = await page.evaluate(() => {
          const mgr = window.__realtimeManager;
          return mgr ? mgr.getCachedBlocks().length : -1;
        });
        console.log(`   [+${i}s] Cache: ${cache} blocks`);
      }
    }
    
    const finalCache = await page.evaluate(() => {
      return {
        blocks: window.__realtimeManager?.getCachedBlocks()?.length || 0,
        connId: window.__realtimeManager?.getConnectionStatus()?.connectionId
      };
    });
    
    console.log(`\n   ✅ Landing page loaded, cache has ${finalCache.blocks} blocks`);
    console.log(`   📍 Connection ID: ${finalCache.connId}\n`);
    
    console.log('2️⃣  User clicks "Blocks" in navigation...\n');
    
    const blocksLink = await page.locator('a[href="/blocks"]').first();
    if (await blocksLink.isVisible()) {
      await blocksLink.click();
      console.log('   ✅ Clicked Blocks link\n');
    }
    
    await page.waitForTimeout(5000);
    
    const blocksCache = await page.evaluate(() => {
      return {
        blocks: window.__realtimeManager?.getCachedBlocks()?.length || 0,
        connId: window.__realtimeManager?.getConnectionStatus()?.connectionId
      };
    });
    
    console.log(`   📍 Blocks page Connection ID: ${blocksCache.connId}`);
    console.log(`   📦 Cache on blocks page: ${blocksCache.blocks} blocks`);
    console.log(`   🔗 Same instance? ${finalCache.connId === blocksCache.connId ? 'YES ✅' : 'NO ❌'}\n`);
    
    console.log('='.repeat(80));
    console.log('📋 EVENT TIMELINE:\n');
    events.forEach(e => console.log(e));
    console.log('='.repeat(80));
    
    if (finalCache.connId === blocksCache.connId && blocksCache.blocks > 0) {
      console.log('\n✅ SUCCESS: Singleton persists and cache available!');
    } else if (finalCache.connId !== blocksCache.connId) {
      console.log('\n❌ FAILED: New instance created on navigation!');
      console.log(`   Landing ID: ${finalCache.connId}`);
      console.log(`   Blocks ID: ${blocksCache.connId}`);
    } else {
      console.log('\n⚠️  Cache empty despite singleton persisting');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testRealUserFlow().then(() => process.exit(0));

