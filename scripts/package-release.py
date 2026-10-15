#!/usr/bin/env python3
"""Build a local, allowlisted source archive. No network, staging or publication."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import re
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'release'
ROOT_FILES = ('.env.example', '.gitignore', 'README.md', 'package.json',
              'package-lock.json', 'tsconfig.json', 'playwright.config.ts')
TREES = ('src', 'public', 'tests', 'docs', 'scripts')
EVIDENCE = (
    'VERIFICATION.md', 'live-demo.json', 'live-demo-2026-10-14.json',
    'live-browser-rechecked-2026-10-15.json',
    'agent-first-attempt-2026-10-15.json', 'agent-partial-2026-10-15.json',
    'agent-cloudflare-redirect-2026-10-15.json', 'agent-candidate-diagnostic.json',
    'agent-final-partial-2026-10-15.json', 'agent-verified-jobs-2026-10-15.json',
    'live-agent-combined-2026-10-15.json', 'live-jobs-combined-2026-10-15.csv',
    'live-combined-desktop-2026-10-15.jpg', 'live-combined-mobile-2026-10-15.jpg',
    'agent-partial-desktop-2026-10-15.jpg', 'agent-partial-mobile-2026-10-15.jpg',
    'live-jobs-2026-10-15.csv',
    'live-attempt-2026-10-15.json', 'preflight-failure-2026-10-15.json',
    'wallet-check-2026-10-15.json', 'live-wallet-preflight.json',
    'live-wallet-receipt.json', 'agent-step-cap-preflight.json',
    'live-jobs.csv', 'desktop-live.png', 'mobile-live.png',
    'readiness-checks.json',
    'unit-tests.txt', 'ui-tests.txt', 'typecheck.txt', 'build.txt',
    'submission/status.json', 'submission/rules-check.json', 'submission/request-limit-authorization.json', 'submission/secret-scan.json', 'submission/archive-smoke.json',
    'followup-design-triage.json', 'followup-design-after.json',
)
ALLOWED_SUFFIXES = {'.ts', '.js', '.mjs', '.py', '.html', '.css', '.json',
                    '.md', '.txt', '.woff2'}


def env_values(path):
    """Read simple dotenv assignments as data, never execute or print them."""
    if not path.is_file():
        return {}
    values = {}
    for line in path.read_text().splitlines():
        match = re.fullmatch(r'\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*', line)
        if match:
            value = match[2]
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            values[match[1]] = value
    return values


def main():
    paths = [ROOT / name for name in ROOT_FILES]
    for tree in TREES:
        for path in (ROOT / tree).rglob('*'):
            if path.is_symlink():
                raise ValueError('symlink refused: ' + str(path.relative_to(ROOT)))
            if path.is_file() and path.suffix in ALLOWED_SUFFIXES:
                paths.append(path)
    paths += [ROOT / 'evidence' / name for name in EVIDENCE]
    paths = sorted(set(paths))
    if (ROOT / '.env.example').stat().st_size:
        raise ValueError('.env.example must be empty')
    local = env_values(ROOT / '.env')
    approved = {**local, **os.environ}
    shared = {}
    if approved.get('USE_SHARED_TINYFISH_KEY') == 'true':
        shared = env_values(Path.home() / '.config/tinyfish/credentials.env')
    keys = {values.get('TINYFISH_API_KEY', '') for values in (local, shared, os.environ)}
    secrets = [key.encode() for key in keys if len(key) >= 8]
    patterns = [
        re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
        re.compile(rb'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})'),
        re.compile(rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
        re.compile(rb'\bsk_live_[A-Za-z0-9]{20,}\b'),
    ]
    content = {}
    for path in paths:
        if path.is_symlink() or not path.is_file():
            raise ValueError('required regular file missing: ' + str(path.relative_to(ROOT)))
        relative = path.relative_to(ROOT).as_posix()
        if any(part.startswith('.') for part in path.relative_to(ROOT).parts) and relative not in ROOT_FILES:
            raise ValueError('hidden input refused: ' + relative)
        data = path.read_bytes()
        if any(key in data for key in secrets) or any(pattern.search(data) for pattern in patterns):
            raise ValueError('possible secret in ' + relative + '; matched values withheld')
        content['careers-finder/' + relative] = data
    manifest = {
        'kind': 'local source archive; not a submission receipt',
        'createdAt': datetime.now(timezone.utc).isoformat(),
        'files': {name: {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
                  for name, data in content.items()},
        'excluded': ['.env', '.data', 'node_modules', 'dist', 'test-results',
                     'playwright-report', 'release', 'unrelated parent projects'],
        'scan': {'knownCredentialValuesChecked': len(secrets), 'matches': 0,
                 'limits': 'Exact known key bytes and selected credential patterns; no history scan or guarantee against unknown secret formats.'},
    }
    OUT.mkdir(exist_ok=True)
    name = 'firststep-careers-finder-0.1.0-source'
    manifest_data = (json.dumps(manifest, indent=2) + '\n').encode()
    archive = OUT / (name + '.zip')
    temporary = OUT / (name + '.zip.tmp')
    with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED) as bundle:
        for entry, data in content.items():
            bundle.writestr(entry, data)
        bundle.writestr('careers-finder/RELEASE-MANIFEST.json', manifest_data)
    # Inspect actual archive members, not just the input file list.
    with zipfile.ZipFile(temporary) as bundle:
        expected = set(content) | {'careers-finder/RELEASE-MANIFEST.json'}
        if set(bundle.namelist()) != expected or bundle.testzip() is not None:
            raise ValueError('archive integrity mismatch')
        for entry in bundle.namelist():
            data = bundle.read(entry)
            if any(key in data for key in secrets):
                raise ValueError('known credential in archive; value withheld')
            if entry in content and data != content[entry]:
                raise ValueError('archive byte mismatch')
    temporary.replace(archive)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    (OUT / (name + '.sha256')).write_text(digest + '  ' + archive.name + '\n')
    (OUT / (name + '.manifest.json')).write_bytes(manifest_data)
    print(json.dumps({'archive': str(archive), 'files': len(content) + 1,
                      'sha256': digest, 'knownCredentialMatches': 0,
                      'envExampleBytes': 0, 'published': False}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Errors above contain only fixed text and relative file names.
        print('Package stopped: ' + str(error), file=sys.stderr)
        sys.exit(2)
