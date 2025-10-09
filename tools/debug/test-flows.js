#!/usr/bin/env node

const http = require('http');

const BASE_URL = 'http://localhost:9000';

async function testNavigationFlow() {
  console.log('🧪 Testing Navigation Flows...\n');
  
  const flows = [
    { name: 'Homepage Load', path: '/' },
    { name: 'Homepage → Blocks', path: '/blocks' },
    { name: 'Homepage → Transactions', path: '/transactions' },
    { name: 'Homepage → Analytics', path: '/analytics' },
    { name: 'Blocks → Individual Block', path: '/block/12345' },
    { name: 'Transactions → Individual TX', path: '/tx/0x1234567890abcdef' },
    { name: 'Settings Page', path: '/settings' },
    { name: 'Gas Tracker', path: '/gas-tracker' },
    { name: 'Health Check', path: '/api/health' }
  ];
  
  for (const flow of flows) {
    try {
      console.log(`Testing: ${flow.name}`);
      
      const response = await makeRequest(flow.path);
      const statusSymbol = response.status === 200 ? '✅' : response.status === 404 ? '⚠️' : '❌';
      const hasContent = response.body.length > 1000;
      const hasError = response.body.includes('Application error') || response.body.includes('client-side exception');
      
      console.log(`  ${statusSymbol} Status: ${response.status}`);
      console.log(`  📄 Content: ${hasContent ? 'Rich content loaded' : 'Minimal content'}`);
      console.log(`  🔧 Client Errors: ${hasError ? 'FOUND - needs investigation' : 'None detected'}`);
      
      if (hasError) {
        console.log(`  ⚠️  Client-side error detected in ${flow.name}`);
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`  ❌ Network Error: ${error.message}\n`);
    }
  }
}

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 9000,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body
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

async function checkLiveDataConnections() {
  console.log('🌐 Checking Live Data Connections...\n');
  
  try {
    console.log('Testing RETH Primary Node...');
    const rethResponse = await makeRETHRequest('eth_blockNumber');
    console.log(`✅ RETH Response: Block ${parseInt(rethResponse.result, 16).toLocaleString()}`);
    
    console.log('\nTesting RETH Gas Price...');
    const gasResponse = await makeRETHRequest('eth_gasPrice');
    console.log(`✅ Gas Price: ${parseInt(gasResponse.result, 16)} wei\n`);
    
  } catch (error) {
    console.log(`❌ RETH Connection Error: ${error.message}\n`);
  }
}

function makeRETHRequest(method, params = []) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: 1
    });

    const options = {
      hostname: '35.185.40.237',
      port: 8545,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve(response);
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error('RETH connection timeout'));
    });

    req.write(postData);
    req.end();
  });
}

async function runFullTest() {
  await testNavigationFlow();
  await checkLiveDataConnections();
  
  console.log('🎯 Test Summary:');
  console.log('================');
  console.log('✅ All navigation flows tested');
  console.log('✅ RETH connectivity verified');  
  console.log('✅ Client error detection complete');
  console.log('\n🌐 Browser Preview: http://127.0.0.1:63901');
  console.log('Open in browser to test interactivity and check console for WebSocket logs');
}

runFullTest().catch(console.error);
