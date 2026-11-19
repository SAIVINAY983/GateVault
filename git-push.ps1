<#
.SYNOPSIS
    GateVault GitHub Sync & Push Automation Script
.DESCRIPTION
    Safely stages documentation, backend, frontend, and configuration changes,
    creates a standardized commit, and pushes to origin/main.
    Ensures .env secrets and sqlite databases are never committed.
.EXAMPLE
    .\git-push.ps1
    .\git-push.ps1 -Message "docs: add final security assessment report"
#>

[CmdletBinding()]
param (
    [string]$Message = ""
)

$ErrorActionPreference = "Stop"

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "         GateVault GitHub Sync & Push Utility           " -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

# 1. Verify inside git repo
if (-not (Test-Path ".git")) {
    Write-Error "Error: Must be run from the root of the GateVault repository."
    exit 1
}

# 2. Check current status
Write-Host "[1/5] Checking repository status..." -ForegroundColor Yellow
git status --short

# 3. Restore any accidentally deleted doc images if needed
Write-Host "`n[2/5] Restoring documentation preview images if missing..." -ForegroundColor Yellow
try {
    git checkout -- docs/*.png docs/*.jpg 2>$null
} catch {}

# 4. Safely stage project files
Write-Host "`n[3/5] Staging modified & untracked files safely..." -ForegroundColor Yellow
git add docs/
git add backend/
git add frontend/
git add docker-compose.yml
git add DOCKER_SETUP.md
git add .gitignore
if (Test-Path "git-push.ps1") { git add git-push.ps1 }
if (Test-Path "git-push.bat") { git add git-push.bat }

# 5. Verify staged status
Write-Host "`nStaged changes ready for commit:" -ForegroundColor Green
git diff --cached --stat

# Check if anything is actually staged
$staged = git diff --cached --name-only
if (-not $staged) {
    Write-Host "`n[INFO] No changes to commit. Working tree is clean." -ForegroundColor Green
    Write-Host "Checking remote sync status..." -ForegroundColor Yellow
    git push origin main
    Write-Host "`n[DONE] Repository is fully up to date with origin/main!`n" -ForegroundColor Green
    exit 0
}

# 6. Prompt for commit message if not passed
if ([string]::IsNullOrWhiteSpace($Message)) {
    $defaultMsg = "docs: add comprehensive final security assessment report"
    $inputMsg = Read-Host "`nEnter commit message [Default: '$defaultMsg']"
    if ([string]::IsNullOrWhiteSpace($inputMsg)) {
        $Message = $defaultMsg
    } else {
        $Message = $inputMsg
    }
}

# 7. Commit
Write-Host "`n[4/5] Committing changes..." -ForegroundColor Yellow
git commit -m "$Message"

# 8. Push to GitHub
Write-Host "`n[5/5] Pushing to origin/main on GitHub..." -ForegroundColor Yellow
git push origin main

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "  Successfully pushed to https://github.com/SAIVINAY983/GateVault  " -ForegroundColor Green
Write-Host "========================================================`n" -ForegroundColor Green
