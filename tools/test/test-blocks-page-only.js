#!/usr/bin/env node

const { chromium } = require('playwright');

async function testBlocksPage() {
  console.log('🧪 Blocks Page Isolated Test\n');
  console.log('='.repeat(80) + '\n');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  const typeErrors = [];
  const logs = [];
  
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      if (!text.includes('WebGL') && !text.includes('DevTools')) {
        errors.push(text);
        console.log(`   ❌ ${text}`);
        if (text.includes('TypeError') || text.includes('undefined') || text.includes('Cannot read')) {
          typeErrors.push(text);
        }
      }
    } else if (text.includes('Blocks') || text.includes('cache')) {
      logs.push(text);
      console.log(`   📝 ${text}`);
    }
  });
  
  page.on('pageerror', error => {
    errors.push(`PAGE ERROR: ${error.message}`);
    console.log(`   💥 PAGE ERROR: ${error.message}`);
  });
  
  try {
    // Step 1: Load landing page to populate cache
    console.log('📍 Step 1: Loading landing page to populate cache...\n');
    await page.goto('http://localhost:5051', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(10000);
    
    const cacheState = await page.evaluate(() => window.debugWebSocketCache?.());
    console.log(`   ✅ Cache populated: ${cacheState?.cache?.blocksCount || 0} blocks\n`);
    
    // Step 2: Navigate to blocks page
    console.log('📍 Step 2: Navigating to blocks page...\n');
    errors.length = 0; // Reset errors for blocks page
    
    await page.goto('http://localhost:5051/blocks', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    
    // Step 3: Check for specific errors
    console.log('\n📊 Blocks Page Analysis:\n');
    
    const hasTypeErrors = typeErrors.length > 0;
    const hasUndefinedLengthError = errors.some(e => e.includes("Cannot read properties of undefined (reading 'length')"));
    const hasTransactionsError = errors.some(e => e.includes('transactions'));
    
    console.log(`   TypeError count: ${typeErrors.length}`);
    console.log(`   'undefined length' error: ${hasUndefinedLengthError ? 'YES ❌' : 'NO ✅'}`);
    console.log(`   'transactions' related: ${hasTransactionsError ? 'YES ❌' : 'NO ✅'}`);
    console.log(`   Total errors: ${errors.length}`);
    
    // Check if blocks are displayed
    const blocksDisplayed = await page.evaluate(() => {
      const blockItems = document.querySelectorAll('li');
      return blockItems.length;
    });
    
    console.log(`   Blocks displayed: ${blocksDisplayed > 0 ? `YES (${blocksDisplayed}) ✅` : 'NO ❌'}`);
    
    // Final verdict
    console.log('\n' + '='.repeat(80));
    
    if (errors.length === 0 && blocksDisplayed > 0) {
      console.log('🎉 SUCCESS: Blocks page working with no errors!');
      console.log('='.repeat(80));
      return 0;
    } else if (hasUndefinedLengthError || hasTransactionsError) {
      console.log('❌ FAILED: block.transactions.length error still present');
      console.log('='.repeat(80));
      return 1;
    } else if (errors.length > 0) {
      console.log(`⚠️  ${errors.length} errors detected (but not the original bug)`);
      console.log('='.repeat(80));
      return 1;
    } else {
      console.log('⚠️  Blocks not displayed');
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

testBlocksPage().then(code => process.exit(code));

