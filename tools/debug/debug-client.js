#!/usr/bin/env node

const puppeteer = require('puppeteer');

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: false, 
      devtools: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Listen for console messages (including errors)
    page.on('console', msg => {
      console.log(`BROWSER ${msg.type().toUpperCase()}: ${msg.text()}`);
    });
    
    // Listen for page errors
    page.on('pageerror', error => {
      console.log('PAGE ERROR:', error.message);
      console.log('STACK:', error.stack);
    });
    
    // Listen for failed requests
    page.on('requestfailed', request => {
      console.log('REQUEST FAILED:', request.url(), request.failure().errorText);
    });
    
    console.log('Navigating to homepage...');
    await page.goto('http://localhost:9000', { waitUntil: 'networkidle2', timeout: 10000 });
    
    console.log('Waiting 3 seconds for JavaScript to load...');
    await page.waitForTimeout(3000);
    
    console.log('Checking if page loaded properly...');
    const title = await page.title();
    console.log('Page title:', title);
    
    // Try to find key elements
    try {
      await page.waitForSelector('h1', { timeout: 5000 });
      console.log('✅ H1 element found');
    } catch (e) {
      console.log('❌ H1 element not found');
    }
    
    // Check for error messages
    const errorElements = await page.$$('.error, [class*="error"]');
    if (errorElements.length > 0) {
      console.log(`Found ${errorElements.length} error elements`);
    }
    
    console.log('Test completed. Browser will stay open for manual inspection.');
    console.log('Press Ctrl+C to close.');
    
    // Keep browser open for manual inspection
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Script error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
