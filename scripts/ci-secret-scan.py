#!/usr/bin/env python3
"""Escaneo CI de secretos. Imprime solo ruta + etiqueta, nunca el valor."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PATTERNS = [
    ("jwt_like", re.compile(r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}")),
    ("private_key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    # Solo valores en la misma línea; [ \\t]* no cruza saltos de línea.
    ("supabase_secret_assignment", re.compile(r"(?m)^SUPABASE_SECRET_KEY[ \t]*=[ \t]*(\S+)[ \t]*$")),
    ("pepper_assignment", re.compile(r"(?m)^NOM035_(?:TOKEN|SESSION|RATE_LIMIT)_PEPPER[ \t]*=[ \t]*(\S+)[ \t]*$")),
    ("password_assignment", re.compile(r"(?i)(password|passwd)\s*[:=]\s*['\"][^'\"]{8,}")),
    ("totp_secret", re.compile(r"(?i)totp[_-]?secret\s*[:=]\s*['\"][^'\"]+")),
    ("oauth_token", re.compile(r"(?i)(access_token|refresh_token)\s*[:=]\s*['\"][^'\"]{16,}")),
]

EXCLUDE_DIR_NAMES = {
    ".git",
    "node_modules",
    ".next",
    "test-results",
    "playwright-report",
    ".tmp",
    ".temp",
    "coverage",
    ".vercel",
}
ALLOW_EMPTY_ASSIGNMENT_FILES = {".env.example"}
# Peppers sintéticos en tests unitarios (nunca valores de staging/prod).
ALLOW_PEPPER_IN_TESTS = True

hits: list[tuple[str, str]] = []

for path in ROOT.rglob("*"):
    if not path.is_file():
        continue
    if set(path.parts) & EXCLUDE_DIR_NAMES:
        continue
    if path.suffix in {".png", ".jpg", ".jpeg", ".webp", ".zip", ".pdf", ".woff", ".woff2"}:
        continue
    # Archivos de entorno locales: no deben versionarse; CI no los tiene.
    # Localmente existen pero están en .gitignore — no fallar el scan del árbol de trabajo.
    if path.name in {".env", ".env.local", ".env.staging.local"}:
        continue
    try:
        text = path.read_text("utf-8", errors="ignore")
    except OSError:
        continue
    rel = str(path.relative_to(ROOT))
    for label, cre in PATTERNS:
        for m in cre.finditer(text):
            if path.name in ALLOW_EMPTY_ASSIGNMENT_FILES:
                line = text[: m.end()].splitlines()[-1]
                value = line.split("=", 1)[1].strip() if "=" in line else "x"
                if len(value) == 0:
                    continue
            if (
                ALLOW_PEPPER_IN_TESTS
                and label == "pepper_assignment"
                and ("__tests__" in rel or "/tests/" in rel or rel.startswith("e2e"))
            ):
                continue
            # Contraseñas sintéticas de E2E / fixtures de prueba (nunca prod).
            if label == "password_assignment" and (
                rel.startswith("e2e/")
                or "/__tests__/" in rel
                or rel.startswith("scripts/seed-")
                or rel.startswith("scripts/cleanup-")
                or rel.startswith("scripts/smoke-b412-")
                # CI local WebKit: GUIDE_III_TEST_PASSWORD sintético en workflow (no Cloud).
                or (
                    rel.startswith(".github/workflows/")
                    and "GUIDE_III_TEST_PASSWORD" in text[max(0, m.start() - 80) : m.end()]
                )
            ):
                continue
            hits.append((rel, label))

seen: set[tuple[str, str]] = set()
unique: list[tuple[str, str]] = []
for h in hits:
    if h in seen:
        continue
    seen.add(h)
    unique.append(h)

# Fallar si un secreto estaría versionado (tracked by git)
import subprocess

tracked = set(
    subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT)
    .decode()
    .split("\0")
)

versioned_hits = [(rel, label) for rel, label in unique if rel in tracked]

if versioned_hits:
    print(f"SECRET_SCAN_FAIL count={len(versioned_hits)}")
    for rel, label in versioned_hits:
        print(f"{label}\t{rel}")
    sys.exit(1)

print("SECRET_SCAN_OK")
