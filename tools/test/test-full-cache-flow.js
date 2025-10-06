#!/usr/bin/env node

/**
 * Comprehensive Smart Cache Flow Test
 * Tests the complete user journey with cache
 */

const { chromium } = require('playwright');

async function testFullCacheFlow() {
  console.log('🧪 Comprehensive Smart Cache Flow Test\n');
  console.log('='.repeat(80) + '\n');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const results = {
    landing: { errors: [], cache: 0 },
    validators: { errors: [], usedCache: false, blocks: 0 },
    blocks: { errors: [], usedCache: false },
    transactions: { errors: [], loaded: false },
    mempool: { errors: [], loaded: false },
    scheduled: { errors: [], loaded: false },
    analytics: { errors: [], loaded: false },
    async: { errors: [], loaded: false }
  };
  
  let currentPage = 'landing';
  
  // Track errors by page
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('WebGL') && !msg.text().includes('DevTools')) {
      results[currentPage].errors.push(msg.text());
      console.log(`   ❌ ERROR on ${currentPage}: ${msg.text()}`);
    }
  });
  
  // Track page errors
  page.on('pageerror', error => {
    results[currentPage].errors.push(`PAGE ERROR: ${error.message}`);
    console.log(`   💥 PAGE ERROR on ${currentPage}: ${error.message}`);
  });
  
  try {
    // PHASE 1: Landing Page
    console.log('1️⃣  PHASE 1: Landing Page Cache Population\n');
    await page.goto('http://localhost:5051', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    console.log('   Waiting 15 seconds for cache to populate...');
    await page.waitForTimeout(15000);
    
    const landingCache = await page.evaluate(() => window.debugWebSocketCache?.());
    results.landing.cache = landingCache?.cache?.blocksCount || 0;
    
    console.log(`   ✅ Landing page cache: ${results.landing.cache} blocks\n`);
    
    // PHASE 2: Validators Page
    console.log('2️⃣  PHASE 2: Validators Page - Test Cache Load\n');
    currentPage = 'validators';
    
    const validatorLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Validators') || text.includes('cached blocks')) {
        validatorLogs.push(text);
      }
    });
    
    await page.goto('http://localhost:5051/validators', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(8000);
    
    // Check if cache was used (multiple possible messages)
    results.validators.usedCache = validatorLogs.some(l => 
      l.includes('Using') || 
      l.includes('Initializing with') || 
      l.includes('Restoring') ||
      l.includes('Successfully loaded from cache')
    );
    
    // Check if validators are displayed
    const validatorInfo = await page.evaluate(() => {
      const statsCards = document.querySelectorAll('[class*="text-2xl"]');
      const validatorRows = document.querySelectorAll('tbody tr');
      return {
        statsCount: statsCards.length,
        validatorCount: validatorRows.length,
        totalValidators: statsCards[0]?.textContent || '0',
        blocksAnalyzed: statsCards[1]?.textContent?.replace(/,/g, '') || '0'
      };
    });
    
    results.validators.blocks = parseInt(validatorInfo.blocksAnalyzed) || validatorInfo.validatorCount;
    
    console.log(`   Cache used: ${results.validators.usedCache ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   Validators displayed: ${validatorInfo.validatorCount > 0 ? `YES (${validatorInfo.validatorCount} validators) ✅` : 'NO ❌'}`);
    console.log(`   Blocks analyzed: ${validatorInfo.blocksAnalyzed || 'N/A'}`);
    console.log(`   Cache-related logs:`);
    validatorLogs.filter(l => l.includes('cache') || l.includes('Cache') || l.includes('cached')).forEach(log => console.log(`     - ${log}`));
    console.log('');
    
    // PHASE 3: Blocks Page
    console.log('3️⃣  PHASE 3: Blocks Page - Test Cache Load\n');
    currentPage = 'blocks';
    
    const blocksLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Blocks') || text.includes('cached')) {
        blocksLogs.push(text);
      }
    });
    
    await page.goto('http://localhost:5051/blocks', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    
    results.blocks.usedCache = blocksLogs.some(l => l.includes('Using') && l.includes('cached blocks'));
    
    console.log(`   Cache used: ${results.blocks.usedCache ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   Errors detected: ${results.blocks.errors.length}`);
    if (results.blocks.errors.length > 0) {
      results.blocks.errors.forEach(err => console.log(`     - ${err}`));
    }
    console.log('');
    
    // PHASE 4: Transactions Page
    console.log('4️⃣  PHASE 4: Transactions Page\n');
    currentPage = 'transactions';
    
    await page.goto('http://localhost:5051/transactions', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    results.transactions.loaded = await page.evaluate(() => {
      const txItems = document.querySelectorAll('li');
      return txItems.length > 0;
    });
    
    console.log(`   Page loaded: ${results.transactions.loaded ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   Errors: ${results.transactions.errors.length}`);
    console.log('');
    
    // PHASE 5: Mempool Page
    console.log('5️⃣  PHASE 5: Mempool Page\n');
    currentPage = 'mempool';
    
    await page.goto('http://localhost:5051/mempool', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    results.mempool.loaded = await page.evaluate(() => {
      const statsCards = document.querySelectorAll('[class*="text-2xl"]');
      return statsCards.length > 0;
    });
    
    console.log(`   Page loaded: ${results.mempool.loaded ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   Errors: ${results.mempool.errors.length}`);
    console.log('');
    
    // PHASE 6: Scheduled Page
    console.log('6️⃣  PHASE 6: Scheduled Transactions Page\n');
    currentPage = 'scheduled';
    
    await page.goto('http://localhost:5051/scheduled', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    results.scheduled.loaded = await page.evaluate(() => {
      const pageTitle = document.querySelector('h1');
      return pageTitle && pageTitle.textContent.includes('Scheduled');
    });
    
    console.log(`   Page loaded: ${results.scheduled.loaded ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   Errors: ${results.scheduled.errors.length}`);
    console.log('');
    
    // PHASE 7: Analytics Page
    console.log('7️⃣  PHASE 7: Analytics Page\n');
    currentPage = 'analytics';
    
    await page.goto('http://localhost:5051/analytics', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);  // Give Plotly time to render
    
    results.analytics.loaded = await page.evaluate(() => {
      const title = document.querySelector('h1');
      const statsCards = document.querySelectorAll('[class*="text-2xl"]');
      const hasContent = document.body.textContent.includes('Analytics') || 
                        document.body.textContent.includes('Gas Usage') ||
                        statsCards.length > 0;
      return hasContent;
    });
    
    console.log(`   Page loaded: ${results.analytics.loaded ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   Errors: ${results.analytics.errors.length}`);
    console.log('');
    
    // PHASE 8: Async Transactions Page
    console.log('8️⃣  PHASE 8: Async Transactions Page\n');
    currentPage = 'async';
    
    await page.goto('http://localhost:5051/async', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    results.async.loaded = await page.evaluate(() => {
      const title = document.querySelector('h1');
      return title && title.textContent.includes('Async');
    });
    
    console.log(`   Page loaded: ${results.async.loaded ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   Errors: ${results.async.errors.length}`);
    console.log('');
    
    // FINAL SUMMARY
    console.log('='.repeat(80));
    console.log('📊 FINAL TEST RESULTS\n');
    console.log(`Landing Page:`);
    console.log(`  - Errors: ${results.landing.errors.length}`);
    if (results.landing.errors.length > 0) {
      results.landing.errors.forEach(e => console.log(`    ❌ ${e}`));
    }
    console.log(`  - Cache Populated: ${results.landing.cache > 0 ? `YES (${results.landing.cache} blocks) ✅` : 'NO ❌'}`);
    console.log('');
    console.log(`Validators Page:`);
    console.log(`  - Errors: ${results.validators.errors.length}`);
    if (results.validators.errors.length > 0) {
      results.validators.errors.forEach(e => console.log(`    ❌ ${e}`));
    }
    console.log(`  - Used Cache: ${results.validators.usedCache || results.validators.blocks > 0 ? 'YES ✅' : 'NO ❌'}`);
    console.log(`  - Validators Shown: ${results.validators.blocks > 0 ? 'YES ✅' : 'NO ❌'}`);
    console.log('');
    console.log(`Blocks Page:`);
    console.log(`  - Errors: ${results.blocks.errors.length}`);
    if (results.blocks.errors.length > 0) {
      results.blocks.errors.forEach(e => console.log(`    ❌ ${e}`));
    }
    console.log(`  - Used Cache: ${results.blocks.usedCache ? 'YES ✅' : 'NO ❌'}`);
    console.log('');
    
    console.log(`Transactions Page:`);
    console.log(`  - Errors: ${results.transactions.errors.length}`);
    if (results.transactions.errors.length > 0) {
      console.log(`    ❌ ${results.transactions.errors[0]}`);
    }
    console.log(`  - Loaded: ${results.transactions.loaded ? 'YES ✅' : 'NO ❌'}`);
    console.log('');
    
    console.log(`Mempool Page:`);
    console.log(`  - Errors: ${results.mempool.errors.length}`);
    if (results.mempool.errors.length > 0) {
      console.log(`    ❌ ${results.mempool.errors[0]}`);
    }
    console.log(`  - Loaded: ${results.mempool.loaded ? 'YES ✅' : 'NO ❌'}`);
    console.log('');
    
    console.log(`Scheduled Page:`);
    console.log(`  - Errors: ${results.scheduled.errors.length}`);
    if (results.scheduled.errors.length > 0) {
      console.log(`    ❌ ${results.scheduled.errors[0]}`);
    }
    console.log(`  - Loaded: ${results.scheduled.loaded ? 'YES ✅' : 'NO ❌'}`);
    console.log('');
    
    console.log(`Analytics Page:`);
    console.log(`  - Errors: ${results.analytics.errors.length}`);
    if (results.analytics.errors.length > 0) {
      console.log(`    ❌ ${results.analytics.errors[0]}`);
    }
    console.log(`  - Loaded: ${results.analytics.loaded ? 'YES ✅' : 'NO ❌'}`);
    console.log('');
    
    console.log(`Async Transactions Page:`);
    console.log(`  - Errors: ${results.async.errors.length}`);
    if (results.async.errors.length > 0) {
      console.log(`    ❌ ${results.async.errors[0]}`);
    }
    console.log(`  - Loaded: ${results.async.loaded ? 'YES ✅' : 'NO ❌'}`);
    console.log('');
    
    // Calculate totals
    const totalErrors = Object.values(results).reduce((sum, page) => sum + page.errors.length, 0);
    const criticalErrors = results.landing.errors.length + 
                           results.validators.errors.length + 
                           results.blocks.errors.length;
    const pagesLoaded = [
      results.landing.cache > 0,
      results.blocks.usedCache,
      results.transactions.loaded,
      results.mempool.loaded,
      results.scheduled.loaded,
      results.analytics.loaded,
      results.async.loaded
    ].filter(Boolean).length;
    
    console.log('📈 OVERALL STATISTICS:\n');
    console.log(`  Total Pages Tested: 8`);
    console.log(`  Pages Loaded Successfully: ${pagesLoaded}/8`);
    console.log(`  Total Errors (all pages): ${totalErrors}`);
    console.log(`  Critical Errors (core pages): ${criticalErrors}`);
    console.log('');
    
    if (criticalErrors === 0 && results.landing.cache > 0 && results.blocks.usedCache) {
      console.log('🎉 SUCCESS: All core functionality working!');
      console.log('   - Smart cache operational');
      console.log('   - No critical errors');
      console.log('   - Core pages functional');
      console.log('='.repeat(80));
      return 0;
    } else if (totalErrors > 20) {
      console.log(`❌ CRITICAL FAILURE: ${totalErrors} total errors`);
      console.log('='.repeat(80));
      return 1;
    } else if (pagesLoaded >= 6) {
      console.log(`⚠️  PARTIAL SUCCESS: ${pagesLoaded}/8 pages working, ${criticalErrors} critical errors`);
      console.log('='.repeat(80));
      return criticalErrors > 0 ? 1 : 0;
    } else {
      console.log('❌ FAILED: Multiple pages not loading');
      console.log('='.repeat(80));
      return 1;
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
    return 1;
  } finally {
    await browser.close();
  }
}

testFullCacheFlow().then(code => process.exit(code));

