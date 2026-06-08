# Complete CI/CD & Kubernetes Setup Guide

## 📋 Overview

This is a production-ready, security-focused CI/CD pipeline and Kubernetes deployment system for the OneStop Backend application. The setup follows industry-standard DevOps and security practices.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub Actions CI/CD                      │
├─────────────────────────────────────────────────────────────────┤
│  1. Code Push (main/develop)                                     │
│  2. Security Scanning (Trivy, npm audit, CodeQL, TruffleHog)    │
│  3. Docker Build (Multi-stage, non-root, SBOM)                  │
│  4. Image Scanning (Trivy, Grype)                               │
│  5. Push to GHCR (GitHub Container Registry)                     │
│  6. Update K8s Manifests (via Kustomize)                         │
│  7. GitOps Sync (ArgoCD/Flux)                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Kubernetes Cluster                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │   Production     │  │     Staging      │                     │
│  ├──────────────────┤  ├──────────────────┤                     │
│  │ • 3+ replicas    │  │ • 2 replicas     │                     │
│  │ • HPA 3-20       │  │ • HPA 2-5        │                     │
│  │ • TLS enabled    │  │ • TLS enabled    │                     │
│  │ • Network policy │  │ • Network policy │                     │
│  │ • RBAC           │  │ • RBAC           │                     │
│  └──────────────────┘  └──────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Repository Structure

```
onestop_backend-main/
├── .github/
│   ├── workflows/
│   │   ├── deploy.yml           # Main CI/CD pipeline
│   │   └── security-scan.yml    # Daily security scanning
│   └── SECURITY.md              # Security policy
├── k8s-manifests/               # All Kubernetes resources
│   ├── base/                    # Base manifests
│   │   ├── deployment.yaml      # Secure deployment config
│   │   ├── service.yaml         # Service definition
│   │   ├── hpa.yaml             # Autoscaling config
│   │   ├── networkpolicy.yaml   # Network security
│   │   ├── serviceaccount.yaml  # Service account
│   │   ├── rbac.yaml            # Access control
│   │   ├── configmap.yaml       # App configuration
│   │   ├── secret.yaml          # Secrets template
│   │   ├── ingress.yaml         # TLS ingress
│   │   ├── poddisruptionbudget.yaml
│   │   └── kustomization.yaml
│   ├── overlays/
│   │   ├── production/          # Production overrides
│   │   └── staging/             # Staging overrides
│   ├── deploy.sh                # Deployment helper
│   ├── create-secrets.sh        # Secret creation helper
│   └── README.md
├── src/                         # Application code
├── Dockerfile                   # Secure Docker build
├── .dockerignore
├── SETUP.md                     # Setup instructions
└── package.json
```

## 🔐 Security Features

### Container Security
- ✅ **Multi-stage builds**: Minimal attack surface
- ✅ **Non-root execution**: UID 1001, no privilege escalation
- ✅ **Read-only root filesystem**: Prevents runtime tampering
- ✅ **Dropped capabilities**: ALL Linux capabilities removed
- ✅ **Seccomp profile**: Runtime security
- ✅ **Health checks**: Liveness, readiness, startup probes

### Network Security
- ✅ **Network Policies**: Explicit allow-list for ingress/egress
- ✅ **Default deny**: Blocks all traffic by default
- ✅ **TLS termination**: HTTPS-only with cert-manager
- ✅ **Rate limiting**: DDoS protection
- ✅ **Security headers**: X-Frame-Options, CSP, etc.

### Access Control
- ✅ **RBAC**: Least-privilege access
- ✅ **ServiceAccount**: Dedicated account per service
- ✅ **No token auto-mount**: Disabled by default
- ✅ **Namespace isolation**: Separate prod/staging

### CI/CD Security
- ✅ **Vulnerability scanning**: Trivy, Grype, npm audit
- ✅ **SAST analysis**: CodeQL for code vulnerabilities
- ✅ **Secret detection**: TruffleHog prevents credential leaks
- ✅ **SBOM generation**: Supply chain transparency
- ✅ **Image signing**: Provenance attestations
- ✅ **Dependency review**: Automated PR checks

### Operational Security
- ✅ **Resource limits**: CPU/memory constraints
- ✅ **HPA**: Auto-scaling prevents resource exhaustion
- ✅ **PDB**: High availability during updates
- ✅ **Anti-affinity**: Pod distribution across nodes/zones
- ✅ **Audit logging**: Track all changes

## 🚀 Quick Start

### 1. Prerequisites

**Required:**
- GitHub repository (this repo)
- Kubernetes cluster (1.24+)
- kubectl configured
- GitHub Container Registry access

**Optional but recommended:**
- cert-manager (for TLS certificates)
- ArgoCD or Flux (for GitOps)
- Sealed Secrets or External Secrets Operator

### 2. GitHub Configuration

#### A. Enable Actions Permissions
1. Go to repository **Settings** → **Actions** → **General**
2. Under "Workflow permissions":
   - Select **"Read and write permissions"**
   - Check **"Allow GitHub Actions to create and approve pull requests"**
3. Click **Save**

#### B. Create GitHub Secrets
Go to **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

**Required Secrets:**

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `DOCKER_HUB_USERNAME` | Docker Hub username | `your-dockerhub-user` |
| `DOCKER_HUB_TOKEN` | Docker Hub access token | Create at hub.docker.com |
| `DOCKER_HUB_REPOSITORY` | Docker Hub repository | `your-user/onestop-backend` |
| `K8S_REPO_NAME` | Your K8s repository name | `your-org/k8s-manifests` |
| `K8S_REPO_PAT` | Personal Access Token | Create with `repo` scope |

**Optional Secrets:**

| Secret Name | Description |
|-------------|-------------|
| `SLACK_WEBHOOK_URL` | Slack notifications |
| `ARGOCD_AUTH_TOKEN` | ArgoCD API token (for manual sync trigger) |
| `ARGOCD_SERVER` | ArgoCD server URL |
| `NOTIFICATION_EMAIL` | Email for failure alerts |

**Create Docker Hub Access Token:**
1. Go to [Docker Hub](https://hub.docker.com/)
2. Account Settings → **Security** → **New Access Token**
3. Name: `github-actions`, Permissions: **Read, Write, Delete**
4. Copy token and save as `DOCKER_HUB_TOKEN` secret

**Create Personal Access Token (PAT):**
1. Go to GitHub **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click **"Generate new token (classic)"**
3. Set scopes: `repo`, `workflow`
4. Copy token and save as `K8S_REPO_PAT` secret

### 3. Kubernetes Cluster Setup

#### A. Create Namespaces
```bash
kubectl create namespace production
kubectl create namespace staging
```

#### B. Create Secrets

**Option 1: Using the helper script**
```bash
cd k8s-manifests
chmod +x create-secrets.sh
./create-secrets.sh production
./create-secrets.sh staging
```

**Option 2: Manual creation**
```bash
kubectl create secret generic onestop-backend-secrets \
  --namespace=production \
  --from-literal=DATABASE_URL='postgresql://user:pass@host:5432/db' \
  --from-literal=MONGODB_URI='mongodb://user:pass@host:27017/db' \
  --from-literal=JWT_SECRET='your-secure-jwt-secret-min-32-chars' \
  --from-literal=JWT_REFRESH_SECRET='your-refresh-secret-min-32-chars' \
  --from-literal=AWS_ACCESS_KEY_ID='your-access-key' \
  --from-literal=AWS_SECRET_ACCESS_KEY='your-secret-key' \
  --from-literal=SMTP_HOST='smtp.gmail.com' \
  --from-literal=SMTP_PORT='587' \
  --from-literal=SMTP_USER='noreply@example.com' \
  --from-literal=SMTP_PASSWORD='your-smtp-password'

# Repeat for staging namespace
```

**Option 3: Using Sealed Secrets (Recommended)**
```bash
# Install Sealed Secrets controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# Install kubeseal CLI
brew install kubeseal  # macOS
# or download from releases

# Create and seal secret
kubectl create secret generic onestop-backend-secrets \
  --from-literal=DATABASE_URL='...' \
  --dry-run=client -o yaml | \
  kubeseal --format yaml > sealed-secret.yaml

# Apply sealed secret
kubectl apply -f sealed-secret.yaml -n production
```

#### C. Install Ingress Controller (if not already installed)
```bash
# Nginx Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml
```

#### D. Install cert-manager (for TLS)
```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer for Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

### 4. Configure K8s Manifests

#### A. Update Domain Names

Edit these files and replace `yourdomain.com`:

**`k8s-manifests/base/ingress.yaml`**
```yaml
spec:
  tls:
  - hosts:
    - api.yourdomain.com  # ← Change this
```

**`k8s-manifests/overlays/production/patch-ingress.yaml`**
```yaml
spec:
  rules:
  - host: api.yourdomain.com  # ← Change this
```

**`k8s-manifests/overlays/staging/patch-ingress.yaml`**
```yaml
spec:
  rules:
  - host: staging-api.yourdomain.com  # ← Change this
```

#### B. Update ConfigMaps

Edit `k8s-manifests/base/configmap.yaml`:
```yaml
data:
  CORS_ORIGIN: "https://yourdomain.com"  # ← Update
  S3_BUCKET_NAME: "your-bucket-name"     # ← Update
  AWS_REGION: "us-east-1"                # ← Update
```

#### C. Update Image Repository

Edit `k8s-manifests/base/kustomization.yaml`:
```yaml
images:
- name: ghcr.io/your-org/onestop-backend  # ← Change your-org
  newTag: latest
```

### 5. Deploy to Kubernetes

#### Option 1: Using the helper script
```bash
cd k8s-manifests
chmod +x deploy.sh

# Preview staging
./deploy.sh staging preview

# Deploy staging
./deploy.sh staging apply

# Deploy production
./deploy.sh production apply
```

#### Option 2: Manual deployment
```bash
cd k8s-manifests

# Staging
kubectl apply -k overlays/staging

# Production
kubectl apply -k overlays/production
```

#### Option 3: ArgoCD Sync (Automatic)

Your ArgoCD server is already configured and running on a separate server. It will automatically detect changes when the GitHub Actions workflow updates the image tag in your K8s repository.

**No manual deployment needed** - ArgoCD handles it automatically!

Monitor deployment progress in your ArgoCD dashboard.

### 6. Verify Deployment

```bash
# Check pods
kubectl get pods -n production
kubectl get pods -n staging

# Check services
kubectl get svc -n production

# Check ingress
kubectl get ingress -n production

# Check HPA
kubectl get hpa -n production

# View logs
kubectl logs -f deployment/prod-onestop-backend -n production

# Check rollout status
kubectl rollout status deployment/prod-onestop-backend -n production
```

### 7. Test the Application

```bash
# Get ingress IP/hostname
kubectl get ingress onestop-backend-ingress -n production

# Test health endpoint
curl https://api.yourdomain.com/health

# Check TLS certificate
curl -vI https://api.yourdomain.com
```

## 🔄 CI/CD Workflow

### Automatic Deployment Flow

1. **Developer pushes code** to `production` branch
2. **GitHub Actions triggers**:
   - Security scanning (Trivy, CodeQL, TruffleHog, npm audit)
   - Docker image build (multi-stage, non-root, secure)
   - Image scanning (Trivy + Grype)
   - SBOM generation
   - Image signing with Cosign
   - Push to Docker Hub
   - Update K8s manifests in separate repo
3. **ArgoCD detects change** (auto-sync from your ArgoCD server)
4. **Automatic deployment** to production cluster
5. **Health checks** verify deployment
6. **Notification** sent (Slack/email)

### Branch Strategy

- **`production`** → Production environment (triggers deployment)
- **Pull Requests** → Security scans only (no deployment)

**Note:** Deployment only happens on push to `production` branch for maximum security and control.

### Manual Deployment

If you need to deploy manually:

```bash
# Build and push image
docker build -t ghcr.io/your-org/onestop-backend:v1.0.0 .
docker push ghcr.io/your-org/onestop-backend:v1.0.0

# Update manifest
cd k8s-manifests/overlays/production
kustomize edit set image ghcr.io/your-org/onestop-backend=ghcr.io/your-org/onestop-backend:v1.0.0

# Deploy
kubectl apply -k .
```

## 📊 Monitoring & Operations

### View Logs
```bash
# All pods in namespace
kubectl logs -f -l app=onestop-backend -n production

# Specific pod
kubectl logs -f pod-name -n production

# Previous contayour-dockerhub-user/onestop-backend:v1.0.0 .
docker push your-dockerhub-user/onestop-backend:v1.0.0

# Update manifest in K8s repo
cd k8s-manifests/overlays/production
kustomize edit set image your-dockerhub-user/onestop-backend=your-dockerhub-user/onestop-backend:v1.0.0

# Commit and push (ArgoCD will auto-sync)
git add kustomization.yaml
git commit -m "chore: manual deploy v1.0.0"
git push

# ArgoCD will automatically deploy the changes
# Monitor in ArgoCD dashboard
# Update HPA limits
kubectl patch hpa onestop-backend-hpa -n production \
  --patch '{"spec":{"maxReplicas":30}}'
```

### Rollback Deployment
```bash
# View rollout history
kubectl rollout history deployment/prod-onestop-backend -n production

# Rollback to previous version
kubectl rollout undo deployment/prod-onestop-backend -n production

# Rollback to specific revision
kubectl rollout undo deployment/prod-onestop-backend --to-revision=2 -n production
```

### Update Configuration
```bash
# Edit ConfigMap
kubectl edit configmap onestop-backend-config -n production

# Restart deployment to pick up changes
kubectl rollout restart deployment/prod-onestop-backend -n production
```

### Debug Issues
```bash
# Describe pod (shows events)
kubectl describe pod pod-name -n production

# Get recent events
kubectl get events -n production --sort-by='.lastTimestamp'

# Shell into pod
kubectl exec -it pod-name -n production -- /bin/sh

# Debug with temporary pod
kubectl run debug --rm -it --image=nicolaka/netshoot -n production -- /bin/bash
```

## 🛡️ Security Best Practices

### Secrets Management
1. **Never commit secrets to git**
2. Use Sealed Secrets or External Secrets Operator
3. Rotate secrets regularly (every 90 days)
4. Use strong, randomly generated passwords
5. Prefer IAM roles over access keys (AWS)

### Container Security
1. Always use specific image tags (not `latest`)
2. Scan images before deployment
3. Run as non-root user
4. Use read-only root filesystem
5. Drop all capabilities

### Network Security
1. Use Network Policies (default deny)
2. Enable TLS everywhere
3. Implement rate limiting
4. Use Web Application Firewall (WAF)
5. Regular security audits

### Access Control
1. Follow principle of least privilege
2. Use RBAC for all access
3. Audit all actions
4. Require MFA for production access
5. Regular access reviews

## 🔧 Troubleshooting

### Pods not starting
**Symptoms**: Pods stuck in `Pending`, `CrashLoopBackOff`, or `Error`

**Solutions**:
```bash
# Check pod status
kubectl describe pod pod-name -n production

# Common issues:
# - Insufficient resources: Check HPA and node capacity
# - Image pull errors: Verify image exists and credentials
# - Secret not found: Ensure secrets are created
# - Health check failing: Check application logs
```

### High memory usage
```bash
# Check resource usage
kubectl top pods -n production

# Increase memory limits
# Edit k8s-manifests/overlays/production/patch-deployment.yaml
```

### Network connectivity issues
```bash
# Test from debug pod
kubectl run test --rm -it --image=busybox -n production -- /bin/sh
wget -O- http://onestop-backend:80/health

# Check network policies
kubectl get networkpolicy -n production
kubectl describe networkpolicy onestop-backend-netpol -n production
```

### HPA not scaling
```bash
# Check metrics server
kubectl top nodes
kubectl top pods -n production

# If metrics unavailable, install metrics-server:
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

### Ingress not working
```bash
# Check ingress
kubectl describe ingress onestop-backend-ingress -n production

# Check ingress controller
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx

# Verify DNS points to load balancer
kubectl get svc -n ingress-nginx
```

## 📚 Additional Resources

- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [OWASP Kubernetes Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Kubernetes_Security_Cheat_Sheet.html)
- [CIS Kubernetes Benchmark](https://www.cisecurity.org/benchmark/kubernetes)
- [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)

## 🤝 Support

For issues or questions:
- Review documentation in `SETUP.md` and `k8s-manifests/README.md`
- Check [SECURITY.md](.github/SECURITY.md) for security concerns
- Open an issue in the repository
- Contact the DevOps team

## ✅ Checklist

Before going to production, ensure:

- [ ] All secrets are created and not committed to git
- [ ] Domain names are updated in all manifests
- [ ] TLS certificates are configured (cert-manager)
- [ ] Resource limits are appropriate for your load
- [ ] HPA settings match your scaling needs
- [ ] Network policies are tested
- [ ] Monitoring is set up (Prometheus/Grafana)
- [ ] Logging is configured (ELK/Loki)
- [ ] Backup strategy is in place
- [ ] Disaster recovery plan is documented
- [ ] Security scanning is passing
- [ ] Load testing is complete
- [ ] Rollback procedure is tested
- [ ] Team is trained on operations

---

**Version**: 1.0.0  
**Last Updated**: May 2026  
**Maintained by**: DevOps Team
