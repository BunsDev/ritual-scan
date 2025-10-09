#!/bin/bash

echo "🔍 Ritual Chain Validator Distribution Analysis"
echo "=============================================="
echo ""

RPC_URL="http://35.196.101.134:8545"

# Get latest block number
latest_hex=$(curl -s -X POST $RPC_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  | grep -o '"result":"[^"]*"' | cut -d'"' -f4)

latest_dec=$((${latest_hex}))
echo "📊 Latest block: #$latest_dec ($latest_hex)"
echo ""

# Sample 20 recent blocks
echo "🔍 Sampling recent blocks for validator analysis..."
echo ""

declare -A validators
total_blocks=0

for i in {0..19}; do
  block_num=$((latest_dec - i))
  block_hex=$(printf "0x%x" $block_num)
  
  # Get block data
  response=$(curl -s -X POST $RPC_URL \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBlockByNumber\",\"params\":[\"$block_hex\",false],\"id\":1}")
  
  # Extract miner address
  miner=$(echo "$response" | grep -o '"miner":"[^"]*"' | cut -d'"' -f4)
  
  if [ ! -z "$miner" ]; then
    validators["$miner"]=$((${validators["$miner"]} + 1))
    total_blocks=$((total_blocks + 1))
    echo "Block #$block_num: $miner"
  fi
done

echo ""
echo "🎯 VALIDATOR DISTRIBUTION RESULTS:"
echo "=================================="
echo "📊 Total blocks analyzed: $total_blocks"
echo ""

# Count unique validators
unique_count=0
for validator in "${!validators[@]}"; do
  unique_count=$((unique_count + 1))
done

echo "👥 Unique validators found: $unique_count"
echo ""

if [ $unique_count -le 3 ]; then
  echo "🚨 MAJOR ISSUE: Only $unique_count validators are producing blocks!"
  echo "💡 Expected: ~30 validators (according to network specs)"
  echo "❌ Actual active validators: $unique_count"
  echo ""
fi

echo "📈 Block production by validator:"
echo "---------------------------------"

# Sort and display validators by block count
for validator in "${!validators[@]}"; do
  count=${validators[$validator]}
  percentage=$(echo "scale=1; $count * 100 / $total_blocks" | bc -l)
  echo "$validator: $count blocks ($percentage%)"
done | sort -k2 -nr

echo ""
echo "⚠️  ANALYSIS CONCLUSION:"
echo "If the network has 30 validators but only 2-3 are producing blocks,"
echo "this indicates a significant centralization issue or validator participation problem."
