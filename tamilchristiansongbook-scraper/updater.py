"""
updater.py — Incremental update for the Tamil songbook JSON.

Compares the local full_tamil_songbook.json against the live CDN metadata and
fetches only the chunks that contain new or changed songs.

Usage:
    python updater.py

Output:
    ../songbook/full_tamil_songbook.json  (updated in-place)
"""

import urllib.request, base64, gzip, json, hashlib, time, os

from scraper import transliterate, CDN_BASE, _fetch_compressed, _chunk_url

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "../songbook/full_tamil_songbook.json")


def incremental_update():
    # 1. Load local database
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            db = json.load(f)
        print(f"Loaded {len(db)} local songs.")
    else:
        db = []
        print("No local file found — will fetch everything.")

    local_map = {s["id"]: s for s in db}

    # 2. Fetch live metadata
    print("Checking live metadata…")
    live_data = _fetch_compressed(f"{CDN_BASE}/data/tamil.compressed")
    live_songs = live_data["songs"]

    # 3. Detect new or changed songs (title or youtube_id changed)
    needs_update = []
    for ls in live_songs:
        sid = ls["a"]
        if (
            sid not in local_map
            or local_map[sid].get("title_tamil") != ls["b"]
            or local_map[sid].get("youtube_id") != ls.get("d", "")
        ):
            needs_update.append(ls)

    if not needs_update:
        print("Everything is up to date!")
        return

    print(f"Found {len(needs_update)} new/changed songs.")

    # 4. Fetch only the required chunks
    chunks_to_fetch = sorted({int(s["a"]) // 50 for s in needs_update})
    print(f"Fetching {len(chunks_to_fetch)} chunk(s)…")

    new_lyrics = {}
    target_ids = {s["a"] for s in needs_update}

    for i in chunks_to_fetch:
        try:
            chunk_data = _fetch_compressed(_chunk_url(i))
            for local_id, content in chunk_data.items():
                gid = str(i * 50 + int(local_id))
                if gid in target_ids:
                    new_lyrics[gid] = {
                        "lyrics_tamil": content["c"],
                        "lyrics_roman": transliterate(content["c"]),
                    }
            print(f"  chunk {i} done.")
            time.sleep(0.01)
        except Exception as exc:
            print(f"  chunk {i} failed: {exc}")

    # 5. Merge updates into local map
    for ns in needs_update:
        sid = ns["a"]
        song_obj = {
            "id": sid,
            "title_tamil": ns["b"],
            "title_roman": transliterate(ns["b"]),
            "youtube_id": ns.get("d", ""),
        }
        if sid in new_lyrics:
            song_obj.update(new_lyrics[sid])
        elif sid in local_map:
            # Keep existing lyrics if not re-fetched (title-only change)
            for key in ("lyrics_tamil", "lyrics_roman"):
                if key in local_map[sid]:
                    song_obj[key] = local_map[sid][key]
        local_map[sid] = song_obj

    # 6. Save
    final_db = sorted(local_map.values(), key=lambda x: int(x["id"]))
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(final_db, f, ensure_ascii=False, indent=2)
    print(f"Done. Total songs: {len(final_db)}")


if __name__ == "__main__":
    incremental_update()
