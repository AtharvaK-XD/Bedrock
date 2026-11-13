import os, sys, json, subprocess, urllib.request

def get_token():
    p = subprocess.Popen(['git', 'credential', 'fill'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    out, _ = p.communicate(input='protocol=https\nhost=github.com\nusername=AtharvaK-XD\n\n')
    for line in out.splitlines():
        if line.startswith('password='):
            return line.split('=', 1)[1]
    return ''

token = get_token()
if not token:
    print('Failed to get token')
    sys.exit(1)

repos = ['AtharvaK-XD/Bedrock', 'Bedrockxai/Bedrock']
tag_name = 'v1.4.7'
release_title = 'Bedrock v1.4.7 - Branching v2 Visual Engine, 15 Starter Recipes & Sandboxed Web Worker Execution'
body = """# Bedrock v1.4.7 - Branching v2 Visual Engine, 15 Starter Recipes & Sandboxed Web Worker Execution

The unified workstation for frontier prompt engineering. Synthesize autonomous agent directives, orchestrate visual DAG workflows, and benchmark across 10 AI providers.

### What's New in v1.4.7:
- **Branching v2 Interactive Studio**: Full visual execution for all 15 node types with Run All, Step-by-Step debugging, Pause/Stop, and live animated execution rings and wire particle streams.
- **Smart Condition Builder**: Multi-rule groups (ALL/ANY), nested JSON path extraction, 24 condition operators, and an instant zero-token "Try it" local evaluator.
- **Interactive Breakpoints ("Ask Me")**: Human-in-the-loop modal pauses pipeline execution to collect user input directly into workflow runtime state.
- **15 Curated Starter Recipes**: Practical templates categorized into Simple, Intermediate, and Advanced (Mood Router, Product Description Factory, Meeting Notes to Task Table, Code Review Gate, and more).
- **Web Worker Code Sandbox Isolation**: Hardened sandbox code runner executing custom JavaScript inside dedicated Web Workers with automatic frame fallback, 3-second hard timeout, and CSP `worker-src blob:;` protection against process starvation.
- **100% BYOK Desktop Freedom**: The desktop workstation remains 100% subscription-free, allowing unlimited visual nodes, unlimited templates, and local encrypted key storage without plan gates.

### Desktop Downloads:
- **Windows Installer**: [Bedrock Setup 1.4.7.exe](https://github.com/AtharvaK-XD/Bedrock/releases/download/v1.4.7/Bedrock.Setup.1.4.7.exe)
- **Windows Portable / Direct**: [Bedrock-Setup.exe](https://github.com/AtharvaK-XD/Bedrock/releases/download/v1.4.7/Bedrock-Setup.exe)
- **macOS Desktop Build**: Dedicated release available at [v1.4.7-mac](https://github.com/AtharvaK-XD/Bedrock/releases/tag/v1.4.7-mac) (`Bedrock-Mac.dmg` / `Bedrock-Mac.zip`)
"""

assets = [
    ('release/Bedrock Setup 1.4.7.exe', 'Bedrock Setup 1.4.7.exe', 'application/vnd.microsoft.portable-executable'),
    ('release/Bedrock-Setup-1.4.7.exe', 'Bedrock-Setup-1.4.7.exe', 'application/vnd.microsoft.portable-executable'),
    ('release/Bedrock-Setup.exe', 'Bedrock-Setup.exe', 'application/vnd.microsoft.portable-executable'),
    ('release/Bedrock Setup 1.4.7.exe.blockmap', 'Bedrock Setup 1.4.7.exe.blockmap', 'application/octet-stream'),
    ('release/latest.yml', 'latest.yml', 'text/yaml'),
]

for repo in repos:
    print(f'Processing {repo}...')
    # Check if release exists
    get_url = f'https://api.github.com/repos/{repo}/releases/tags/{tag_name}'
    req = urllib.request.Request(get_url, headers={
        'Authorization': f'token {token}',
        'User-Agent': 'Bedrock-Release',
        'Accept': 'application/vnd.github.v3+json'
    })
    rel_id = None
    upload_url_template = None
    try:
        with urllib.request.urlopen(req) as resp:
            rel = json.loads(resp.read().decode())
            rel_id = rel['id']
            upload_url_template = rel['upload_url']
            print(f'Release already exists for {repo} (id: {rel_id})')
    except urllib.error.HTTPError as e:
        if e.code == 404:
            # Create release
            create_url = f'https://api.github.com/repos/{repo}/releases'
            payload = json.dumps({
                'tag_name': tag_name,
                'name': release_title,
                'body': body,
                'draft': False,
                'prerelease': False
            }).encode('utf-8')
            create_req = urllib.request.Request(create_url, data=payload, headers={
                'Authorization': f'token {token}',
                'User-Agent': 'Bedrock-Release',
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            })
            with urllib.request.urlopen(create_req) as create_resp:
                rel = json.loads(create_resp.read().decode())
                rel_id = rel['id']
                upload_url_template = rel['upload_url']
                print(f'Created release for {repo} (id: {rel_id})')
        else:
            print(f'Error querying release: {e}')
            continue

    if not upload_url_template:
        continue

    clean_upload_url = upload_url_template.split('{')[0]

    # Upload each asset
    for file_path, file_name, mime_type in assets:
        if not os.path.exists(file_path):
            print(f'Asset not found: {file_path}')
            continue

        file_size = os.path.getsize(file_path)
        print(f'Uploading {file_name} ({file_size} bytes) to {repo}...')
        upload_url = f'{clean_upload_url}?name={urllib.parse.quote(file_name)}'

        with open(file_path, 'rb') as f:
            data = f.read()

        up_req = urllib.request.Request(upload_url, data=data, headers={
            'Authorization': f'token {token}',
            'User-Agent': 'Bedrock-Release',
            'Content-Type': mime_type,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Length': str(file_size)
        })

        try:
            with urllib.request.urlopen(up_req) as up_resp:
                print(f'Successfully uploaded {file_name}')
        except urllib.error.HTTPError as err:
            err_body = err.read().decode()
            if 'already_exists' in err_body:
                print(f'{file_name} already uploaded on {repo}')
            else:
                print(f'Upload failed for {file_name}: {err.code} {err_body}')

print('Release publishing complete!')
