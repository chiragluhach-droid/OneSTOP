# GitHub Secrets Setup Guide

This guide will help you configure all required GitHub secrets for the CI/CD pipeline.

## 📋 Required Secrets

Navigate to your repository: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### 1. Docker Hub Credentials

#### `DOCKER_HUB_USERNAME`
- **Value**: Your Docker Hub username
- **Example**: `johnsmith`
- **How to get**: Your Docker Hub login username

#### `DOCKER_HUB_TOKEN`
- **Value**: Docker Hub access token (NOT your password)
- **How to create**:
  1. Go to [Docker Hub](https://hub.docker.com/)
  2. Click your avatar → **Account Settings**
  3. Go to **Security** tab
  4. Click **New Access Token**
  5. Name: `github-actions`
  6. Permissions: **Read, Write, Delete**
  7. Click **Generate**
  8. Copy the token (shown only once!)
  9. Save as secret

#### `DOCKER_HUB_REPOSITORY`
- **Value**: Your Docker Hub repository name
- **Format**: `username/repository-name`
- **Example**: `johnsmith/onestop-backend`
- **How to get**: 
  - If repo exists: Go to Docker Hub and copy the repository name
  - If new: Use format `your-username/onestop-backend`

### 2. Kubernetes Repository Credentials

#### `K8S_REPO_NAME`
- **Value**: Your Kubernetes manifests repository
- **Format**: `organization/repository-name` or `username/repository-name`
- **Example**: `mycompany/k8s-manifests`
- **Note**: This is where your K8s YAML files are stored (separate from this repo)

#### `K8S_REPO_PAT`
- **Value**: GitHub Personal Access Token
- **How to create**:
  1. Go to GitHub **Settings** (your profile settings, not repo settings)
  2. Navigate to **Developer settings** → **Personal access tokens** → **Tokens (classic)**
  3. Click **Generate new token (classic)**
  4. Name: `k8s-repo-access`
  5. Expiration: Choose based on your security policy
  6. Select scopes:
     - ✅ `repo` (all repo permissions)
     - ✅ `workflow`
  7. Click **Generate token**
  8. Copy the token (shown only once!)
  9. Save as secret

## 🔔 Optional Secrets (Notifications)

### 3. Slack Notifications

#### `SLACK_WEBHOOK_URL`
- **Value**: Slack webhook URL
- **How to create**:
  1. Go to your Slack workspace
  2. Go to [Slack API Apps](https://api.slack.com/apps)
  3. Click **Create New App** → **From scratch**
  4. Name: `GitHub Deployments`, Select workspace
  5. Go to **Incoming Webhooks**
  6. Toggle **Activate Incoming Webhooks** to **On**
  7. Click **Add New Webhook to Workspace**
  8. Select channel for notifications
  9. Copy the webhook URL
  10. Save as secret

### 4. ArgoCD Integration (Optional)

#### `ARGOCD_AUTH_TOKEN`
- **Value**: ArgoCD API token
- **How to create**:
  1. Login to your ArgoCD server
  2. Go to **Settings** → **Accounts**
  3. Create a new account or use existing
  4. Generate token: `argocd account generate-token --account github-actions`
  5. Copy the token
  6. Save as secret
- **Note**: Only needed if you want GitHub Actions to trigger immediate ArgoCD sync

#### `ARGOCD_SERVER`
- **Value**: ArgoCD server URL
- **Format**: `https://argocd.example.com`
- **Example**: `https://argocd.mycompany.com`
- **Note**: Your ArgoCD server URL (without trailing slash)

### 5. Email Notifications (Optional)

#### `NOTIFICATION_EMAIL`
- **Value**: Email address for failure notifications
- **Example**: `devops-alerts@mycompany.com`

#### `SMTP_SERVER`
- **Value**: SMTP server address
- **Example**: `smtp.gmail.com`

#### `SMTP_PORT`
- **Value**: SMTP port
- **Example**: `587`

#### `SMTP_USERNAME`
- **Value**: SMTP username
- **Example**: `alerts@mycompany.com`

#### `SMTP_PASSWORD`
- **Value**: SMTP password or app-specific password

## ✅ Verification Checklist

After adding all secrets, verify:

- [ ] `DOCKER_HUB_USERNAME` - Your Docker Hub username
- [ ] `DOCKER_HUB_TOKEN` - Docker Hub access token (not password)
- [ ] `DOCKER_HUB_REPOSITORY` - Format: `username/repo-name`
- [ ] `K8S_REPO_NAME` - Format: `org/repo-name`
- [ ] `K8S_REPO_PAT` - GitHub PAT with `repo` and `workflow` scopes
- [ ] `SLACK_WEBHOOK_URL` (optional) - Starts with `https://hooks.slack.com/`
- [ ] `ARGOCD_AUTH_TOKEN` (optional) - ArgoCD token
- [ ] `ARGOCD_SERVER` (optional) - Format: `https://argocd.example.com`

## 🧪 Test Your Setup

After configuring secrets, test the pipeline:

1. Create a test branch:
   ```bash
   git checkout -b test-cicd
   ```

2. Make a small change:
   ```bash
   echo "# Test" >> README.md
   git add README.md
   git commit -m "test: CI/CD pipeline"
   ```

3. Merge to production:
   ```bash
   git checkout production
   git merge test-cicd
   git push origin production
   ```

4. Monitor the workflow:
   - Go to **Actions** tab in your repository
   - Watch the workflow execution
   - Check for any errors related to secrets

## 🔐 Security Best Practices

1. **Never commit secrets to code**
2. **Rotate tokens regularly** (every 90 days recommended)
3. **Use least privilege** - Only grant necessary permissions
4. **Audit access** - Regularly review who has access
5. **Use organization secrets** - For shared secrets across repos
6. **Enable 2FA** - On GitHub and Docker Hub accounts
7. **Monitor usage** - Check Actions logs for suspicious activity

## 🆘 Troubleshooting

### Error: "Bad credentials" or "Authentication failed"
- **Cause**: Invalid Docker Hub token or GitHub PAT
- **Solution**: Regenerate the token and update the secret

### Error: "Repository not found"
- **Cause**: Incorrect `K8S_REPO_NAME` format or PAT lacks permissions
- **Solution**: Verify format is `owner/repo` and PAT has `repo` scope

### Error: "Image push failed"
- **Cause**: Docker Hub repository doesn't exist or token lacks write permission
- **Solution**: Create repository on Docker Hub or regenerate token with write access

### Webhook not working
- **Cause**: Invalid Slack webhook URL or channel deleted
- **Solution**: Regenerate webhook in Slack

## 📚 Additional Resources

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Docker Hub Access Tokens](https://docs.docker.com/docker-hub/access-tokens/)
- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
- [ArgoCD Authentication](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_account/)

---

**Quick Setup Command:**

```bash
# Test if secrets are working
gh secret list  # Requires GitHub CLI
```

For questions or issues, refer to the main [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).
