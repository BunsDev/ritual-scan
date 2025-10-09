#!/usr/bin/env node

/**
 * Direct WebSocket Test for RETH on port 8546
 * Testing if WebSocket subscriptions work properly
 */

const WebSocket = require('ws');

console.log('🔌 Testing WebSocket connection to RETH on port 8546...\n');

const ws = new WebSocket('ws://35.185.40.237:8546');

ws.on('open', () => {
  console.log('✅ WebSocket connection opened successfully!');
  
  // Test 1: Basic JSON-RPC call
  console.log('\n📡 Test 1: Basic RPC call (eth_blockNumber)');
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'eth_blockNumber',
    params: [],
    id: 1
  }));
  
  // Test 2: Try subscription (this might fail)
  setTimeout(() => {
    console.log('\n📡 Test 2: Subscription attempt (eth_subscribe newHeads)');
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_subscribe',
      params: ['newHeads'],
      id: 2
    }));
  }, 1000);
  
  // Test 3: Try pending transactions subscription
  setTimeout(() => {
    console.log('\n📡 Test 3: Subscription attempt (eth_subscribe newPendingTransactions)');
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_subscribe',
      params: ['newPendingTransactions'],
      id: 3
    }));
  }, 2000);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data);
    console.log('\n📥 Received message:');
    console.log(JSON.stringify(message, null, 2));
    
    if (message.error) {
      console.log(`❌ Error response: ${message.error.message}`);
    } else if (message.result) {
      console.log(`✅ Success response: ${JSON.stringify(message.result)}`);
    }
  } catch (error) {
    console.log('❌ Failed to parse message:', data.toString());
  }
});

ws.on('error', (error) => {
  console.log('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
  console.log(`🔌 WebSocket closed: ${code} ${reason}`);
});

// Close after 10 seconds
setTimeout(() => {
  console.log('\n🏁 Test complete, closing connection...');
  ws.close();
  process.exit(0);
}, 10000);
