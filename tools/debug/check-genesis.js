const fetch = require('node-fetch');

const RETH_URL = 'http://35.185.40.237:8545';

async function rpcCall(method, params = []) {
  const response = await fetch(RETH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: 1
    })
  });
  
  const data = await response.json();
  return data.result;
}

async function checkGenesisBlock() {
  console.log('🔍 Fetching block 0 (genesis) from RETH...');
  
  try {
    // Get block 0 with full transaction details
    const block0 = await rpcCall('eth_getBlockByNumber', ['0x0', true]);
    
    if (!block0) {
      console.log('❌ Block 0 not found');
      return;
    }
    
    console.log('📦 Block 0 info:', {
      number: block0.number,
      hash: block0.hash,
      transactionCount: block0.transactions?.length || 0
    });
    
    if (!block0.transactions || block0.transactions.length === 0) {
      console.log('📭 No transactions in genesis block');
      return;
    }
    
    console.log('🔍 Checking transactions for contract deployments...');
    
    let contractCount = 0;
    for (let i = 0; i < block0.transactions.length; i++) {
      const tx = block0.transactions[i];
      
      console.log(`TX ${i}:`, {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        isContractCreation: tx.to === null
      });
      
      // Check if this is a contract creation (to === null)
      if (tx.to === null) {
        contractCount++;
        console.log('🏗️  CONTRACT CREATION FOUND:', tx.hash);
        
        try {
          const receipt = await rpcCall('eth_getTransactionReceipt', [tx.hash]);
          if (receipt && receipt.contractAddress) {
            console.log('✅ CONTRACT DEPLOYED:', {
              address: receipt.contractAddress,
              creator: tx.from,
              gasUsed: receipt.gasUsed,
              status: receipt.status
            });
          } else {
            console.log('❌ No contract address in receipt');
          }
        } catch (receiptError) {
          console.log('❌ Failed to get receipt:', receiptError.message);
        }
      }
    }
    
    console.log('📊 Summary: Found', contractCount, 'contract deployments in block 0');
    
  } catch (error) {
    console.error('❌ Error fetching block 0:', error.message);
  }
}

checkGenesisBlock();
