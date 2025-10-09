const puppeteer = require('puppeteer');

async function testBlocksToTransactions() {
  console.log('🔍 Testing specific navigation: Blocks → Transactions');
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser to see what's happening
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    slowMo: 1000, // Slow down actions to see them
  });

  const page = await browser.newPage();
  
  // Track all console messages
  page.on('console', msg => {
    console.log(`🖥️  [${msg.type()}] ${msg.text()}`);
  });

  // Track navigation
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      console.log(`📍 Navigated to: ${frame.url()}`);
    }
  });

  try {
    // Step 1: Go directly to blocks page
    console.log('📍 Step 1: Navigate directly to /blocks');
    await page.goto('http://localhost:7038/blocks', { 
      waitUntil: 'networkidle0', 
      timeout: 15000 
    });
    
    console.log('📍 Current URL:', page.url());
    
    // Step 2: Wait for page to fully load and check navigation
    await page.waitForTimeout(3000);
    
    // Check if navigation is present
    const navExists = await page.$('nav');
    console.log('🔍 Navigation element exists:', !!navExists);
    
    // Look for transaction link
    const transactionLink = await page.$('a[href="/transactions"]');
    console.log('🔍 Transaction link exists:', !!transactionLink);
    
    if (transactionLink) {
      // Check if link is visible
      const isVisible = await page.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return (
          rect.width > 0 && 
          rect.height > 0 && 
          window.getComputedStyle(el).visibility !== 'hidden'
        );
      }, transactionLink);
      
      console.log('🔍 Transaction link is visible:', isVisible);
      
      if (isVisible) {
        console.log('📍 Step 2: Click on Transactions tab');
        
        // Click and wait
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }),
          transactionLink.click()
        ]);
        
        console.log('📍 URL after click:', page.url());
        
        if (page.url().includes('/transactions')) {
          console.log('✅ Successfully navigated to transactions via tab click!');
        } else {
          console.log('❌ Tab click failed - still on:', page.url());
        }
      }
    } else {
      console.log('❌ Transaction link not found in navigation');
      
      // Debug: Show all links on the page
      const allLinks = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(a => ({
          href: a.href,
          text: a.textContent.trim(),
          visible: a.offsetParent !== null
        })).filter(link => link.text || link.href.includes('localhost'));
      });
      
      console.log('🔍 All links found:', allLinks);
    }
    
    // Keep browser open for manual inspection
    console.log('🔍 Browser will stay open for 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testBlocksToTransactions().catch(console.error);
