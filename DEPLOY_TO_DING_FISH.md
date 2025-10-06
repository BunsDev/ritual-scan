# Deploy to ding.fish - Quick Guide

## 🎯 Production Deployment for ding.fish

**Live URLs:**
- Primary: https://ding.fish (via Cloudflare)
- Direct: http://34.133.158.181 (GKE LoadBalancer)

---

## 🚀 Quick Deploy (5 minutes)

### **Step 1: Authenticate**

```bash
gcloud auth login
gcloud container clusters get-credentials ritual-explorer-cluster --region=us-central1 --project=testing-logging-2
```

### **Step 2: Build & Push**

```bash
cd /home/ritual/repos/.elsa/ritual-scan

# Get current commit hash
COMMIT_HASH=$(git rev-parse --short HEAD)

# Build Docker image
docker build -t gcr.io/testing-logging-2/ritual-explorer:$COMMIT_HASH \
             -t gcr.io/testing-logging-2/ritual-explorer:latest .

# Push to Google Container Registry
docker push gcr.io/testing-logging-2/ritual-explorer:$COMMIT_HASH
docker push gcr.io/testing-logging-2/ritual-explorer:latest
```

### **Step 3: Deploy to GKE**

```bash
# Update deployment with new image
kubectl set image deployment/ritual-explorer \
  ritual-explorer=gcr.io/testing-logging-2/ritual-explorer:$COMMIT_HASH

# Wait for rollout to complete
kubectl rollout status deployment/ritual-explorer --timeout=5m
```

### **Step 4: Verify**

```bash
# Check pods are running
kubectl get pods -l app=ritual-explorer

# Check service
kubectl get service ritual-explorer-service

# Test the endpoint
curl http://34.133.158.181/
curl https://ding.fish/
```

---

## 📋 Infrastructure Details

### **GKE Cluster:**
```
Name: ritual-explorer-cluster
Region: us-central1
Project: testing-logging-2
```

### **Deployment:**
```
Name: ritual-explorer
Replicas: 2
Image: gcr.io/testing-logging-2/ritual-explorer:latest
Port: 3000 (internal)
```

### **Service:**
```
Name: ritual-explorer-service
Type: LoadBalancer
External IP: 34.133.158.181
Port: 80 → 3000
```

### **Cloudflare:**
```
DNS: ding.fish → Cloudflare IPs
Origin: 34.133.158.181 (GKE LoadBalancer)
SSL: Flexible mode
WebSocket: Enabled
Tunnel: rpc-websocket-tunnel → ws.ding.fish
```

---

## 🔧 Useful Commands

### **Logs:**
```bash
# Tail logs from all pods
kubectl logs -l app=ritual-explorer --tail=100 -f

# Logs from specific pod
kubectl logs ritual-explorer-XXXXX-XXXXX --tail=200
```

### **Scaling:**
```bash
# Scale up/down
kubectl scale deployment/ritual-explorer --replicas=3

# Auto-scale
kubectl autoscale deployment/ritual-explorer --min=2 --max=5 --cpu-percent=80
```

### **Rollback:**
```bash
# Rollback to previous version
kubectl rollout undo deployment/ritual-explorer

# Rollback to specific revision
kubectl rollout history deployment/ritual-explorer
kubectl rollout undo deployment/ritual-explorer --to-revision=2
```

### **Restart:**
```bash
# Force restart (no code change)
kubectl rollout restart deployment/ritual-explorer
```

---

## 🐛 Troubleshooting

### **Pods not starting:**
```bash
kubectl describe pod ritual-explorer-XXXXX-XXXXX
kubectl logs ritual-explorer-XXXXX-XXXXX
```

### **Service not accessible:**
```bash
kubectl get service ritual-explorer-service
kubectl describe service ritual-explorer-service
```

### **Cloudflare not working:**
```bash
# Check if origin is reachable
curl http://34.133.158.181/

# Check Cloudflare DNS
dig ding.fish +short

# Check Cloudflare Tunnel
kubectl get pods -l app=cloudflared
kubectl logs -l app=cloudflared --tail=50
```

---

## 📦 What Gets Deployed

**Latest Features:**
- ✅ WebSocket over HTTPS (Cloudflare Tunnel)
- ✅ 500-block global cache
- ✅ 1000-block per-page windows
- ✅ Real-time analytics charts
- ✅ Wallet connection (MetaMask/WalletConnect)
- ✅ Auto-faucet (100 RITUAL on connect)
- ✅ Validator world map visualization
- ✅ Activity distribution histogram
- ✅ 40+ Ritual method signatures
- ✅ Clean UI (no dev tools visible)

**Configuration:**
- Password: `notthelastlayer1~`
- RPC Endpoint: http://35.196.202.163:8545
- WebSocket: ws://35.196.202.163:8546
- Cloudflare Tunnel: wss://ws.ding.fish/

---

## 🔄 CI/CD (Optional)

**For automated deployments, create:**

`.github/workflows/deploy-gke.yml`:
```yaml
name: Deploy to GKE
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Cloud SDK
        uses: google-github-actions/setup-gcloud@v1
        with:
          service_account_key: ${{ secrets.GCP_SA_KEY }}
          project_id: testing-logging-2
      
      - name: Configure Docker
        run: gcloud auth configure-docker
      
      - name: Build & Push
        run: |
          COMMIT=$(git rev-parse --short HEAD)
          docker build -t gcr.io/testing-logging-2/ritual-explorer:$COMMIT .
          docker push gcr.io/testing-logging-2/ritual-explorer:$COMMIT
      
      - name: Deploy
        run: |
          gcloud container clusters get-credentials ritual-explorer-cluster --region=us-central1
          kubectl set image deployment/ritual-explorer ritual-explorer=gcr.io/testing-logging-2/ritual-explorer:$COMMIT
```

---

## ✅ Quick Deploy Checklist

- [ ] Committed all changes to git
- [ ] Authenticated with gcloud
- [ ] Built Docker image
- [ ] Pushed to GCR
- [ ] Set new image on deployment
- [ ] Waited for rollout to complete
- [ ] Verified pods are running
- [ ] Tested https://ding.fish
- [ ] Checked console for errors
- [ ] Verified WebSocket connection

**Total time: ~5 minutes** (most of it is build time)

---

## 🎯 One-Liner Deploy

```bash
cd /home/ritual/repos/.elsa/ritual-scan && \
  COMMIT=$(git rev-parse --short HEAD) && \
  docker build -t gcr.io/testing-logging-2/ritual-explorer:$COMMIT -t gcr.io/testing-logging-2/ritual-explorer:latest . && \
  docker push gcr.io/testing-logging-2/ritual-explorer:$COMMIT && \
  docker push gcr.io/testing-logging-2/ritual-explorer:latest && \
  kubectl set image deployment/ritual-explorer ritual-explorer=gcr.io/testing-logging-2/ritual-explorer:$COMMIT && \
  kubectl rollout status deployment/ritual-explorer --timeout=5m
```

Copy/paste this for instant deploy! 🚀

