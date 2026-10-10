# Script to manage GitHub releases: Windows (v1.2.4) and macOS (v1.2.4-mac)
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
    
    # ---------------- 1. Windows Release (v1.2.4) ----------------
    $winRelease = $null
    try {
        $winRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/tags/v1.2.4" -Headers $headers -Method Get
        Write-Host "Windows Release v1.2.4 exists (ID: $($winRelease.id))."
    } catch {
        Write-Host "Creating Windows release v1.2.4..."
        $body = @{
            tag_name = "v1.2.4"
            target_commitish = "main"
            name = "Bedrock v1.2.4 - Desktop Workstation"
            body = @"
# Bedrock v1.2.4 Desktop Workstation

This release restores the dedicated Desktop Workstation Sidebar navigation layout with instant ⌘1–⌘6 workspace switching, introduces strict Zero-Coding / Zero-Tech-Stack Image & Video Generation synthesis directives, and refreshes the unified Landing Page.

## Highlights
- **Dedicated Desktop Sidebar Layout**: Restored native desktop `Sidebar` navigation for the Electron workstation app with instant ⌘1–⌘6 global shortcuts, live API key status indicator, and full-height viewports, while preserving the floating Aceternity `Topbar` for the web application.
- **Image & Video Generation Archetypes**: Added Image Generation (`IMG`) and Video Generation (`VIDEO`) targets to the Prompt Wizard with strict anti-hallucination guardrails and zero-coding directives for Midjourney v6.1, FLUX.1, DALL-E 3, SDXL, Runway Gen-3 Alpha, Sora, and Luma Dream Machine.
- **Landing Page Refresh**: Updated copy highlighting all 10 AI frontier providers, visual DAG branching canvas, tactile physics deck with 5% to 300% zoom, and 15 multi-target code & config exporters.
- **10 Frontier AI Providers**: Full multi-model support across Claude 3.7 Sonnet, OpenAI GPT-4o, Gemini 2.5 Flash, DeepSeek-R1, Meta LLaMA 3.3, Mistral Large, Cohere Command R+, Microsoft Copilot, Nvidia, and Hugging Face with authentic transparent brand assets.
- **Auto-Updater Synchronization**: Native ``latest.yml`` manifests and SHA-512 blockmaps for background update verification and one-click upgrades.

---

### Downloads
- **Windows Installer**: `Bedrock-Setup.exe` (or `Bedrock-Setup-1.2.4.exe`)
"@
            draft = $false
            prerelease = $false
            make_latest = "true"
        } | ConvertTo-Json

        $winRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases" -Headers $headers -Method Post -Body $body -ContentType "application/json"
        Write-Host "Windows release v1.2.4 created successfully (ID: $($winRelease.id))."
    }

    $winId = $winRelease.id
    $winAssets = @(
        @{ Name = "Bedrock-Setup.exe"; Path = "release\Bedrock-Setup.exe"; ContentType = "application/octet-stream" },
        @{ Name = "Bedrock-Setup-1.2.4.exe"; Path = "release\Bedrock-Setup-1.2.4.exe"; ContentType = "application/octet-stream" },
        @{ Name = "latest.yml"; Path = "release\latest.yml"; ContentType = "text/yaml" },
        @{ Name = "Bedrock-Setup-1.2.4.exe.blockmap"; Path = "release\Bedrock-Setup-1.2.4.exe.blockmap"; ContentType = "application/octet-stream" }
    )

    foreach ($item in $winAssets) {
        if (Test-Path $item.Path) {
            if ($winRelease.assets) {
                foreach ($a in $winRelease.assets) {
                    if ($a.name -eq $item.Name) {
                        Write-Host "Deleting existing $($item.Name) in v1.2.4 (ID: $($a.id))..."
                        Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/assets/$($a.id)" -Headers $headers -Method Delete
                        Start-Sleep -Seconds 1
                    }
                }
            }
            $fileItem = Get-Item $item.Path
            Write-Host "==> Uploading $($item.Name) ($([math]::Round($fileItem.Length / 1MB, 2)) MB) to v1.2.4..."
            $uploadUrl = "https://uploads.github.com/repos/$repo/releases/$winId/assets?name=$($item.Name)"
            & curl.exe -s -S -X POST -H "Authorization: Bearer $token" -H "Content-Type: $($item.ContentType)" -H "Accept: application/vnd.github.v3+json" --data-binary "@$($item.Path)" "$uploadUrl" | Out-Null
            Write-Host "    $($item.Name) uploaded successfully."
        }
    }

    # ---------------- 2. macOS Dedicated Release (v1.2.4-mac) ----------------
    $macRelease = $null
    try {
        $macRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/tags/v1.2.4-mac" -Headers $headers -Method Get
        Write-Host "macOS Release v1.2.4-mac exists (ID: $($macRelease.id))."
    } catch {
        Write-Host "Creating dedicated macOS release v1.2.4-mac..."
        $body = @{
            tag_name = "v1.2.4-mac"
            target_commitish = "main"
            name = "Bedrock v1.2.4 - macOS Desktop Workstation"
            body = @"
# Bedrock v1.2.4 - macOS Desktop Workstation

Dedicated macOS release for Bedrock Prompt Engineering Workstation.
Native build supporting both Apple Silicon (M1/M2/M3/M4) and Intel Macs with Multi-Target Blueprint Exporters, Interactive Physics Deck, and Zero-Coding Media Generation.

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

        $macRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases" -Headers $headers -Method Post -Body $body -ContentType "application/json"
        Write-Host "macOS release v1.2.4-mac created successfully (ID: $($macRelease.id))."
    }

    $macId = $macRelease.id
    $macTargets = @("Bedrock-Mac.dmg", "Bedrock-Mac.zip")
    foreach ($mName in $macTargets) {
        $mPath = "release\$mName"
        if (Test-Path $mPath) {
            if ($macRelease.assets) {
                foreach ($a in $macRelease.assets) {
                    if ($a.name -eq $mName) {
                        Write-Host "Deleting existing $mName in v1.2.4-mac..."
                        Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/assets/$($a.id)" -Headers $headers -Method Delete
                        Start-Sleep -Seconds 1
                    }
                }
            }
            $fileItem = Get-Item $mPath
            Write-Host "==> Uploading $mName ($([math]::Round($fileItem.Length / 1MB, 2)) MB) to v1.2.4-mac..."
            $uploadUrl = "https://uploads.github.com/repos/$repo/releases/$macId/assets?name=$mName"
            & curl.exe -s -S -X POST -H "Authorization: Bearer $token" -H "Content-Type: application/octet-stream" -H "Accept: application/vnd.github.v3+json" --data-binary "@$mPath" "$uploadUrl" | Out-Null
            Write-Host "    $mName uploaded successfully."
        }
    }

    # ---------------- 3. Backfill latest.yml to earlier releases for seamless auto-updater ----------------
    foreach ($prevTag in @("v1.2.3", "v1.2.2", "v1.2.1")) {
        try {
            $prevRel = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/tags/$prevTag" -Headers $headers -Method Get
            if ($prevRel) {
                Write-Host "Ensuring latest.yml exists on $prevTag for auto-updater migration..."
                if ($prevRel.assets) {
                    foreach ($a in $prevRel.assets) {
                        if ($a.name -eq "latest.yml") {
                            Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/assets/$($a.id)" -Headers $headers -Method Delete
                            Start-Sleep -Seconds 1
                        }
                    }
                }
                $uploadUrl = "https://uploads.github.com/repos/$repo/releases/$($prevRel.id)/assets?name=latest.yml"
                & curl.exe -s -S -X POST -H "Authorization: Bearer $token" -H "Content-Type: text/yaml" -H "Accept: application/vnd.github.v3+json" --data-binary "@release\latest.yml" "$uploadUrl" | Out-Null
                Write-Host "    latest.yml attached to $prevTag on $repo."
            }
        } catch {
            Write-Host "Could not backfill $prevTag on $repo (skipped)."
        }
    }

    Write-Host "`n==> Verifying latest Windows release for $repo..."
    $latest = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -Headers $headers -Method Get
    Write-Host "Latest release tag: $($latest.tag_name)"
    foreach ($a in $latest.assets) {
        Write-Host "  - Asset: $($a.name) ($([math]::Round($a.size / 1MB, 2)) MB)"
    }
}

Write-Host "`n==> Finished isolated release configuration for both accounts!"
