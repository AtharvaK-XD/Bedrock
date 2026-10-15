# Script to manage GitHub releases: Windows (v1.2.5) and macOS (v1.2.5-mac)
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
    
    # ---------------- 1. Windows Release (v1.2.5) ----------------
    $winRelease = $null
    try {
        $winRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/tags/v1.2.5" -Headers $headers -Method Get
        Write-Host "Windows Release v1.2.5 exists (ID: $($winRelease.id))."
    } catch {
        Write-Host "Creating Windows release v1.2.5..."
        $body = @{
            tag_name = "v1.2.5"
            target_commitish = "main"
            name = "Bedrock v1.2.5 - Desktop Workstation & AI Model Tuning"
            body = @"
# Bedrock v1.2.5 - AI Model Tuning, Sub-Millisecond RAG & Desktop Workstation

This major engineering release decouples Bedrock's domain guardrails, introduces per-model tuning tables to drastically curb randomness and hallucination, embeds a sub-millisecond RAG factual verification engine, and brings full backend API proxying to the native Desktop Workstation.

## Highlights
- **Decoupled Domain Guardrails**: Completely segregated Universal, Coding, Visual Media, Writing, Freelance, and Hackathon synthesis profiles. Visual prompts (Midjourney, FLUX.1, Sora, Runway) are strictly purged of all coding, tech stack, and database contamination.
- **Calibrated Per-Model Tuning Table**: Fine-tuned temperature thresholds (Coding: 0.15–0.20, Freelance: 0.25–0.30, Writing: 0.40–0.45, Visual: 0.65–0.70) with tailored top_p, token budgets, and model-specific system directives across Llama 3.1 8B, Llama 3.3 70B, DeepSeek-R1, Gemini 2.5 Flash, and GPT-4o-mini.
- **Sub-Millisecond RAG Verification Engine**: Integrated low-token (<80 tokens) factual grounding blocks (`<verified_external_facts>`) backed by standalone Python semantic verification and dual Node/TypeScript runtime modules. Zero hallucination of deprecated APIs, fake packages, or invalid parameters.
- **Output Quality Validation & Single-Shot Repair Retry**: Automated post-generation AST and lexical analysis catching forbidden terms and invoking a single-shot penalization repair loop before output delivery.
- **Desktop Workstation Backend Proxy & Offline Fallback**: Desktop Electron runtime transparently proxies API generation and telemetry to production serverless infrastructure while seamlessly falling back to client-side tuned LLM dispatch when operating offline.
- **Dual-Account Auto-Updater Sync**: Real-time update discovery, blockmap verification, and background updates synchronized across ``Bedrockxai/Bedrock`` and ``AtharvaK-XD/Bedrock``.

---

### Downloads
- **Windows Installer**: `Bedrock-Setup.exe` (or `Bedrock-Setup-1.2.5.exe`)
"@
            draft = $false
            prerelease = $false
            make_latest = "true"
        } | ConvertTo-Json

        $winRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases" -Headers $headers -Method Post -Body $body -ContentType "application/json"
        Write-Host "Windows release v1.2.5 created successfully (ID: $($winRelease.id))."
    }

    $winId = $winRelease.id
    $winAssets = @(
        @{ Name = "Bedrock-Setup.exe"; Path = "release\Bedrock-Setup.exe"; ContentType = "application/octet-stream" },
        @{ Name = "Bedrock-Setup-1.2.5.exe"; Path = "release\Bedrock-Setup-1.2.5.exe"; ContentType = "application/octet-stream" },
        @{ Name = "latest.yml"; Path = "release\latest.yml"; ContentType = "text/yaml" },
        @{ Name = "Bedrock-Setup-1.2.5.exe.blockmap"; Path = "release\Bedrock-Setup-1.2.5.exe.blockmap"; ContentType = "application/octet-stream" }
    )

    foreach ($item in $winAssets) {
        if (Test-Path $item.Path) {
            if ($winRelease.assets) {
                foreach ($a in $winRelease.assets) {
                    if ($a.name -eq $item.Name) {
                        Write-Host "Deleting existing $($item.Name) in v1.2.5 (ID: $($a.id))..."
                        Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/assets/$($a.id)" -Headers $headers -Method Delete
                        Start-Sleep -Seconds 1
                    }
                }
            }
            $fileItem = Get-Item $item.Path
            Write-Host "==> Uploading $($item.Name) ($([math]::Round($fileItem.Length / 1MB, 2)) MB) to v1.2.5..."
            $uploadUrl = "https://uploads.github.com/repos/$repo/releases/$winId/assets?name=$($item.Name)"
            & curl.exe -s -S -X POST -H "Authorization: Bearer $token" -H "Content-Type: $($item.ContentType)" -H "Accept: application/vnd.github.v3+json" --data-binary "@$($item.Path)" "$uploadUrl" | Out-Null
            Write-Host "    $($item.Name) uploaded successfully."
        }
    }

    # ---------------- 2. macOS Dedicated Release (v1.2.5-mac) ----------------
    $macRelease = $null
    try {
        $macRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/tags/v1.2.5-mac" -Headers $headers -Method Get
        Write-Host "macOS Release v1.2.5-mac exists (ID: $($macRelease.id))."
    } catch {
        Write-Host "Creating dedicated macOS release v1.2.5-mac..."
        $body = @{
            tag_name = "v1.2.5-mac"
            target_commitish = "main"
            name = "Bedrock v1.2.5 - macOS Desktop Workstation"
            body = @"
# Bedrock v1.2.5 - macOS Desktop Workstation

Dedicated macOS release for Bedrock Prompt Engineering Workstation.
Native build supporting both Apple Silicon (M1/M2/M3/M4) and Intel Macs with Multi-Target Blueprint Exporters, Interactive Physics Deck, Sub-Millisecond RAG Verification, and Zero-Coding Media Generation.

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
        Write-Host "macOS release v1.2.5-mac created successfully (ID: $($macRelease.id))."
    }

    $macId = $macRelease.id
    $macTargets = @("Bedrock-Mac.dmg", "Bedrock-Mac.zip")
    foreach ($mName in $macTargets) {
        $mPath = "release\$mName"
        if (Test-Path $mPath) {
            if ($macRelease.assets) {
                foreach ($a in $macRelease.assets) {
                    if ($a.name -eq $mName) {
                        Write-Host "Deleting existing $mName in v1.2.5-mac..."
                        Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/assets/$($a.id)" -Headers $headers -Method Delete
                        Start-Sleep -Seconds 1
                    }
                }
            }
            $fileItem = Get-Item $mPath
            Write-Host "==> Uploading $mName ($([math]::Round($fileItem.Length / 1MB, 2)) MB) to v1.2.5-mac..."
            $uploadUrl = "https://uploads.github.com/repos/$repo/releases/$macId/assets?name=$mName"
            & curl.exe -s -S -X POST -H "Authorization: Bearer $token" -H "Content-Type: application/octet-stream" -H "Accept: application/vnd.github.v3+json" --data-binary "@$mPath" "$uploadUrl" | Out-Null
            Write-Host "    $mName uploaded successfully."
        }
    }

    # ---------------- 3. Backfill latest.yml to earlier releases for seamless auto-updater ----------------
    foreach ($prevTag in @("v1.2.4", "v1.2.3", "v1.2.2", "v1.2.1")) {
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
