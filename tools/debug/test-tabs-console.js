const puppeteer = require('puppeteer');

async function testTabsForConsoleErrors() {
  let browser;
  const consoleErrors = [];
  const consoleWarnings = [];
  const networkErrors = [];
  
  try {
    console.log('🚀 Starting Puppeteer tab testing...');
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: true, // Running in headless mode for server environment
      defaultViewport: { width: 1920, height: 1080 },
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    const page = await browser.newPage();
    
    // Listen for console messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      
      if (type === 'error') {
        consoleErrors.push({ type: 'console-error', message: text, timestamp: new Date().toISOString() });
        console.log('❌ Console Error:', text);
      } else if (type === 'warning') {
        consoleWarnings.push({ type: 'console-warning', message: text, timestamp: new Date().toISOString() });
        console.log('⚠️  Console Warning:', text);
      }
    });

    // Listen for page errors
    page.on('pageerror', error => {
      consoleErrors.push({ type: 'page-error', message: error.message, timestamp: new Date().toISOString() });
      console.log('💥 Page Error:', error.message);
    });

    // Listen for failed requests
    page.on('requestfailed', request => {
      networkErrors.push({ 
        type: 'network-error', 
        url: request.url(), 
        errorText: request.failure().errorText,
        timestamp: new Date().toISOString() 
      });
      console.log('🌐 Network Error:', request.url(), '-', request.failure().errorText);
    });

    // Navigate to the application
    console.log('📍 Navigating to http://localhost:7038...');
    
    try {
      await page.goto('http://localhost:7038', { 
        waitUntil: 'domcontentloaded', 
        timeout: 15000 
      });
    } catch (error) {
      console.log('⚠️  Initial navigation failed, trying with different wait condition...');
      await page.goto('http://localhost:7038', { 
        waitUntil: 'load', 
        timeout: 10000 
      });
    }
    
    // Wait for initial load and any React hydration
    console.log('⏳ Waiting for page to fully load...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('🔍 Looking for navigation tabs...');
    
    // First, let's see what the page title is and get basic page info
    const pageTitle = await page.title();
    const pageUrl = page.url();
    console.log(`📄 Page loaded: "${pageTitle}" at ${pageUrl}`);
    
    // Try to find tabs - they might be in different structures
    const tabSelectors = [
      'nav a', // Common nav links
      '[role="tab"]', // ARIA tabs
      '.tab', // Class-based tabs
      '[data-tab]', // Data attribute tabs
      'header nav a', // Header navigation links
      '.nav-link', // Bootstrap-style nav links
      'button[role="tab"]', // Button tabs
      '.tabs button', // Tailwind tab buttons
      'nav button', // Navigation buttons
      'a[href^="/"]' // Internal links starting with /
    ];

    let tabs = [];
    
    // Try each selector to find tabs
    for (const selector of tabSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          console.log(`✅ Found ${elements.length} elements with selector: ${selector}`);
          
          // Get text content and href/onclick for each element
          for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            const text = await page.evaluate(el => el.textContent?.trim() || el.innerText?.trim() || '', element);
            const href = await page.evaluate(el => el.href || el.getAttribute('href') || '', element);
            const tag = await page.evaluate(el => el.tagName.toLowerCase(), element);
            
            if (text && text.length > 0) {
              tabs.push({
                element,
                text,
                href,
                tag,
                selector,
                index: i
              });
            }
          }
          break; // Use the first successful selector
        }
      } catch (error) {
        // Continue to next selector
      }
    }

    if (tabs.length === 0) {
      console.log('⚠️  No tabs found, trying to find any clickable navigation elements...');
      
      // Fallback: look for any clickable elements that might be navigation
      const fallbackElements = await page.$$('a, button[type="button"], [onclick], [data-testid*="tab"], [data-testid*="nav"]');
      
      for (const element of fallbackElements) {
        const text = await page.evaluate(el => el.textContent?.trim() || el.innerText?.trim() || '', element);
        const href = await page.evaluate(el => el.href || el.getAttribute('href') || '', element);
        
        if (text && text.length > 0 && text.length < 50) { // Reasonable tab text length
          tabs.push({
            element,
            text,
            href,
            tag: await page.evaluate(el => el.tagName.toLowerCase(), element),
            selector: 'fallback',
            index: tabs.length
          });
        }
      }
    }

    console.log(`📋 Found ${tabs.length} potential navigation elements:`);
    tabs.forEach((tab, index) => {
      console.log(`  ${index + 1}. "${tab.text}" (${tab.tag}) - ${tab.href || 'no href'}`);
    });

    if (tabs.length === 0) {
      console.log('❌ No tabs or navigation elements found to test');
      return;
    }

    // Test each tab
    console.log('\n🧪 Starting tab testing...');
    
    for (let i = 0; i < Math.min(tabs.length, 10); i++) { // Limit to first 10 to avoid infinite loops
      const tab = tabs[i];
      console.log(`\n${i + 1}/${Math.min(tabs.length, 10)} Testing: "${tab.text}"`);
      
      try {
        // Clear previous errors for this tab test
        const initialErrorCount = consoleErrors.length;
        const initialWarningCount = consoleWarnings.length;
        
        // Click the tab/link
        await tab.element.click();
        
        // Wait for navigation or content change
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Wait for any additional network requests
        try {
          await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 3000 });
        } catch {
          // Navigation might not trigger, just wait a bit more
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Check if new errors occurred
        const newErrors = consoleErrors.length - initialErrorCount;
        const newWarnings = consoleWarnings.length - initialWarningCount;
        
        if (newErrors > 0) {
          console.log(`  ❌ ${newErrors} new console error(s) detected`);
        } else if (newWarnings > 0) {
          console.log(`  ⚠️  ${newWarnings} new console warning(s) detected`);
        } else {
          console.log(`  ✅ No console errors detected`);
        }
        
        // Get current URL for reference
        const currentUrl = page.url();
        console.log(`  📍 Current URL: ${currentUrl}`);
        
      } catch (error) {
        console.log(`  💥 Error clicking tab "${tab.text}": ${error.message}`);
        consoleErrors.push({
          type: 'puppeteer-error',
          message: `Failed to click tab "${tab.text}": ${error.message}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Generate summary report
    console.log('\n📊 TEST SUMMARY');
    console.log('===============');
    console.log(`✅ Tabs tested: ${Math.min(tabs.length, 10)}`);
    console.log(`❌ Console errors: ${consoleErrors.length}`);
    console.log(`⚠️  Console warnings: ${consoleWarnings.length}`);
    console.log(`🌐 Network errors: ${networkErrors.length}`);

    if (consoleErrors.length > 0) {
      console.log('\n❌ CONSOLE ERRORS DETECTED:');
      consoleErrors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.type}] ${error.message}`);
      });
    }

    if (consoleWarnings.length > 0) {
      console.log('\n⚠️  CONSOLE WARNINGS DETECTED:');
      consoleWarnings.forEach((warning, index) => {
        console.log(`${index + 1}. [${warning.type}] ${warning.message}`);
      });
    }

    if (networkErrors.length > 0) {
      console.log('\n🌐 NETWORK ERRORS DETECTED:');
      networkErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.url} - ${error.errorText}`);
      });
    }

    if (consoleErrors.length === 0 && networkErrors.length === 0) {
      console.log('\n🎉 SUCCESS: No critical errors found!');
    }

  } catch (error) {
    console.error('💥 Test execution failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testTabsForConsoleErrors().catch(console.error);
