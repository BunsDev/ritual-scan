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
    description: 'Real-time network overview with latest blocks, transactions, and live stats'
  },
  {
    name: 'analytics',
    url: '/analytics',
    title: 'Charts Dashboard',
    description: 'Visual analytics with gas usage, transaction counts, and performance metrics'
  },
  {
    name: 'ritual-analytics',
    url: '/ritual-analytics',
    title: 'Ritual Chain Stats',
    description: 'Async adoption metrics, protocol fees, and transaction type distribution'
  },
  {
    name: 'blocks',
    url: '/blocks',
    title: 'Block Explorer',
    description: 'Real-time block list with live updates via WebSocket'
  },
  {
    name: 'validators',
    url: '/validators',
    title: 'Validator Network Map',
    description: 'Geographic visualization of validator network with activity metrics'
  },
  {
    name: 'mempool',
    url: '/mempool',
    title: 'Live Mempool Monitor',
    description: 'Real-time pending transactions and scheduled jobs'
  },
  {
    name: 'settings',
    url: '/settings',
    title: 'RPC Configuration',
    description: 'User-configurable RPC endpoints with connection testing'
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
    headless: true,
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
      '--disable-gpu'
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
      
      // Navigate to the page
      await page.goto(`${BASE_URL}${pageInfo.url}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Handle password prompt on first page load
      if (!authenticated) {
        console.log(`   Checking for password prompt...`);
        const passwordInput = await page.$('input[type="password"]');
        if (passwordInput) {
          console.log(`   Entering password...`);
          await page.type('input[type="password"]', PASSWORD);
          await page.keyboard.press('Enter');
          await new Promise(resolve => setTimeout(resolve, 2000));
          authenticated = true;
        }
      }

      // Wait 1 minute for content to fully load and cache to populate
      console.log(`   Waiting 60 seconds for content to load...`);
      await new Promise(resolve => setTimeout(resolve, 60000));

      // Wait for content based on page type
      try {
        if (pageInfo.name === 'homepage') {
          await page.waitForSelector('.text-white', { timeout: 5000 });
        } else if (pageInfo.name === 'analytics' || pageInfo.name === 'ritual-analytics') {
          await page.waitForSelector('canvas, svg, .plotly', { timeout: 8000 });
        } else if (pageInfo.name === 'validators') {
          await page.waitForSelector('canvas, svg', { timeout: 8000 });
        } else {
          await page.waitForSelector('h1, .text-lime-400', { timeout: 5000 });
        }
      } catch (waitError) {
        console.log(`⚠️ Selector wait timeout for ${pageInfo.name}, proceeding with screenshot`);
      }

      // Take screenshot
      const screenshotPath = path.join(SCREENSHOT_DIR, `${pageInfo.name}.png`);
      await page.screenshot({
        path: screenshotPath,
        fullPage: false, // Just viewport for cleaner screenshots
        captureBeyondViewport: false
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