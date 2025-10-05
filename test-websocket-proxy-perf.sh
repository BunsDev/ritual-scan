#!/bin/bash

echo "🧪 WebSocket Proxy Performance Test"
echo "===================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test 1: Direct WebSocket (baseline)
echo "Test 1: Direct WS connection (baseline)"
echo "----------------------------------------"
START=$(date +%s%N)
DIRECT_RESULT=$(timeout 3 wscat -c ws://35.196.101.134:8546 -x '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' 2>&1)
END=$(date +%s%N)
DIRECT_TIME=$(( ($END - $START) / 1000000 ))
DIRECT_BLOCK=$(echo "$DIRECT_RESULT" | grep -o '"result":"0x[^"]*"' | cut -d'"' -f4)

echo "  Time: ${DIRECT_TIME}ms"
echo "  Block: $DIRECT_BLOCK ($(printf "%d" $DIRECT_BLOCK))"
echo ""

# Test 2: WSS via Caddy Proxy
echo "Test 2: WSS via Caddy Proxy"
echo "----------------------------"
START=$(date +%s%N)
PROXY_RESULT=$(timeout 3 wscat -c wss://localhost/rpc-ws --no-check -x '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' 2>&1)
END=$(date +%s%N)
PROXY_TIME=$(( ($END - $START) / 1000000 ))
PROXY_BLOCK=$(echo "$PROXY_RESULT" | grep -o '"result":"0x[^"]*"' | cut -d'"' -f4)

echo "  Time: ${PROXY_TIME}ms"
echo "  Block: $PROXY_BLOCK ($(printf "%d" $PROXY_BLOCK))"
echo ""

# Calculate overhead
OVERHEAD=$(( $PROXY_TIME - $DIRECT_TIME ))
OVERHEAD_PCT=$(( $OVERHEAD * 100 / $DIRECT_TIME ))

echo "📊 Performance Analysis"
echo "-----------------------"
echo "  Direct WS:       ${DIRECT_TIME}ms"
echo "  WSS via Caddy:   ${PROXY_TIME}ms"
echo "  Overhead:        ${OVERHEAD}ms (${OVERHEAD_PCT}%)"
echo ""

# Test 3: Subscription test (real-time updates)
echo "Test 3: WebSocket Subscription (newHeads)"
echo "------------------------------------------"
echo "Subscribing to new blocks for 10 seconds..."

timeout 10 wscat -c wss://localhost/rpc-ws --no-check 2>&1 <<EOF &
{"jsonrpc":"2.0","method":"eth_subscribe","params":["newHeads"],"id":1}
EOF

sleep 10
pkill -f wscat

echo ""
echo "✅ Subscription test complete (check for block updates above)"
echo ""

# Test 4: Multiple concurrent connections
echo "Test 4: Concurrent Connections"
echo "-------------------------------"
for i in {1..5}; do
    (timeout 2 wscat -c wss://localhost/rpc-ws --no-check -x '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":'$i'}' 2>&1 | grep -o '"result":"0x[^"]*"' ) &
done
wait
echo ""
echo "✅ 5 concurrent connections tested"
echo ""

# Summary
echo "📈 Summary"
echo "=========="
if [ $OVERHEAD_PCT -lt 20 ]; then
    echo -e "${GREEN}✅ Performance: Excellent (<20% overhead)${NC}"
elif [ $OVERHEAD_PCT -lt 50 ]; then
    echo -e "${YELLOW}⚠️  Performance: Acceptable (20-50% overhead)${NC}"
else
    echo -e "${RED}❌ Performance: Poor (>50% overhead)${NC}"
fi

echo ""
echo "🎯 Recommendations:"
if [ "$DIRECT_BLOCK" = "$PROXY_BLOCK" ]; then
    echo -e "${GREEN}✅ Both connections return same block - data consistency OK${NC}"
else
    echo -e "${YELLOW}⚠️  Different blocks returned (timing difference)${NC}"
fi

echo ""
echo "📝 Next Steps:"
echo "  1. Open browser to https://localhost"
echo "  2. Open browser console (F12)"
echo "  3. Look for: '🔗 Using Caddy WebSocket proxy: wss://localhost/rpc-ws'"
echo "  4. Verify WebSocket connects successfully"
echo "  5. Watch for real-time block updates"
echo ""

