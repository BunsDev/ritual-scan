#!/bin/bash

# Deploy to ding.fish Production
# Quick deployment script for https://ding.fish

set -e

echo "🚀 Deploying to ding.fish (Production)"
echo "======================================"
echo ""

PROJECT_ID="testing-logging-2"
CLUSTER_NAME="ritual-explorer-cluster"
REGION="us-central1"
DEPLOYMENT_NAME="ritual-explorer"
IMAGE_NAME="ritual-explorer"

# Get current commit
COMMIT_HASH=$(git rev-parse --short HEAD)
IMAGE="gcr.io/$PROJECT_ID/$IMAGE_NAME:$COMMIT_HASH"
LATEST_IMAGE="gcr.io/$PROJECT_ID/$IMAGE_NAME:latest"

echo "📋 Deployment Info:"
echo "   Cluster: $CLUSTER_NAME"
echo "   Region: $REGION"
echo "   Project: $PROJECT_ID"
echo "   Deployment: $DEPLOYMENT_NAME"
echo "   Image: $IMAGE"
echo "   Commit: $COMMIT_HASH"
echo ""

# Ensure authenticated
echo "🔐 Checking authentication..."
if ! kubectl cluster-info --request-timeout=5s > /dev/null 2>&1; then
    echo "⚠️  No cluster access - authenticating..."
    gcloud container clusters get-credentials $CLUSTER_NAME --region=$REGION --project=$PROJECT_ID
    echo "✅ Authenticated"
fi

# Update Cloudflare Tunnel configuration (if credentials available)
echo ""
echo "🔧 Updating Cloudflare Tunnel..."
./scripts/update-cloudflare-tunnel.sh || echo "   (Skipped - manual update required)"

# Build Docker image
echo ""
echo "🏗️  Building Docker image..."
docker build -t $IMAGE -t $LATEST_IMAGE . 

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed!"
    exit 1
fi

echo "✅ Build successful"

# Push to GCR
echo ""
echo "📤 Pushing to Google Container Registry..."
docker push $IMAGE
docker push $LATEST_IMAGE

echo "✅ Images pushed"

# Deploy to GKE
echo ""
echo "🚢 Deploying to GKE..."
kubectl set image deployment/$DEPLOYMENT_NAME $DEPLOYMENT_NAME=$IMAGE

echo "⏳ Waiting for rollout..."
kubectl rollout status deployment/$DEPLOYMENT_NAME --timeout=5m

if [ $? -ne 0 ]; then
    echo "❌ Rollout failed!"
    exit 1
fi

# Get deployment info
echo ""
echo "✅ Deployment Complete!"
echo ""
echo "📊 Current Status:"
kubectl get deployment $DEPLOYMENT_NAME
echo ""
kubectl get pods -l app=$DEPLOYMENT_NAME
echo ""

# Get service info
echo "🌐 Service Information:"
kubectl get service ritual-explorer-service
echo ""

echo "✅ ding.fish is now running commit: $COMMIT_HASH"
echo ""
echo "🌐 Access your app:"
echo "   https://ding.fish (Cloudflare with WebSocket)"
echo "   http://34.133.158.181 (Direct)"
echo ""
echo "🔍 Useful commands:"
echo "   Logs:    kubectl logs -l app=$DEPLOYMENT_NAME --tail=100 -f"
echo "   Pods:    kubectl get pods -l app=$DEPLOYMENT_NAME"
echo "   Restart: kubectl rollout restart deployment/$DEPLOYMENT_NAME"
echo ""
echo "📚 Documentation:"
echo "   Cloudflare: docs/deployment/CLOUDFLARE.md"
echo "   Deployment: docs/deployment/DEPLOY_TO_DING_FISH.md"
echo ""

