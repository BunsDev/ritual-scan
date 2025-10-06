#!/usr/bin/env node

/**
 * Test if RealtimeWebSocketManager singleton persists across page navigation
 */

const { chromium } = require('playwright');

async function testSingletonPersistence() {
  console.log('🔬 Testing Singleton Persistence Across Navigation\n');
  console.log('='.repeat(80) + '\n');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const connectionIds = [];
  
  page.on('console', msg => {
    const text = msg.text();
    // Capture connection IDs
    const match = text.match(/conn_(\w+)/);
    if (match && !connectionIds.includes(match[0])) {
      connectionIds.push(match[0]);
      console.log(`📍 New connection ID detected: ${match[0]}`);
    }
  });
  
  try {
    console.log('1️⃣  Loading landing page...\n');
    await page.goto('http://localhost:5051', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    
    const landingManager = await page.evaluate(() => {
      const mgr = window.getRealtimeManager?.();
      return {
        connectionId: mgr?.getConnectionStatus?.().connectionId,
        blocksCount: mgr?.getCachedBlocks?.().length,
        exists: !!mgr
      };
    });
    
    console.log(`   Landing page manager:`);
    console.log(`     - Exists: ${landingManager.exists}`);
    console.log(`     - Connection ID: ${landingManager.connectionId}`);
    console.log(`     - Blocks cached: ${landingManager.blocksCount}`);
    console.log('');
    
    console.log('2️⃣  Navigating to validators (using Link click, not page.goto)...\n');
    
    // Click the Validators link in navigation instead of page.goto
    const validatorsLink = await page.locator('a[href="/validators"]').first();
    if (await validatorsLink.count() > 0) {
      await validatorsLink.click();
      console.log('   ✅ Clicked Validators link (client-side navigation)');
    } else {
      console.log('   ⚠️  Link not found, falling back to page.goto');
      await page.goto('http://localhost:5051/validators', { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    await page.waitForTimeout(3000);
    
    const validatorsManager = await page.evaluate(() => {
      const mgr = window.getRealtimeManager?.();
      return {
        connectionId: mgr?.getConnectionStatus?.().connectionId,
        blocksCount: mgr?.getCachedBlocks?.().length,
        exists: !!mgr
      };
    });
    
    console.log(`   Validators page manager:`);
    console.log(`     - Exists: ${validatorsManager.exists}`);
    console.log(`     - Connection ID: ${validatorsManager.connectionId}`);
    console.log(`     - Blocks cached: ${validatorsManager.blocksCount}`);
    console.log('');
    
    console.log('3️⃣  Navigating to blocks (using Link click)...\n');
    
    // Click the Blocks link in navigation
    const blocksLink = await page.locator('a[href="/blocks"]').first();
    if (await blocksLink.count() > 0) {
      await blocksLink.click();
      console.log('   ✅ Clicked Blocks link (client-side navigation)');
    } else {
      console.log('   ⚠️  Link not found, falling back to page.goto');
      await page.goto('http://localhost:5051/blocks', { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    await page.waitForTimeout(3000);
    
    const blocksManager = await page.evaluate(() => {
      const mgr = window.getRealtimeManager?.();
      return {
        connectionId: mgr?.getConnectionStatus?.().connectionId,
        blocksCount: mgr?.getCachedBlocks?.().length,
        exists: !!mgr
      };
    });
    
    console.log(`   Blocks page manager:`);
    console.log(`     - Exists: ${blocksManager.exists}`);
    console.log(`     - Connection ID: ${blocksManager.connectionId}`);
    console.log(`     - Blocks cached: ${blocksManager.blocksCount}`);
    console.log('');
    
    // Analysis
    console.log('='.repeat(80));
    console.log('📊 SINGLETON ANALYSIS\n');
    
    const sameInstance = landingManager.connectionId === validatorsManager.connectionId &&
                         validatorsManager.connectionId === blocksManager.connectionId;
    
    console.log(`Total unique connection IDs seen: ${connectionIds.length}`);
    console.log(`Connection IDs: ${connectionIds.join(', ')}`);
    console.log('');
    console.log(`Same instance across pages? ${sameInstance ? 'YES ✅' : 'NO ❌'}`);
    console.log('');
    console.log(`Landing → Validators:`);
    console.log(`  - Same ID? ${landingManager.connectionId === validatorsManager.connectionId ? 'YES' : 'NO'}`);
    console.log(`  - Cache persisted? ${validatorsManager.blocksCount >= landingManager.blocksCount ? 'YES' : 'NO'}`);
    console.log(`  - Blocks: ${landingManager.blocksCount} → ${validatorsManager.blocksCount}`);
    console.log('');
    console.log(`Validators → Blocks:`);
    console.log(`  - Same ID? ${validatorsManager.connectionId === blocksManager.connectionId ? 'YES' : 'NO'}`);
    console.log(`  - Cache persisted? ${blocksManager.blocksCount >= validatorsManager.blocksCount ? 'YES' : 'NO'}`);
    console.log(`  - Blocks: ${validatorsManager.blocksCount} → ${blocksManager.blocksCount}`);
    console.log('');
    
    if (!sameInstance) {
      console.log('❌ CRITICAL: Multiple manager instances detected!');
      console.log('   This breaks the singleton pattern and cache persistence.');
      console.log('   Each page is getting a fresh manager with empty cache.');
    } else if (validatorsManager.blocksCount === 0 && landingManager.blocksCount > 0) {
      console.log('❌ CRITICAL: Cache is being cleared on navigation!');
      console.log('   Instance persists but cache data is lost.');
    } else {
      console.log('✅ Singleton working correctly - same instance and cache persists');
    }
    
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testSingletonPersistence().then(() => process.exit(0));

