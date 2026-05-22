#!/usr/bin/env python3
"""
Build pre-compiled `.fjm` binaries for every example in
`public/example-fjms/manifest.json`, writing each to
`public/example-fjms/<slug>.fjm`.

This script runs ON THE DEPLOY HOST (not the GitHub Actions runner) because
it needs the `fj` CLI (provided by `pip install flipjump` inside the venv).
The TS half (`scripts/build-example-index.ts`) runs on the runner and emits
the manifest; the Python half consumes the manifest here.

Hard-fails when `fj` is missing — better than silently shipping a stale
cache. The TypeScript / Next.js side ALWAYS works without `.fjm` files
present (the client falls back to /api/compile).

Wipes any stale `*.fjm` not in the current manifest first. rsync --delete
in deploy.yml already does this, but the defensive wipe makes local runs
correct too.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT / "public" / "example-fjms" / "manifest.json"
OUTPUT_DIR = ROOT / "public" / "example-fjms"
TIMEOUT_S = 120
FJ_CMD = os.environ.get("FJ_CMD", "fj")


def die(msg: str) -> "None":
    sys.stderr.write(f"build-example-fjms.py: {msg}\n")
    sys.exit(1)


def check_fj() -> None:
    if shutil.which(FJ_CMD) is None:
        die(
            f"`{FJ_CMD}` is not on PATH. "
            "On the deploy host this means the virtualenv wasn't activated. "
            "Run `source $VENV_PATH/bin/activate` before this script."
        )


def load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        die(
            f"{MANIFEST_PATH} not found. "
            "Run `tsx scripts/build-example-index.ts` first (it's wired into npm "
            "prebuild/predev)."
        )
    with MANIFEST_PATH.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def slugs_in_manifest(manifest: dict) -> set:
    out = set()
    for entry in manifest.values():
        slug = entry.get("slug")
        if isinstance(slug, str):
            out.add(slug)
    return out


def wipe_stale_fjms(keep_slugs: set) -> None:
    if not OUTPUT_DIR.exists():
        return
    for path in OUTPUT_DIR.glob("*.fjm"):
        if path.stem not in keep_slugs:
            sys.stdout.write(f"  removing stale {path.name}\n")
            path.unlink()


def build_one(entry: dict) -> None:
    slug = entry["slug"]
    name = entry.get("name", slug)
    files = entry.get("files", [])
    if not files:
        die(f"manifest entry '{slug}' has no files")

    out_path = OUTPUT_DIR / f"{slug}.fjm"

    with tempfile.TemporaryDirectory(prefix="fj-build-") as tmpdir:
        tmp_path = Path(tmpdir)
        argv_files = []
        for f in files:
            fname = f["name"]
            content = f["content"]
            # Filenames in the manifest come from EXAMPLES, which the
            # `examples.test.ts` unit test already validates against
            # `isSafeFilename` — no separators, no traversal. Defensive
            # `Path.name` check below makes sure of it again.
            if Path(fname).name != fname:
                die(f"unsafe filename in entry '{slug}': {fname!r}")
            file_path = tmp_path / fname
            file_path.write_text(content, encoding="utf-8")
            argv_files.append(str(file_path))

        sys.stdout.write(f"  compiling {name} → {out_path.name}\n")
        # No shell=True, array argv. `fj --asm -o OUT FILES…` is the CLI
        # surface the server-side compile route also uses.
        result = subprocess.run(
            [FJ_CMD, "--asm", "-o", str(out_path), *argv_files],
            cwd=tmpdir,
            timeout=TIMEOUT_S,
            capture_output=True,
            text=True,
            # errors='replace' so non-UTF-8 bytes from fj don't mask a real
            # compile failure as a UnicodeDecodeError in this script.
            errors="replace",
        )
        if result.returncode != 0:
            die(
                f"fj --asm failed for '{slug}':\n"
                f"  stdout: {result.stdout!r}\n"
                f"  stderr: {result.stderr!r}"
            )
        if not out_path.exists():
            die(f"fj --asm exited 0 but {out_path} was not created")


def main() -> None:
    check_fj()
    manifest = load_manifest()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    slugs = slugs_in_manifest(manifest)
    wipe_stale_fjms(slugs)
    for entry in manifest.values():
        build_one(entry)
    sys.stdout.write(f"built {len(manifest)} .fjm file(s) into {OUTPUT_DIR}\n")


if __name__ == "__main__":
    main()
