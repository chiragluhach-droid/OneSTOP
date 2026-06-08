# GitHub Actions CI/CD Setup Guide

This guide will help you set up the complete CI/CD pipeline for the OneStop Backend application.

## Prerequisites

- GitHub repository with admin access
- A separate Kubernetes manifests repository
- Docker registry access (GitHub Container Registry)

## Step 1: Configure GitHub Secrets

Navigate to your repository settings → Secrets and variables → Actions, and add:

### Required Secrets

1. **K8S_REPO_NAME**: Name of your Kubernetes repository
   ```
   Example: your-org/k8s-manifests
   ```

2. **K8S_REPO_PAT**: Personal Access Token for K8s repo
   - Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate new token with scopes: `repo`, `workflow`
   - Copy and save as secret

### Optional Secrets (for notifications)

3. **SLACK_WEBHOOK_URL**: Slack webhook for notifications
   - Go to your Slack workspace
   - Create an Incoming Webhook
   - Copy webhook URL

## Step 2: Enable GitHub Container Registry

1. Go to your repository Settings → Actions → General
2. Scroll to "Workflow permissions"
3. Select "Read and write permissions"
4. Check "Allow GitHub Actions to create and approve pull requests"
5. Click Save

## Step 3: Set Up Kubernetes Repository

Your K8s repository should have one of these structures:

### Option A: Kustomize Structure
```
k8s-repo/
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── kustomization.yaml
└── overlays/
    ├── production/
    │   └── kustomization.yaml
    └── staging/
        └── kustomization.yaml
```

### Option B: Direct Manifests
```
k8s-repo/
└── manifests/
    ├── production/
    │   └── deployment.yaml
    └── staging/
        └── deployment.yaml
```

### Option C: Helm Values
```
k8s-repo/
└── values/
    ├── production.yaml
    └── staging.yaml
```

## Step 4: Configure Branch Protection

1. Go to Settings → Branches
2. Add rule for `main` branch:
   - Require a pull request before merging
   - Require status checks to pass: `Security Scanning`, `Build & Push Docker Image`
   - Require branches to be up to date
   - Require conversation resolution before merging

## Step 5: Enable Security Features

1. **Dependabot**:
   - Go to Settings → Code security and analysis
   - Enable "Dependabot alerts"
   - Enable "Dependabot security updates"

2. **Code Scanning**:
   - Enable "CodeQL analysis"
   - Enable "Secret scanning"

3. **Security Policy**:
   - The `.github/SECURITY.md` file is already created
   - Review and customize as needed

## Step 6: Test the Pipeline

1. Make a small change to your code
2. Create a feature branch: `git checkout -b test-pipeline`
3. Commit and push: 
   ```bash
   git add .
   git commit -m "test: pipeline setup"
   git push origin test-pipeline
   ```
4. Open a Pull Request
5. Verify all checks pass
6. Merge to `main` or `develop`
7. Check Actions tab for deployment progress

## Step 7: Configure GitOps Tool (Optional)

If using ArgoCD or Flux:

### ArgoCD
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: onestop-backend
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/k8s-manifests
    targetRevision: HEAD
    path: overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

### Flux
```yaml
apiVersion: source.toolkit.fluxcd.io/v1beta2
kind: GitRepository
metadata:
  name: k8s-manifests
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/your-org/k8s-manifests
  branch: main
```

## Workflow Overview

### Deployment Workflow (deploy.yml)

**Triggers**: Push to `main` or `develop`, Pull Requests

**Jobs**:
1. **security-scan**: Trivy filesystem scan, npm audit
2. **build-and-push**: Build Docker image, scan image, push to registry
3. **update-k8s-manifest**: Update K8s manifests in separate repo
4. **notify**: Send deployment notifications

### Security Scanning Workflow (security-scan.yml)

**Triggers**: Daily at 2 AM UTC, Manual, Push to main

**Jobs**:
1. **dependency-review**: Check for vulnerable dependencies
2. **codeql-analysis**: Static code analysis
3. **secret-scanning**: Scan for exposed secrets
4. **container-scanning**: Scan container images
5. **sast-analysis**: ESLint security checks

## Security Features

✅ **Multi-stage Docker builds**: Reduces attack surface
✅ **Non-root container**: Runs as user 'nodejs' (uid 1001)
✅ **Vulnerability scanning**: Trivy, Grype, npm audit
✅ **Secret detection**: TruffleHog prevents secret leaks
✅ **SBOM generation**: Software Bill of Materials for compliance
✅ **Signed images**: Provenance and attestations
✅ **Dependency review**: Automatic PR checks
✅ **CodeQL**: Advanced code analysis
✅ **Regular scanning**: Daily security scans

## Monitoring Deployments

1. **GitHub Actions Tab**: View workflow runs
2. **Security Tab**: View security alerts and advisories
3. **Container Registry**: `https://github.com/orgs/YOUR_ORG/packages`
4. **K8s Dashboard**: Monitor actual deployments

## Troubleshooting

### Build fails with "permission denied"
- Check GitHub Actions permissions in repository settings
- Ensure workflow has write access to packages

### K8s manifest update fails
- Verify `K8S_REPO_PAT` has correct permissions
- Check `K8S_REPO_NAME` format (should be `owner/repo`)

### Security scans fail
- Review scan results in Security tab
- Fix vulnerabilities or add exceptions if false positives

### Image not updating in K8s
- Check ArgoCD/Flux sync status
- Verify image path in manifests matches registry path
- Ensure correct environment (production/staging)

## Best Practices

1. **Never commit secrets**: Use GitHub Secrets
2. **Test in staging first**: Deploy to staging before production
3. **Monitor security alerts**: Check Security tab regularly
4. **Keep dependencies updated**: Enable Dependabot
5. **Review SBOM**: Understand your supply chain
6. **Use semantic versioning**: Tag releases properly
7. **Document changes**: Use conventional commits

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [Kubernetes Security](https://kubernetes.io/docs/concepts/security/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## Support

For issues or questions:
- Open an issue in the repository
- Contact the DevOps team
- Review `.github/SECURITY.md` for security concerns
