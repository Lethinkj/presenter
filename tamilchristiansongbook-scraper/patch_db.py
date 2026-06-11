"""
patch_db.py — Patch corrupted song titles in Supabase.

The original JSON seeded title_roman values that contain raw Tamil Unicode
characters (e.g. "iraajaா" instead of "iraajaa") due to a bug in the old
transliterator.  This script:

  1. Loads songbook/full_tamil_songbook.json
  2. Re-transliterates each title from title_tamil using the fixed transliterator
  3. Finds rows where old != new
  4. Issues PATCH requests to Supabase to fix those rows

Usage:
    # Preview only (no writes):
    python patch_db.py --dry-run

    # Apply all patches:
    python patch_db.py
"""

import json, os, sys, urllib.request, urllib.parse, argparse

# ---------------------------------------------------------------------------
# Load fixed transliterator from sibling scraper.py
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(__file__))
from scraper import transliterate

# ---------------------------------------------------------------------------
# Load Supabase credentials from backend/.env
# ---------------------------------------------------------------------------
_ENV_PATH = os.path.join(os.path.dirname(__file__), "../backend/.env")

def _load_env(path):
    env = {}
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return env

_env = _load_env(_ENV_PATH)
SUPABASE_URL = os.environ.get("SUPABASE_URL") or _env.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY") or _env.get("SUPABASE_ANON_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    sys.exit(
        "ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set "
        "in backend/.env or as environment variables."
    )

SONGS_ENDPOINT = f"{SUPABASE_URL.rstrip('/')}/rest/v1/songs"

# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def _headers(extra=None):
    h = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    if extra:
        h.update(extra)
    return h


def supabase_get(params: dict) -> list:
    """SELECT with query params (e.g. title=eq.xxx&select=id,title)."""
    qs = urllib.parse.urlencode(params)
    req = urllib.request.Request(
        f"{SONGS_ENDPOINT}?{qs}",
        headers=_headers({"Accept": "application/json"}),
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def supabase_patch(row_id: str, new_title: str) -> bool:
    """PATCH a single row by UUID."""
    qs = urllib.parse.urlencode({"id": f"eq.{row_id}"})
    body = json.dumps({"title": new_title}).encode()
    req = urllib.request.Request(
        f"{SONGS_ENDPOINT}?{qs}",
        data=body,
        headers=_headers(),
        method="PATCH",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status in (200, 204)
    except urllib.error.HTTPError as exc:
        print(f"    HTTP {exc.code}: {exc.read().decode()[:200]}")
        return False


# ---------------------------------------------------------------------------
# Build patch list
# ---------------------------------------------------------------------------

def build_patch_list(seeded_songs: list) -> list[tuple[str, str]]:
    """
    Return (old_title, new_title) pairs where the seeded title is corrupted.
    old_title = what is currently in the DB (from the seeded JSON).
    new_title = correct transliteration from title_tamil via the fixed function.
    """
    patches = []
    for s in seeded_songs:
        old = str(s.get("title_roman") or "").strip()
        tamil = str(s.get("title_tamil") or "").strip()
        if not old or not tamil:
            continue
        new = transliterate(tamil).strip()
        if old != new:
            patches.append((old, new))
    return patches


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Patch corrupted Supabase song titles.")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing.")
    parser.add_argument(
        "--source",
        default="../songbook/full_tamil_songbook_v1.json",
        help="Path to the JSON that was seeded into Supabase (default: v1 — the corrupted one).",
    )
    args = parser.parse_args()

    json_path = os.path.join(os.path.dirname(__file__), args.source)
    with open(json_path, encoding="utf-8") as f:
        songs = json.load(f)

    patches = build_patch_list(songs)
    print(f"Songs in JSON       : {len(songs)}")
    print(f"Titles to patch     : {len(patches)}")
    print(f"Mode                : {'DRY RUN (no writes)' if args.dry_run else 'LIVE (writing to Supabase)'}")
    print()

    if not patches:
        print("Nothing to do.")
        return

    updated = 0
    not_found = 0
    errors = 0

    for i, (old_title, new_title) in enumerate(patches, 1):
        print(f"[{i}/{len(patches)}] {old_title!r}")
        print(f"          → {new_title!r}")

        if args.dry_run:
            print("          (dry run — skipped)")
            continue

        # Find matching rows by exact title
        try:
            rows = supabase_get({"title": f"eq.{old_title}", "select": "id,title"})
        except Exception as exc:
            print(f"          ERROR fetching rows: {exc}")
            errors += 1
            continue

        if not rows:
            print("          NOT FOUND in DB — skipped")
            not_found += 1
            continue

        for row in rows:
            ok = supabase_patch(row["id"], new_title)
            if ok:
                print(f"          ✓ updated id={row['id']}")
                updated += 1
            else:
                print(f"          ✗ failed  id={row['id']}")
                errors += 1

    print()
    print("=== Done ===")
    if not args.dry_run:
        print(f"Updated   : {updated}")
        print(f"Not found : {not_found}")
        print(f"Errors    : {errors}")


if __name__ == "__main__":
    main()
