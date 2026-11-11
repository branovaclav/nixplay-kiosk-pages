#!/usr/bin/env python3
"""Run every project's validator. Exit 1 if any fail.

  python3 tools/validate.py
"""
from __future__ import annotations

import os
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

VALIDATORS = [
    os.path.join(REPO, "projects", "daily-summary", "tools", "validate.py"),
]


def main():
    failed = 0
    for path in VALIDATORS:
        if not os.path.isfile(path):
            print(f"missing validator: {path}", file=sys.stderr)
            failed += 1
            continue
        rel = os.path.relpath(path, REPO)
        print(f"— {rel}")
        r = subprocess.run([sys.executable, path], cwd=REPO)
        if r.returncode != 0:
            failed += 1
    if failed:
        print(f"\n{failed} validator(s) failed.", file=sys.stderr)
        return 1
    print("\nAll project validators OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
