#!/bin/bash

echo "🚀 Deploying Latest Ritual Explorer to GKE"
echo "==========================================="
echo ""

PROJECT_ID="testing-logging-2"
DEPLOYMENT_NAME="ritual-explorer-http"
IMAGE="gcr.io/$PROJECT_ID/ritual-explorer:latest"
COMMIT_HASH=$(git rev-parse --short HEAD)

echo "📋 Deployment Info:"
echo "   Project: $PROJECT_ID"
echo "   Deployment: $DEPLOYMENT_NAME"
echo "   Image: $IMAGE"
echo "   Git Commit: $COMMIT_HASH"
echo ""

# Check if we have kubectl access
echo "🔍 Checking cluster access..."
if kubectl cluster-info --request-timeout=5s > /dev/null 2>&1; then
    echo "✅ Cluster access confirmed"
else
    echo "⚠️  No cluster access - need to authenticate"
    echo "   Run: gcloud container clusters get-credentials ritual-explorer-cluster --region=us-central1 --project=$PROJECT_ID"
    exit 1
fi

# Get current deployment status
echo ""
echo "📊 Current Status:"
kubectl get deployment $DEPLOYMENT_NAME 2>/dev/null || echo "Deployment not found - using http-deployment.yaml"

# Determine which deployment exists
if kubectl get deployment $DEPLOYMENT_NAME > /dev/null 2>&1; then
    # Rolling update existing deployment
    echo ""
    echo "🔄 Triggering rolling update..."
    kubectl set image deployment/$DEPLOYMENT_NAME ritual-explorer-http=$IMAGE
    
    echo "⏳ Waiting for rollout to complete..."
    kubectl rollout status deployment/$DEPLOYMENT_NAME --timeout=5m
    
else
    # Deploy fresh
    echo ""
    echo "📦 Deploying new instance..."
    sed "s/PROJECT_ID/$PROJECT_ID/g" k8s/http-deployment.yaml | kubectl apply -f -
    
    echo "⏳ Waiting for deployment..."
    kubectl rollout status deployment/$DEPLOYMENT_NAME --timeout=5m
fi

# Get service info
echo ""
echo "🌐 Service Information:"
kubectl get services ritual-explorer-http-service

# Get external IP
EXTERNAL_IP=$(kubectl get service ritual-explorer-http-service -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")

echo ""
echo "✅ Deployment Complete!"
echo ""
if [ -n "$EXTERNAL_IP" ]; then
    echo "🌐 Access your app at: http://$EXTERNAL_IP"
    echo ""
    echo "🔍 Features deployed:"
    echo "   ✅ Real-time WebSocket updates (direct connection)"
    echo "   ✅ 500-block global cache"
    echo "   ✅ 1000-block per-page windows"
    echo "   ✅ localStorage persistence (5-min TTL)"
    echo "   ✅ Analytics live charts"
    echo "   ✅ 40+ Ritual method signatures"
    echo "   ✅ All transaction display (no 10-tx limit)"
else
    echo "⏳ LoadBalancer IP still provisioning..."
    echo "   Check with: kubectl get services ritual-explorer-http-service"
fi

echo ""
echo "🔧 Useful Commands:"
echo "   Logs:     kubectl logs -l app=ritual-explorer-http --tail=100 -f"
echo "   Pods:     kubectl get pods -l app=ritual-explorer-http"
echo "   Scale:    kubectl scale deployment/$DEPLOYMENT_NAME --replicas=3"
echo "   Restart:  kubectl rollout restart deployment/$DEPLOYMENT_NAME"
echo ""

