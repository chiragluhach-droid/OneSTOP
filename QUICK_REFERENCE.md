# 🚀 Quick Reference - CI/CD Setup

## Workflow Trigger
- **Branch**: `production` only
- **Action**: Push to production branch triggers full CI/CD pipeline
- **Pull Requests**: Security scans only (no deployment)

## Pipeline Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Push to 'production' branch                                │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Security Scanning                                          │
│  • Trivy filesystem scan                                    │
│  • npm audit                                                │
│  • Secret detection                                         │
│  • CodeQL analysis                                          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Build Docker Image                                         │
│  • Multi-stage build                                        │
│  • Non-root user (UID 1001)                                 │
│  • Read-only filesystem                                     │
│  • Security hardened                                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Image Security Scanning                                    │
│  • Trivy vulnerability scan (CRITICAL/HIGH)                 │
│  • Grype security scan                                      │
│  • SBOM generation                                          │
│  • Cosign image signing                                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Push to Docker Hub                                         │
│  • Tags: prod-{sha}-{timestamp}, latest                     │
│  • Signed with Cosign                                       │
│  • SBOM attached                                            │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Update K8s Manifests                                       │
│  • Clone K8s repository                                     │
│  • Update image tag in overlays/production                  │
│  • Commit with [skip ci]                                    │
│  • Push changes                                             │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  ArgoCD Auto-Sync (External Server)                         │
│  • Detects K8s manifest changes                             │
│  • Syncs to production cluster                              │
│  • Rolling update deployment                                │
│  • Health checks validation                                 │
└─────────────────────────────────────────────────────────────┘
```

## Required GitHub Secrets

| Secret | Purpose | Format/Example |
|--------|---------|----------------|
| `DOCKER_HUB_USERNAME` | Docker Hub login | `johnsmith` |
| `DOCKER_HUB_TOKEN` | Docker Hub access token | From hub.docker.com |
| `DOCKER_HUB_REPOSITORY` | Image repository name | `johnsmith/onestop-backend` |
| `K8S_REPO_NAME` | K8s manifests repo | `myorg/k8s-manifests` |
| `K8S_REPO_PAT` | GitHub PAT for K8s repo | With `repo` scope |

## Optional Secrets

| Secret | Purpose |
|--------|---------|
| `SLACK_WEBHOOK_URL` | Slack deployment notifications |
| `ARGOCD_AUTH_TOKEN` | ArgoCD API token (for manual sync) |
| `ARGOCD_SERVER` | ArgoCD server URL |
| `NOTIFICATION_EMAIL` | Email for failure alerts |

📖 **Detailed setup**: See [GITHUB_SECRETS_SETUP.md](GITHUB_SECRETS_SETUP.md)

## Image Naming Convention

```
Format: {repository}:prod-{short-sha}-{timestamp}

Example: johnsmith/onestop-backend:prod-a1b2c3d-20260528-143022

Components:
- prod = production environment
- a1b2c3d = first 7 chars of git commit SHA
- 20260528-143022 = date and time (YYYYMMDD-HHMMSS)
```

## Security Features

### Container Security
- ✅ Non-root user (UID 1001)
- ✅ Read-only root filesystem
- ✅ No privilege escalation
- ✅ All capabilities dropped
- ✅ Seccomp profile enabled

### Image Security
- ✅ Multi-stage builds
- ✅ Minimal base (Alpine)
- ✅ Vulnerability scanning (Trivy + Grype)
- ✅ SBOM generation
- ✅ Keyless image signing (Cosign)
- ✅ Build provenance

### CI/CD Security
- ✅ Secret detection (TruffleHog)
- ✅ SAST analysis (CodeQL)
- ✅ Dependency scanning (npm audit)
- ✅ License compliance
- ✅ Fail on HIGH/CRITICAL vulnerabilities

### Kubernetes Security
- ✅ Network Policies (default deny)
- ✅ RBAC (least privilege)
- ✅ Pod Security Standards
- ✅ Resource limits
- ✅ Health checks

## Deployment Commands

### Trigger Production Deployment
```bash
# Option 1: Direct push
git checkout production
git merge main
git push origin production

# Option 2: Via PR
# Create PR to production branch → Merge → Auto-deploys
```

### Monitor Deployment
```bash
# GitHub Actions
# Go to: Actions tab → View workflow run

# ArgoCD
# Access your ArgoCD dashboard
# Check application status

# Kubernetes
kubectl get pods -n production
kubectl rollout status deployment/prod-onestop-backend -n production
kubectl logs -f deployment/prod-onestop-backend -n production
```

### Manual Rollback
```bash
# Via kubectl
kubectl rollout undo deployment/prod-onestop-backend -n production

# Via ArgoCD
# Use ArgoCD dashboard → History → Rollback
```

## File Structure

```
.github/workflows/
├── deploy.yml           # Main CI/CD pipeline (production only)
└── security-scan.yml    # Daily security scanning

k8s-manifests/
├── base/                # Base Kubernetes resources
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── hpa.yaml
│   ├── networkpolicy.yaml
│   ├── rbac.yaml
│   ├── ingress.yaml
│   └── ...
└── overlays/
    └── production/      # Production overrides
        ├── kustomization.yaml  # ← Updated by CI/CD
        └── patch-*.yaml

Dockerfile               # Secure multi-stage build
.dockerignore           # Exclude files from image

DEPLOYMENT_GUIDE.md     # Complete deployment guide
GITHUB_SECRETS_SETUP.md # Secrets configuration guide
FILES_CREATED.md        # File summary
```

## ArgoCD Configuration

Your ArgoCD application should be configured to:

```yaml
# Reference configuration (already done on your ArgoCD server)
source:
  repoURL: https://github.com/your-org/k8s-manifests
  path: overlays/production
  targetRevision: HEAD

destination:
  server: https://kubernetes.default.svc
  namespace: production

syncPolicy:
  automated:
    prune: true       # Delete removed resources
    selfHeal: true    # Sync on manual changes
    allowEmpty: false
  syncOptions:
    - CreateNamespace=true
  retry:
    limit: 5
```

## Verification Checklist

Before first deployment:

- [ ] Docker Hub repository exists
- [ ] All GitHub secrets configured
- [ ] K8s repository accessible
- [ ] ArgoCD watching K8s repository
- [ ] Kubernetes secrets created
- [ ] Domain names updated in ingress
- [ ] cert-manager installed (for TLS)
- [ ] Network policies tested
- [ ] Resource limits set appropriately

## Common Issues

### Build fails with "authentication required"
**Solution**: Verify `DOCKER_HUB_TOKEN` is valid and has write permissions

### K8s manifest update fails
**Solution**: Check `K8S_REPO_PAT` has `repo` scope and access to K8s repository

### ArgoCD not syncing
**Solution**: 
- Verify ArgoCD is watching correct repo and path
- Check ArgoCD application sync policy
- Review ArgoCD logs for errors

### Image pull error in K8s
**Solution**: 
- Verify image exists in Docker Hub
- Check image name matches in kustomization.yaml
- If private repo, add imagePullSecrets

## Useful Commands

```bash
# Check GitHub Actions status
gh run list --branch production

# View latest workflow
gh run view

# List Docker Hub tags
curl -s https://hub.docker.com/v2/repositories/USERNAME/onestop-backend/tags | jq

# Check K8s deployment
kubectl get deployment -n production
kubectl describe deployment prod-onestop-backend -n production

# View ArgoCD application status (requires argocd CLI)
argocd app get onestop-backend-prod

# Trigger manual ArgoCD sync
argocd app sync onestop-backend-prod
```

## Support

- **Documentation**: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **Secrets Setup**: [GITHUB_SECRETS_SETUP.md](GITHUB_SECRETS_SETUP.md)
- **Security Policy**: [.github/SECURITY.md](.github/SECURITY.md)
- **K8s Guide**: [k8s-manifests/README.md](k8s-manifests/README.md)

---

**Production-ready with industry-standard security!** 🔒🚀
