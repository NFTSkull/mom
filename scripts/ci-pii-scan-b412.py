#!/usr/bin/env python3
"""PII/secret heuristic scan for B4.12.1 candidate files. No full secret dump."""
from __future__ import annotations
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANDIDATES = [
    "scripts/lib/assert-production-only.ts",
    "scripts/lib/b412-pilot-constants.ts",
    "scripts/lib/b412-pilot-policy.ts",
    "scripts/seed-b412-prod-pilot.ts",
    "scripts/cleanup-b412-prod-pilot.ts",
    "scripts/smoke-b412-prod-pilot.ts",
    "scripts/smoke-b412-prod-storage.ts",
    "src/lib/nom035/__tests__/b4-12-production-guards.test.ts",
    "docs/B4_12_PRODUCTION_CUTOVER_PILOT.md",
    "CHANGELOG.md",
    "DEVLOG.md",
    "package.json",
]

PATTERNS = [
    ("jwt", re.compile(r"eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,}\.")),
    ("gh_pat", re.compile(r"ghp_[A-Za-z0-9]{36,}")),
    ("service_key", re.compile(r"sb_secret_[A-Za-z0-9]+")),
    ("supabase_service_role", re.compile(r"service_role['\"]?\s*[:=]\s*['\"]eyJ")),
    ("email_realish", re.compile(r"[a-z0-9._%+-]+@(gmail|hotmail|outlook|yahoo|vioz)\.com", re.I)),
    ("csv_path", re.compile(r"trabajadores_nom035_83\.csv")),
    ("password_assign", re.compile(r"password\s*=\s*['\"][^'\"]{8,}['\"]", re.I)),
]

hits = []
for rel in CANDIDATES:
    p = ROOT / rel
    if not p.exists():
        hits.append((rel, "missing_file"))
        continue
    text = p.read_text(encoding="utf-8", errors="ignore")
    for name, rx in PATTERNS:
        if rx.search(text):
            # allowlisted synthetic pilot email domain
            if name == "email_realish" and "nom035.pilot.invalid" in text and "vioz" not in text.lower():
                continue
            hits.append((rel, name))

if hits:
    print("PII_SCAN_FAIL")
    for rel, name in hits:
        print(f"  {rel}: {name}")
    sys.exit(1)
print("PII_SCAN_OK")
