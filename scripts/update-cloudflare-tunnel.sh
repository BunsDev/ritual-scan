#!/bin/bash
# Update Cloudflare Tunnel Configuration
# Automatically updates the WebSocket tunnel to point to the current RPC endpoint

set -e

# Parse RPC WebSocket URL from env or args
WS_URL=${1:-$(grep NEXT_PUBLIC_RETH_WS_URL .env.production | cut -d'=' -f2 | tr -d ' ')}

if [ -z "$WS_URL" ]; then
  echo "Usage: $0 ws://IP:PORT"
  echo "Or set NEXT_PUBLIC_RETH_WS_URL in .env.production"
  exit 1
fi

# Extract IP and port
WS_IP=$(echo "$WS_URL" | sed -E 's|ws://([^:]+):.*|\1|')
WS_PORT=$(echo "$WS_URL" | sed -E 's|ws://[^:]+:([0-9]+)|\1|')

echo "Updating Cloudflare Tunnel to: $WS_IP:$WS_PORT"

# Cloudflare credentials (from environment or secrets)
CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID:-""}
CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN:-""}
TUNNEL_ID="62409a64-c970-4cdc-86d8-2b5d44b5f01e"  # Extracted from tunnel token

if [ -z "$CLOUDFLARE_ACCOUNT_ID" ] || [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo ""
  echo "⚠️  Cloudflare credentials not found"
  echo ""
  echo "To enable automation, set these environment variables:"
  echo "  export CLOUDFLARE_ACCOUNT_ID='your-account-id'"
  echo "  export CLOUDFLARE_API_TOKEN='your-api-token'"
  echo ""
  echo "Get Account ID: Cloudflare Dashboard → Right sidebar"
  echo "Get API Token: Cloudflare Dashboard → Profile → API Tokens → Create Token"
  echo "  Required permissions: Zone:Read, Account:Cloudflare Tunnel:Edit"
  echo ""
  echo "For now, manually update the tunnel at:"
  echo "  https://one.dash.cloudflare.com → Access → Tunnels → rpc-websocket-tunnel"
  echo "  Change origin to: http://$WS_IP:$WS_PORT"
  echo ""
  exit 0
fi

echo "Updating tunnel via Cloudflare API..."

# Update tunnel configuration
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/configurations" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{
    \"config\": {
      \"ingress\": [
        {
          \"hostname\": \"ws.ding.fish\",
          \"service\": \"http://$WS_IP:$WS_PORT\",
          \"originRequest\": {
            \"noTLSVerify\": true
          }
        },
        {
          \"service\": \"http_status:404\"
        }
      ]
    }
  }"

echo ""
echo "✅ Cloudflare Tunnel updated to: $WS_IP:$WS_PORT"
echo ""
