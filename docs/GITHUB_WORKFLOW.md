# GateVault – GitHub Commands & Workflow Reference Guide

This guide provides the complete set of GitHub commands and automation scripts configured for the **GateVault** repository (`origin`: `https://github.com/SAIVINAY983/GateVault.git`).

---

## 1. Quick Automation (One-Command Push)

Two helper scripts have been added to the root directory for automated, safe staging, committing, and pushing:

### Option A: PowerShell Script
```powershell
# Interactive (prompts for commit message):
.\git-push.ps1

# With custom message:
.\git-push.ps1 -Message "docs: add security verification report"
```

### Option B: Windows Batch Script (Double-Click or CLI)
```cmd
git-push.bat
```

> **Note**: These scripts automatically restore any missing doc preview images, safely stage only project code and docs, ignore local `.env` and `db.sqlite3` files, and push cleanly to `origin/main`.

---

## 2. Standard Manual Git Commands

If you prefer to run Git commands directly in your terminal, use this standard sequence:

### Step 1: Check Repository Status
```powershell
git status
```

### Step 2: Restore Deleted Images (If Needed)
If `docs/gatevault_architecture.png` or `docs/gatevault_website.jpg` show as deleted:
```powershell
git checkout -- docs/*.png docs/*.jpg
```

### Step 3: Stage Safe Project Changes
Stage documentation, backend, frontend, and configuration:
```powershell
git add docs/
git add backend/
git add frontend/
git add docker-compose.yml
git add DOCKER_SETUP.md
git add .gitignore
git add git-push.ps1 git-push.bat
```

### Step 4: Verify What Is Staged (Zero Secrets Check)
```powershell
git status --short
```
*Ensure `backend/.env`, `frontend/.env`, and `backend/db.sqlite3` are NEVER in the staged list.*

### Step 5: Commit with Conventional Commit Format
```powershell
git commit -m "docs: add comprehensive final security assessment report"
```

### Step 6: Push to GitHub
```powershell
git push origin main
```

---

## 3. Pulling Latest Changes & Synchronization

To synchronize your local workspace with any commits on GitHub:
```powershell
# Fetch remote branches
git fetch origin

# Pull and merge changes into local main branch
git pull origin main
```

---

## 4. Release Tagging (For University Submission & Portfolio)

To freeze a milestone release on GitHub with an official release tag:

```powershell
# 1. Create an annotated release tag
git tag -a v1.0.0 -m "GateVault v1.0.0: Full Security Hardening & Container Deployment"

# 2. Push tag to GitHub
git push origin v1.0.0

# Or push all local tags:
git push origin --tags
```

---

## 5. Branch Management for Future Enhancements

To develop a new feature without affecting the `main` branch:

```powershell
# 1. Create and switch to a new feature branch
git checkout -b feature/new-audit-metrics

# 2. Make your edits and commit
git add .
git commit -m "feat(audit): add export filter metrics"

# 3. Push branch to GitHub
git push -u origin feature/new-audit-metrics

# 4. Switch back to main and merge when ready
git checkout main
git merge feature/new-audit-metrics
git push origin main
```

---

## 6. Undo & Emergency Recovery Commands

| Scenario | Recommended Command |
| :--- | :--- |
| **Discard uncommitted changes in a specific file** | `git restore <path/to/file>` |
| **Unstage a file without losing edits** | `git restore --staged <path/to/file>` |
| **Restore a deleted tracked file from repository** | `git checkout -- <path/to/file>` |
| **View recent commit history** | `git log --oneline -n 10` |
| **Verify .env is properly ignored by Git** | `git check-ignore backend/.env` |
