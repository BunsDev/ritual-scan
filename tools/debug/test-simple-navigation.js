const puppeteer = require('puppeteer');

async function testSimpleNavigation() {
  console.log('🔍 Testing Blocks → Transactions navigation (headless)');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  
  let consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log('❌ Console Error:', msg.text());
    }
  });

  try {
    // Step 1: Navigate to blocks page
    console.log('📍 Step 1: Navigate to /blocks');
    await page.goto('http://localhost:7038/blocks', { 
      waitUntil: 'domcontentloaded', 
      timeout: 10000 
    });
    
    // Step 2: Try to navigate to transactions via link click
    console.log('📍 Step 2: Look for transactions link');
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for page to load
    
    const transactionsLink = await page.$('a[href="/transactions"]');
    
    if (transactionsLink) {
      console.log('✅ Found transactions link in navigation');
      
      // Click the link  
      console.log('📍 Step 3: Click transactions link');
      
      // Try multiple clicking approaches
      try {
        await page.click('a[href="/transactions"]');
        console.log('✅ Used page.click() method');
      } catch (e) {
        console.log('❌ page.click() failed:', e.message);
        try {
          await page.evaluate(() => {
            document.querySelector('a[href="/transactions"]').click();
          });
          console.log('✅ Used evaluate click');
        } catch (e2) {
          console.log('❌ evaluate click failed:', e2.message);
        }
      }
      
      // Wait for navigation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const currentUrl = page.url();
      console.log('📍 Current URL after click:', currentUrl);
      
      if (currentUrl.includes('/transactions')) {
        console.log('✅ SUCCESS: Navigation from blocks to transactions works!');
      } else {
        console.log('❌ FAILED: Still on blocks page or other page');
      }
      
    } else {
      console.log('❌ FAILED: No transactions link found in navigation');
    }
    
    // Step 3: Test direct navigation as comparison
    console.log('📍 Step 4: Test direct navigation to /transactions');
    await page.goto('http://localhost:7038/transactions', { 
      waitUntil: 'domcontentloaded', 
      timeout: 10000 
    });
    
    const finalUrl = page.url();
    if (finalUrl.includes('/transactions')) {
      console.log('✅ Direct navigation to /transactions works');
    } else {
      console.log('❌ Direct navigation to /transactions failed');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  } finally {
    await browser.close();
    
    console.log('\n📊 SUMMARY');
    console.log('===========');
    console.log('Console errors found:', consoleErrors.length);
    
    if (consoleErrors.length > 0) {
      console.log('❌ Console errors:');
      consoleErrors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    } else {
      console.log('✅ No console errors detected');
    }
  }
}

testSimpleNavigation().catch(console.error);
