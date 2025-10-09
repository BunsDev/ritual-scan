#!/usr/bin/env node

/**
 * Quick Console Error Analysis - Simple Puppeteer approach
 * Avoids Playwright hanging issues
 */

const puppeteer = require('puppeteer');

const PAGES_TO_TEST = [
  { name: 'Home', url: '/' },
  { name: 'Blocks', url: '/blocks' },
  { name: 'Transactions', url: '/transactions' },
  { name: 'Mempool', url: '/mempool' },
  { name: 'Scheduled', url: '/scheduled' },
  { name: 'Async', url: '/async' },
  { name: 'Analytics', url: '/analytics' },
  { name: 'Gas Tracker', url: '/gas-tracker' },
  { name: 'Settings', url: '/settings' }
];

async function testConsoleErrors() {
  console.log('🔍 Starting Quick Console Error Analysis...\n');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const bugReport = [];
  let totalErrors = 0;

  try {
    for (const pageInfo of PAGES_TO_TEST) {
      console.log(`\n📊 Testing: ${pageInfo.name} (${pageInfo.url})`);
      
      const page = await browser.newPage();
      const consoleErrors = [];
      const networkErrors = [];
      
      // Monitor console errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const error = msg.text();
          consoleErrors.push(error);
          console.log(`❌ Console Error: ${error}`);
        }
      });

      // Monitor failed requests
      page.on('response', response => {
        if (!response.ok()) {
          const error = `${response.status()} ${response.url()}`;
          networkErrors.push(error);
          console.log(`🌐 Network Error: ${error}`);
        }
      });

      const startTime = Date.now();
      
      try {
        await page.goto(`http://localhost:3000${pageInfo.url}`, { 
          waitUntil: 'networkidle0',
          timeout: 10000 
        });
        
        // Wait a bit for async operations
        await page.waitForTimeout(3000);
        
        const loadTime = Date.now() - startTime;
        
        // Report for this page
        const pageReport = {
          page: pageInfo.name,
          url: pageInfo.url,
          consoleErrors: consoleErrors.length,
          networkErrors: networkErrors.length,
          loadTime,
          errors: consoleErrors,
          networkFailures: networkErrors
        };
        
        bugReport.push(pageReport);
        totalErrors += consoleErrors.length;
        
        console.log(`⏱️  Load Time: ${loadTime}ms`);
        console.log(`❌ Console Errors: ${consoleErrors.length}`);
        console.log(`🌐 Network Errors: ${networkErrors.length}`);
        
        if (consoleErrors.length === 0) {
          console.log(`✅ ${pageInfo.name}: CLEAN - No console errors!`);
        } else {
          console.log(`🔍 ${pageInfo.name}: NEEDS FIX - ${consoleErrors.length} errors`);
        }
        
      } catch (error) {
        console.log(`💥 ${pageInfo.name}: FAILED TO LOAD - ${error.message}`);
        bugReport.push({
          page: pageInfo.name,
          url: pageInfo.url,
          consoleErrors: 0,
          networkErrors: 0,
          loadTime: 0,
          errors: [`LOAD_FAILED: ${error.message}`],
          networkFailures: []
        });
      }
      
      await page.close();
    }

    // COMPREHENSIVE BUG ANALYSIS & STACK RANKING
    console.log('\n' + '='.repeat(80));
    console.log('🎯 COMPREHENSIVE BUG ANALYSIS & STACK RANKING');
    console.log('='.repeat(80));
    console.log(`📊 TOTAL CONSOLE ERRORS FOUND: ${totalErrors}`);
    console.log(`📄 PAGES TESTED: ${bugReport.length}`);
    console.log('\n🏆 STACK RANKED ISSUES (Priority Order):');
    
    // Sort by number of errors (descending)
    const sortedReport = bugReport.sort((a, b) => b.consoleErrors - a.consoleErrors);
    
    sortedReport.forEach((report, index) => {
      const priority = report.consoleErrors === 0 ? '✅ CLEAN' :
                      report.consoleErrors <= 2 ? '🟡 LOW' :
                      report.consoleErrors <= 5 ? '🟠 MEDIUM' :
                      '🔴 HIGH';
      
      console.log(`\n${index + 1}. ${priority} - ${report.page} (${report.consoleErrors} errors)`);
      
      if (report.errors.length > 0) {
        console.log(`   🐛 Issues:`);
        report.errors.forEach(error => {
          console.log(`     - ${error}`);
        });
      }
    });

    // IMPLEMENTATION PLAN
    console.log('\n' + '='.repeat(80));
    console.log('🛠️ IMPLEMENTATION PLAN - FIX ONE BY ONE');
    console.log('='.repeat(80));
    
    const priorityPages = sortedReport.filter(p => p.consoleErrors > 0);
    
    if (priorityPages.length === 0) {
      console.log('🎉 AMAZING! No console errors found across all pages!');
    } else {
      console.log('📋 RECOMMENDED FIX ORDER:');
      priorityPages.forEach((page, index) => {
        console.log(`\n${index + 1}. Fix ${page.page} (${page.consoleErrors} errors)`);
        console.log(`   🎯 Focus Areas:`);
        page.errors.forEach(error => {
          console.log(`     - ${error}`);
        });
      });
    }

  } catch (error) {
    console.error('💥 Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testConsoleErrors().catch(console.error);
