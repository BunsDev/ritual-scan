#!/usr/bin/env node

const { chromium } = require('playwright');

async function testDetailedTiming() {
  console.log('⏱️  Detailed Timing Analysis\n');
  console.log('='.repeat(80) + '\n');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const timeline = [];
  let startTime = Date.now();
  
  function logEvent(event) {
    const elapsed = Date.now() - startTime;
    timeline.push({ time: elapsed, event });
    console.log(`[+${(elapsed/1000).toFixed(2)}s] ${event}`);
  }
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Creating NEW') || text.includes('Reusing existing')) {
      logEvent(`CONSOLE: ${text}`);
    }
    if (text.includes('WebSocket connected')) {
      logEvent(`✅ WebSocket CONNECTED`);
    }
    if (text.includes('Cache updated:') && text.includes('blocks cached')) {
      const match = text.match(/(\d+) blocks cached/);
      if (match) {
        logEvent(`📦 Cache now has ${match[1]} blocks`);
      }
    }
    if (text.includes('loadCachedData called') || text.includes('getCachedBlocks called')) {
      logEvent(`🔍 Page checking cache...`);
    }
    if (text.includes('Got') && text.includes('cached blocks')) {
      const match = text.match(/Got (\d+) cached blocks/);
      if (match) {
        logEvent(`📊 Page found ${match[1]} blocks in cache`);
      }
    }
  });
  
  try {
    console.log('📍 Loading landing page...\n');
    startTime = Date.now();
    logEvent('🚀 Page.goto() called');
    
    await page.goto('http://localhost:5051', { waitUntil: 'domcontentloaded', timeout: 30000 });
    logEvent('📄 DOM Content Loaded');
    
    await page.waitForTimeout(10000);
    logEvent('⏸️  10 second wait complete');
    
    const cacheState = await page.evaluate(() => window.debugWebSocketCache?.());
    logEvent(`📦 Final cache state: ${cacheState?.cache?.blocksCount || 0} blocks`);
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 TIMING BREAKDOWN\n');
    
    const wsConnectTime = timeline.find(e => e.event.includes('WebSocket CONNECTED'));
    const firstBlockTime = timeline.find(e => e.event.includes('Cache now has'));
    
    if (wsConnectTime) {
      console.log(`✅ WebSocket connected at: +${(wsConnectTime.time/1000).toFixed(2)}s`);
    } else {
      console.log(`❌ WebSocket never connected in 10s window`);
    }
    
    if (firstBlockTime) {
      console.log(`📦 First block cached at: +${(firstBlockTime.time/1000).toFixed(2)}s`);
    } else {
      console.log(`❌ No blocks cached in 10s window`);
    }
    
    console.log(`\n⏰ Time to cache ready: ${firstBlockTime ? (firstBlockTime.time/1000).toFixed(2) : 'N/A'}s`);
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testDetailedTiming().then(() => process.exit(0));

