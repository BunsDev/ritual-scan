const WebSocket = require('ws');
const http = require('http');

// Create HTTP server for JSON-RPC
const httpServer = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const request = JSON.parse(body);
        const response = handleRpcRequest(request);
        
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(JSON.stringify(response));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32700, message: 'Parse error' },
          id: null
        }));
      }
    });
  } else if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Mock blockchain state
let currentBlockNumber = 1000000;
let gasPrice = 20; // gwei
let pendingTxCount = 15;
let queuedTxCount = 8;

// Generate mock transaction hash
function generateTxHash() {
  return '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// Generate mock block hash
function generateBlockHash() {
  return '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// Handle JSON-RPC requests
function handleRpcRequest(request) {
  const { method, params, id } = request;
  
  switch (method) {
    case 'eth_blockNumber':
      return {
        jsonrpc: '2.0',
        result: '0x' + currentBlockNumber.toString(16),
        id
      };
      
    case 'eth_gasPrice':
      return {
        jsonrpc: '2.0',
        result: '0x' + Math.floor(gasPrice * 1e9).toString(16),
        id
      };
      
    case 'eth_getBlockByNumber':
      const blockNum = params[0] === 'latest' ? currentBlockNumber : parseInt(params[0], 16);
      return {
        jsonrpc: '2.0',
        result: {
          number: '0x' + blockNum.toString(16),
          hash: generateBlockHash(),
          parentHash: generateBlockHash(),
          timestamp: '0x' + Math.floor(Date.now() / 1000).toString(16),
          gasLimit: '0x1c9c380',
          gasUsed: '0x' + Math.floor(Math.random() * 0x1c9c380).toString(16),
          baseFeePerGas: '0x' + Math.floor(gasPrice * 1e9).toString(16),
          transactions: params[1] ? Array.from({length: Math.floor(Math.random() * 20)}, () => generateTxHash()) : []
        },
        id
      };
      
    case 'txpool_status':
      return {
        jsonrpc: '2.0',
        result: {
          pending: '0x' + pendingTxCount.toString(16),
          queued: '0x' + queuedTxCount.toString(16)
        },
        id
      };
      
    case 'txpool_scheduledContent':
      return {
        jsonrpc: '2.0',
        result: {
          scheduled: Array.from({length: Math.floor(Math.random() * 5)}, () => ({
            hash: generateTxHash(),
            callId: Math.floor(Math.random() * 1000),
            maxBlock: currentBlockNumber + Math.floor(Math.random() * 100)
          }))
        },
        id
      };
      
    default:
      return {
        jsonrpc: '2.0',
        error: { code: -32601, message: 'Method not found' },
        id
      };
  }
}

// Start HTTP server
httpServer.listen(8545, () => {
  console.log('🚀 Mock JSON-RPC server running on http://localhost:8545');
});

// Create WebSocket server
const wss = new WebSocket.Server({ port: 8546 });

console.log('🚀 Mock WebSocket server running on ws://localhost:8546');

// Track subscriptions
const subscriptions = new Map();
let subscriptionId = 1;

wss.on('connection', (ws) => {
  console.log('📱 New WebSocket connection');
  
  ws.on('message', (message) => {
    try {
      const request = JSON.parse(message.toString());
      handleWebSocketMessage(ws, request);
    } catch (error) {
      console.error('❌ WebSocket message parse error:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('📱 WebSocket connection closed');
    // Clean up subscriptions for this connection
    for (const [subId, data] of subscriptions.entries()) {
      if (data.ws === ws) {
        subscriptions.delete(subId);
      }
    }
  });
});

function handleWebSocketMessage(ws, request) {
  const { method, params, id } = request;
  
  switch (method) {
    case 'eth_subscribe':
      const subscriptionType = params[0];
      const subId = subscriptionId++;
      
      subscriptions.set(subId, {
        ws,
        type: subscriptionType,
        id: subId
      });
      
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        result: '0x' + subId.toString(16),
        id
      }));
      
      console.log(`📡 New subscription: ${subscriptionType} (ID: ${subId})`);
      break;
      
    case 'eth_unsubscribe':
      const unsubId = parseInt(params[0], 16);
      subscriptions.delete(unsubId);
      
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        result: true,
        id
      }));
      break;
      
    default:
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32601, message: 'Method not found' },
        id
      }));
  }
}

// Simulate blockchain activity
setInterval(() => {
  // Simulate new block
  currentBlockNumber++;
  gasPrice = Math.max(1, gasPrice + (Math.random() - 0.5) * 2); // Random walk
  pendingTxCount = Math.max(0, pendingTxCount + Math.floor((Math.random() - 0.5) * 5));
  queuedTxCount = Math.max(0, queuedTxCount + Math.floor((Math.random() - 0.5) * 3));
  
  const newBlock = {
    number: '0x' + currentBlockNumber.toString(16),
    hash: generateBlockHash(),
    parentHash: generateBlockHash(),
    timestamp: '0x' + Math.floor(Date.now() / 1000).toString(16),
    gasLimit: '0x1c9c380',
    gasUsed: '0x' + Math.floor(Math.random() * 0x1c9c380).toString(16),
    baseFeePerGas: '0x' + Math.floor(gasPrice * 1e9).toString(16),
    transactions: Array.from({length: Math.floor(Math.random() * 20)}, () => generateTxHash())
  };
  
  // Send to newHeads subscribers
  for (const [subId, data] of subscriptions.entries()) {
    if (data.type === 'newHeads' && data.ws.readyState === WebSocket.OPEN) {
      data.ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_subscription',
        params: {
          subscription: '0x' + subId.toString(16),
          result: newBlock
        }
      }));
    }
  }
  
  console.log(`🔗 New block #${currentBlockNumber} (Gas: ${gasPrice.toFixed(1)} gwei, Pending: ${pendingTxCount})`);
}, 3000); // New block every 3 seconds

// Simulate pending transactions
setInterval(() => {
  const txHash = generateTxHash();
  
  // Send to newPendingTransactions subscribers
  for (const [subId, data] of subscriptions.entries()) {
    if (data.type === 'newPendingTransactions' && data.ws.readyState === WebSocket.OPEN) {
      data.ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_subscription',
        params: {
          subscription: '0x' + subId.toString(16),
          result: txHash
        }
      }));
    }
  }
  
  console.log(`💸 New pending tx: ${txHash.slice(0, 10)}...`);
}, 1500); // New pending transaction every 1.5 seconds

console.log('🎭 Mock blockchain server ready!');
console.log('📡 Simulating blocks every 3 seconds');
console.log('💸 Simulating pending transactions every 1.5 seconds');
