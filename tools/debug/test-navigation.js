#!/usr/bin/env node

// Simple navigation test without puppeteer dependency
const http = require('http');

const BASE_URL = 'http://localhost:9000';

const pages = [
  '/',
  '/blocks', 
  '/transactions',
  '/analytics',
  '/gas-tracker',
  '/settings'
];

async function testPage(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 9000,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const hasLimeTheme = data.includes('text-lime-') || data.includes('bg-lime-') || data.includes('border-lime-');
        const hasBlackBg = data.includes('bg-black');
        const hasPurpleTheme = data.includes('text-purple-') && !data.includes('remove');
        
        resolve({
          path,
          status: res.statusCode,
          hasLimeTheme,
          hasBlackBg,
          hasPurpleTheme,
          title: data.match(/<title>(.*?)<\/title>/)?.[1] || 'No title'
        });
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error(`Timeout for ${path}`));
    });

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing navigation and theme consistency...\n');
  
  const results = [];
  
  for (const page of pages) {
    try {
      console.log(`Testing ${page}...`);
      const result = await testPage(page);
      results.push(result);
      
      const status = result.status === 200 ? '✅' : '❌';
      const theme = result.hasLimeTheme && result.hasBlackBg ? '🟢' : '🔴';
      const oldTheme = result.hasPurpleTheme ? '🟣' : '';
      
      console.log(`  ${status} Status: ${result.status}`);
      console.log(`  ${theme} Lime/Black Theme: ${result.hasLimeTheme && result.hasBlackBg ? 'YES' : 'NO'}`);
      console.log(`  ${oldTheme} Old Purple Theme: ${result.hasPurpleTheme ? 'FOUND (needs fix)' : 'NONE'}`);
      console.log(`  📄 Title: ${result.title}`);
      console.log('');
      
    } catch (error) {
      console.log(`  ❌ Error testing ${page}: ${error.message}\n`);
      results.push({ path: page, error: error.message });
    }
  }
  
  console.log('📊 SUMMARY:');
  console.log('================');
  
  const working = results.filter(r => r.status === 200).length;
  const withLimeTheme = results.filter(r => r.hasLimeTheme && r.hasBlackBg).length;
  const withPurpleTheme = results.filter(r => r.hasPurpleTheme).length;
  
  console.log(`✅ Working pages: ${working}/${pages.length}`);
  console.log(`🟢 Pages with Lime/Black theme: ${withLimeTheme}/${pages.length}`);
  console.log(`🟣 Pages still with Purple theme: ${withPurpleTheme}/${pages.length}`);
  
  if (withPurpleTheme > 0) {
    console.log('\n⚠️  PAGES NEEDING THEME FIXES:');
    results.filter(r => r.hasPurpleTheme).forEach(r => {
      console.log(`   - ${r.path}`);
    });
  }
  
  if (withLimeTheme === pages.length && withPurpleTheme === 0) {
    console.log('\n🎉 ALL PAGES HAVE CONSISTENT LIME/BLACK THEME!');
  }
}

runTests().catch(console.error);
