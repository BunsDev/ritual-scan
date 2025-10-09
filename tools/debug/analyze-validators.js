#!/usr/bin/env node

const RPC_URL = 'http://35.196.101.134:8545';

async function rpcCall(method, params = []) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: 1
    })
  });
  
  const data = await response.json();
  if (data.error) {
    throw new Error(`RPC Error: ${data.error.message}`);
  }
  
  return data.result;
}

async function analyzeValidatorDistribution() {
  console.log('🔍 Analyzing Ritual Chain Validator Distribution...\n');
  
  try {
    // Get latest block number
    const latestBlockHex = await rpcCall('eth_blockNumber');
    const latestBlock = parseInt(latestBlockHex, 16);
    console.log(`📊 Latest block: #${latestBlock} (${latestBlockHex})`);
    
    // Analyze last 100 blocks for validator distribution
    const blockCount = 100;
    const startBlock = latestBlock - blockCount + 1;
    
    console.log(`🔍 Analyzing blocks ${startBlock} to ${latestBlock} (${blockCount} blocks total)\n`);
    
    const validatorCounts = new Map();
    const blockData = [];
    
    // Fetch blocks in batches to avoid overwhelming the RPC
    for (let i = 0; i < blockCount; i += 10) {
      const batchPromises = [];
      
      for (let j = 0; j < 10 && (i + j) < blockCount; j++) {
        const blockNum = startBlock + i + j;
        const blockHex = `0x${blockNum.toString(16)}`;
        batchPromises.push(
          rpcCall('eth_getBlockByNumber', [blockHex, false])
            .then(block => ({ blockNum, block }))
            .catch(err => ({ blockNum, error: err.message }))
        );
      }
      
      const batchResults = await Promise.all(batchPromises);
      
      for (const result of batchResults) {
        if (result.error) {
          console.warn(`⚠️  Failed to fetch block ${result.blockNum}: ${result.error}`);
          continue;
        }
        
        const { block } = result;
        if (!block) continue;
        
        const validator = block.miner || block.author || 'Unknown';
        const blockNum = parseInt(block.number, 16);
        const timestamp = parseInt(block.timestamp, 16);
        
        // Count validator occurrences
        validatorCounts.set(validator, (validatorCounts.get(validator) || 0) + 1);
        
        blockData.push({
          number: blockNum,
          validator: validator,
          timestamp: timestamp,
          gasUsed: parseInt(block.gasUsed, 16),
          gasLimit: parseInt(block.gasLimit, 16)
        });
      }
      
      // Progress indicator
      process.stdout.write(`📦 Processed ${Math.min(startBlock + i + 10, latestBlock)} / ${latestBlock}\r`);
    }
    
    console.log(`\n\n🎯 VALIDATOR DISTRIBUTION ANALYSIS:`);
    console.log(`=====================================`);
    
    // Sort validators by block count (descending)
    const sortedValidators = Array.from(validatorCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    
    const totalBlocks = blockData.length;
    console.log(`📊 Total blocks analyzed: ${totalBlocks}\n`);
    
    // Display top validators
    console.log(`🏆 TOP VALIDATORS (Last ${blockCount} blocks):`);
    console.log(`${'Rank'.padEnd(6)} ${'Validator Address'.padEnd(42)} ${'Blocks'.padEnd(8)} ${'Percentage'.padEnd(12)} ${'Bar'}`);
    console.log(`${''.padEnd(80, '-')}`);
    
    sortedValidators.forEach((entry, index) => {
      const [validator, count] = entry;
      const percentage = ((count / totalBlocks) * 100).toFixed(2);
      const barLength = Math.round((count / totalBlocks) * 40);
      const bar = '█'.repeat(barLength) + '░'.repeat(40 - barLength);
      
      console.log(`${(index + 1).toString().padEnd(6)} ${validator.padEnd(42)} ${count.toString().padEnd(8)} ${(percentage + '%').padEnd(12)} ${bar}`);
    });
    
    // Statistical analysis
    console.log(`\n📈 STATISTICAL ANALYSIS:`);
    console.log(`========================`);
    
    const uniqueValidators = sortedValidators.length;
    const topValidator = sortedValidators[0];
    const secondValidator = sortedValidators[1];
    
    console.log(`👥 Unique validators found: ${uniqueValidators}`);
    console.log(`🥇 Top validator: ${topValidator[0].slice(0, 10)}... (${topValidator[1]} blocks, ${((topValidator[1] / totalBlocks) * 100).toFixed(2)}%)`);
    if (secondValidator) {
      console.log(`🥈 Second validator: ${secondValidator[0].slice(0, 10)}... (${secondValidator[1]} blocks, ${((secondValidator[1] / totalBlocks) * 100).toFixed(2)}%)`);
    }
    
    // Concentration analysis
    const top2Blocks = (topValidator[1] + (secondValidator?.[1] || 0));
    const top2Percentage = ((top2Blocks / totalBlocks) * 100).toFixed(2);
    
    console.log(`\n⚠️  CONCENTRATION ANALYSIS:`);
    console.log(`===========================`);
    console.log(`🎯 Top 2 validators control: ${top2Blocks}/${totalBlocks} blocks (${top2Percentage}%)`);
    
    if (parseFloat(top2Percentage) > 66) {
      console.log(`🚨 HIGH CENTRALIZATION: Top 2 validators control >66% of blocks!`);
    } else if (parseFloat(top2Percentage) > 50) {
      console.log(`⚠️  MODERATE CENTRALIZATION: Top 2 validators control >50% of blocks`);
    } else {
      console.log(`✅ GOOD DISTRIBUTION: Top 2 validators control <50% of blocks`);
    }
    
    // Expected vs actual distribution
    if (uniqueValidators > 0) {
      const expectedPercentage = (100 / uniqueValidators).toFixed(2);
      console.log(`\n📊 If perfectly distributed among ${uniqueValidators} validators:`);
      console.log(`   Expected: ${expectedPercentage}% per validator`);
      console.log(`   Actual top validator: ${((topValidator[1] / totalBlocks) * 100).toFixed(2)}%`);
      console.log(`   Deviation: ${(((topValidator[1] / totalBlocks) * 100) - parseFloat(expectedPercentage)).toFixed(2)}% above expected`);
    }
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

// Run the analysis
analyzeValidatorDistribution();
