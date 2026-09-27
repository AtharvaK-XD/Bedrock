# Script to create GitHub release v1.2.0 and upload Bedrock-Setup.exe
$ErrorActionPreference = "Stop"

Write-Host "==> Fetching GitHub credentials..."
$output = & cmd /c "echo protocol=https& echo host=github.com" | git credential fill
$tokenLine = ($output | Where-Object { $_ -match "^password=" })
if (-not $tokenLine) {
    throw "Failed to retrieve GitHub token from git credentials."
}
$token = $tokenLine.Substring(9).Trim()

$repo = "AtharvaK-XD/Bedrock"
$headers = @{
    "Authorization" = "Bearer $token"
    "User-Agent" = "Bedrock-Publisher"
    "Accept" = "application/vnd.github.v3+json"
}

Write-Host "==> Checking if release for v1.2.0 exists..."
$release = $null
try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/tags/v1.2.0" -Headers $headers -Method Get
    Write-Host "Release v1.2.0 already exists (ID: $($release.id))."
} catch {
    Write-Host "Release does not exist yet. Creating release v1.2.0..."
    $body = @{
        tag_name = "v1.2.0"
        target_commitish = "main"
        name = "Bedrock v1.2.0 - Desktop Workstation"
        body = @"
# Bedrock v1.2.0 Desktop Workstation

This release delivers the dedicated desktop workstation interface with complete sidebar navigation and local BYOK support.

## Highlights
- **Full Desktop Sidebar Navigation**: Seamless access to Dashboard, Prompt Generator, Branching Pipelines, Prompt Tester, and Library directly from the workstation sidebar.
- **Dedicated Desktop Layout**: Clean borderless workstation view without web topbars or landing page redirects.
- **Collapsible Generator History**: Dynamic docking alongside the desktop sidebar.
- **BYOK Multi-Model Synthesis**: Built-in support for Gemini, Groq, OpenAI, Anthropic, and OpenRouter.

---

### Downloads
- **Windows Installer**: Download `Bedrock-Setup.exe` below.
"@
        draft = $false
        prerelease = $false
        make_latest = "true"
    } | ConvertTo-Json

    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases" -Headers $headers -Method Post -Body $body
    Write-Host "Release created successfully (ID: $($release.id))."
}

$releaseId = $release.id

# Check if Bedrock-Setup.exe is already in assets
if ($release.assets) {
    foreach ($asset in $release.assets) {
        if ($asset.name -eq "Bedrock-Setup.exe") {
            Write-Host "Deleting existing Bedrock-Setup.exe asset ($($asset.id))..."
            Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/assets/$($asset.id)" -Headers $headers -Method Delete
            Start-Sleep -Seconds 2
        }
    }
}

$filePath = "release\installer\Bedrock-Setup.exe"
if (-not (Test-Path $filePath)) {
    throw "Installer file not found at $filePath"
}
$fileItem = Get-Item $filePath
Write-Host "==> Uploading $filePath ($([math]::Round($fileItem.Length / 1MB, 2)) MB) to GitHub release..."

$uploadUrl = "https://uploads.github.com/repos/$repo/releases/$releaseId/assets?name=Bedrock-Setup.exe"

& curl.exe -X POST `
    -H "Authorization: Bearer $token" `
    -H "Content-Type: application/octet-stream" `
    -H "Accept: application/vnd.github.v3+json" `
    --data-binary "@$filePath" `
    "$uploadUrl"

Write-Host "`n==> Verifying latest release..."
$latest = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -Headers $headers -Method Get
Write-Host "Latest release tag: $($latest.tag_name)"
Write-Host "Latest release name: $($latest.name)"
Write-Host "Latest release assets:"
foreach ($a in $latest.assets) {
    Write-Host "  - $($a.name): $([math]::Round($a.size / 1MB, 2)) MB | Download: $($a.browser_download_url)"
}

Write-Host "==> Finished release process!"
