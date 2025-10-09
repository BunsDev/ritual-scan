#!/usr/bin/env node

async function checkValidators() {
  const RPC_URL = 'http://35.196.101.134:8545';
  
  console.log('🔍 Checking recent validator activity on Ritual Chain...\n');
  
  // Get several recent blocks manually
  const blockPromises = [];
  const targetBlocks = [
    'latest', '0x10eee', '0x10eed', '0x10eec', '0x10eeb', 
    '0x10eea', '0x10ee9', '0x10ee8', '0x10ee7', '0x10ee6',
    '0x10ee0', '0x10ed0', '0x10ec0', '0x10eb0', '0x10ea0'  // Sample across wider range
  ];
  
  for (const blockId of targetBlocks) {
    blockPromises.push(
      fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBlockByNumber',
          params: [blockId, false],
          id: Math.random()
        })
      }).then(r => r.json())
    );
  }
  
  const responses = await Promise.all(blockPromises);
  const validators = new Map();
  
  console.log('📊 BLOCK ANALYSIS:');
  console.log('Block Number | Validator Address                          | Timestamp');
  console.log('-'.repeat(80));
  
  for (const response of responses) {
    if (response.result && response.result.miner) {
      const block = response.result;
      const blockNum = parseInt(block.number, 16);
      const validator = block.miner;
      const timestamp = new Date(parseInt(block.timestamp, 16) * 1000).toISOString();
      
      validators.set(validator, (validators.get(validator) || 0) + 1);
      
      console.log(`#${blockNum.toString().padStart(8)} | ${validator} | ${timestamp}`);
    }
  }
  
  console.log('\n🎯 VALIDATOR SUMMARY:');
  console.log('='.repeat(60));
  
  const sortedValidators = Array.from(validators.entries())
    .sort((a, b) => b[1] - a[1]);
  
  const totalBlocks = responses.filter(r => r.result).length;
  
  sortedValidators.forEach((entry, index) => {
    const [validator, count] = entry;
    const percentage = ((count / totalBlocks) * 100).toFixed(1);
    console.log(`${(index + 1).toString().padStart(2)}. ${validator} - ${count}/${totalBlocks} blocks (${percentage}%)`);
  });
  
  console.log(`\n📈 FINDINGS:`);
  console.log(`• Total unique validators: ${sortedValidators.length}`);
  console.log(`• Blocks sampled: ${totalBlocks}`);
  
  if (sortedValidators.length <= 3) {
    console.log(`🚨 ISSUE: Only ${sortedValidators.length} validators producing blocks!`);
    console.log(`💡 Expected: ~30 validators (as mentioned by user)`);
    console.log(`❌ Current: ${sortedValidators.length} validators active`);
    
    if (sortedValidators.length >= 2) {
      const dominance = ((sortedValidators[0][1] + sortedValidators[1][1]) / totalBlocks * 100).toFixed(1);
      console.log(`⚠️  Top 2 validators control ${dominance}% of recent blocks`);
    }
  }
}

checkValidators().catch(console.error);
