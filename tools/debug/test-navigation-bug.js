const puppeteer = require('puppeteer');

async function testNavigationBug() {
  console.log('🔍 Testing navigation bug: Blocks → Transactions');
  
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1920, height: 1080 },
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ]
  });

  const page = await browser.newPage();
  
  // Track console errors and network issues
  const errors = [];
  const networkErrors = [];

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    
    if (type === 'error') {
      errors.push({ type: 'console-error', message: text, timestamp: new Date().toISOString() });
      console.log('❌ Console Error:', text);
    }
  });

  page.on('response', response => {
    if (!response.ok() && response.url().includes('localhost')) {
      networkErrors.push({ 
        type: 'network-error', 
        url: response.url(), 
        status: response.status(),
        timestamp: new Date().toISOString() 
      });
      console.log('🌐 Network Error:', response.url(), response.status());
    }
  });

  try {
    console.log('📍 Step 1: Navigate to home page');
    await page.goto('http://localhost:7038/', { 
      waitUntil: 'domcontentloaded', 
      timeout: 10000 
    });
    
    console.log('📍 Step 2: Look for navigation elements');
    
    // Wait for page to load completely
    await page.waitForSelector('nav', { timeout: 5000 });
    
    // Check what navigation links are present
    const navLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links
        .filter(link => link.href.includes('localhost'))
        .map(link => ({ href: link.href, text: link.textContent }));
    });
    
    console.log('🔍 Found navigation links:', navLinks);
    
    // Look for blocks link with different selectors
    let blocksLink = await page.$('a[href="/blocks"]');
    if (!blocksLink) {
      console.log('🔍 Trying alternative selector for Blocks...');
      blocksLink = await page.$('a:contains("Blocks")');
    }
    if (!blocksLink) {
      console.log('🔍 Looking for any link containing "blocks"...');
      blocksLink = await page.evaluateHandle(() => {
        const links = Array.from(document.querySelectorAll('a'));
        return links.find(link => 
          link.href.includes('/blocks') || 
          link.textContent.toLowerCase().includes('blocks')
        );
      });
    }
    
    if (blocksLink) {
      console.log('📍 Step 2b: Click on Blocks tab');
      await blocksLink.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.log('❌ No blocks link found, navigating directly');
      await page.goto('http://localhost:7038/blocks', { waitUntil: 'domcontentloaded' });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    let currentUrl = page.url();
    console.log('📍 Current URL after Blocks click:', currentUrl);
    
    if (!currentUrl.includes('/blocks')) {
      console.log('❌ Failed to navigate to blocks page');
      return;
    }
    
    console.log('📍 Step 3: Click on Transactions tab from Blocks page');
    
    // Wait for the navigation to be ready
    await page.waitForSelector('a[href="/transactions"]', { timeout: 5000 });
    
    // Check if the transactions link is visible
    const transactionsLink = await page.$('a[href="/transactions"]');
    if (!transactionsLink) {
      console.log('❌ Transactions link not found');
      return;
    }
    
    // Try clicking the transactions tab
    console.log('🖱️  Clicking transactions tab...');
    await page.click('a[href="/transactions"]');
    
    // Wait for navigation
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    currentUrl = page.url();
    console.log('📍 URL after Transactions click:', currentUrl);
    
    if (currentUrl.includes('/transactions')) {
      console.log('✅ Successfully navigated to transactions page via tab click');
    } else {
      console.log('❌ Failed to navigate to transactions page via tab click');
      console.log('🔍 Checking page content...');
      
      const pageTitle = await page.title();
      console.log('📄 Page title:', pageTitle);
      
      const bodyText = await page.evaluate(() => {
        return document.body.innerText.substring(0, 200);
      });
      console.log('📝 Page content preview:', bodyText);
    }
    
    console.log('📍 Step 4: Test direct navigation to /transactions');
    await page.goto('http://localhost:7038/transactions', { 
      waitUntil: 'domcontentloaded', 
      timeout: 10000 
    });
    
    currentUrl = page.url();
    console.log('📍 URL after direct navigation:', currentUrl);
    
    if (currentUrl.includes('/transactions')) {
      console.log('✅ Direct navigation to /transactions works');
    } else {
      console.log('❌ Direct navigation to /transactions failed');
    }

  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
  } finally {
    await browser.close();
    
    console.log('\n📊 TEST SUMMARY');
    console.log('================');
    console.log('Console errors:', errors.length);
    console.log('Network errors:', networkErrors.length);
    
    if (errors.length > 0) {
      console.log('\n❌ Console Errors:');
      errors.forEach((error, i) => {
        console.log(`${i + 1}. ${error.message}`);
      });
    }
    
    if (networkErrors.length > 0) {
      console.log('\n🌐 Network Errors:');
      networkErrors.forEach((error, i) => {
        console.log(`${i + 1}. ${error.url} - ${error.status}`);
      });
    }
  }
}

testNavigationBug().catch(console.error);
