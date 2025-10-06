# Cloudflare Configuration for ding.fish

## Current Setup

Production uses Cloudflare Tunnel for WebSocket connections:

```
Browser (https://ding.fish)
    ↓
    wss://ws.ding.fish
    ↓
Cloudflare Edge (SSL termination)
    ↓
Cloudflare Tunnel (encrypted)
    ↓
cloudflared daemon (GKE pod)
    ↓
ws://35.196.202.163:8546 (RETH WebSocket)
```

## Why Cloudflare Tunnel?

GKE's HTTP(S) Load Balancer doesn't handle WebSocket well:
- HTTP/2 backend issues
- SSL passthrough complexities
- Requires dual load balancer setup

Cloudflare Tunnel solves this:
- Free tier
- Native WebSocket support
- No inbound firewall rules needed
- DDoS protection included

## Configuration

### DNS Records
- `ding.fish` → A record → GKE LoadBalancer IP
- `ws.ding.fish` → CNAME → Cloudflare Tunnel

### Tunnel Setup
1. Install cloudflared in GKE (see `k8s/cloudflared-tunnel.yaml`)
2. Configure tunnel to point to WebSocket service
3. Create DNS CNAME for `ws.ding.fish`

### SSL/TLS
- Mode: Full (strict)
- Certificate: Cloudflare managed
- Minimum TLS: 1.2

## Alternative: Cloudflare Spectrum

Spectrum is Cloudflare's Layer 4 proxy. Available on Pro plan ($20/month).

Why we didn't use it:
- Tunnel is free
- Tunnel works fine for our needs
- Spectrum adds complexity for no benefit

If you need Spectrum later, see archived docs in git history.

## Troubleshooting

### WebSocket connection fails
Check:
1. Tunnel is running: `kubectl get pods | grep cloudflared`
2. DNS is correct: `dig ws.ding.fish`
3. Cloudflare Tunnel status in dashboard

### Mixed content errors
Ensure:
- Main site uses HTTPS
- WebSocket uses WSS (not WS)
- `/api/rpc-proxy` handles HTTP RPC calls

## Reference

- Cloudflare Dashboard: https://dash.cloudflare.com
- Tunnel docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- Current tunnel config: `k8s/cloudflared-tunnel.yaml`
