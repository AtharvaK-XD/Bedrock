# Script to manage GitHub releases: Windows (v1.2.1) and macOS (v1.2.1-mac)
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
    
    # ---------------- 1. Windows Release (v1.2.1) ----------------
    $winRelease = $null
    try {
        $winRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/tags/v1.2.1" -Headers $headers -Method Get
        Write-Host "Windows Release v1.2.1 exists (ID: $($winRelease.id))."
    } catch {
        Write-Host "Creating Windows release v1.2.1..."
        $body = @{
            tag_name = "v1.2.1"
            target_commitish = "main"
            name = "Bedrock v1.2.1 - Desktop Workstation"
            body = @"
# Bedrock v1.2.1 Desktop Workstation

This release delivers the dedicated desktop workstation interface with direct Google/GitHub OAuth consent integration, instant authentication handshakes, and local BYOK synthesis.

## Highlights
- **Instant Headless OAuth Consent**: Bypasses intermediate verification cards and directs immediately to Google's / GitHub's native account selection and consent screen.
- **Dedicated Desktop Layout**: Clean borderless workstation view directly routing into login on first run.
- **Full Desktop Sidebar Navigation**: Seamless access to Dashboard, Prompt Generator, Branching Pipelines, Prompt Tester, and Library directly from the workstation sidebar.
- **BYOK Multi-Model Synthesis**: Built-in support for Gemini, Groq, OpenAI, Anthropic, and OpenRouter.
- **Single-Instance Deep Linking**: Robust ``bedrock://`` deep link protocol support with window focus restoration.

---

### Downloads
- **Windows Installer**: Download `Bedrock-Setup.exe` below.
"@
            draft = $false
            prerelease = $false
            make_latest = "true"
        } | ConvertTo-Json

        $winRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases" -Headers $headers -Method Post -Body $body
        Write-Host "Windows release created successfully (ID: $($winRelease.id))."
    }

    $winPath = "release\installer\Bedrock-Setup.exe"
    if (-not (Test-Path $winPath)) {
        $winPath = "release\Bedrock-Setup.exe"
    }
    if (Test-Path $winPath) {
        $winId = $winRelease.id
        if ($winRelease.assets) {
            foreach ($a in $winRelease.assets) {
                if ($a.name -eq "Bedrock-Setup.exe") {
                    Write-Host "Deleting old Bedrock-Setup.exe asset ($($a.id))..."
                    Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/assets/$($a.id)" -Headers $headers -Method Delete
                    Start-Sleep -Seconds 1
                }
            }
        }
        $fileItem = Get-Item $winPath
        Write-Host "==> Uploading Bedrock-Setup.exe ($([math]::Round($fileItem.Length / 1MB, 2)) MB) to v1.2.1..."
        $uploadUrl = "https://uploads.github.com/repos/$repo/releases/$winId/assets?name=Bedrock-Setup.exe"
        & curl.exe -X POST -H "Authorization: Bearer $token" -H "Content-Type: application/octet-stream" -H "Accept: application/vnd.github.v3+json" --data-binary "@$winPath" "$uploadUrl"
    }

    # ---------------- 2. macOS Dedicated Release (v1.2.1-mac) ----------------
    $macRelease = $null
    try {
        $macRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/tags/v1.2.1-mac" -Headers $headers -Method Get
        Write-Host "macOS Release v1.2.1-mac exists (ID: $($macRelease.id))."
    } catch {
        Write-Host "Creating dedicated macOS release v1.2.1-mac..."
        $body = @{
            tag_name = "v1.2.1-mac"
            target_commitish = "main"
            name = "Bedrock v1.2.1 - macOS Desktop Workstation"
            body = @"
# Bedrock v1.2.1 - macOS Desktop Workstation

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
        Write-Host "macOS release created successfully (ID: $($macRelease.id))."
    }

    $macId = $macRelease.id
    $macTargets = @("Bedrock-Mac.dmg", "Bedrock-Mac.zip")
    foreach ($mName in $macTargets) {
        $mPath = "release\$mName"
        if (Test-Path $mPath) {
            if ($macRelease.assets) {
                foreach ($a in $macRelease.assets) {
                    if ($a.name -eq $mName) {
                        Write-Host "Deleting existing $mName in v1.2.1-mac..."
                        Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/assets/$($a.id)" -Headers $headers -Method Delete
                        Start-Sleep -Seconds 1
                    }
                }
            }
            $fileItem = Get-Item $mPath
            Write-Host "==> Uploading $mName ($([math]::Round($fileItem.Length / 1MB, 2)) MB) to v1.2.1-mac..."
            $uploadUrl = "https://uploads.github.com/repos/$repo/releases/$macId/assets?name=$mName"
            & curl.exe -X POST -H "Authorization: Bearer $token" -H "Content-Type: application/octet-stream" -H "Accept: application/vnd.github.v3+json" --data-binary "@$mPath" "$uploadUrl"
        }
    }

    Write-Host "`n==> Verifying latest Windows release for $repo..."
    $latest = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -Headers $headers -Method Get
    Write-Host "Latest release tag (should be v1.2.1): $($latest.tag_name)"
    foreach ($a in $latest.assets) {
        Write-Host "  - Windows Asset: $($a.name) ($([math]::Round($a.size / 1MB, 2)) MB)"
    }
}

Write-Host "`n==> Finished isolated release configuration!"
