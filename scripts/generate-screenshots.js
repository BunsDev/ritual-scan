const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

const BASE_URL = process.env.SCREENSHOT_URL || 'https://ding.fish';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');
const PASSWORD = 'notthelastlayer1~';

const pages = [
  {
    name: 'homepage',
    url: '/',
    title: 'Homepage Dashboard',
    description: 'Real-time network overview with latest blocks, transactions, and live stats',
    waitTime: 30000
  },
  {
    name: 'charts',
    url: '/charts',
    title: 'Charts Dashboard',
    description: 'Visual analytics with gas usage, transaction counts, and performance metrics',
    waitTime: 60000
  },
  {
    name: 'stats',
    url: '/stats',
    title: 'Ritual Chain Stats',
    description: 'Async adoption metrics, protocol fees, and transaction type distribution',
    waitTime: 60000
  },
  {
    name: 'blocks',
    url: '/blocks',
    title: 'Block Explorer',
    description: 'Real-time block list with live updates via WebSocket',
    waitTime: 30000
  },
  {
    name: 'validators',
    url: '/validators',
    title: 'Validator Network Map',
    description: 'Geographic visualization of validator network with activity metrics',
    waitTime: 30000
  },
  {
    name: 'leaderboard',
    url: '/leaderboard',
    title: 'Network Leaderboard',
    description: 'Top validators and network participants ranked by activity',
    waitTime: 30000
  },
  {
    name: 'mempool',
    url: '/mempool',
    title: 'Live Mempool Monitor',
    description: 'Real-time pending transactions and scheduled jobs',
    waitTime: 30000
  },
  {
    name: 'mempool-scheduled',
    url: '/mempool',
    title: 'Scheduled Transactions',
    description: 'Scheduled transactions waiting to execute',
    waitTime: 30000,
    clickTab: 'Scheduled'
  },
  {
    name: 'mempool-async',
    url: '/mempool',
    title: 'Async Transactions',
    description: 'Async commitment and settlement transactions',
    waitTime: 30000,
    clickTab: 'Async'
  },
  {
    name: 'settings',
    url: '/settings',
    title: 'RPC Configuration',
    description: 'User-configurable RPC endpoints with connection testing',
    waitTime: 30000
  }
];

async function ensureDirectoryExists(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

async function generateScreenshots() {
  console.log(`🔄 Starting screenshot generation from ${BASE_URL}...`);
  
  await ensureDirectoryExists(SCREENSHOT_DIR);

  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: {
      width: 1920,
      height: 1080
    },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process'
    ]
  });

  const page = await browser.newPage();
  
  // Set user agent
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Handle password authentication if needed
  let authenticated = false;
  
  let successCount = 0;
  let errorCount = 0;

  for (const pageInfo of pages) {
    try {
      console.log(`📸 Capturing ${pageInfo.name}...`);
      
      // Navigate to the page with minimal wait first
      await page.goto(`${BASE_URL}${pageInfo.url}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Handle password prompt on first page load IMMEDIATELY
      if (!authenticated) {
        console.log(`   Checking for password prompt...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        const passwordInput = await page.$('input[type="password"]');
        if (passwordInput) {
          console.log(`   Entering password...`);
          await page.type('input[type="password"]', PASSWORD);
          await page.keyboard.press('Enter');
          console.log(`   Waiting for authentication...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          authenticated = true;
          console.log(`   ✅ Authenticated successfully`);
        }
      }
      
      // Now wait for network to settle after authentication
      try {
        await page.waitForNetworkIdle({ timeout: 10000, idleTime: 500 });
      } catch (e) {
        console.log(`   ⚠️ Network not idle, continuing anyway`);
      }

      // Click tab if specified (for mempool tabs)
      if (pageInfo.clickTab) {
        console.log(`   Clicking ${pageInfo.clickTab} tab...`);
        try {
          await page.waitForSelector('button', { timeout: 5000 });
          const buttons = await page.$$('button');
          for (const button of buttons) {
            const text = await page.evaluate(el => el.textContent, button);
            if (text.includes(pageInfo.clickTab)) {
              await button.click();
              await new Promise(resolve => setTimeout(resolve, 2000));
              break;
            }
          }
        } catch (tabError) {
          console.log(`⚠️ Could not find ${pageInfo.clickTab} tab`);
        }
      }

      // Wait for content to load based on page-specific wait time
      const waitSeconds = pageInfo.waitTime / 1000;
      console.log(`   Waiting ${waitSeconds} seconds for content to load...`);
      await new Promise(resolve => setTimeout(resolve, pageInfo.waitTime));

      // Wait for content based on page type
      try {
        if (pageInfo.name === 'homepage') {
          await page.waitForSelector('.text-white', { timeout: 5000 });
        } else if (pageInfo.name === 'charts' || pageInfo.name === 'stats') {
          await page.waitForSelector('canvas, svg, .plotly', { timeout: 8000 });
        } else if (pageInfo.name === 'validators') {
          await page.waitForSelector('canvas, svg', { timeout: 8000 });
        } else if (pageInfo.name === 'mempool-scheduled' || pageInfo.name === 'mempool-async') {
          // Wait for transactions to appear, keep checking
          console.log(`   Waiting for ${pageInfo.clickTab} transactions to appear...`);
          let attempts = 0;
          const maxAttempts = 20;
          while (attempts < maxAttempts) {
            const hasTransactions = await page.evaluate(() => {
              const rows = document.querySelectorAll('tbody tr');
              return rows.length > 0 && !document.body.textContent.includes('No transactions found');
            });
            if (hasTransactions) {
              console.log(`   ✅ Found ${pageInfo.clickTab} transactions!`);
              break;
            }
            await new Promise(resolve => setTimeout(resolve, 3000));
            attempts++;
          }
          if (attempts >= maxAttempts) {
            console.log(`   ⚠️ No ${pageInfo.clickTab} transactions found after waiting`);
          }
        } else {
          await page.waitForSelector('h1, .text-lime-400', { timeout: 5000 });
        }
      } catch (waitError) {
        console.log(`⚠️ Selector wait timeout for ${pageInfo.name}, proceeding with screenshot`);
      }

      // Scroll to top before screenshot
      await page.evaluate(() => window.scrollTo(0, 0));
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Take screenshot
      const screenshotPath = path.join(SCREENSHOT_DIR, `${pageInfo.name}.png`);
      await page.screenshot({
        path: screenshotPath,
        fullPage: false,
        captureBeyondViewport: false,
        type: 'png',
        omitBackground: false
      });

      console.log(`✅ Screenshot saved: ${pageInfo.name}.png`);
      successCount++;

    } catch (error) {
      console.error(`❌ Failed to capture ${pageInfo.name}:`, error.message);
      errorCount++;
    }
  }

  await browser.close();

  console.log(`\n📊 Screenshot Generation Complete:`);
  console.log(`✅ Successful: ${successCount}/${pages.length}`);
  console.log(`❌ Failed: ${errorCount}/${pages.length}`);
  console.log(`📁 Screenshots saved to: ${SCREENSHOT_DIR}`);

  return { successCount, errorCount, screenshots: pages };
}

// Run the script
if (require.main === module) {
  generateScreenshots()
    .then(() => {
      console.log('\n✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Screenshot generation failed:', error);
      process.exit(1);
    });
}

module.exports = { generateScreenshots };