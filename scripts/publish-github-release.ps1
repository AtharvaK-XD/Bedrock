# Script to manage GitHub releases: Windows (v1.2.2) and macOS (v1.2.2-mac)
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
    Write-Host "==> Processing releases for repository: $repo"
    Write-Host "========================================================"
    
    # ---------------- 1. Windows Release (v1.2.2) ----------------
    $winRelease = $null
    try {
        $winRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/tags/v1.2.2" -Headers $headers -Method Get
        Write-Host "Windows Release v1.2.2 exists (ID: $($winRelease.id))."
    } catch {
        Write-Host "Creating Windows release v1.2.2..."
        $body = @{
            tag_name = "v1.2.2"
            target_commitish = "main"
            name = "Bedrock v1.2.2 - Desktop Workstation"
            body = @"
# Bedrock v1.2.2 Desktop Workstation

This release delivers brand taskbar icon synchronization, seamless auto-updater integration with verified manifest assets, and workstation UI enhancements.

## Highlights
- **Taskbar Brand Icon Alignment**: Embedded native high-resolution PE multi-format icon resource and registered explicit Windows ``com.bedrock.desktop`` AppUserModelId.
- **Auto-Updater Synchronization**: Native ``latest.yml`` manifests and blockmaps for background update verification and one-click upgrades.
- **Instant Headless OAuth Consent**: Bypasses intermediate verification cards and directs immediately to Google's / GitHub's native account selection and consent screen.
- **Full Desktop Sidebar Navigation**: Seamless access to Dashboard, Prompt Generator, Branching Pipelines, Prompt Tester, Library, and Settings.
- **BYOK Multi-Model Synthesis**: Built-in support for Gemini, Groq, OpenAI, Anthropic, and OpenRouter.

---

### Downloads
- **Windows Installer**: `Bedrock-Setup.exe` (or `Bedrock-Setup-1.2.2.exe`)
"@
            draft = $false
            prerelease = $false
            make_latest = "true"
        } | ConvertTo-Json

        $winRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases" -Headers $headers -Method Post -Body $body
        Write-Host "Windows release v1.2.2 created successfully (ID: $($winRelease.id))."
    }

    $winId = $winRelease.id
    $winAssets = @(
        @{ Name = "Bedrock-Setup.exe"; Path = "release\Bedrock-Setup.exe"; ContentType = "application/octet-stream" },
        @{ Name = "Bedrock-Setup-1.2.2.exe"; Path = "release\Bedrock-Setup-1.2.2.exe"; ContentType = "application/octet-stream" },
        @{ Name = "latest.yml"; Path = "release\latest.yml"; ContentType = "text/yaml" },
        @{ Name = "Bedrock-Setup-1.2.2.exe.blockmap"; Path = "release\Bedrock-Setup-1.2.2.exe.blockmap"; ContentType = "application/octet-stream" }
    )

    foreach ($item in $winAssets) {
        if (Test-Path $item.Path) {
            if ($winRelease.assets) {
                foreach ($a in $winRelease.assets) {
                    if ($a.name -eq $item.Name) {
                        Write-Host "Deleting existing $($item.Name) in v1.2.2 (ID: $($a.id))..."
                        Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/assets/$($a.id)" -Headers $headers -Method Delete
                        Start-Sleep -Seconds 1
                    }
                }
            }
            $fileItem = Get-Item $item.Path
            Write-Host "==> Uploading $($item.Name) ($([math]::Round($fileItem.Length / 1MB, 2)) MB) to v1.2.2..."
            $uploadUrl = "https://uploads.github.com/repos/$repo/releases/$winId/assets?name=$($item.Name)"
            & curl.exe -s -S -X POST -H "Authorization: Bearer $token" -H "Content-Type: $($item.ContentType)" -H "Accept: application/vnd.github.v3+json" --data-binary "@$($item.Path)" "$uploadUrl" | Out-Null
            Write-Host "    $($item.Name) uploaded successfully."
        }
    }

    # ---------------- 2. macOS Dedicated Release (v1.2.2-mac) ----------------
    $macRelease = $null
    try {
        $macRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/tags/v1.2.2-mac" -Headers $headers -Method Get
        Write-Host "macOS Release v1.2.2-mac exists (ID: $($macRelease.id))."
    } catch {
        Write-Host "Creating dedicated macOS release v1.2.2-mac..."
        $body = @{
            tag_name = "v1.2.2-mac"
            target_commitish = "main"
            name = "Bedrock v1.2.2 - macOS Desktop Workstation"
            body = @"
# Bedrock v1.2.2 - macOS Desktop Workstation

Dedicated macOS release for Bedrock Prompt Engineering Workstation.
Native build supporting both Apple Silicon (M1/M2/M3/M4) and Intel Macs.

### Downloads
- **macOS Disk Image (Installer)**: `Bedrock-Mac.dmg`
- **macOS Application Archive**: `Bedrock-Mac.zip`

---

### First Launch Instructions (Ad-hoc Unsigned Build)
Because this build is distributed directly without a paid Apple certificate:
1. Open `Bedrock-Mac.dmg` and drag `Bedrock` to your `/Applications` folder.
2. **Right-click** (or Control-click) `Bedrock.app` in Applications and click **Open**.
3. Click **Open** on the confirmation prompt.
*(Or in Terminal, run: ``xattr -cr /Applications/Bedrock.app``)*
"@
            draft = $false
            prerelease = $false
            make_latest = "false"
        } | ConvertTo-Json

        $macRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases" -Headers $headers -Method Post -Body $body
        Write-Host "macOS release v1.2.2-mac created successfully (ID: $($macRelease.id))."
    }

    $macId = $macRelease.id
    $macTargets = @("Bedrock-Mac.dmg", "Bedrock-Mac.zip")
    foreach ($mName in $macTargets) {
        $mPath = "release\$mName"
        if (Test-Path $mPath) {
            if ($macRelease.assets) {
                foreach ($a in $macRelease.assets) {
                    if ($a.name -eq $mName) {
                        Write-Host "Deleting existing $mName in v1.2.2-mac..."
                        Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/assets/$($a.id)" -Headers $headers -Method Delete
                        Start-Sleep -Seconds 1
                    }
                }
            }
            $fileItem = Get-Item $mPath
            Write-Host "==> Uploading $mName ($([math]::Round($fileItem.Length / 1MB, 2)) MB) to v1.2.2-mac..."
            $uploadUrl = "https://uploads.github.com/repos/$repo/releases/$macId/assets?name=$mName"
            & curl.exe -s -S -X POST -H "Authorization: Bearer $token" -H "Content-Type: application/octet-stream" -H "Accept: application/vnd.github.v3+json" --data-binary "@$mPath" "$uploadUrl" | Out-Null
            Write-Host "    $mName uploaded successfully."
        }
    }

    # ---------------- 3. Backfill latest.yml to v1.2.1 for seamless updater migration ----------------
    try {
        $oldRel = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/tags/v1.2.1" -Headers $headers -Method Get
        if ($oldRel) {
            Write-Host "Ensuring latest.yml exists on v1.2.1 for auto-updater compatibility..."
            if ($oldRel.assets) {
                foreach ($a in $oldRel.assets) {
                    if ($a.name -eq "latest.yml") {
                        Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/assets/$($a.id)" -Headers $headers -Method Delete
                        Start-Sleep -Seconds 1
                    }
                }
            }
            $uploadUrl = "https://uploads.github.com/repos/$repo/releases/$($oldRel.id)/assets?name=latest.yml"
            & curl.exe -s -S -X POST -H "Authorization: Bearer $token" -H "Content-Type: text/yaml" -H "Accept: application/vnd.github.v3+json" --data-binary "@release\latest.yml" "$uploadUrl" | Out-Null
            Write-Host "    latest.yml attached to v1.2.1 on $repo."
        }
    } catch {
        Write-Host "Could not backfill v1.2.1 on $repo (skipped)."
    }

    Write-Host "`n==> Verifying latest Windows release for $repo..."
    $latest = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -Headers $headers -Method Get
    Write-Host "Latest release tag: $($latest.tag_name)"
    foreach ($a in $latest.assets) {
        Write-Host "  - Asset: $($a.name) ($([math]::Round($a.size / 1MB, 2)) MB)"
    }
}

Write-Host "`n==> Finished isolated release configuration for both accounts!"
