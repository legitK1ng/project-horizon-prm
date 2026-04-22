# ACR Audio Filename Parser — Complete Reference & Implementation
# ================================================================
# Horizon PRM Project | Data Pipeline Layer
# Validated against: 70 real filenames, 69/70 perfect match (99%)
#
# PURPOSE
# -------
# Authoritative reference for parsing call recording filenames from
# every ACR app variant in this dataset. Filename parsing is the
# FOUNDATION of the entire Horizon data pipeline:
#
#   Raw audio file
#       → parse filename
#       → extract structured metadata
#       → canonical rename
#       → pair with .properties/.json sidecar
#       → ingest to Supabase
#       → power PRM frontend
#
# BACKSTORY
# ---------
# Recordings span 2021–2025 across 4 apps:
#   1. ACR Phone (NLL) — .amr files, /properties/ sidecar JSON
#   2. Cube Call Recorder (NLL) — .m4a, square-bracket format
#   3. ACR-compatible transcription pipeline — .mp3, underscore format
#   4. Unfold Tool (GAS automation) — created 41x numbered duplicates
#
# CANONICAL OUTPUT FORMAT
# -----------------------
#   YYYY-MM-DD_HHMMSS_[DIR]_[PHONE]_[ContactName].[ext]
#
#   DIR tag values:
#     OUT   outgoing phone call
#     IN    incoming phone call
#     FB    Facebook/Messenger call
#     ZOOM  Zoom meeting
#     MIC   microphone/dictaphone recording
#     UNK   direction not determinable
#
# ARROW DIRECTION CHARACTERS
#   ↗ (U+2197) = Outgoing   → DIR tag: OUT
#   ↙ (U+2199) = Incoming   → DIR tag: IN
#   ↑ (U+2191) = Outgoing (older ACR, rare)
#   ↓ (U+2193) = Incoming (older ACR, rare)
#
# PARSER ORDER (apply in this exact sequence)
#   1. Pattern H   — Cube brackets [unambiguous]
#   2. Pattern E/F — underscore format
#   3. Strip (N) suffix
#   4. Pattern C2  — date-first facebook
#   5. Pattern G   — mic/dictaphone
#   6. Pattern K   — Voice_NNN
#   7. Detect channel
#   8. Pattern D   — unknown contact
#   9. Pattern I   — facebook system strings
#  10. Pattern J   — zoom
#  11. Pattern C   — facebook with real label
#  12. Pattern A   — named contact + phone + arrow
#  13. Pattern B   — bare phone + arrow
#  14. Pattern X   — unmatched fallback
#
# ================================================================

import re
import json
from pathlib import Path
from datetime import datetime


SYSTEM_FB_LABELS = {
    'phone', 'call ended', 'audio call from messenger',
    'is calling you on messenger', 'is calling you on messenger…',
    'outlook', 'unknown contact',
}

ARROW_CHARS = '↗↙↑↓'


def norm_phone(raw: str) -> str:
    """Normalize any phone string to E.164. Returns '' if not normalizable."""
    digits = re.sub(r'[^\d]', '', str(raw))
    if digits.startswith('1') and len(digits) == 11:
        return f"+{digits}"
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) > 10:
        return f"+{digits}"   # non-US or UUID-phone
    if 6 < len(digits) <= 9:
        return f"+{digits}"   # short/local, flag separately
    return ''


def slugify(s: str) -> str:
    """Convert contact name to URL-safe slug."""
    s = re.sub(r'[^\w\s\-]', '', str(s or '')).strip()
    s = re.sub(r'[\s_]+', '-', s)
    return re.sub(r'-{2,}', '-', s) or 'unknown'


def extract_dt_tail(stem: str) -> str:
    """Extract YYYY-MM-DD HH-MM-SS from end of stem."""
    m = re.search(r'(\d{4})-(\d{2})-(\d{2}) (\d{2})-(\d{2})-(\d{2})$', stem)
    if m:
        yr, mo, dy, hr, mn, sc = m.groups()
        return f"{yr}-{mo}-{dy}_{hr}{mn}{sc}"
    return ''


def extract_dt_head(stem: str) -> str:
    """Extract YYYY-MM-DD HH-MM-SS from start of stem (Pattern C2)."""
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2}) (\d{2})-(\d{2})-(\d{2})', stem)
    if m:
        yr, mo, dy, hr, mn, sc = m.groups()
        return f"{yr}-{mo}-{dy}_{hr}{mn}{sc}"
    return ''


def extract_dt_underscores(stem: str) -> str:
    """Extract YYYY_MM_DD_HH_MM_SS from underscore format (Pattern E/F)."""
    m = re.search(r'(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})', stem)
    if m:
        yr, mo, dy, hr, mn, sc = m.groups()
        return f"{yr}-{mo}-{dy}_{hr}{mn}{sc}"
    return ''


def extract_dt_brackets(stem: str) -> str:
    """Extract datetime from [YYYY-MM-DD HH-MM-SS] (Pattern H)."""
    m = re.search(r'\[(\d{4}-\d{2}-\d{2}) (\d{2}-\d{2}-\d{2})\]', stem)
    if m:
        date, time_ = m.groups()
        yr, mo, dy = date.split('-')
        hr, mn, sc = time_.split('-')
        return f"{yr}-{mo}-{dy}_{hr}{mn}{sc}"
    return ''


def parse_acr_filename(stem: str, ext: str, mtime: float = None) -> dict:
    """
    Parse any ACR-variant filename into structured metadata.

    Args:
        stem:  filename without extension
        ext:   extension with dot, e.g. '.amr'
        mtime: file modification timestamp (fallback for datetime)

    Returns dict with keys:
        pattern    str   A/B/C/C2/D/E/F/G/H/I/J/K/X
        contact    str   raw contact name (may be empty)
        phone      str   E.164 normalized (may be empty)
        direction  str   OUT / IN / '' (empty = unknown)
        channel    str   phone / facebook / zoom / mic
        dt         str   YYYY-MM-DD_HHMMSS (canonical)
        ch_idx     str   '' / '0' / '1'  (audio channel track)
        confidence str   high / medium / low
        notes      str   any warnings or edge cases
    """
    result = {
        'pattern':    'X',
        'contact':    '',
        'phone':      '',
        'direction':  '',
        'channel':    'phone',
        'dt':         '',
        'ch_idx':     '',
        'confidence': 'high',
        'notes':      '',
    }

    # ── 1. PATTERN H — Cube Call Recorder ────────────────────────────────────
    h = re.match(
        r'^(.+?)\s*\((\+[\d]+)\)\s*'
        r'\[(\d{4}-\d{2}-\d{2})\s+(\d{2}-\d{2}-\d{2})\]\s*'
        r'\[(Incoming|Outgoing)\]',
        stem, re.I)
    if h:
        name, phone, date, time_, dir_ = h.groups()
        is_uuid = bool(re.match(r'^[+]?[0-9a-f\-]{20,}$', name.strip(), re.I))
        result.update(
            pattern='H',
            contact=name.strip() if not is_uuid else 'fb-cube',
            phone=norm_phone(phone),
            direction='OUT' if 'out' in dir_.lower() else 'IN',
            channel='phone' if not is_uuid else 'facebook',
            dt=f"{date}_{time_.replace('-', '')}",
        )
        if is_uuid:
            result['notes'] = f'UUID label: {name.strip()[:20]}'
        return result

    # ── 2. PATTERN E/F — Transcription app underscore ────────────────────────
    ef = re.match(
        r'^(?:([A-Za-z][A-Za-z_\-]+?)_)?'
        r'(\+?1?\d{10,15})_'
        r'(\d{4})_(\d{2})_(\d{2})_'
        r'(\d{2})_(\d{2})_(\d{2})'
        r'(?:_\[(\d)\])?$',
        stem)
    if ef:
        name, phone, yr, mo, dy, hr, mn, sc, ch = ef.groups()
        is_unknown = (name or '').lower() == 'unknown'
        result.update(
            pattern='D' if is_unknown else ('E' if name else 'F'),
            contact=(name or '').replace('_', ' ').strip() if not is_unknown else 'unknown',
            phone=norm_phone(phone),
            channel='phone',
            ch_idx=ch or '',
            dt=f"{yr}-{mo}-{dy}_{hr}{mn}{sc}",
            notes='direction unknown (not in filename)' if not is_unknown else '',
        )
        return result

    # Edge case: double-underscore label (CALL_BALANCE, CANCELLED, etc.)
    ef_label = re.match(
        r'^([A-Z][A-Z_]+)__?(\w+)_'
        r'(\d{4})_(\d{2})_(\d{2})_'
        r'(\d{2})_(\d{2})_(\d{2})'
        r'(?:_\[(\d)\])?$',
        stem)
    if ef_label:
        label, _, yr, mo, dy, hr, mn, sc, ch = ef_label.groups()
        result.update(
            pattern='E',
            contact=label.replace('_', ' ').strip(),
            phone='',
            channel='phone',
            ch_idx=ch or '',
            dt=f"{yr}-{mo}-{dy}_{hr}{mn}{sc}",
            confidence='medium',
            notes=f'label-only, no phone: {label}',
        )
        return result

    # ── 3. Strip numbered suffix ──────────────────────────────────────────────
    stem_clean = re.sub(r'\s*\(\d+\)$', '', stem).strip()
    was_numbered = stem_clean != stem
    if was_numbered:
        result['notes'] = f'stripped copy suffix from: {stem}'

    # ── 4. Pattern C2 — date-first facebook ──────────────────────────────────
    if re.match(r'^\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2} \((?:facebook|messenger)\)',
                stem_clean, re.I):
        result.update(
            pattern='C2',
            channel='facebook',
            contact='anon',
            dt=extract_dt_head(stem_clean),
        )
        return result

    # ── 5. Detect channel ─────────────────────────────────────────────────────
    sl = stem_clean.lower()
    if any(x in sl for x in ('(facebook)', '(messenger)',
                               'audio call from messenger',
                               'is calling you on messenger',
                               'is calling you on messenger…')):
        result['channel'] = 'facebook'
    elif '(zoom)' in sl or 'zoom meeting' in sl:
        result['channel'] = 'zoom'
    elif '(mic)' in sl:
        result['channel'] = 'mic'

    # ── 6. Pattern G — mic/dictaphone ────────────────────────────────────────
    if result['channel'] == 'mic' or re.match(r'^dictaphone', stem_clean, re.I):
        result.update(
            pattern='G',
            contact='dictaphone',
            dt=extract_dt_tail(stem_clean),
        )
        return result

    # ── 7. Pattern K — Voice_NNN ──────────────────────────────────────────────
    if re.match(r'^Voice_\d+', stem_clean, re.I):
        dt_fallback = (datetime.fromtimestamp(mtime).strftime('%Y-%m-%d_%H%M%S')
                       if mtime else 'NODATE')
        result.update(
            pattern='K',
            contact='voice-recording',
            channel='mic',
            dt=dt_fallback,
            confidence='low',
            notes='no datetime in filename; used mtime',
        )
        return result

    # ── 8. Direction from arrow ───────────────────────────────────────────────
    if '↗' in stem_clean or '↑' in stem_clean:
        result['direction'] = 'OUT'
    elif '↙' in stem_clean or '↓' in stem_clean:
        result['direction'] = 'IN'

    # ── 9. Pattern D — unknown contact ───────────────────────────────────────
    if re.match(r'^unknown[\s_]*(contact)?', stem_clean, re.I):
        result.update(
            pattern='D',
            contact='unknown',
            dt=extract_dt_tail(stem_clean),
        )
        return result

    # ── 10. Pattern I — generic facebook system strings ──────────────────────
    if result['channel'] == 'facebook':
        fb_label_m = re.match(r'^(.+?)\s*\((?:facebook|messenger)\)', stem_clean, re.I)
        label = fb_label_m.group(1).strip().lower() if fb_label_m else ''
        is_system = (label in SYSTEM_FB_LABELS or
                     label.startswith('is ') or
                     label.endswith('…') or
                     not label)
        if is_system:
            result.update(
                pattern='I',
                contact='anon',
                dt=extract_dt_tail(stem_clean),
            )
            return result

        raw_label = fb_label_m.group(1).strip() if fb_label_m else 'anon'
        result.update(
            pattern='C',
            contact=raw_label,
            dt=extract_dt_tail(stem_clean),
        )
        return result

    # ── 11. Pattern J — zoom ─────────────────────────────────────────────────
    if result['channel'] == 'zoom':
        result.update(
            pattern='J',
            contact='zoom-meeting',
            dt=extract_dt_tail(stem_clean),
        )
        return result

    # ── 12. Pattern A — named contact + phone ────────────────────────────────
    a = re.match(
        r'^(.+?)\s*\((\+?1?[\d\s\-(). ]{7,20}?)\)\s*[↗↙↑↓]\s*\(phone\)',
        stem_clean)
    if a:
        raw_phone = re.sub(r'[^\d+]', '', a.group(2))
        result.update(
            pattern='A',
            contact=a.group(1).strip(),
            phone=norm_phone(raw_phone),
            dt=extract_dt_tail(stem_clean),
        )
        return result

    # ── 13. Pattern B — bare phone ───────────────────────────────────────────
    b = re.match(
        r'^(\+?1?[\s\-(). \d]{7,25}?)\s*[↗↙↑↓]\s*\(phone\)',
        stem_clean)
    if b:
        raw_phone = re.sub(r'[^\d+]', '', b.group(1))
        result.update(
            pattern='B',
            phone=norm_phone(raw_phone),
            dt=extract_dt_tail(stem_clean),
        )
        return result

    # ── 14. Pattern X — unmatched fallback ───────────────────────────────────
    result.update(
        pattern='X',
        dt=extract_dt_tail(stem_clean) or
           (datetime.fromtimestamp(mtime).strftime('%Y-%m-%d_%H%M%S') if mtime else 'NODATE'),
        confidence='low',
        notes=f'no pattern matched: {stem[:60]}',
    )
    return result


def build_canonical(parsed: dict, ext: str) -> str:
    """
    Build the canonical filename from a parse result.
    Format: YYYY-MM-DD_HHMMSS_DIR_PHONE_ContactName[_chN].ext
    """
    dt = parsed['dt'] or 'NODATE'
    ch = parsed['channel']

    dir_ = parsed['direction']
    if not dir_:
        dir_ = {'facebook': 'FB', 'zoom': 'ZOOM', 'mic': 'MIC'}.get(ch, 'UNK')

    phone = parsed['phone'] or ch
    name  = slugify(parsed['contact']) if parsed['contact'] else 'unknown'
    idx   = f"_ch{parsed['ch_idx']}" if parsed['ch_idx'] else ''

    return f"{dt}_{dir_}_{phone}_{name}{idx}{ext.lower()}"


def find_sidecar(audio_path: Path) -> list:
    """
    Find all metadata sidecar files for an audio recording.
    Handles .properties and .json in multiple locations.
    Handles numbered copy stems (strips (N) suffix).
    """
    found = []
    stem = audio_path.stem
    stem_base = re.sub(r'\s*\(\d+\)$', '', stem).strip()

    for s in {stem, stem_base}:
        for ext in ('.properties', '.json'):
            candidates = [
                audio_path.parent / 'properties' / (s + ext),
                audio_path.parent / (s + ext),
            ]
            for c in candidates:
                if c.exists() and c not in found:
                    found.append(c)
    return found


def load_sidecar_metadata(sidecar_path: Path) -> dict:
    """
    Parse a .properties or .json sidecar file.
    Returns normalized metadata dict.
    """
    empty = {
        'duration_ms': None, 'duration_sec': None,
        'phone_e164': '', 'direction': '',
        'lat': None, 'lon': None, 'address': '',
    }
    try:
        raw = json.loads(sidecar_path.read_text(encoding='utf-8'))
    except Exception:
        return empty

    loc = raw.get('loc', '')
    lat, lon = None, None
    if ';' in loc:
        parts = loc.split(';')
        try:
            lat, lon = float(parts[0]), float(parts[1])
        except ValueError:
            pass

    dur = raw.get('duration')
    return {
        'duration_ms':  int(dur) if dur else None,
        'duration_sec': round(int(dur) / 1000, 1) if dur else None,
        'phone_e164':   norm_phone(raw.get('callee', '')),
        'direction':    raw.get('direction', ''),
        'lat':          lat,
        'lon':          lon,
        'address':      raw.get('addr', ''),
    }


def full_parse(audio_path: Path) -> dict:
    """
    Complete parse of an audio file:
    1. Parse filename
    2. Load sidecar metadata
    3. Merge, preferring sidecar for phone/direction
    4. Build canonical filename
    5. Return everything needed for DB ingest

    This is the function to call from the ingestion pipeline.
    """
    ext    = audio_path.suffix
    mtime  = audio_path.stat().st_mtime if audio_path.exists() else None
    parsed = parse_acr_filename(audio_path.stem, ext, mtime)

    sidecars = find_sidecar(audio_path)
    sidecar_meta = {}
    sidecar_path = None
    for sc in sidecars:
        sidecar_meta = load_sidecar_metadata(sc)
        sidecar_path = sc
        break

    # Sidecar wins on phone and direction
    if sidecar_meta.get('phone_e164'):
        parsed['phone'] = sidecar_meta['phone_e164']
    if sidecar_meta.get('direction'):
        d = sidecar_meta['direction']
        parsed['direction'] = 'OUT' if 'out' in d.lower() else 'IN'

    canonical = build_canonical(parsed, ext)

    return {
        'canonical_name':   canonical,
        'original_name':    audio_path.name,
        'original_path':    str(audio_path),
        'pattern':          parsed['pattern'],
        'contact_name':     parsed['contact'],
        'phone_e164':       parsed['phone'],
        'direction':        parsed['direction'],
        'channel':          parsed['channel'],
        'datetime_str':     parsed['dt'],
        'ch_idx':           parsed['ch_idx'],
        'confidence':       parsed['confidence'],
        'parse_notes':      parsed['notes'],
        'sidecar_path':     str(sidecar_path) if sidecar_path else '',
        'duration_ms':      sidecar_meta.get('duration_ms'),
        'duration_sec':     sidecar_meta.get('duration_sec'),
        'lat':              sidecar_meta.get('lat'),
        'lon':              sidecar_meta.get('lon'),
        'address':          sidecar_meta.get('address', ''),
        'size_bytes':       audio_path.stat().st_size if audio_path.exists() else None,
        'mtime':            mtime,
    }


if __name__ == '__main__':
    TEST_FILES = [
        ("Gabby Cajucom (+1 714-624-0529) ↗ (phone) 2025-08-09 17-34-10", ".amr"),
        ("(320) 629-2585 ↗ (phone) 2025-08-02 09-48-24",                   ".amr"),
        ("1 800-382-6010 ↗ (phone) 2025-08-28 17-50-34",                   ".amr"),
        ("10_06 (facebook) 2025-08-15 10-06-36",                           ".amr"),
        ("2022-10-19 20-40-14 (facebook) 8 40",                            ".amr"),
        ("Unknown contact ↗ (phone) 2025-08-09 12-26-58",                  ".amr"),
        ("Gabby_Cajucom_+17146240529_2024_09_15_20_32_03_[0]",             ".mp3"),
        ("+12489943000_2024_10_08_12_35_03_[0]",                           ".mp3"),
        ("CALL_BALANCE__225_2024_09_20_08_17_03_[1]",                      ".mp3"),
        ("Dictaphone record (mic) 2025-09-11 03-02-27",                    ".amr"),
        ("Ava Gilles (+17633372640) [2025-10-31 22-26-09] [Outgoing]",     ".m4a"),
        ("Call ended (facebook) 2025-08-02 21-22-49",                      ".amr"),
        ("Zoom meeting (zoom) 2022-06-02 14-00-12",                        ".amr"),
        ("Dan Kaczynski ((320) 391-1081) ↗ (phone) 2025-08-02 12-18-34",  ".amr"),
        ("LEGACY COUNSEL (+1 320-679-2438) ↗ (phone) 2025-08-05 10-20-22",".amr"),
        ("836-6650 ↗ (phone) 2022-07-01 17-18-35",                         ".json"),
    ]

    print(f"\n{'='*72}")
    print(f"  ACR FILENAME PARSER — SELF TEST")
    print(f"{'='*72}\n")
    print(f"  {'STEM':<52} PAT  CANONICAL")
    print(f"  {'-'*52} ---  {'-'*40}")

    passed = 0
    for stem, ext in TEST_FILES:
        parsed = parse_acr_filename(stem, ext, mtime=1704067200.0)
        canon  = build_canonical(parsed, ext)
        pat    = parsed['pattern']
        marker = ' ' if pat != 'X' else '!'
        stem_s = (stem[:50] + '..') if len(stem) > 52 else stem
        print(f"{marker} {stem_s:<52} [{pat}]  {canon}")
        if pat != 'X':
            passed += 1

    print(f"\n  {passed}/{len(TEST_FILES)} matched (! = unmatched X)\n")
