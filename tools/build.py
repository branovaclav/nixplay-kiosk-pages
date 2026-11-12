#!/usr/bin/env python3
"""Build every project under projects/ into site/ for GitHub Pages.

Each project is published at /<project-id>/. The daily-summary page is ALSO
copied to the site root as a convenience mirror (identical bytes, no redirect).
The frame opens project URLs directly, not the site root.

  python3 tools/validate.py && python3 tools/build.py
"""
from __future__ import annotations

import importlib.util
import os
import shutil

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(REPO, "site")
PROJECTS = os.path.join(REPO, "projects")


def load_module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise SystemExit(f"cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def ensure_nojekyll(site_dir):
    src = os.path.join(REPO, ".nojekyll")
    dst = os.path.join(site_dir, ".nojekyll")
    if os.path.isfile(src):
        shutil.copy2(src, dst)
    else:
        with open(dst, "w", encoding="utf-8") as f:
            f.write("")


def mirror_dir_contents(src_dir, dst_dir):
    """Copy files/dirs from src into dst (overwrite), leaving other dst entries."""
    os.makedirs(dst_dir, exist_ok=True)
    for name in os.listdir(src_dir):
        s = os.path.join(src_dir, name)
        d = os.path.join(dst_dir, name)
        if os.path.isdir(s):
            if os.path.isdir(d):
                shutil.rmtree(d)
            elif os.path.exists(d):
                os.remove(d)
            shutil.copytree(s, d)
        else:
            if os.path.isdir(d):
                shutil.rmtree(d)
            shutil.copy2(s, d)


def build_daily_summary():
    path = os.path.join(PROJECTS, "daily-summary", "tools", "build.py")
    mod = load_module(path, "daily_summary_build")
    out = os.path.join(SITE, "daily-summary")
    primary = mod.build(out_dir=out, write_designs=True)
    # Back-compat: identical page + assets at site root (no redirect).
    mirror_dir_contents(out, SITE)
    print(f"mirrored daily-summary → site/ (root BC, primary={primary.get('date')})")
    return primary


def _copy_static_project(project_id, skip_names=None):
    """Copy a static project folder into site/<id>/ (skips docs/tests/tools/env)."""
    skip = set(skip_names or [])
    skip.update(
        {
            "README.md",
            "FRAME-DEPLOY.md",
            ".env.example",
            "slideshow.env",
            "tests",
            "tools",
            "notes",
        }
    )
    src = os.path.join(PROJECTS, project_id)
    out = os.path.join(SITE, project_id)
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out, exist_ok=True)
    for name in os.listdir(src):
        if name.startswith(".") or name in skip:
            continue
        s = os.path.join(src, name)
        d = os.path.join(out, name)
        if os.path.isdir(s):
            shutil.copytree(s, d)
        elif name.endswith((".html", ".css", ".js", ".svg", ".png", ".woff2", ".txt")):
            shutil.copy2(s, d)
    index_src = os.path.join(src, "index.html")
    if not os.path.isfile(index_src):
        raise SystemExit(f"projects/{project_id}/index.html missing")
    shutil.copy2(index_src, os.path.join(out, "index.html"))
    print(f"built site/{project_id}/index.html")


def build_photo_slideshow():
    _copy_static_project("photo-slideshow")


def build():
    if os.path.isdir(SITE):
        shutil.rmtree(SITE)
    os.makedirs(SITE, exist_ok=True)

    build_daily_summary()
    build_photo_slideshow()
    ensure_nojekyll(SITE)
    print(f"site ready → {SITE}")


if __name__ == "__main__":
    # Allow `python3 tools/build.py` from any cwd
    os.chdir(REPO)
    build()
