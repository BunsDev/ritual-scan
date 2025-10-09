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
      headless: true,
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
      
      // Filter out some common non-critical messages
      if (text.includes('Download the React DevTools') || 
          text.includes('chunk-') || 
          text.includes('webpack-internal') ||
          text.includes('35.185.40.237') || // Old IP connection errors
          text.includes('130.211.246.58')) { // Old secondary IP connection errors
        return;
      }
      
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
    
    await page.goto('http://localhost:7038', { 
      waitUntil: 'domcontentloaded', 
      timeout: 15000 
    });
    
    // Wait for initial load and React hydration
    console.log('⏳ Waiting for page to fully load...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const pageTitle = await page.title();
    console.log(`📄 Page loaded: "${pageTitle}"`);

    // Define the tab URLs we want to test based on the navigation we saw
    const tabUrls = [
      { name: 'Home', url: 'http://localhost:7038/' },
      { name: 'Blocks', url: 'http://localhost:7038/blocks' },
      { name: 'Transactions', url: 'http://localhost:7038/transactions' },
      { name: 'Mempool', url: 'http://localhost:7038/mempool' },
      { name: 'Scheduled', url: 'http://localhost:7038/scheduled' },
      { name: 'Async', url: 'http://localhost:7038/async' },
      { name: 'Charts', url: 'http://localhost:7038/analytics' },
      { name: 'Stats', url: 'http://localhost:7038/ritual-analytics' },
      { name: 'Settings', url: 'http://localhost:7038/settings' }
    ];

    console.log(`📋 Found ${tabUrls.length} tabs to test:`);
    tabUrls.forEach((tab, index) => {
      console.log(`  ${index + 1}. "${tab.name}" - ${tab.url}`);
    });

    console.log('\n🧪 Starting tab testing...');
    
    for (let i = 0; i < tabUrls.length; i++) {
      const tab = tabUrls[i];
      console.log(`\n${i + 1}/${tabUrls.length} Testing: "${tab.name}"`);
      
      try {
        // Clear previous errors for this tab test
        const initialErrorCount = consoleErrors.length;
        const initialWarningCount = consoleWarnings.length;
        const initialNetworkErrorCount = networkErrors.length;
        
        // Navigate directly to the tab URL
        await page.goto(tab.url, { 
          waitUntil: 'domcontentloaded', 
          timeout: 10000 
        });
        
        // Wait for the page to load and stabilize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Wait for any network requests to complete
        try {
          await page.waitForLoadState?.('networkidle', { timeout: 3000 });
        } catch {
          // Not available in all Puppeteer versions, continue
        }
        
        // Check if new errors occurred
        const newErrors = consoleErrors.length - initialErrorCount;
        const newWarnings = consoleWarnings.length - initialWarningCount;
        const newNetworkErrors = networkErrors.length - initialNetworkErrorCount;
        
        if (newErrors > 0) {
          console.log(`  ❌ ${newErrors} new console error(s) detected`);
        } else if (newWarnings > 0) {
          console.log(`  ⚠️  ${newWarnings} new console warning(s) detected`);
        } else if (newNetworkErrors > 0) {
          console.log(`  🌐 ${newNetworkErrors} new network error(s) detected`);
        } else {
          console.log(`  ✅ No errors detected`);
        }
        
        // Get current URL for verification
        const currentUrl = page.url();
        console.log(`  📍 Current URL: ${currentUrl}`);
        
        // Try to find any specific elements that might indicate the page loaded correctly
        const hasContent = await page.evaluate(() => {
          const body = document.body;
          return body && body.innerText && body.innerText.trim().length > 0;
        });
        
        if (hasContent) {
          console.log(`  📝 Page has content`);
        } else {
          console.log(`  ⚠️  Page appears empty`);
        }
        
      } catch (error) {
        console.log(`  💥 Error navigating to "${tab.name}": ${error.message}`);
        consoleErrors.push({
          type: 'navigation-error',
          message: `Failed to navigate to "${tab.name}": ${error.message}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Generate summary report
    console.log('\n📊 TEST SUMMARY');
    console.log('===============');
    console.log(`✅ Tabs tested: ${tabUrls.length}`);
    console.log(`❌ Console errors: ${consoleErrors.length}`);
    console.log(`⚠️  Console warnings: ${consoleWarnings.length}`);
    console.log(`🌐 Network errors: ${networkErrors.length}`);

    if (consoleErrors.length > 0) {
      console.log('\n❌ CONSOLE/PAGE ERRORS DETECTED:');
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
    } else if (consoleWarnings.length > 0 && consoleErrors.length === 0) {
      console.log('\n🟡 WARNINGS ONLY: No critical errors, but some warnings found.');
    } else {
      console.log('\n🔴 ISSUES FOUND: Please review the errors above.');
    }

    // Create a simple report object
    const report = {
      totalTabs: tabUrls.length,
      consoleErrors: consoleErrors.length,
      consoleWarnings: consoleWarnings.length,
      networkErrors: networkErrors.length,
      timestamp: new Date().toISOString(),
      details: {
        consoleErrors,
        consoleWarnings,
        networkErrors
      }
    };

    return report;

  } catch (error) {
    console.error('💥 Test execution failed:', error.message);
    return { error: error.message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testTabsForConsoleErrors().then(report => {
  console.log('\n📋 Final Report:', JSON.stringify(report, null, 2));
}).catch(console.error);
