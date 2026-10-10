# Script to manage GitHub releases: Windows (v1.2.3) and macOS (v1.2.3-mac)
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
    
    # ---------------- 1. Windows Release (v1.2.3) ----------------
    $winRelease = $null
    try {
        $winRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/tags/v1.2.3" -Headers $headers -Method Get
        Write-Host "Windows Release v1.2.3 exists (ID: $($winRelease.id))."
    } catch {
        Write-Host "Creating Windows release v1.2.3..."
        $body = @{
            tag_name = "v1.2.3"
            target_commitish = "main"
            name = "Bedrock v1.2.3 - Desktop Workstation"
            body = @"
# Bedrock v1.2.3 Desktop Workstation

This release delivers the Multi-Target Blueprint Exporters (15 targets), the ultra-wide Interactive Physics Deck engine with 1:1 scale-calibrated freeform drag physics, Lenis scroll hijacking fixes, and background auto-updater manifest synchronization.

## Highlights
- **Multi-Target Blueprint Exporters**: Export any prompt into 15 publication-ready targets including Cursor Rules (.cursorrules), Claude Code (CLAUDE.md), Windsurf Cascade (.windsurfrules), GitHub Copilot instructions, Vercel AI SDK, OpenAI TS/Python, Anthropic TS/Python, Google Gen AI, LangChain Python, cURL, JSONs, and Markdown.
- **Interactive Physics Deck Engine**: Tactile freeform 3D blueprint deck with ultra-wide ``Ctrl + Scroll`` zoom (5% to 300%), scale-calibrated 1:1 cursor tracking (``deltaScreen / zoomScale``), unconstrained canvas drag physics, and dynamic z-index elevation.
- **Modal Scroll Isolation**: Resolved scroll wheel interception across code editors and prompt textareas by isolating wheel events from global smooth-scroll listeners (``data-lenis-prevent``).
- **Auto-Updater Synchronization**: Native ``latest.yml`` manifests and SHA-512 blockmaps for background update verification and one-click upgrades.
- **Windows Taskbar & Brand Alignment**: Embedded Win32 PE multi-resolution icon resource with registered ``com.bedrock.desktop`` AppUserModelId.

---

### Downloads
- **Windows Installer**: `Bedrock-Setup.exe` (or `Bedrock-Setup-1.2.3.exe`)
"@
            draft = $false
            prerelease = $false
            make_latest = "true"
        } | ConvertTo-Json

        $winRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases" -Headers $headers -Method Post -Body $body
        Write-Host "Windows release v1.2.3 created successfully (ID: $($winRelease.id))."
    }

    $winId = $winRelease.id
    $winAssets = @(
        @{ Name = "Bedrock-Setup.exe"; Path = "release\Bedrock-Setup.exe"; ContentType = "application/octet-stream" },
        @{ Name = "Bedrock-Setup-1.2.3.exe"; Path = "release\Bedrock-Setup-1.2.3.exe"; ContentType = "application/octet-stream" },
        @{ Name = "latest.yml"; Path = "release\latest.yml"; ContentType = "text/yaml" },
        @{ Name = "Bedrock-Setup-1.2.3.exe.blockmap"; Path = "release\Bedrock-Setup-1.2.3.exe.blockmap"; ContentType = "application/octet-stream" }
    )

    foreach ($item in $winAssets) {
        if (Test-Path $item.Path) {
            if ($winRelease.assets) {
                foreach ($a in $winRelease.assets) {
                    if ($a.name -eq $item.Name) {
                        Write-Host "Deleting existing $($item.Name) in v1.2.3 (ID: $($a.id))..."
                        Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/assets/$($a.id)" -Headers $headers -Method Delete
                        Start-Sleep -Seconds 1
                    }
                }
            }
            $fileItem = Get-Item $item.Path
            Write-Host "==> Uploading $($item.Name) ($([math]::Round($fileItem.Length / 1MB, 2)) MB) to v1.2.3..."
            $uploadUrl = "https://uploads.github.com/repos/$repo/releases/$winId/assets?name=$($item.Name)"
            & curl.exe -s -S -X POST -H "Authorization: Bearer $token" -H "Content-Type: $($item.ContentType)" -H "Accept: application/vnd.github.v3+json" --data-binary "@$($item.Path)" "$uploadUrl" | Out-Null
            Write-Host "    $($item.Name) uploaded successfully."
        }
    }

    # ---------------- 2. macOS Dedicated Release (v1.2.3-mac) ----------------
    $macRelease = $null
    try {
        $macRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/tags/v1.2.3-mac" -Headers $headers -Method Get
        Write-Host "macOS Release v1.2.3-mac exists (ID: $($macRelease.id))."
    } catch {
        Write-Host "Creating dedicated macOS release v1.2.3-mac..."
        $body = @{
            tag_name = "v1.2.3-mac"
            target_commitish = "main"
            name = "Bedrock v1.2.3 - macOS Desktop Workstation"
            body = @"
# Bedrock v1.2.3 - macOS Desktop Workstation

Dedicated macOS release for Bedrock Prompt Engineering Workstation.
Native build supporting both Apple Silicon (M1/M2/M3/M4) and Intel Macs with Multi-Target Blueprint Exporters and Interactive Physics Deck.

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
        Write-Host "macOS release v1.2.3-mac created successfully (ID: $($macRelease.id))."
    }

    $macId = $macRelease.id
    $macTargets = @("Bedrock-Mac.dmg", "Bedrock-Mac.zip")
    foreach ($mName in $macTargets) {
        $mPath = "release\$mName"
        if (Test-Path $mPath) {
            if ($macRelease.assets) {
                foreach ($a in $macRelease.assets) {
                    if ($a.name -eq $mName) {
                        Write-Host "Deleting existing $mName in v1.2.3-mac..."
                        Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/assets/$($a.id)" -Headers $headers -Method Delete
                        Start-Sleep -Seconds 1
                    }
                }
            }
            $fileItem = Get-Item $mPath
            Write-Host "==> Uploading $mName ($([math]::Round($fileItem.Length / 1MB, 2)) MB) to v1.2.3-mac..."
            $uploadUrl = "https://uploads.github.com/repos/$repo/releases/$macId/assets?name=$mName"
            & curl.exe -s -S -X POST -H "Authorization: Bearer $token" -H "Content-Type: application/octet-stream" -H "Accept: application/vnd.github.v3+json" --data-binary "@$mPath" "$uploadUrl" | Out-Null
            Write-Host "    $mName uploaded successfully."
        }
    }

    # ---------------- 3. Backfill latest.yml to earlier releases for seamless auto-updater ----------------
    foreach ($prevTag in @("v1.2.2", "v1.2.1")) {
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
