#!/usr/bin/env bash
# Build the kiosk slideshow URL with #cfg=<base64url JSON> from a private env file.
# Usage: ./tools/make-kiosk-url.sh [slideshow.env]
# Never prints album keys to the console beyond the URL itself — keep the env private.
set -euo pipefail

ENV_FILE="${1:-slideshow.env}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_URL="${SLIDESHOW_BASE_URL:-https://branovaclav.github.io/nixplay-kiosk-pages/photo-slideshow/}"

if [[ ! -f "$ENV_FILE" ]]; then
  # Also try next to this project
  if [[ -f "$ROOT/$ENV_FILE" ]]; then
    ENV_FILE="$ROOT/$ENV_FILE"
  else
    echo "missing env file: $ENV_FILE (see .env.example)" >&2
    exit 1
  fi
fi

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

if [[ -z "${SLIDESHOW_ALBUMS:-}" ]]; then
  echo "SLIDESHOW_ALBUMS is required" >&2
  exit 1
fi

python3 - "$BASE_URL" <<'PY'
import json, os, sys, base64, re

base = sys.argv[1]
raw_albums = [a.strip() for a in os.environ.get("SLIDESHOW_ALBUMS", "").split(",") if a.strip()]

def album_id(value):
    """Accept bare CloudKit share ids or full photos.icloud.com shared-album URLs."""
    v = value.strip()
    m = re.search(
        r"(?:photos\.icloud\.com/shared/album/|icloud\.com/sharedalbum/#)([A-Za-z0-9_-]+)",
        v,
    )
    if m:
        return m.group(1)
    if re.fullmatch(r"[A-Za-z0-9_-]{8,}", v):
        return v
    sys.exit("unrecognized album entry (want bare id or photos.icloud.com/shared/album/<id>): " + v[:48])

albums = [album_id(a) for a in raw_albums]
if not albums or len(albums) > 5:
    sys.exit("need 1–5 album keys in SLIDESHOW_ALBUMS")

cfg = {"albums": albums}
if os.environ.get("SLIDESHOW_INTERVAL"):
    cfg["interval"] = float(os.environ["SLIDESHOW_INTERVAL"])
if os.environ.get("SLIDESHOW_FADE"):
    cfg["fade"] = float(os.environ["SLIDESHOW_FADE"])
if os.environ.get("SLIDESHOW_SHARPEN"):
    cfg["sharpen"] = float(os.environ["SLIDESHOW_SHARPEN"])
_clock = (os.environ.get("SLIDESHOW_CLOCK_FONT") or "").strip().lower()
if _clock in ("system", "manrope", "inter", "outfit", "figtree"):
    cfg["clockFont"] = _clock
if os.environ.get("SLIDESHOW_NOMINATIM_URL"):
    cfg["nominatimUrl"] = os.environ["SLIDESHOW_NOMINATIM_URL"]
if os.environ.get("SLIDESHOW_PHOTON_URL"):
    cfg["photonUrl"] = os.environ["SLIDESHOW_PHOTON_URL"]

raw = json.dumps(cfg, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
b64 = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
print(base.rstrip("/") + "/#cfg=" + b64)
PY
