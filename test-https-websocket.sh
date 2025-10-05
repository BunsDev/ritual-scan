#!/bin/bash

echo "🧪 Testing HTTPS/WSS Proxy Implementation"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        ((TESTS_FAILED++))
    fi
}

echo "📋 Pre-flight Checks"
echo "--------------------"

# Check if services are running
if lsof -i:5051 > /dev/null 2>&1; then
    test_result 0 "Next.js running on port 5051"
else
    test_result 1 "Next.js NOT running on port 5051"
    echo "   Run: npm run dev"
fi

if sudo lsof -i:443 > /dev/null 2>&1; then
    test_result 0 "Caddy running on port 443"
else
    test_result 1 "Caddy NOT running on port 443"
    echo "   Run: ./setup-caddy-https.sh"
fi

echo ""
echo "🔌 Testing WebSocket Connections"
echo "---------------------------------"

# Test 1: Direct WS connection (baseline)
echo "Test 1: Direct WS to RPC node..."
timeout 5 wscat -c ws://35.196.101.134:8546 -x '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' > /tmp/ws-direct.log 2>&1
if grep -q "result" /tmp/ws-direct.log; then
    test_result 0 "Direct WS connection works"
    DIRECT_WS_TIME=$(grep -o '"result":"[^"]*"' /tmp/ws-direct.log | head -1)
else
    test_result 1 "Direct WS connection failed"
fi

# Test 2: WSS via Caddy proxy
echo "Test 2: WSS via Caddy proxy..."
timeout 5 wscat -c wss://localhost/rpc-ws --no-check -x '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' > /tmp/wss-proxy.log 2>&1
if grep -q "result" /tmp/wss-proxy.log; then
    test_result 0 "WSS proxy connection works"
    PROXY_WS_TIME=$(grep -o '"result":"[^"]*"' /tmp/wss-proxy.log | head -1)
else
    test_result 1 "WSS proxy connection failed"
    echo "   Check: tail -f /tmp/caddy.log"
fi

echo ""
echo "🌐 Testing HTTPS Endpoints"
echo "--------------------------"

# Test 3: HTTPS main page
echo "Test 3: HTTPS main page..."
HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" https://localhost/)
if [ "$HTTP_CODE" = "200" ]; then
    test_result 0 "HTTPS main page loads (HTTP $HTTP_CODE)"
else
    test_result 1 "HTTPS main page failed (HTTP $HTTP_CODE)"
fi

# Test 4: RPC Proxy endpoint
echo "Test 4: RPC proxy endpoint..."
RPC_RESPONSE=$(curl -sk -X POST https://localhost/api/rpc-proxy \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}')
if echo "$RPC_RESPONSE" | grep -q "result"; then
    test_result 0 "RPC proxy works"
    BLOCK_NUM=$(echo "$RPC_RESPONSE" | grep -o '"result":"[^"]*"')
    echo "   Latest block: $BLOCK_NUM"
else
    test_result 1 "RPC proxy failed"
    echo "   Response: $RPC_RESPONSE"
fi

echo ""
echo "⏱️  Performance Comparison"
echo "-------------------------"

# Measure WebSocket latency
echo "Measuring WebSocket latency (10 requests each)..."

# Direct WS
DIRECT_TOTAL=0
for i in {1..10}; do
    START=$(date +%s%N)
    timeout 2 wscat -c ws://35.196.101.134:8546 -x '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' > /dev/null 2>&1
    END=$(date +%s%N)
    LATENCY=$(( ($END - $START) / 1000000 )) # Convert to ms
    DIRECT_TOTAL=$(( $DIRECT_TOTAL + $LATENCY ))
done
DIRECT_AVG=$(( $DIRECT_TOTAL / 10 ))

# Proxy WSS
PROXY_TOTAL=0
for i in {1..10}; do
    START=$(date +%s%N)
    timeout 2 wscat -c wss://localhost/rpc-ws --no-check -x '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' > /dev/null 2>&1
    END=$(date +%s%N)
    LATENCY=$(( ($END - $START) / 1000000 )) # Convert to ms
    PROXY_TOTAL=$(( $PROXY_TOTAL + $LATENCY ))
done
PROXY_AVG=$(( $PROXY_TOTAL / 10 ))

echo ""
echo "📊 Results:"
echo "  Direct WS:        ${DIRECT_AVG}ms average"
echo "  WSS via Caddy:    ${PROXY_AVG}ms average"
echo "  Overhead:         $(( $PROXY_AVG - $DIRECT_AVG ))ms ($(( ($PROXY_AVG - $DIRECT_AVG) * 100 / $DIRECT_AVG ))% slower)"
echo ""

echo "📈 Summary"
echo "----------"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! HTTPS/WSS proxy is working correctly.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Check logs above.${NC}"
    exit 1
fi

