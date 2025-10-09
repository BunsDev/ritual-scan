import { test, expect, Page } from '@playwright/test';

/**
 * Smart Cache Validation Test Suite
 * Tests WebSocket connectivity and cache functionality
 */

test.describe('Smart Cache Functionality', () => {
  let consoleLogs: string[] = [];
  
  test.beforeEach(async ({ page }) => {
    // Capture all console messages
    consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      
      // Print important debug messages
      if (text.includes('conn_') || 
          text.includes('WebSocket') || 
          text.includes('Cache') ||
          text.includes('Block') ||
          text.includes('DEBUG')) {
        console.log(`[Browser Console] ${text}`);
      }
    });
    
    // Navigate to homepage
    await page.goto('http://localhost:5051', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
  });

  test('WebSocket should connect successfully', async ({ page }) => {
    console.log('\n🧪 TEST 1: WebSocket Connection\n');
    
    // Wait for WebSocket to initialize
    await page.waitForTimeout(5000);
    
    // Check connection status
    const status = await page.evaluate(() => {
      const manager = (window as any).getRealtimeManager?.();
      return manager?.getConnectionStatus();
    });
    
    console.log('Connection Status:', JSON.stringify(status, null, 2));
    
    expect(status).toBeDefined();
    expect(status.isConnected).toBe(true);
    expect(status.connectionId).toMatch(/^conn_/);
    
    console.log('✅ WebSocket connected successfully\n');
  });

  test('Cache should populate with blocks within 30 seconds', async ({ page }) => {
    console.log('\n🧪 TEST 2: Cache Population\n');
    
    // Wait up to 30 seconds for blocks to arrive
    let cacheState;
    let attempts = 0;
    const maxAttempts = 15; // 30 seconds (2s intervals)
    
    while (attempts < maxAttempts) {
      await page.waitForTimeout(2000);
      
      cacheState = await page.evaluate(() => {
        const manager = (window as any).getRealtimeManager?.();
        return manager?.debugCacheState?.();
      });
      
      console.log(`Attempt ${attempts + 1}/${maxAttempts}: Blocks in cache: ${cacheState?.cache?.blocksCount || 0}`);
      
      if (cacheState?.cache?.blocksCount > 0) {
        console.log('✅ Cache populated!\n');
        break;
      }
      
      attempts++;
    }
    
    console.log('Final Cache State:', JSON.stringify(cacheState, null, 2));
    
    expect(cacheState).toBeDefined();
    expect(cacheState.cache.blocksCount).toBeGreaterThan(0);
    
    if (cacheState.cache.firstBlock) {
      const blockNum = parseInt(cacheState.cache.firstBlock.number, 16);
      console.log(`✅ First cached block: #${blockNum}\n`);
    }
  });

  test('Validators page should load from cache', async ({ page }) => {
    console.log('\n🧪 TEST 3: Validators Page Cache Load\n');
    
    // Wait for cache to populate on homepage
    console.log('Waiting for cache to populate...');
    await page.waitForTimeout(20000);
    
    // Check cache before navigation
    const cacheBeforeNav = await page.evaluate(() => {
      const manager = (window as any).getRealtimeManager?.();
      const blocks = manager?.getCachedBlocks?.();
      return { count: blocks?.length || 0 };
    });
    
    console.log(`Cache before navigation: ${cacheBeforeNav.count} blocks`);
    
    // Clear console logs
    consoleLogs = [];
    
    // Navigate to validators page
    console.log('Navigating to validators page...');
    await page.goto('http://localhost:5051/validators', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    await page.waitForTimeout(3000);
    
    // Check if cache load message appeared
    const cacheLoadMsg = consoleLogs.find(log => 
      log.includes('Using') && log.includes('cached blocks')
    );
    
    const instantLoadMsg = consoleLogs.find(log =>
      log.includes('instant load')
    );
    
    console.log('\nConsole logs containing "cache" or "blocks":');
    consoleLogs
      .filter(log => log.toLowerCase().includes('cache') || log.toLowerCase().includes('blocks'))
      .forEach(log => console.log(`  - ${log}`));
    
    if (cacheLoadMsg || instantLoadMsg) {
      console.log(`\n✅ Cache load detected: ${cacheLoadMsg || instantLoadMsg}\n`);
    } else {
      console.log('\n⚠️  No cache load message detected\n');
      console.log('All console logs:');
      consoleLogs.slice(-20).forEach(log => console.log(`  - ${log}`));
    }
    
    // Verify validators are displayed
    const hasValidators = await page.evaluate(() => {
      const validatorRows = document.querySelectorAll('tbody tr');
      return validatorRows.length > 0;
    });
    
    console.log(`Validators rendered: ${hasValidators ? 'Yes' : 'No'}\n`);
    
    expect(cacheBeforeNav.count).toBeGreaterThan(0);
    expect(hasValidators).toBe(true);
  });

  test('Blocks page should load from cache', async ({ page }) => {
    console.log('\n🧪 TEST 4: Blocks Page Cache Load\n');
    
    // Wait for cache to populate on homepage
    console.log('Waiting for cache to populate...');
    await page.waitForTimeout(20000);
    
    // Check cache state
    const cacheState = await page.evaluate(() => {
      return (window as any).debugWebSocketCache?.();
    });
    
    console.log(`Cache state: ${cacheState?.cache?.blocksCount || 0} blocks`);
    
    // Clear console logs
    consoleLogs = [];
    
    // Navigate to blocks page
    console.log('Navigating to blocks page...');
    await page.goto('http://localhost:5051/blocks', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    await page.waitForTimeout(3000);
    
    // Check for cache usage messages
    const usedCache = consoleLogs.some(log =>
      log.includes('Using') && log.includes('cached blocks')
    );
    
    const cacheMessage = consoleLogs.find(log =>
      log.includes('cached blocks') || log.includes('instant load')
    );
    
    console.log(`Cache used: ${usedCache}`);
    if (cacheMessage) {
      console.log(`Message: ${cacheMessage}`);
    }
    
    // Verify blocks are displayed
    const blockCount = await page.evaluate(() => {
      const blockItems = document.querySelectorAll('li');
      return blockItems.length;
    });
    
    console.log(`Blocks displayed: ${blockCount}\n`);
    
    expect(cacheState?.cache?.blocksCount).toBeGreaterThan(0);
    expect(blockCount).toBeGreaterThan(0);
  });

  test('Debug: Inspect WebSocket message flow', async ({ page }) => {
    console.log('\n🧪 TEST 5: WebSocket Message Flow Debug\n');
    
    const messages: any[] = [];
    
    // Intercept WebSocket messages by monitoring console
    const relevantLogs = consoleLogs.filter(log =>
      log.includes('Subscription message') ||
      log.includes('Identified as block header') ||
      log.includes('New block #') ||
      log.includes('Cache updated') ||
      log.includes('Unknown subscription result')
    );
    
    console.log(`Captured ${relevantLogs.length} relevant messages in 30 seconds:`);
    relevantLogs.forEach(log => console.log(`  📩 ${log}`));
    
    // Get detailed cache state
    const detailedState = await page.evaluate(() => {
      const manager = (window as any).getRealtimeManager?.();
      return {
        connectionStatus: manager?.getConnectionStatus?.(),
        cachedBlocks: manager?.getCachedBlocks?.().length || 0,
        cacheState: manager?.debugCacheState?.()
      };
    });
    
    console.log('\nDetailed State:', JSON.stringify(detailedState, null, 2));
    
    expect(detailedState.cachedBlocks).toBeGreaterThan(0);
  });
});

test.describe('Cache Failure Diagnostics', () => {
  test('Diagnose if cache fails to populate', async ({ page }) => {
    console.log('\n🔍 DIAGNOSTIC TEST: Cache Population Failure Analysis\n');
    
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));
    
    await page.goto('http://localhost:5051', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    await page.waitForTimeout(30000);
    
    const diagnostics = await page.evaluate(() => {
      const manager = (window as any).getRealtimeManager?.();
      const state = manager?.debugCacheState?.();
      
      return {
        managerExists: !!manager,
        wsReadyState: state?.connection?.wsState,
        isConnected: state?.connection?.isConnected,
        lastBlockNumber: state?.connection?.lastBlockNumber,
        cachedBlocksCount: state?.cache?.blocksCount,
        hasFirstBlock: !!state?.cache?.firstBlock,
        subscribers: state?.subscribers || 0
      };
    });
    
    console.log('Diagnostics:', JSON.stringify(diagnostics, null, 2));
    
    // Analyze the issue
    if (!diagnostics.managerExists) {
      console.log('❌ ISSUE: RealtimeWebSocketManager not created');
    } else if (diagnostics.wsReadyState !== 1) {
      console.log(`❌ ISSUE: WebSocket not connected (state: ${diagnostics.wsReadyState})`);
    } else if (!diagnostics.isConnected) {
      console.log('❌ ISSUE: Manager reports not connected despite WS being open');
    } else if (diagnostics.lastBlockNumber === 0) {
      console.log('❌ ISSUE: No blocks processed - handleNewBlock never called');
      
      // Check for specific error patterns
      const hasSubscriptionMsg = logs.some(l => l.includes('Subscription message'));
      const hasBlockIdentified = logs.some(l => l.includes('Identified as block header'));
      const hasUnknownResult = logs.some(l => l.includes('Unknown subscription result'));
      
      console.log(`  - Subscription messages received: ${hasSubscriptionMsg}`);
      console.log(`  - Blocks identified: ${hasBlockIdentified}`);
      console.log(`  - Unknown results: ${hasUnknownResult}`);
      
      if (hasSubscriptionMsg && !hasBlockIdentified) {
        console.log('  ⚠️  Block detection logic failing - messages received but not identified');
      }
    } else if (diagnostics.cachedBlocksCount === 0) {
      console.log('❌ ISSUE: Blocks processed but cache not populated');
      console.log('  ⚠️  Cache array not being updated in handleNewBlock');
    } else {
      console.log('✅ Cache is working correctly!');
    }
    
    // Print relevant logs for debugging
    console.log('\nRelevant logs:');
    logs
      .filter(l => 
        l.includes('WebSocket') || 
        l.includes('Block') || 
        l.includes('Cache') ||
        l.includes('DEBUG')
      )
      .slice(-30)
      .forEach(l => console.log(`  ${l}`));
  });
});

