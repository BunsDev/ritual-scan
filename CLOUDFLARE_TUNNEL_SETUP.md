# Cloudflare Tunnel for WebSocket - Setup Guide

## 🎯 What Cloudflare Tunnel Does

```
Browser (https://ding.fish)
    ↓
    wss://ws.ding.fish
    ↓
Cloudflare Edge (handles SSL)
    ↓
Cloudflare Tunnel (encrypted connection)
    ↓
cloudflared daemon (running in GKE)
    ↓
ws://35.196.101.134:8546 (RPC WebSocket)
```

**Benefits:**
- ✅ FREE (no extra cost)
- ✅ Full SSL/TLS support
- ✅ Handles WebSocket natively
- ✅ DDoS protection
- ✅ No inbound firewall rules needed

---

## 📋 Setup Steps

### **Step 1: Access Cloudflare Zero Trust**

In Cloudflare dashboard:

1. Look for **"Zero Trust"** in left sidebar
   - Or try direct link: https://one.dash.cloudflare.com/
2. If first time, click **"Start"** or **"Get Started"**
3. Choose a **team name** (e.g., "ritual-team")
4. Select **FREE plan** (0-50 users)

### **Step 2: Create Tunnel**

1. In Zero Trust dashboard, go to **"Networks"** → **"Tunnels"**
2. Click **"Create a tunnel"**
3. Choose **"Cloudflared"** (not WARP)
4. Name: **"rpc-websocket-tunnel"**
5. Click **"Save tunnel"**

### **Step 3: Install cloudflared in GKE**

Cloudflare will show you a token. Copy it!

Then I'll create the Kubernetes deployment for you.

**Copy the token** (looks like: `eyJhbGciOiJS...`) and paste it here.

---

## 🚀 What I'll Deploy

Once you give me the token, I'll create:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cloudflared
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: cloudflared
        image: cloudflare/cloudflared:latest
        args:
        - tunnel
        - --no-autoupdate
        - run
        - --token
        - YOUR_TOKEN_HERE
```

This will:
- Run cloudflared in your GKE cluster
- Connect to Cloudflare's network
- Create secure tunnel
- Proxy WebSocket traffic

### **Step 4: Configure Public Hostname**

After cloudflared connects:

1. In tunnel configuration, click **"Public Hostname"** tab
2. Click **"Add a public hostname"**
3. Configure:
   ```
   Subdomain: ws
   Domain: ding.fish
   Type: HTTP (for WebSocket)
   URL: 35.196.101.134:8546
   ```
4. Save

### **Step 5: Test!**

```bash
# DNS will auto-update
dig ws.ding.fish +short
# Returns Cloudflare IPs

# Test WebSocket
wscat -c wss://ws.ding.fish/
# Should connect!
```

---

## 🎯 Ready?

**Go to Cloudflare dashboard and find "Zero Trust" or go to:**
https://one.dash.cloudflare.com/

**Then navigate to Networks → Tunnels and create the tunnel. Once you have the token, send it to me and I'll deploy cloudflared to your GKE cluster!** 🚀

