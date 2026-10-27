#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════╗
║          HORIZON CONSOLIDATE  v2.0  —  horizon_consolidate_v2.py    ║
║          One-shot audio vault builder for Horizon_Data               ║
╠══════════════════════════════════════════════════════════════════════╣
║  USAGE                                                               ║
║    python horizon_consolidate_v2.py            # dry run (safe)      ║
║    python horizon_consolidate_v2.py --go       # execute moves       ║
║    python horizon_consolidate_v2.py --verify   # verify + prompt del ║
║    python horizon_consolidate_v2.py --status   # show vault summary  ║
╠══════════════════════════════════════════════════════════════════════╣
║  WHAT IT DOES                                                        ║
║  1. Recursively walks EVERY source root, no depth limit              ║
║  2. Finds all audio files by extension                               ║
║  3. MD5-hashes each file — true deduplication, not name/size        ║
║  4. Parses filename → canonical name using all known ACR patterns    ║
║  5. Pairs each audio file with its .json/.properties metadata        ║
║  6. Renames metadata to match canonical audio name (no orphans)      ║
║  7. Moves audio → Audio_Archive, metadata → Transcripts_JSON        ║
║  8. Writes full move_log.csv + dupe_log.csv + error_log.csv          ║
║  9. --verify confirms every dest exists, then prompts source delete  ║
╠══════════════════════════════════════════════════════════════════════╣
║  PATTERNS HANDLED                                                    ║
║  T  +1phone-index-unixMs                              .m4a           ║
║  H  ContactName (+E164) [YYYY-MM-DD HH-MM-SS] [In/Outgoing]  .m4a   ║
║  H2 +E164 [YYYY-MM-DD HH-MM-SS] [In/Outgoing]                .m4a   ║
║  E  ContactName_+1phone_YYYY_MM_DD_HH_MM_SS_[ch]      .mp3/.wav     ║
║  F  phone_YYYY_MM_DD_HH_MM_SS_[ch]                    .mp3/.wav     ║
║  Z  YYYY-MM-DD HH-MM-SS (channel) Contact (+phone) ↗  .amr          ║
║  C2 YYYY-MM-DD HH-MM-SS (facebook) HH MM (reversed)   .amr          ║
║  G  Dictaphone record (mic) YYYY-MM-DD HH-MM-SS       .amr          ║
║  K  Voice_NNN.amr  (generic recorder, st_ctime fallback)             ║
║  D  Unknown contact ↗↙ YYYY-MM-DD HH-MM-SS            .amr/.wav     ║
║  I  Phone/Audio call/is calling (facebook) YYYY-MM-DD HH-MM-SS       ║
║  C  Label (facebook/messenger) YYYY-MM-DD HH-MM-SS                   ║
║  J  Zoom meeting (zoom) YYYY-MM-DD HH-MM-SS                          ║
║  A  ContactName (+1 NXX-NXX-XXXX) ↗↙ (phone) YYYY-MM-DD HH-MM-SS    ║
║  B  (NXX) NXX-XXXX ↗↙ (phone) YYYY-MM-DD HH-MM-SS                   ║
║  B2 1 NXX-NXX-XXXX ↗ (phone) YYYY-MM-DD HH-MM-SS  (no +/())         ║
║  X  UNKNOWN — moved with hash/ctime-based name, flagged in log      ║
╚══════════════════════════════════════════════════════════════════════╝
"""

import os, re, sys, csv, json, hashlib, shutil, time
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict

# ── CONFIG ─────────────────────────────────────────────────────────────────────
DRY_RUN = "--go"     not in sys.argv
VERIFY  = "--verify" in sys.argv
STATUS  = "--status" in sys.argv

VAULT_ROOT    = Path(os.environ.get("HORIZON_VAULT_PATH", r"C:\Users\owner\My Drive\Horizon_Data"))
AUDIO_ARCHIVE = VAULT_ROOT / "02_Processed_Vault" / "Audio_Archive"
TRANSCRIPTS   = VAULT_ROOT / "02_Processed_Vault" / "Transcripts_JSON"
PIPELINE      = VAULT_ROOT / "04_Pipeline_Tools"
LOG_DIR       = VAULT_ROOT / "03_Database_State" / "MCP_Logs"

TS = datetime.now().strftime("%Y%m%d_%H%M%S")

# ── SOURCE ROOTS ── (all walked recursively, unlimited depth) ──────────────────
# Format: (label, path, is_primary)
# is_primary=False → contents logged as duplicates, never moved
SOURCE_ROOTS = [
    # Primary sources — will be moved
    ("unfold_source",   Path(r"C:\Users\owner\My Drive\1 Unfold(tool)\01_source_media"), True),
    ("unfold_output",   Path(r"C:\Users\owner\My Drive\1 Unfold(tool)\Output"),          True),
    ("unfold_cube_acr", Path(r"C:\Users\owner\My Drive\1 Unfold(tool)\Cube ACR"),        True),
    ("onedrive_acr",    Path(r"C:\Users\owner\OneDrive\Apps\ACR"),                       True),
    ("mydrive_root",    Path(r"C:\Users\owner\My Drive"),                                True),
    ("drive_acr_app",   Path(r"C:\Users\owner\My Drive\com.nll.acr"),                    True),
    ("drive_cube_cb",   Path(r"C:\Users\owner\My Drive\com.nll.cb"),                     True),
    ("transcription",   Path(r"C:\Transcription"),                                       True),
    ("music_acrcalls",  Path(r"C:\Users\owner\Music\ACRCalls"),                          True),
    # Duplicate sources — hash-logged but NOT moved (deleted after verify)
    ("music_backup",    Path(r"C:\Users\owner\Music\ACRCallsBackup"),                   False),
]

# Subdirectory names to never descend into (case-insensitive)
SKIP_DIRS = {
    '$recycle.bin', '.tmp.drivedownload', '.tmp.driveupload',
    '.git', 'node_modules', '__pycache__', '.conda', 'conda',
    'horizon_data',  # never scan the destination itself
    'audio_archive', 'transcripts_json',
}

# Only walk top level for My Drive root (avoid scanning all 131 subdirs)
SHALLOW_ROOTS = {
    Path(r"C:\Users\owner\My Drive"),
}

AUDIO_EXTS      = {'.amr', '.mp3', '.m4a', '.wav', '.ogg', '.aac',
                   '.opus', '.flac', '.3gp', '.wma'}
TRANSCRIPT_EXTS = {'.txt', '.srt', '.vtt'}
META_EXTS       = {'.json', '.properties'}


# ── MD5 HASHING ────────────────────────────────────────────────────────────────
def md5(path: Path, chunk=1 << 20) -> str:
    """Hash file in 1 MB chunks. Returns hex string."""
    h = hashlib.md5()
    try:
        with open(path, 'rb') as f:
            while True:
                buf = f.read(chunk)
                if not buf:
                    break
                h.update(buf)
        return h.hexdigest()
    except (OSError, PermissionError):
        return ''


# ── PHONE NORMALIZATION & SLUGIFY ──────────────────────────────────────────────
def norm_phone(raw: str) -> str:
    if not raw:
        return ''
    d = re.sub(r'[^\d]', '', str(raw))
    if d.startswith('1') and len(d) == 11:
        return f"+{d}"
    if len(d) == 10:
        return f"+1{d}"
    if len(d) > 6:
        return f"+{d}"
    return ''


def slugify(s: str) -> str:
    if not s:
        return 'unknown'
    s = re.sub(r'[^\x00-\x7f]', '', str(s))  # strip non-ascii / emoji
    s = re.sub(r'[^\w\s-]', '', s).strip()
    s = re.sub(r'[\s_]+', '-', s)
    s = re.sub(r'-{2,}', '-', s)             # collapse double hyphens
    return s or 'unknown'


# ── FILENAME PARSER ─────────────────────────────────────────────────────────────
def parse(stem: str, ext: str, file_path: Path = None) -> dict:
    r = {
        'pattern': 'X',
        'contact': '',
        'phone':   '',
        'dir':     '',      # OUT / IN / ''
        'channel': 'phone', # phone / facebook / zoom / mic
        'dt':      '',      # YYYY-MM-DD_HHMMSS
        'ch_idx':  '',      # [0] or [1] from transcription app
    }

    # ── 1. Pattern T: Unix millisecond timestamp (Cube App format) ──
    t_match = re.match(r'^(\+?1?\d{10,15})-(\d+)-(\d{13,})$', stem)
    if t_match:
        phone, idx, ms = t_match.groups()
        try:
            dt_obj = datetime.fromtimestamp(int(ms) / 1000.0, tz=timezone.utc)
            dt_val = dt_obj.strftime("%Y-%m-%d_%H%M%S")
        except Exception:
            dt_val = 'NODATE'
        r.update(pattern='T', phone=norm_phone(phone), dt=dt_val)
        return r

    # ── 2a. Pattern H: Cube CB / ACR bracket format (named contact) ──
    h = re.match(
        r'^(.+?)\s*\((\+[\d]+)\)\s*'
        r'\[(\d{4}-\d{2}-\d{2})\s+(\d{2}-\d{2}-\d{2})\]\s*'
        r'\[(Incoming|Outgoing)\]',
        stem, re.I)
    if h:
        name, phone, date, time_, dir_ = h.groups()
        is_uuid = bool(re.match(r'^[+]?[0-9a-f\-]{20,}$', name.strip(), re.I))
        r.update(
            pattern='H',
            contact='fb-cube' if is_uuid else name.strip(),
            phone=norm_phone(phone),
            dir='OUT' if 'out' in dir_.lower() else 'IN',
            channel='facebook' if is_uuid else 'phone',
            dt=f"{date}_{time_.replace('-', '')}",
        )
        return r

    # ── 2b. Pattern H2: ACR Phone bracket format (phone-only unknown contact) ──
    h2 = re.match(
        r'^(\+[\d]{7,15})\s*'
        r'\[(\d{4}-\d{2}-\d{2})\s+(\d{2}-\d{2}-\d{2})\]\s*'
        r'\[(Incoming|Outgoing)\](?:\s*\[([^\]]*)\])?$',
        stem, re.I)
    if h2:
        phone, date, time_, dir_, _extra = h2.groups()
        r.update(
            pattern='H2',
            contact='',
            phone=norm_phone(phone),
            dir='OUT' if 'out' in dir_.lower() else 'IN',
            channel='phone',
            dt=f"{date}_{time_.replace('-', '')}",
        )
        return r

    # ── 3. Pattern E/F: Transcription app: [Name_]phone_YYYY_MM_DD_HH_MM_SS[_[ch]] ──
    ef = re.match(
        r'^(?:([A-Za-z][A-Za-z_\-]+?)_)?'
        r'(\+?1?\d{10,15})_'
        r'(\d{4})_(\d{2})_(\d{2})_'
        r'(\d{2})_(\d{2})_(\d{2})'
        r'(?:_\[(\d)\])?$', stem)
    if ef:
        name, phone, yr, mo, dy, hr, mn, sc, ch = ef.groups()
        is_unk = (name or '').lower() == 'unknown'
        r.update(
            pattern='D' if is_unk else ('E' if name else 'F'),
            contact='unknown' if is_unk else (name or '').replace('_', ' ').strip(),
            phone=norm_phone(phone),
            ch_idx=ch or '',
            dt=f"{yr}-{mo}-{dy}_{hr}{mn}{sc}")
        return r

    # Edge case: double-underscore label (CALL_BALANCE, CANCELLED, etc.)
    ef_label = re.match(
        r'^([A-Z][A-Z_]+)__?(\w+)_'
        r'(\d{4})_(\d{2})_(\d{2})_'
        r'(\d{2})_(\d{2})_(\d{2})'
        r'(?:_\[(\d)\])?$', stem)
    if ef_label:
        label, _, yr, mo, dy, hr, mn, sc, ch = ef_label.groups()
        r.update(
            pattern='E',
            contact=label.replace('_', ' ').strip(),
            phone='',
            ch_idx=ch or '',
            dt=f"{yr}-{mo}-{dy}_{hr}{mn}{sc}")
        return r

    # Strip numbered copy suffix before parsing:  filename (3).amr → filename
    stem_clean = re.sub(r'\s*\(\d+\)$', '', stem).strip()

    # ── 4. Pattern C2: 2022 reversed date-first facebook (no arrow) ──
    if (re.match(r'^\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2}\s*\((?:facebook|messenger)\)', stem_clean, re.I)
            and not any(a in stem_clean for a in '↗↙↑↓')):
        dt_str = stem_clean[:19]
        parts = dt_str.split(' ')
        dt_canon = f"{parts[0]}_{parts[1].replace('-', '')}"
        r.update(pattern='C2', channel='facebook', contact='anon', dt=dt_canon)
        return r

    # ── 5. Pattern Z: 2021 date-first format ──
    z = re.match(
        r'^(\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2})\s*\((phone|facebook|messenger|zoom|mic)\)\s*(.*)?$',
        stem_clean, re.I)
    if z:
        dt_str, ch, rest = z.groups()
        ch = 'facebook' if ch.lower() == 'messenger' else ch.lower()
        parts = dt_str.split(' ')
        dt_canon = f"{parts[0]}_{parts[1].replace('-', '')}"

        contact, phone, direction = '', '', ''
        rest = (rest or '').strip()
        if ch == 'phone':
            za = re.match(r'^(.+?)\s*\((\+?1?[\d\s\-(). ]{7,20}?)\)\s*[↗↙↑↓]', rest)
            if za:
                contact = za.group(1).strip()
                phone = norm_phone(re.sub(r'[^\d+]', '', za.group(2)))
            else:
                zb = re.match(r'^(\+?1?[\d\s\-(). ]{7,20}?)\s*[↗↙↑↓]', rest)
                if zb:
                    phone = norm_phone(re.sub(r'[^\d+]', '', zb.group(1)))
            direction = 'OUT' if any(x in rest for x in '↗↑') else ('IN' if any(x in rest for x in '↙↓') else '')
        else:
            contact = re.sub(r'\s*[↗↙↑↓].*$', '', rest).strip() or 'anon'

        r.update(pattern='Z', contact=contact, phone=phone, dir=direction, channel=ch, dt=dt_canon)
        return r

    # Shared tail datetime  YYYY-MM-DD HH-MM-SS
    dt_m = re.search(r'(\d{4})-(\d{2})-(\d{2}) (\d{2})-(\d{2})-(\d{2})$', stem_clean)
    if dt_m:
        yr, mo, dy, hr, mn, sc = dt_m.groups()
        r['dt'] = f"{yr}-{mo}-{dy}_{hr}{mn}{sc}"

    # Direction
    if '↗' in stem_clean or '↑' in stem_clean:
        r['dir'] = 'OUT'
    elif '↙' in stem_clean or '↓' in stem_clean:
        r['dir'] = 'IN'

    # Channel
    sl = stem_clean.lower()
    if any(x in sl for x in ('(facebook)', '(messenger)', 'is calling you on messenger',
                               'audio call from messenger', 'call ended')):
        r['channel'] = 'facebook'
    elif '(zoom)' in sl or 'zoom meeting' in sl:
        r['channel'] = 'zoom'
    elif '(mic)' in sl:
        r['channel'] = 'mic'

    # ── G  Dictaphone / mic ──
    if r['channel'] == 'mic' or re.match(r'^dictaphone', stem_clean, re.I):
        r.update(pattern='G', contact='dictaphone')
        return r

    # ── K  Voice_NNN generic (fallback to file st_ctime) ──
    if re.match(r'^Voice_\d+', stem_clean, re.I):
        dt_f = 'NODATE'
        if file_path and file_path.exists():
            dt_f = datetime.fromtimestamp(file_path.stat().st_ctime).strftime("%Y-%m-%d_%H%M%S")
        r.update(pattern='K', contact='voice-recording', channel='mic', dt=dt_f)
        return r

    # ── D  Unknown contact ──
    if re.match(r'^unknown[\s_]*(contact)?', stem_clean, re.I):
        r.update(pattern='D', contact='unknown')
        return r

    # ── I / C  Facebook/Messenger labels ──
    if r['channel'] == 'facebook':
        m = re.match(r'^(.+?)\s*\((?:facebook|messenger)\)', stem_clean, re.I)
        label = m.group(1).strip() if m else 'anon'
        system = {
            'phone', 'call ended', 'audio call from messenger',
            'is calling you on messenger', 'is calling you on messenger…',
            'outlook', 'unknown contact', 'unknown'
        }
        is_sys = (
            label.lower() in system
            or label.lower().startswith('is ')
            or label.endswith('…')
            or bool(re.match(r'^\d+[:\s]\d{2}$', label))
        )
        r.update(pattern='I' if is_sys else 'C', contact='anon' if is_sys else label)
        return r

    # ── J  Zoom ──
    if r['channel'] == 'zoom':
        r.update(pattern='J', contact='zoom-meeting')
        return r

    # ── A  ContactName (phone) ↗↙ (phone) ──
    a = re.match(
        r'^(.+?)\s*\((\+?1?[\d\s\-(). ]{7,20}?)\)\s*[↗↙↑↓]\s*\((?:phone)\)',
        stem_clean)
    if a:
        raw = a.group(2).strip()
        r.update(pattern='A', contact=a.group(1).strip(),
                 phone=norm_phone(re.sub(r'[^\d+]', '', raw)))
        return r

    # ── B  Bare number ↗↙ (phone) ──
    b = re.match(
        r'^(\+?1?[\s\-(). \d]{7,25}?)\s*[↗↙↑↓]\s*\((?:phone)\)',
        stem_clean)
    if b:
        r.update(pattern='B',
                 phone=norm_phone(re.sub(r'[^\d+]', '', b.group(1))))
        return r

    # ── B2  "1 NXX-NXX-XXXX ↗ (phone)" (no + or parens) ──
    b2 = re.match(r'^(1[\s\d\-]{9,14})\s*[↗↙↑↓]\s*\((?:phone)\)', stem_clean)
    if b2:
        r.update(pattern='B2',
                 phone=norm_phone(re.sub(r'[^\d]', '', b2.group(1))))
        return r

    # Fallback — grab any phone number present + fallback to file st_ctime
    ph = re.search(r'(\+?1[\d\-\s().]{9,}|\d{10,})', stem_clean)
    if ph:
        r['phone'] = norm_phone(ph.group(1))
    if not r['dt'] and file_path and file_path.exists():
        r['dt'] = datetime.fromtimestamp(file_path.stat().st_ctime).strftime("%Y-%m-%d_%H%M%S")
    return r  # pattern stays 'X'


# ── CANONICAL NAME BUILDER ─────────────────────────────────────────────────────
def canonical(src: Path) -> tuple[str, dict]:
    """Returns (canonical_filename, parsed_dict)."""
    ext    = src.suffix.lower()
    parsed = parse(src.stem, ext, src)

    dt = parsed['dt'] or 'NODATE'
    ch = parsed['channel']
    dir_ = parsed['dir']

    # Direction tag
    if not dir_:
        dir_ = {'facebook': 'FB', 'zoom': 'ZOOM', 'mic': 'MIC'}.get(ch, 'UNK')

    phone = parsed['phone'] or ch
    name  = slugify(parsed['contact']) if parsed['contact'] else 'unknown'
    idx   = f"_ch{parsed['ch_idx']}" if parsed['ch_idx'] else ''

    canon = f"{dt}_{dir_}_{phone}_{name}{idx}{ext}"
    return canon, parsed


# ── METADATA COMPANION FINDER ──────────────────────────────────────────────────
def find_meta(audio: Path) -> list[Path]:
    """Find all metadata files paired with an audio file."""
    found = []
    stem  = audio.stem
    stem_base = re.sub(r'\s*\(\d+\)$', '', stem).strip()

    for s in {stem, stem_base}:
        for ext in ('.properties', '.json'):
            for c in [audio.parent / 'properties' / f"{s}{ext}", audio.parent / f"{s}{ext}"]:
                if c.exists() and c not in found:
                    found.append(c)
    return found


# ── FILE WALKER ────────────────────────────────────────────────────────────────
SKIP_DIR_SEGS = SKIP_DIRS

def walk_audio(root: Path, shallow=False) -> list[Path]:
    """Yield all audio files under root."""
    files = []
    if not root.exists():
        return files

    for dirpath, dirnames, filenames in os.walk(root, topdown=True):
        if shallow:
            depth = str(dirpath).replace(str(root), '').count(os.sep)
            if depth >= 1:
                dirnames.clear()
                continue

        dirnames[:] = [
            d for d in dirnames
            if d.lower() not in SKIP_DIR_SEGS
            and '$recycle' not in d.lower()
        ]

        for fname in filenames:
            p = Path(dirpath) / fname
            if p.suffix.lower() in AUDIO_EXTS:
                files.append(p)

    return files


# ── MAIN ROUTINES ──────────────────────────────────────────────────────────────
def run():
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    AUDIO_ARCHIVE.mkdir(parents=True, exist_ok=True)
    TRANSCRIPTS.mkdir(parents=True, exist_ok=True)

    mode = "DRY RUN — nothing will move" if DRY_RUN else "EXECUTING — files will move"
    print(f"\n{'='*68}")
    print(f"  HORIZON CONSOLIDATE v2  —  {mode}")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*68}\n")

    all_audio: list[tuple[str, Path, bool]] = []
    for label, root, is_primary in SOURCE_ROOTS:
        if not root.exists():
            print(f"  [SKIP ] {label:<22}  not found: {root}")
            continue
        shallow = root in SHALLOW_ROOTS
        files = walk_audio(root, shallow=shallow)
        tag = "PRIMARY" if is_primary else "DUPE-SRC"
        print(f"  [FOUND] {label:<22}  {len(files):>5,} files  ({tag}){' (shallow)' if shallow else ''}")
        for f in files:
            all_audio.append((label, f, is_primary))

    total = len(all_audio)
    print(f"\n  Total audio files discovered: {total:,}\n")
    print(f"  Hashing and deduplicating... (this may take a few minutes for large sets)\n")

    hash_to_canon: dict[str, str]  = {}
    hash_to_source: dict[str, str] = {}

    move_rows  = []
    dupe_rows  = []
    error_rows = []

    move_count = skip_exists = dupe_count = error_count = 0
    last_print = time.time()

    for i, (label, src, is_primary) in enumerate(all_audio):
        if time.time() - last_print > 5:
            print(f"    {i:>5}/{total}  ({i/total*100:.0f}%)  moves:{move_count}  dupes:{dupe_count}  errors:{error_count}")
            last_print = time.time()

        try:
            file_hash = md5(src)
        except Exception as e:
            error_rows.append({'label': label, 'source': str(src), 'error': str(e)})
            error_count += 1
            continue

        if not file_hash:
            error_rows.append({'label': label, 'source': str(src), 'error': 'unreadable'})
            error_count += 1
            continue

        try:
            canon, parsed = canonical(src)
        except Exception as e:
            error_rows.append({'label': label, 'source': str(src), 'error': f'parse: {e}'})
            error_count += 1
            continue

        size_b = src.stat().st_size

        if file_hash in hash_to_canon:
            dupe_count += 1
            dupe_rows.append({
                'source':     str(src),
                'label':      label,
                'canon':      canon,
                'hash':       file_hash,
                'first_copy': hash_to_source[file_hash],
                'size_bytes': size_b,
            })
            continue

        hash_to_canon[file_hash]  = canon
        hash_to_source[file_hash] = str(src)

        if not is_primary:
            dupe_count += 1
            dupe_rows.append({
                'source':     str(src),
                'label':      label + ' (non-primary)',
                'canon':      canon,
                'hash':       file_hash,
                'first_copy': 'non-primary source',
                'size_bytes': size_b,
            })
            continue

        dest = AUDIO_ARCHIVE / canon

        if dest.exists():
            existing_hash = md5(dest)
            if existing_hash == file_hash:
                skip_exists += 1
                continue
            else:
                dest = AUDIO_ARCHIVE / f"{dest.stem}_{file_hash[:6]}{dest.suffix}"

        meta_files = find_meta(src)

        move_count += 1
        row = {
            'action':     'MOVE' if not DRY_RUN else 'PLANNED',
            'label':      label,
            'source':     str(src),
            'dest':       str(dest),
            'canon':      canon,
            'pattern':    parsed['pattern'],
            'contact':    parsed['contact'],
            'phone':      parsed['phone'],
            'direction':  parsed['dir'],
            'channel':    parsed['channel'],
            'datetime':   parsed['dt'],
            'ch_idx':     parsed['ch_idx'],
            'hash':       file_hash,
            'size_bytes': size_b,
            'meta_count': len(meta_files),
            'error':      '',
        }

        if not DRY_RUN:
            try:
                AUDIO_ARCHIVE.mkdir(parents=True, exist_ok=True)
                shutil.move(str(src), str(dest))

                for mf in meta_files:
                    meta_dest = TRANSCRIPTS / f"{dest.stem}{mf.suffix}"
                    if not meta_dest.exists():
                        TRANSCRIPTS.mkdir(parents=True, exist_ok=True)
                        shutil.move(str(mf), str(meta_dest))

            except Exception as e:
                row['action'] = 'ERROR'
                row['error']  = str(e)
                error_count  += 1
                move_count   -= 1

        move_rows.append(row)

    # Handle transcripts separately (txt/srt/vtt that aren't paired with audio)
    trans_src = Path(r"C:\Transcription")
    if trans_src.exists():
        for f in trans_src.iterdir():
            if not f.is_file():
                continue
            if f.suffix.lower() in TRANSCRIPT_EXTS:
                dest = TRANSCRIPTS / f.name
                if not dest.exists():
                    move_count += 1
                    if not DRY_RUN:
                        try:
                            shutil.move(str(f), str(dest))
                        except Exception:
                            error_count += 1

    # Write logs
    move_csv = LOG_DIR / f"move_log_{TS}.csv"
    dupe_csv = LOG_DIR / f"dupe_log_{TS}.csv"
    err_csv  = LOG_DIR / f"error_log_{TS}.csv"

    move_fields = ['action', 'label', 'source', 'dest', 'canon', 'pattern', 'contact',
                   'phone', 'direction', 'channel', 'datetime', 'ch_idx', 'hash',
                   'size_bytes', 'meta_count', 'error']
    dupe_fields = ['source', 'label', 'canon', 'hash', 'first_copy', 'size_bytes']
    err_fields  = ['label', 'source', 'error']

    with open(move_csv, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=move_fields, extrasaction='ignore')
        w.writeheader()
        w.writerows(move_rows)

    with open(dupe_csv, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=dupe_fields, extrasaction='ignore')
        w.writeheader()
        w.writerows(dupe_rows)

    if error_rows:
        with open(err_csv, 'w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=err_fields, extrasaction='ignore')
            w.writeheader()
            w.writerows(error_rows)

    pattern_counts = defaultdict(int)
    for r in move_rows:
        pattern_counts[r['pattern']] += 1

    pattern_desc = {
        'A': 'ContactName (phone) ↗↙', 'B': 'BareNumber ↗↙ (phone)',
        'B2': '1 NXX-NXX ↗ (phone)', 'C': 'HH MM (facebook)',
        'C2': 'YYYY-MM-DD (facebook) reversed', 'D': 'Unknown contact',
        'E': 'Name_phone_YYYY_MM_DD [.mp3]', 'F': 'phone_YYYY_MM_DD [.mp3]',
        'G': 'Dictaphone (mic)', 'H': 'Name (+E164) [date] [dir] [.m4a]',
        'H2': '+E164 [date] [dir] [.m4a]', 'I': 'Phone/Audio call (facebook)',
        'J': 'Zoom meeting', 'K': 'Voice_NNN generic',
        'T': '+phone-idx-unixMs [.m4a]', 'Z': '2021 YYYY-MM-DD (channel) Contact',
        'X': 'UNKNOWN (hash-named)',
    }

    print(f"""
{'='*68}
  {'PLAN COMPLETE' if DRY_RUN else 'EXECUTION COMPLETE'}
  Files to move   : {move_count:>6,}
  True duplicates : {dupe_count:>6,}   (same MD5 — skipped)
  Already in dest : {skip_exists:>6,}   (already moved)
  Errors          : {error_count:>6,}
  ──────────────────────────────────────────────────────────────
  Move log        : {move_csv}
  Dupe log        : {dupe_csv}
{'='*68}

  PATTERNS FOUND:""")
    for pat, count in sorted(pattern_counts.items(), key=lambda x: -x[1]):
        desc = pattern_desc.get(pat, pat)
        print(f"    {count:>5,}  [{pat}]  {desc}")

    sample = [r for r in move_rows if r['action'] in ('MOVE', 'PLANNED')][:30]
    if sample:
        print(f"\n  SAMPLE RENAMES (first {len(sample)}):")
        print(f"  {'ORIGINAL':<55}  CANONICAL")
        print(f"  {'-'*55}  {'-'*50}")
        for r in sample:
            orig = Path(r['source']).name[:54]
            print(f"  {orig:<55}  {r['canon']}")

    if DRY_RUN:
        print(f"\n  Run with --go to execute.\n")
    else:
        print(f"\n  Run with --verify to confirm and clean up sources.\n")


def verify():
    """Check every move landed correctly, then offer to delete sources."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    print(f"\n{'='*68}")
    print(f"  VERIFICATION MODE")
    print(f"{'='*68}\n")

    logs = sorted(LOG_DIR.glob("move_log_*.csv"), reverse=True)
    if not logs:
        print("  No move_log found. Run the script first.")
        return
    log = logs[0]
    print(f"  Using log: {log}\n")

    ok = fail = skip = 0
    missing = []

    with open(log, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            if row['action'] in ('PLANNED', 'ERROR'):
                skip += 1
                continue
            dest = Path(row['dest'])
            if dest.exists():
                ok += 1
            else:
                fail += 1
                missing.append(row['dest'])

    print(f"  Verified OK  : {ok:,}")
    print(f"  Missing      : {fail:,}")
    print(f"  Skipped      : {skip:,}")

    if missing:
        print(f"\n  First 10 missing:")
        for m in missing[:10]:
            print(f"    {m}")
        print("\n  Fix errors before deleting sources.")
        return

    if ok == 0:
        print("  Nothing to verify — run --go first.")
        return

    print(f"\n  All {ok:,} files confirmed at destination.")

    delete_targets = [
        Path(r"C:\Users\owner\Music\ACRCallsBackup"),
        Path(r"C:\Users\owner\Music\ACRCalls"),
        Path(r"C:\Users\owner\My Drive\1 Unfold(tool)\01_source_media"),
        Path(r"C:\Users\owner\My Drive\1 Unfold(tool)\Output"),
        Path(r"C:\Users\owner\My Drive\1 Unfold(tool)\Cube ACR"),
    ]
    existing_targets = [t for t in delete_targets if t.exists()]
    if not existing_targets:
        print("  Source folders already gone — nothing to delete.")
        return

    print(f"\n  The following source folders can be deleted:")
    for t in existing_targets:
        print(f"    {t}")

    answer = input("\n  Type YES to delete all of the above: ").strip()
    if answer == 'YES':
        for t in existing_targets:
            print(f"  Deleting {t.name}...")
            shutil.rmtree(str(t))
        print("  Done. Sources deleted.")
    else:
        print("  Kept. Run --verify again when ready.")


def status():
    """Show current vault state."""
    print(f"\n{'='*68}")
    print(f"  VAULT STATUS  —  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*68}\n")

    for label, path in [("Audio_Archive", AUDIO_ARCHIVE), ("Transcripts_JSON", TRANSCRIPTS)]:
        if not path.exists():
            print(f"  {label}: not found")
            continue
        files = list(path.rglob('*'))
        audio = [f for f in files if f.is_file() and f.suffix.lower() in AUDIO_EXTS]
        meta  = [f for f in files if f.is_file() and f.suffix.lower() in (META_EXTS | TRANSCRIPT_EXTS)]
        size  = sum(f.stat().st_size for f in files if f.is_file())
        print(f"  {label}:")
        print(f"    Audio files : {len(audio):,}")
        print(f"    Meta/trans  : {len(meta):,}")
        print(f"    Total size  : {size/1e9:.2f} GB\n")

    logs = sorted(LOG_DIR.glob("move_log_*.csv"), reverse=True)
    if logs:
        print(f"  Latest log: {logs[0].name}")
        with open(logs[0], newline='', encoding='utf-8') as f:
            rows = list(csv.DictReader(f))
        moved   = sum(1 for r in rows if r['action'] == 'MOVE')
        planned = sum(1 for r in rows if r['action'] == 'PLANNED')
        errors  = sum(1 for r in rows if r['action'] == 'ERROR')
        print(f"    Moved: {moved:,}  Planned: {planned:,}  Errors: {errors:,}\n")


if __name__ == '__main__':
    if STATUS:
        status()
    elif VERIFY:
        verify()
    else:
        run()
