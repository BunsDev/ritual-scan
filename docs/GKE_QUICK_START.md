# GKE Quick Start Guide
## Ritual Blockchain Explorer

### One-Command Deployment

```bash
# 1. Setup GKE cluster (one-time)
make setup-gke PROJECT_ID=your-gcp-project-id

# 2. Deploy application  
make deploy-gke PROJECT_ID=your-gcp-project-id
```

### Prerequisites

1. **Google Cloud SDK** installed and authenticated
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Docker** installed and running

3. **kubectl** installed (comes with gcloud)

4. **Make** installed

### Quick Deployment Steps

#### Step 1: Setup GKE Cluster (5-10 minutes)
```bash
# Replace with your actual GCP project ID
make setup-gke PROJECT_ID=my-ritual-project
```

This will:
- Enable required APIs
- Create GKE cluster with 2 nodes
- Configure authentication
- Setup service accounts

#### Step 2: Deploy Application (3-5 minutes)
```bash
# Deploy to the cluster
make deploy-gke PROJECT_ID=my-ritual-project
```

This will:
- Build Docker image
- Push to Google Container Registry
- Deploy to GKE cluster
- Show access information

### Management Commands

```bash
# Check deployment status
make gke-status

# View logs
make gke-logs  

# Access pod shell
make gke-shell

# Scale deployment
make gke-scale REPLICAS=5

# Port forward for local access
kubectl port-forward service/ritual-scan-service 8080:80
# Access at http://localhost:8080
```

### Accessing Your Application

After deployment, get the external IP:
```bash
kubectl get services ritual-scan-service
```

Or use port forwarding for immediate access:
```bash
kubectl port-forward service/ritual-scan-service 8080:80
# Open http://localhost:8080
```

### Cost Estimate

| Component | Configuration | Monthly Cost |
|-----------|---------------|--------------|
| **GKE Cluster** | 2 n1-standard-1 nodes | $45-60 |
| **Load Balancer** | Standard HTTP(S) LB | $20 |
| **Container Registry** | 5GB storage | $1 |
| **Total** | | **~$65-80/month** |

### Configuration

#### **Environment Variables**
Copy and customize the template:
```bash
cp .env.gke.template .env.gke
# Edit .env.gke with your values
```

#### **Custom Domain**
Update `k8s/deployment.yaml`:
```yaml
# Line 90 & 93
- ritual-scan.YOUR_DOMAIN.com
```

### Troubleshooting

#### **Common Issues**

**Cluster Creation Fails:**
```bash
# Check quotas
gcloud compute project-info describe --project=PROJECT_ID

# Try different region
make setup-gke PROJECT_ID=my-project REGION=us-west2
```

**Image Push Fails:**
```bash
# Authenticate Docker with GCR
gcloud auth configure-docker
```

**Pods Not Starting:**
```bash
# Check pod logs
kubectl logs -l app=ritual-scan
kubectl describe pods -l app=ritual-scan
```

**No External IP:**
```bash
# Check load balancer provisioning
kubectl get services ritual-scan-service -w
```

### Production Considerations

#### **Security**
- Enable network policies
- Use Google Secret Manager
- Configure RBAC properly
- Enable audit logging

#### **Monitoring**
- Setup Google Cloud Monitoring
- Configure alerting policies
- Enable container logging

#### **High Availability**
- Multi-zone cluster
- Pod disruption budgets
- Backup strategies

### Cleanup

To delete everything:
```bash
# Delete application
make gke-cleanup

# Delete cluster (saves costs)
gcloud container clusters delete ritual-scan-cluster --region=us-central1
```

### Advanced Usage

#### **Custom Cluster Configuration**
```bash
# Create cluster with custom settings
./scripts/setup-gke.sh PROJECT_ID custom-cluster us-west2
```

#### **Multiple Environments**
```bash
# Setup staging
make setup-gke PROJECT_ID=my-project CLUSTER_NAME=ritual-staging

# Deploy to staging
sed 's/PROJECT_ID/my-project/g' k8s/deployment.yaml | \
  kubectl apply -f - --context=gke_my-project_us-central1_ritual-staging
```

---

## **🎯 Summary**

**Time to Deploy: ~10-15 minutes**
- 5-10 mins: Cluster setup (one-time)
- 3-5 mins: Application deployment
- Ready to use!

**Monthly Cost: ~$65-80**
**Scalability: 1-10 pods automatically**
**Availability: Multi-zone, load balanced**

This setup gives you a production-ready Ritual blockchain explorer on Google Kubernetes Engine with minimal configuration!
