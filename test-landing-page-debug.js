#!/usr/bin/env node

/**
 * Landing Page Console Inspector
 * Navigates to landing page and reports all console messages and errors
 */

const { chromium } = require('playwright');

async function inspectLandingPage() {
  console.log('🔍 Landing Page Console Inspector\n');
  console.log('='.repeat(80));
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  const warnings = [];
  const logs = [];
  const debugMessages = [];
  
  // Capture console messages by type
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    
    if (type === 'error') {
      errors.push(text);
      console.log(`❌ ERROR: ${text}`);
    } else if (type === 'warning') {
      warnings.push(text);
      console.log(`⚠️  WARNING: ${text}`);
    } else if (text.includes('DEBUG') || text.includes('conn_')) {
      debugMessages.push(text);
      console.log(`🔍 ${text}`);
    } else if (text.includes('WebSocket') || text.includes('Cache') || text.includes('Block')) {
      logs.push(text);
      console.log(`📝 ${text}`);
    }
  });
  
  // Capture page errors
  page.on('pageerror', error => {
    console.log(`💥 PAGE ERROR: ${error.message}`);
    errors.push(`PAGE ERROR: ${error.message}`);
  });
  
  console.log('\n📍 Navigating to http://localhost:5051\n');
  
  try {
    await page.goto('http://localhost:5051', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    console.log('✅ Page loaded\n');
    console.log('⏳ Monitoring console for 30 seconds...\n');
    
    // Wait and monitor
    await page.waitForTimeout(30000);
    
    // Get cache state
    console.log('\n' + '='.repeat(80));
    console.log('📊 CACHE STATE CHECK\n');
    
    const cacheState = await page.evaluate(() => {
      try {
        return window.debugWebSocketCache?.();
      } catch (e) {
        return { error: e.message };
      }
    });
    
    console.log(JSON.stringify(cacheState, null, 2));
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📋 SUMMARY\n');
    console.log(`Total Errors: ${errors.length}`);
    console.log(`Total Warnings: ${warnings.length}`);
    console.log(`Debug Messages: ${debugMessages.length}`);
    console.log(`Cache Blocks: ${cacheState?.cache?.blocksCount || 0}`);
    console.log(`WebSocket Connected: ${cacheState?.connection?.isConnected || false}`);
    console.log(`Last Block: ${cacheState?.connection?.lastBlockNumber || 0}`);
    
    if (errors.length > 0) {
      console.log('\n❌ ERRORS DETECTED:');
      errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }
    
    if (warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      warnings.slice(0, 5).forEach((warn, i) => console.log(`  ${i + 1}. ${warn}`));
    }
    
    console.log('\n' + '='.repeat(80));
    
    if (errors.length === 0 && cacheState?.cache?.blocksCount > 0) {
      console.log('🎉 SUCCESS: Landing page working with no errors and cache populated!');
      return 0;
    } else if (errors.length > 0) {
      console.log('❌ FAILED: Errors detected on landing page');
      return 1;
    } else if (cacheState?.cache?.blocksCount === 0) {
      console.log('⚠️  PARTIAL: No errors but cache not populated');
      return 1;
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
    return 1;
  } finally {
    await browser.close();
  }
}

inspectLandingPage().then(code => process.exit(code));

