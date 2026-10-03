# Script to create GitHub release v1.2.0 and upload Windows & Mac installers
$ErrorActionPreference = "Stop"

Write-Host "==> Fetching GitHub credentials..."
$output = & cmd /c "echo protocol=https& echo host=github.com" | git credential fill
$tokenLine = ($output | Where-Object { $_ -match "^password=" })
if (-not $tokenLine) {
    throw "Failed to retrieve GitHub token from git credentials."
}
$token = $tokenLine.Substring(9).Trim()

$repos = @("AtharvaK-XD/Bedrock", "Bedrockxai/Bedrock")
$headers = @{
    "Authorization" = "Bearer $token"
    "User-Agent" = "Bedrock-Publisher"
    "Accept" = "application/vnd.github.v3+json"
}

foreach ($repo in $repos) {
    Write-Host "`n========================================================"
    Write-Host "==> Processing release for repository: $repo"
    Write-Host "========================================================"
    
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

This release delivers the dedicated desktop workstation interface with complete sidebar navigation, local BYOK support, and cross-platform desktop installers.

## Highlights
- **Full Desktop Sidebar Navigation**: Seamless access to Dashboard, Prompt Generator, Branching Pipelines, Prompt Tester, and Library directly from the workstation sidebar.
- **Dedicated Desktop Layout**: Clean borderless workstation view without web topbars or landing page redirects.
- **Collapsible Generator History**: Dynamic docking alongside the desktop sidebar.
- **BYOK Multi-Model Synthesis**: Built-in support for Gemini, Groq, OpenAI, Anthropic, and OpenRouter.

---

### Downloads
- **Windows Installer**: Download `Bedrock-Setup.exe` below.
- **macOS Installer**: Download `Bedrock-Mac.dmg` below.
"@
            draft = $false
            prerelease = $false
            make_latest = "true"
        } | ConvertTo-Json

        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases" -Headers $headers -Method Post -Body $body
        Write-Host "Release created successfully (ID: $($release.id))."
    }

    $releaseId = $release.id

    $uploadTargets = @(
        @{ Name = "Bedrock-Setup.exe"; Path = "release\installer\Bedrock-Setup.exe" },
        @{ Name = "Bedrock-Mac.dmg"; Path = "release\Bedrock-Mac.dmg" },
        @{ Name = "Bedrock-Mac.zip"; Path = "release\Bedrock-Mac.zip" }
    )

    foreach ($target in $uploadTargets) {
        $name = $target.Name
        $path = $target.Path

        if (Test-Path $path) {
            # Check if asset already exists in release
            if ($release.assets) {
                foreach ($asset in $release.assets) {
                    if ($asset.name -eq $name) {
                        Write-Host "Deleting existing $name asset ($($asset.id)) in $repo..."
                        Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/assets/$($asset.id)" -Headers $headers -Method Delete
                        Start-Sleep -Seconds 2
                    }
                }
            }

            $fileItem = Get-Item $path
            Write-Host "==> Uploading $name ($([math]::Round($fileItem.Length / 1MB, 2)) MB) to $repo..."

            $uploadUrl = "https://uploads.github.com/repos/$repo/releases/$releaseId/assets?name=$name"
            & curl.exe -X POST `
                -H "Authorization: Bearer $token" `
                -H "Content-Type: application/octet-stream" `
                -H "Accept: application/vnd.github.v3+json" `
                --data-binary "@$path" `
                "$uploadUrl"
        } else {
            Write-Host "Skipping $name (not present at $path)."
        }
    }

    Write-Host "`n==> Verifying latest release for $repo..."
    $latest = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -Headers $headers -Method Get
    Write-Host "Latest release tag: $($latest.tag_name)"
    Write-Host "Latest release name: $($latest.name)"
    Write-Host "Latest release assets:"
    foreach ($a in $latest.assets) {
        Write-Host "  - $($a.name): $([math]::Round($a.size / 1MB, 2)) MB | Download: $($a.browser_download_url)"
    }
}

Write-Host "`n==> Finished cross-platform release process for both repositories!"
