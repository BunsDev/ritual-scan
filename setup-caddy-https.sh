#!/bin/bash

echo "🔐 Setting up Caddy HTTPS + WebSocket Proxy for Ritual Scan"
echo "============================================================"
echo ""

# Check if Caddy is installed
if ! command -v caddy &> /dev/null; then
    echo "📦 Installing Caddy..."
    sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
    sudo apt update
    sudo apt install caddy
    echo "✅ Caddy installed!"
else
    echo "✅ Caddy already installed"
fi

echo ""
echo "📝 Configuration:"
echo "  - RPC Node: ${RETH_RPC_URL:-http://35.196.101.134:8545}"
echo "  - WS Node:  ${RETH_WS_URL:-ws://35.196.101.134:8546}"
echo "  - Next.js:  http://localhost:5051"
echo "  - HTTPS:    https://localhost:443"
echo ""

# Check if Next.js is already running
if lsof -i:5051 > /dev/null 2>&1; then
    echo "✅ Next.js already running on port 5051"
    NEXTJS_PID=""
else
    echo "🚀 Starting Next.js on port 5051..."
    npm run dev > /tmp/nextjs.log 2>&1 &
    NEXTJS_PID=$!
    echo "   PID: $NEXTJS_PID"
    sleep 5
fi

# Stop existing Caddy if running
if sudo lsof -i:443 > /dev/null 2>&1; then
    echo "🔄 Stopping existing Caddy..."
    sudo pkill caddy
    sleep 2
fi

# Export env vars for Caddy
export RETH_WS_URL="${RETH_WS_URL:-ws://35.196.101.134:8546}"
export RETH_RPC_URL="${RETH_RPC_URL:-http://35.196.101.134:8545}"

# Start Caddy
echo "🚀 Starting Caddy with WebSocket proxy..."
sudo -E caddy run --config Caddyfile > /tmp/caddy.log 2>&1 &
CADDY_PID=$!
echo "   PID: $CADDY_PID"

sleep 3

echo ""
echo "✅ Setup Complete!"
echo ""
echo "🌐 Access Points:"
echo "  🔐 HTTPS App:      https://localhost"
echo "  🔌 WSS Proxy:      wss://localhost/rpc-ws"
echo "  🌐 HTTP (dev):     http://localhost (redirects to HTTPS)"
echo ""
echo "🔧 Backend:"
echo "  Next.js:           http://localhost:5051"
echo "  RPC Endpoint:      ${RETH_RPC_URL:-http://35.196.101.134:8545}"
echo "  WebSocket:         ${RETH_WS_URL:-ws://35.196.101.134:8546}"
echo ""
echo "📋 Logs:"
echo "  Next.js:           tail -f /tmp/nextjs.log"
echo "  Caddy:             tail -f /tmp/caddy.log"
echo ""
echo "🛑 To stop:"
echo "  sudo pkill caddy"
if [ -n "$NEXTJS_PID" ]; then
  echo "  kill $NEXTJS_PID"
fi
echo ""
echo "🧪 Test WebSocket proxy:"
echo "  wscat -c wss://localhost/rpc-ws --no-check"
echo ""


