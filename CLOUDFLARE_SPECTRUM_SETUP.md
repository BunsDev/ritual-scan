# Cloudflare Spectrum for WebSocket - Setup Guide

## 🎯 What Spectrum Does

Spectrum is Cloudflare's Layer 4 proxy that can handle:
- ✅ WebSocket over SSL/TLS
- ✅ Any TCP/UDP protocol
- ✅ DDoS protection
- ✅ SSL termination

Perfect for our WebSocket needs!

## 💰 Availability

**Included in:**
- Pro plan ($20/month) - Limited
- Business plan ($200/month) - More apps
- Enterprise - Unlimited

**If you're on Pro ($20/month), you should have access!**

---

## 📋 Setup Steps

### **Step 1: Check if Spectrum is Available**

In Cloudflare dashboard for ding.fish:

1. Look in left sidebar for **"Spectrum"** tab
2. If you see it → You have access! ✅
3. If you don't see it → Your plan might not include it

### **Step 2: Create Spectrum Application**

Click on **"Spectrum"** in sidebar, then:

1. Click **"Create an Application"**

2. **Application Name:**
   ```
   WebSocket Proxy
   ```

3. **Domain:**
   ```
   ws.ding.fish
   ```

4. **Edge Port:** (What users connect to)
   ```
   443
   ```

5. **Origin:** (Where Spectrum forwards to)
   ```
   Hostname: 35.196.101.134
   Port: 8546
   Protocol: TCP
   ```

6. **TLS:**
   ```
   ✓ Enable TLS
   ```

7. **Proxy Protocol:**
   ```
   Off (or Simple - depends on UI)
   ```

8. Click **"Save"**

### **Step 3: Wait for DNS Propagation**

Cloudflare will automatically create DNS record for `ws.ding.fish`

Wait 1-2 minutes, then check:
```bash
dig ws.ding.fish +short
# Should return Cloudflare IPs
```

### **Step 4: Update Client Code**

Already done! The code will connect to `wss://ws.ding.fish/`

### **Step 5: Deploy Updated Code**

I'll rebuild and deploy once you have Spectrum configured.

---

## 🧪 Testing

**After Spectrum is configured:**

```bash
# Test WebSocket through Spectrum
wscat -c wss://ws.ding.fish/
# Should connect successfully!

# Test JSON-RPC
wscat -c wss://ws.ding.fish/ -x '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
# Should return block number
```

**In browser:**
```
Open https://ding.fish
Console should show:
🔗 Production HTTPS - WebSocket subdomain: wss://ws.ding.fish/
✅ WebSocket connected
```

---

## 🎯 If Spectrum Tab Doesn't Exist

Your plan might not include it. Options:

1. **Upgrade to Business** ($200/month) - includes Spectrum
2. **Use polling** (current, works fine)
3. **Set up Cloudflare Tunnel** (free alternative, more complex)

---

**Go to your Cloudflare dashboard for ding.fish and look for "Spectrum" in the left sidebar. Let me know if you see it!** 🔍

