"""
scraper.py — Full Tamil Songbook Scraper (christiansongbook.org)

Fetches all Tamil songs + lyrics from the public CDN:
  https://samsolomonprabu.github.io/cdn/cs/v3/

Usage:
    python scraper.py

Output:
    ../songbook/full_tamil_songbook.json
"""

import urllib.request, base64, gzip, json, hashlib, math, time, unicodedata, re

_TAMIL_RE = re.compile(r"[஀-௿]")

# ---------------------------------------------------------------------------
# Transliteration tables
# ---------------------------------------------------------------------------

TAMIL_LETTERS = [
    "ஸ்ரீ", "ஜ", "ஷ", "ஸ", "ஹ", "க்ஷ",
    "அ", "ஆ", "இ", "ஈ", "உ", "ஊ", "எ", "ஏ", "ஐ", "ஒ", "ஓ", "ஔ", "அஃ",
    "க", "கா", "கி", "கீ", "கு", "கூ", "கெ", "கே", "கை", "கொ", "கோ", "கௌ", "க்",
    "ங", "ஙா", "ஙி", "ஙீ", "ஙு", "ஙூ", "ஙெ", "ஙே", "ஙை", "ஙொ", "ஙோ", "ஙௌ", "ங்",
    "ச", "சா", "சி", "சீ", "சு", "சூ", "செ", "சே", "சை", "சொ", "சோ", "சௌ", "ச்",
    "ஞ", "ஞா", "ஞி", "ஞீ", "ஞு", "ஞூ", "ஞெ", "ஞே", "ஞை", "ஞொ", "ஞோ", "ஞௌ", "ஞ்",
    "ட", "டா", "டி", "டீ", "டு", "டூ", "டெ", "டே", "டை", "டொ", "டோ", "டௌ", "ட்",
    "ண", "ணா", "ணி", "ணீ", "ணு", "ணூ", "ணெ", "ணே", "ணை", "ணொ", "ணோ", "ணௌ", "ண்",
    "த", "தா", "தி", "தீ", "து", "தூ", "தெ", "தே", "தை", "தொ", "தோ", "தௌ", "த்",
    "ந", "நா", "நி", "நீ", "நு", "நூ", "நெ", "நே", "நை", "நொ", "நோ", "நௌ", "ந்",
    "ப", "பா", "பி", "பீ", "பு", "பூ", "பெ", "பே", "பை", "பொ", "போ", "பௌ", "ப்",
    "ம", "மா", "மி", "மீ", "மு", "மூ", "மெ", "மே", "மை", "மொ", "மோ", "மௌ", "ம்",
    "ய", "யா", "யி", "யீ", "யு", "யூ", "யெ", "யே", "யை", "யொ", "யோ", "யௌ", "ய்",
    "ர", "ரா", "ரி", "ரீ", "ரு", "ரூ", "ரெ", "ரே", "ரை", "ரொ", "ரோ", "ரௌ", "ர்",
    "ல", "லா", "லி", "லீ", "லு", "லூ", "லெ", "லே", "லை", "லொ", "லோ", "லௌ", "ல்",
    "வ", "வா", "வி", "வீ", "வு", "வூ", "வெ", "வே", "வை", "வொ", "வோ", "வௌ", "வ்",
    "ழ", "ழா", "ழி", "ழீ", "ழு", "ழூ", "ழெ", "ழே", "ழை", "ழொ", "ழோ", "ழௌ", "ழ்",
    "ள", "ளா", "ளி", "ளீ", "ளு", "ளூ", "ளெ", "ளே", "ளை", "ளொ", "ளோ", "ளௌ", "ள்",
    "ற", "றா", "றி", "றீ", "று", "றூ", "றெ", "றே", "றை", "றொ", "றோ", "றௌ", "ற்",
    "ன", "னா", "னி", "னீ", "னு", "னூ", "னெ", "னே", "னை", "னொ", "னோ", "னௌ", "ன்",
]

TAMIL_ROMAN = [
    "Sri", "ja", "sha", "sa", "ha", "ksha",
    "a", "aa", "i", "ee", "u", "oo", "e", "ae", "ai", "o", "oe", "au", "ak",
    "ka", "kaa", "ki", "kee", "ku", "koo", "ke", "kae", "kai", "ko", "koe", "kau", "k",
    "nga", "ngaa", "ngi", "ngee", "ngu", "nguu", "nge", "ngae", "ngai", "ngo", "ngoe", "ngau", "ng",
    "sa", "saa", "si", "see", "su", "soo", "se", "sae", "sai", "so", "soe", "sau", "s",
    "nja", "njaa", "nji", "njee", "nju", "njuu", "nge", "njae", "njai", "njo", "njoe", "njau", "nj",
    "ta", "taa", "ti", "tee", "tu", "too", "te", "tae", "tai", "to", "toe", "tau", "t",
    "na", "naa", "ni", "nee", "nu", "noo", "ne", "nae", "nai", "no", "noe", "nau", "n",
    "tha", "thaa", "thi", "thee", "thu", "thoo", "the", "thae", "thai", "tho", "thoe", "thau", "th",
    "na", "naa", "ni", "nee", "nu", "noo", "ne", "nae", "nai", "no", "noe", "nau", "n",
    "pa", "paa", "pi", "pee", "pu", "poo", "pe", "pae", "pai", "po", "poe", "pau", "p",
    "ma", "maa", "mi", "mee", "mu", "moo", "me", "mae", "mai", "mo", "moe", "mau", "m",
    "ya", "yaa", "yi", "yee", "yu", "yuu", "ye", "yae", "yai", "yo", "yoe", "yau", "y",
    "ra", "raa", "ri", "ree", "ru", "roo", "re", "rae", "r", "ro", "roe", "rau", "r",
    "la", "laa", "li", "lee", "lu", "loo", "le", "lae", "lai", "lo", "loe", "lau", "l",
    "va", "vaa", "vi", "vee", "vu", "vuu", "ve", "vae", "vai", "vo", "voe", "vau", "v",
    "zha", "zhaa", "zhi", "zhee", "zhu", "zhuu", "zhe", "zhae", "zhai", "zho", "zhoe", "zhau", "zh",
    "la", "laa", "li", "lee", "lu", "loo", "le", "lae", "lai", "lo", "loe", "lau", "l",
    "ra", "raa", "ri", "ree", "ru", "roo", "re", "rae", "rai", "ro", "roe", "rau", "r",
    "na", "naa", "ni", "nee", "nu", "noo", "ne", "nae", "nai", "no", "noe", "nau", "n",
]

# ---------------------------------------------------------------------------
# Fix: grantha letters (ஜ ஷ ஸ ஹ க்ஷ) were missing all vowel-mark combinations.
# The base forms above transliterate the bare consonant (e.g. ஜ→"ja") but leave
# the following matra (e.g. ா ி ே ் …) untouched, producing garbage like "iraajaா".
# Generate the full set here so longer matches win in the sorted MAPPING.
# ---------------------------------------------------------------------------

_GRANTHA_BASES = [
    ("ஜ",   "j"),
    ("ஷ",   "sh"),
    ("ஸ",   "s"),
    ("ஹ",   "h"),
    ("க்ஷ", "ksh"),
]

# (Tamil vowel mark, Roman suffix that replaces the inherent-a)
_VOWEL_MARKS = [
    ("ா", "aa"),  # ா  long-aa
    ("ி", "i"),   # ி  short-i
    ("ீ", "ee"),  # ீ  long-ii
    ("ு", "u"),   # ு  short-u
    ("ூ", "oo"),  # ூ  long-uu
    ("ெ", "e"),   # ெ  short-e
    ("ே", "ae"),  # ே  long-ae
    ("ை", "ai"),  # ை  ai
    ("ொ", "o"),   # ொ  short-o
    ("ோ", "oe"),  # ோ  long-oe
    ("ௌ", "au"),  # ௌ  au
    ("்", ""),    # ்  virama — consonant only, no vowel
]

for _base_t, _base_r in _GRANTHA_BASES:
    for _mark_t, _mark_r in _VOWEL_MARKS:
        TAMIL_LETTERS.append(_base_t + _mark_t)
        TAMIL_ROMAN.append(_base_r + _mark_r)

# ஃ (visarga) is used to mark foreign consonants (e.g. ஃப → f).
# Map the common combination first, then drop bare ஃ.
TAMIL_LETTERS += ["ஃப", "ஃ"]  # ஃப, ஃ
TAMIL_ROMAN  += ["f",             ""]

# Longest entries must match first so "ஜா" beats "ஜ".
MAPPING = sorted(zip(TAMIL_LETTERS, TAMIL_ROMAN), key=lambda x: len(x[0]), reverse=True)


def transliterate(text: str) -> str:
    if not text:
        return ""
    # NFC normalization composes decomposed Tamil vowels (e.g. ே+ா → ோ)
    # so they match the precomposed forms in MAPPING.
    result = unicodedata.normalize("NFC", text)
    for tamil_str, roman_str in MAPPING:
        result = result.replace(tamil_str, roman_str)
    # Strip any leftover Tamil chars — only possible with malformed source data.
    return _TAMIL_RE.sub("", result).strip()


# ---------------------------------------------------------------------------
# CDN helpers
# ---------------------------------------------------------------------------

CDN_BASE = "https://samsolomonprabu.github.io/cdn/cs/v3"
OUTPUT_FILE = "../songbook/full_tamil_songbook.json"


def _fetch_compressed(url: str):
    with urllib.request.urlopen(url) as resp:
        raw = resp.read().decode("utf-8").replace("\n", "").replace("\r", "").replace(" ", "")
    return json.loads(gzip.decompress(base64.b64decode(raw)))


def _chunk_url(chunk_index: int) -> str:
    hash_val = hashlib.sha256(str(chunk_index).encode()).hexdigest()
    return f"{CDN_BASE}/caches/{hash_val}.cs.song"


# ---------------------------------------------------------------------------
# Full scrape
# ---------------------------------------------------------------------------

def scrape_full_songbook():
    print("Fetching Tamil metadata…")
    data = _fetch_compressed(f"{CDN_BASE}/data/tamil.compressed")

    songs = data["songs"]
    ids = [int(s["a"]) for s in songs]
    max_id = max(ids)
    target_ids = {str(i) for i in ids}
    total_chunks = math.ceil((max_id + 1) / 50)

    print(f"Found {len(songs)} songs (max id {max_id}). Transliterating titles…")

    full_database = []
    for s in songs:
        full_database.append({
            "id": s["a"],
            "title_tamil": s["b"],
            "title_roman": transliterate(s["b"]),
            "youtube_id": s.get("d", ""),
        })

    print(f"Starting lyrics scrape ({total_chunks} chunks)…")
    all_lyrics = {}

    for i in range(total_chunks):
        chunk_range = range(i * 50, (i + 1) * 50)
        if not any(str(rid) in target_ids for rid in chunk_range):
            continue
        try:
            chunk_data = _fetch_compressed(_chunk_url(i))
            for local_id, content in chunk_data.items():
                global_id = str(i * 50 + int(local_id))
                if global_id in target_ids:
                    all_lyrics[global_id] = {
                        "lyrics_tamil": content["c"],
                        "lyrics_roman": transliterate(content["c"]),
                    }
            if i % 100 == 0:
                print(f"  chunk {i}/{total_chunks}…")
            time.sleep(0.005)
        except Exception:
            pass

    print("Merging lyrics…")
    for entry in full_database:
        entry.update(all_lyrics.get(entry["id"], {}))

    import os
    out_path = os.path.join(os.path.dirname(__file__), OUTPUT_FILE)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(full_database, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(full_database)} songs → {out_path}")


if __name__ == "__main__":
    scrape_full_songbook()
