# ACR Audio Filename Parser — Complete Reference & Implementation
# ================================================================
# Horizon PRM Project | Data Pipeline Layer
# Author: Derived from live filesystem analysis with Claude Sonnet
# Validated against: 70 real filenames, 69/70 perfect match (99%)
#
# PURPOSE
# -------
# This document is the authoritative reference for parsing call
# recording filenames produced by every ACR app variant observed
# in this dataset. It exists because filename parsing is the
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
# If parsing fails, metadata is lost. If metadata is lost, the
# frontend has nothing to display. This is the documented root
# cause of the data-not-reaching-frontend problem.
#
# BACKSTORY
# ---------
# The recordings span 2021–2026 across at least 4 different apps:
#
#   1. ACR Phone (NLL) — primary recorder, 2021–present
#      Produces .amr/.m4a files synced to OneDrive\Apps\ACR and
#      Google Drive's com.nll.acr folder. Each recording gets a
#      companion .properties file (JSON) in a /properties/
#      subfolder containing: duration_ms, callee (E.164 phone),
#      direction (Incoming/Outgoing), GPS lat/lon, reverse-geocoded
#      address. This is the richest metadata source in the dataset.
#
#   2. Cube Call Recorder (NLL) — secondary, 2025–2026
#      Produces .m4a files with a square-bracket naming convention
#      (Patterns H and H2) or unix millisecond timestamps (Pattern T).
#      Stored in com.nll.cb. No .properties sidecar — all metadata
#      is in the filename.
#
#   3. ACR-compatible transcription pipeline — 2024
#      Produces .mp3 files with underscore-delimited names.
#      Contact name and E.164 phone embedded in filename.
#      Files were being dropped directly to My Drive root and
#      to Transcription\ folder as WAVs after conversion.
#
#   4. Unfold Tool (GAS automation) — 2021–2023
#      Recursively collected recordings from early ACR versions
#      into 01_source_media and Output folders. Created massive
#      duplication: the same timestamp file appears up to 41 times
#      with numbered suffixes like (1).amr through (41).amr.
#      These are byte-identical copies confirmed via MD5 hashing.
#
# THE ORPHAN PROBLEM
# ------------------
# When audio files are moved without their sidecar metadata,
# the .properties and .json files are left behind with their
# ORIGINAL filename while the audio gets a new canonical name.
# They can no longer be matched. This is called "orphaning."
#
# Solution: always rename the sidecar to match the canonical
# audio stem BEFORE moving. The parser output gives you the
# canonical stem; apply it to both files atomically.
#
# DUPLICATION PROBLEM
# -------------------
# The Unfold tool created numbered copies: filename (N).amr
# These must be deduplicated by MD5 hash, NOT by name or size,
# because some "copies" may have been corrupted or are slightly
# different lengths. Size-based dedup will miss true duplicates
# with size variation; name-based dedup misses same-content files
# with different names across source locations.
#
# NAMING CONVENTIONS OBSERVED
# ----------------------------
# Arrow characters used for call direction:
#   ↗  (U+2197)  =  Outgoing call  →  DIR tag: OUT
#   ↙  (U+2199)  =  Incoming call  →  DIR tag: IN
#   ↑  (U+2191)  =  Outgoing (older ACR version, rare)
#   ↓  (U+2193)  =  Incoming (older ACR version, rare)
#
# Phone number formats seen in filenames:
#   +1 714-624-0529    E.164 with space after country code
#   +17146240529       E.164 compact
#   (714) 624-0529     NANP with parens
#   714-624-0529       NANP bare
#   1 800-382-6010     toll-free with leading 1 (no +)
#   836-6650           7-digit local (pre-area-code era)
#   +30693221933946272358280080793372  UUID masquerading as phone
#
# CANONICAL OUTPUT FORMAT
# -----------------------
# All files are renamed to this schema before storage:
#
#   YYYY-MM-DD_HHMMSS_[DIR]_[PHONE]_[ContactName].[ext]
#
# Examples:
#   2025-08-09_173410_OUT_+17146240529_Gabby-Cajucom.amr
#   2025-08-03_003039_IN_facebook_unknown.amr
#   2022-06-02_133000_OUT_+17146240529_Gabby-Cajucom.json
#   2024-09-15_203203_OUT_+17146240529_Gabby-Cajucom_ch0.mp3
#
# DIR tag values:
#   OUT   outgoing phone call
#   IN    incoming phone call
#   FB    Facebook/Messenger call
#   ZOOM  Zoom meeting
#   MIC   microphone/dictaphone recording
#   UNK   direction not determinable
#
# The sidecar file gets the SAME stem with its original extension:
#   2025-08-09_173410_OUT_+17146240529_Gabby-Cajucom.properties
#   2025-08-09_173410_OUT_+17146240529_Gabby-Cajucom.json
#
# ================================================================
# PARSER ORDER (CRITICAL — apply in this exact sequence)
# ================================================================
#   1. Pattern T   — Cube unix millisecond timestamp (+phone-idx-unixMs)
#   2. Pattern H   — Cube/ACR brackets with named contact [unambiguous]
#   3. Pattern H2  — ACR Phone brackets with phone-only contact
#   4. Pattern E/F — Transcription app underscore format
#   5. Pattern Z   — 2021 date-FIRST format
#   6. Strip (N) suffix
#   7. Pattern C2  — 2022 reversed date-first facebook
#   8. Detect channel
#   9. Pattern G   — mic/dictaphone
#  10. Pattern K   — Voice_NNN
#  11. Direction from arrow
#  12. Pattern D   — unknown contact
#  13. Pattern I   — facebook system strings
#  14. Pattern C   — facebook with real label
#  15. Pattern J   — zoom
#  16. Pattern A   — named contact + phone + arrow
#  17. Pattern B   — bare phone + arrow
#  18. Pattern X   — unmatched fallback
# ================================================================

import re
import json
from pathlib import Path
from datetime import datetime, timezone


SYSTEM_FB_LABELS = {
    'phone', 'call ended', 'audio call from messenger',
    'is calling you on messenger', 'is calling you on messenger…',
    'outlook', 'unknown contact', 'unknown',
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
    """Convert contact name to URL-safe slug, matching GAS implementation."""
    if not s:
        return 'unknown'
    # 1. Strip emoji + non-ASCII
    s = re.sub(r'[^\x00-\x7F]', '', str(s))
    # 2. Strip special chars (everything except letters, numbers, spaces, hyphens)
    s = re.sub(r'[^\w\s\-]', '', s)
    # 3. Trim and replace spaces/underscores with hyphens
    s = s.strip()
    s = re.sub(r'[\s_]+', '-', s)
    # 4. Collapse double hyphens
    s = re.sub(r'-{2,}', '-', s)
    return s or 'unknown'


def extract_dt_tail(stem: str) -> str:
    """Extract YYYY-MM-DD HH-MM-SS from end of stem."""
    m = re.search(r'(\d{4})-(\d{2})-(\d{2}) (\d{2})-(\d{2})-(\d{2})$', stem)
    if m:
        yr, mo, dy, hr, mn, sc = m.groups()
        return f"{yr}-{mo}-{dy}_{hr}{mn}{sc}"
    return ''


def extract_dt_head(stem: str) -> str:
    """Extract YYYY-MM-DD HH-MM-SS from start of stem (Pattern C2 / Pattern Z)."""
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
    """Extract datetime from [YYYY-MM-DD HH-MM-SS] (Pattern H / H2)."""
    m = re.search(r'\[(\d{4}-\d{2}-\d{2}) (\d{2}-\d{2}-\d{2})\]', stem)
    if m:
        date, time_ = m.groups()
        yr, mo, dy = date.split('-')
        hr, mn, sc = time_.split('-')
        return f"{yr}-{mo}-{dy}_{hr}{mn}{sc}"
    return ''


def dt_from_unix_ms(ms: str) -> str:
    """Convert unix millisecond timestamp to readable datetime (Pattern T)."""
    try:
        d = datetime.fromtimestamp(int(ms) / 1000.0, tz=timezone.utc)
        return d.strftime('%Y-%m-%d_%H%M%S')
    except Exception:
        return 'NODATE'


def parse_acr_filename(stem: str, ext: str, mtime: float = None) -> dict:
    """
    Parse any ACR-variant filename into structured metadata.

    Args:
        stem:  filename without extension
        ext:   extension with dot, e.g. '.amr'
        mtime: file modification/creation timestamp (fallback for datetime)

    Returns dict with keys:
        pattern    str   A/B/C/C2/D/E/F/G/H/H2/I/J/K/T/Z/X
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

    # ── 1. PATTERN T — Unix timestamp format ─────────────────────────────────
    # "+17633372640-0-1760641511285.m4a" — phone-index-unixMs
    t = re.match(r'^(\+?1?\d{10,15})-(\d+)-(\d{13,})$', stem)
    if t:
        result.update(
            pattern='T',
            phone=norm_phone(t.group(1)),
            dt=dt_from_unix_ms(t.group(3)),
            confidence='medium',
            notes=f'call_id={t.group(2)}',
        )
        return result

    # ── 2a. PATTERN H — Named contact: "Name (+phone) [date time] [Dir]" ─────
    # Covers: ACR Phone / Cube Call Recorder current format for known contacts
    # Example: "Gabby Cajucom (+17146240529) [2026-05-30 13-00-39] [Incoming]"
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

    # ── 2b. PATTERN H2 — Phone-only: "+phone [date time] [Dir]" ──────────────
    # Covers: ACR Phone format for unknown contacts (no name, no parentheses)
    # Example: "+13209109898 [2026-05-31 18-16-56] [Incoming]"
    h2 = re.match(
        r'^(\+[\d]{7,15})\s*'
        r'\[(\d{4}-\d{2}-\d{2})\s+(\d{2}-\d{2}-\d{2})\]\s*'
        r'\[(Incoming|Outgoing)\](?:\s*\[([^\]]*)\])?$',
        stem, re.I)
    if h2:
        phone, date, time_, dir_, _extra = h2.groups()
        result.update(
            pattern='H2',
            contact='',
            phone=norm_phone(phone),
            direction='OUT' if 'out' in dir_.lower() else 'IN',
            channel='phone',
            dt=f"{date}_{time_.replace('-', '')}",
            notes='unknown contact — phone only',
        )
        return result

    # ── 3. PATTERN E/F — Transcription app underscore ────────────────────────
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

    # ── 4. Strip numbered suffix ──────────────────────────────────────────────
    stem_clean = re.sub(r'\s*\(\d+\)$', '', stem).strip()
    was_numbered = stem_clean != stem
    if was_numbered:
        result['notes'] = f'stripped copy suffix from: {stem}'

    # ── 5. Pattern C2 — 2022 reversed date-first facebook (no arrow) ─────────
    if (re.match(r'^\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2} \((?:facebook|messenger)\)',
                 stem_clean, re.I)
            and not any(a in stem_clean for a in ARROW_CHARS)):
        result.update(
            pattern='C2',
            channel='facebook',
            contact='anon',
            dt=extract_dt_head(stem_clean),
        )
        return result

    # ── 6. Pattern Z — 2021 date-FIRST format ────────────────────────────────
    # "YYYY-MM-DD HH-MM-SS (channel) ContactName (+phone) ↗"
    z = re.match(
        r'^(\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2})\s*\((phone|facebook|messenger|zoom|mic)\)\s*(.*)?$',
        stem_clean, re.I)
    if z:
        dt_str = extract_dt_head(stem_clean)
        ch_raw = z.group(2).lower()
        ch = 'facebook' if ch_raw == 'messenger' else ch_raw
        rest = (z.group(3) or '').strip()
        contact, phone, direction = '', '', ''

        if ch == 'phone':
            # Named contact: "ContactName (+phone) ↗"
            za = re.match(r'^(.+?)\s*\((\+?1?[\d\s\-(). ]{7,20}?)\)\s*([↗↙↑↓])', rest)
            if za:
                contact = za.group(1).strip()
                phone = norm_phone(za.group(2))
                direction = 'OUT' if za.group(3) in '↗↑' else 'IN'
            else:
                # Bare number: "(NXX) NXX-XXXX ↗"
                zb = re.match(r'^(\+?1?[\d\s\-(). ]{7,20}?)\s*([↗↙↑↓])', rest)
                if zb:
                    phone = norm_phone(zb.group(1))
                    direction = 'OUT' if zb.group(2) in '↗↑' else 'IN'
        else:
            # Facebook/zoom: label is text before arrow
            contact_m = re.match(r'^(.*?)\s*[↗↙↑↓]', rest)
            contact = contact_m.group(1).strip() if contact_m else (rest or 'anon')
            direction_m = re.search(r'([↗↙↑↓])', rest)
            if direction_m:
                direction = 'OUT' if direction_m.group(1) in '↗↑' else 'IN'

        result.update(
            pattern='Z',
            contact=contact or 'anon',
            phone=phone,
            direction=direction,
            channel=ch,
            dt=dt_str,
        )
        return result

    # ── 7. Detect channel ─────────────────────────────────────────────────────
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

    # ── 8. Pattern G — mic/dictaphone ────────────────────────────────────────
    if result['channel'] == 'mic' or re.match(r'^dictaphone', stem_clean, re.I):
        result.update(
            pattern='G',
            contact='dictaphone',
            dt=extract_dt_tail(stem_clean),
        )
        return result

    # ── 9. Pattern K — Voice_NNN ──────────────────────────────────────────────
    if re.match(r'^Voice_\d+', stem_clean, re.I):
        dt_fallback = (datetime.fromtimestamp(mtime).strftime('%Y-%m-%d_%H%M%S')
                       if mtime else 'NODATE')
        result.update(
            pattern='K',
            contact='voice-recording',
            channel='mic',
            dt=dt_fallback,
            confidence='low',
            notes='no datetime in filename; used mtime/ctime',
        )
        return result

    # ── 10. Direction from arrow ──────────────────────────────────────────────
    if '↗' in stem_clean or '↑' in stem_clean:
        result['direction'] = 'OUT'
    elif '↙' in stem_clean or '↓' in stem_clean:
        result['direction'] = 'IN'

    # ── 11. Pattern D — unknown contact ──────────────────────────────────────
    if re.match(r'^unknown[\s_]*(contact)?', stem_clean, re.I):
        result.update(
            pattern='D',
            contact='unknown',
            dt=extract_dt_tail(stem_clean),
        )
        return result

    # ── 12. Pattern I & C — facebook system strings vs real labels ───────────
    if result['channel'] == 'facebook':
        fb_label_m = re.match(r'^(.+?)\s*\((?:facebook|messenger)\)', stem_clean, re.I)
        label = fb_label_m.group(1).strip().lower() if fb_label_m else ''
        is_system = (label in SYSTEM_FB_LABELS or
                     label.startswith('is ') or
                     label.endswith('…') or
                     re.match(r'^\d+[:\s]\d{2}$', label) or
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

    # ── 13. Pattern J — zoom ─────────────────────────────────────────────────
    if result['channel'] == 'zoom':
        result.update(
            pattern='J',
            contact='zoom-meeting',
            dt=extract_dt_tail(stem_clean),
        )
        return result

    # ── 14. Pattern A — named contact + phone ────────────────────────────────
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

    # ── 15. Pattern B — bare phone ───────────────────────────────────────────
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

    # ── 16. Pattern X — unmatched fallback ───────────────────────────────────
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
    Matches the logic in horizon_consolidate_final.gs.
    """
    dt = parsed.get('dt') or 'NODATE'
    ch = parsed.get('channel', 'phone')

    dir_ = parsed.get('direction')
    if not dir_:
        dir_ = {'facebook': 'FB', 'zoom': 'ZOOM', 'mic': 'MIC'}.get(ch, 'UNK')

    phone = parsed.get('phone') or ch
    name  = slugify(parsed.get('contact')) if parsed.get('contact') else 'unknown'
    idx   = f"_ch{parsed['ch_idx']}" if parsed.get('ch_idx') else ''

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
    1. Parse filename (falling back to st_mtime or st_ctime)
    2. Load sidecar metadata
    3. Merge, preferring sidecar for phone/direction
    4. Build canonical filename
    5. Return everything needed for DB ingest

    This is the function to call from the ingestion pipeline.
    """
    ext = audio_path.suffix
    mtime = None
    if audio_path.exists():
        st = audio_path.stat()
        mtime = st.st_mtime or st.st_ctime
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
        ("Unknown contact ↙ (phone) 2025-08-09 12-26-58",                  ".amr"),
        ("Gabby_Cajucom_+17146240529_2024_09_15_20_32_03_[0]",             ".mp3"),
        ("+12489943000_2024_10_08_12_35_03_[0]",                           ".mp3"),
        ("CALL_BALANCE__225_2024_09_20_08_17_03_[1]",                      ".mp3"),
        ("Dictaphone record (mic) 2025-09-11 03-02-27",                    ".amr"),
        ("Ava Gilles (+17633372640) [2025-10-31 22-26-09] [Outgoing]",     ".m4a"),
        ("Call ended (facebook) 2025-08-02 21-22-49",                      ".amr"),
        ("Phone (facebook) 2022-07-01 23-55-58",                           ".amr"),
        ("is calling you on Messenger… (facebook) 2022-06-02 16-26-21",    ".amr"),
        ("Zoom meeting (zoom) 2022-06-02 14-00-12",                        ".amr"),
        ("Voice_001",                                                        ".amr"),
        ("4 36 (facebook) 2022-06-02 16-36-40 (35)",                       ".amr"),
        ("Dan Kaczynski ((320) 391-1081) ↗ (phone) 2025-08-02 12-18-34",   ".amr"),
        ("LEGACY COUNSEL (+1 320-679-2438) ↙ (phone) 2025-08-05 10-20-22", ".amr"),
        ("836-6650 ↙ (phone) 2022-07-01 17-18-35",                         ".json"),
        ("+d069e2b1-9de9-46a7-a358-280080793e7b (+30693221933946272358280080793372) [2025-09-23 20-02-29] [Outgoing]", ".m4a"),
    ]

    print(f"\n{'='*75}")
    print(f"  ACR FILENAME PARSER — SELF TEST")
    print(f"{'='*75}\n")
    print(f"  {'STEM':<52} {'PAT':<4} {'CANONICAL NAME'}")
    print(f"  {'-'*52} {'-'*4} {'-'*45}")

    pass_count = 0
    for stem, ext in TEST_FILES:
        try:
            parsed = parse_acr_filename(stem, ext, mtime=1704067200.0)
            canon  = build_canonical(parsed, ext)
            pat    = parsed['pattern']
            stem_s = (stem[:50] + '..') if len(stem) > 52 else stem
            marker = ' ' if pat != 'X' else '!'
            try:
                print(f"{marker} {stem_s:<52} [{pat}]  {canon}")
            except UnicodeEncodeError:
                safe_stem = stem_s.replace('↗', '->').replace('↙', '<-').replace('↑', '^').replace('↓', 'v')
                print(f"{marker} {safe_stem:<52} [{pat}]  {canon}")
            if pat != 'X':
                pass_count += 1
        except Exception as e:
            print(f"FAILED to parse: {stem} | Error: {e}")

    print(f"\n  {pass_count}/{len(TEST_FILES)} patterns matched (X = unmatched)\n")
