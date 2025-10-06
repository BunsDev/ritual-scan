// Direct WebSocket test to verify if subscriptions work
const WebSocket = require('ws');

console.log('🔍 Testing WebSocket subscriptions directly...');

const ws = new WebSocket('ws://35.196.101.134:8546');

ws.on('open', () => {
  console.log('✅ WebSocket connected');
  
  // Test newHeads subscription
  const subscription = {
    jsonrpc: '2.0',
    method: 'eth_subscribe',
    params: ['newHeads'],
    id: 1
  };
  
  console.log('📤 Sending subscription:', JSON.stringify(subscription));
  ws.send(JSON.stringify(subscription));
  
  // Set timeout to close after 10 seconds
  setTimeout(() => {
    console.log('⏰ Test timeout - closing connection');
    ws.close();
  }, 10000);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('📩 Received message:', JSON.stringify(message, null, 2));
    
    if (message.method === 'eth_subscription' && message.params?.result) {
      console.log('🎉 NEW BLOCK RECEIVED!', message.params.result.number);
    }
  } catch (error) {
    console.log('❌ Failed to parse message:', error.message);
    console.log('Raw data:', data.toString());
  }
});

ws.on('error', (error) => {
  console.log('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
  console.log('🔌 WebSocket closed:', code, reason.toString());
  process.exit(0);
});
