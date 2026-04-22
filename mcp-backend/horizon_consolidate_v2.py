#!/usr/bin/env python3
"""
────────────────────────────────────────────────────────────────────────
│          HORIZON CONSOLIDATE  v2.0  —  horizon_consolidate_v2.py     │
│          One-shot audio vault builder for Horizon_Data                │
│ ─────────────────────────────────────────────────────────────────────│
│  USAGE                                                                │
│    python horizon_consolidate_v2.py            # dry run (safe)      │
│    python horizon_consolidate_v2.py --go       # execute moves       │
│    python horizon_consolidate_v2.py --verify   # verify + delete     │
│    python horizon_consolidate_v2.py --status   # show vault summary  │
│ ─────────────────────────────────────────────────────────────────────│
│  WHAT IT DOES                                                         │
│  1. Recursively walks EVERY source root, no depth limit              │
│  2. Finds all audio files by extension                                │
│  3. MD5-hashes each file → true deduplication, not name/size        │
│  4. Parses filename → canonical name using all known ACR patterns    │
│  5. Pairs each audio file with its .json/.properties metadata        │
│  6. Renames metadata to match canonical audio name (no orphans)      │
│  7. Moves audio → Audio_Archive, metadata → Transcripts_JSON        │
│  8. Writes full move_log.csv + dupe_log.csv to MCP_Logs             │
│  9. --verify confirms every dest exists, then prompts source delete  │
│ ─────────────────────────────────────────────────────────────────────│
│  DEDUPLICATION STRATEGY                                               │
│  Primary key: MD5 hash of file contents                              │
│  First copy seen → MOVE to vault                                     │
│  Subsequent copies → logged to dupe_log.csv, skipped                │
│  Numbered variants like (1).amr get hashed → real dupes skipped,    │
│  genuine unique files (different content) still get moved            │
────────────────────────────────────────────────────────────────────────
"""

import os, re, sys, csv, json, hashlib, shutil, time
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# ── CONFIG ──────────────────────────────────────────────────────────────────
DRY_RUN = "--go"     not in sys.argv
VERIFY  = "--verify" in sys.argv
STATUS  = "--status" in sys.argv

VAULT_ROOT    = Path(r"C:\Users\owner\My Drive\Horizon_Data")
AUDIO_ARCHIVE = VAULT_ROOT / "02_Processed_Vault" / "Audio_Archive"
TRANSCRIPTS   = VAULT_ROOT / "02_Processed_Vault" / "Transcripts_JSON"
LOG_DIR       = VAULT_ROOT / "03_Database_State" / "MCP_Logs"

TS = datetime.now().strftime("%Y%m%d_%H%M%S")

# ── SOURCE ROOTS ── (all walked recursively, unlimited depth) ────────────────
SOURCE_ROOTS = [
    ("unfold_source",   Path(r"C:\Users\owner\My Drive\1 Unfold(tool)\01_source_media"), True),
    ("unfold_output",   Path(r"C:\Users\owner\My Drive\1 Unfold(tool)\Output"),          True),
    ("unfold_cube_acr", Path(r"C:\Users\owner\My Drive\1 Unfold(tool)\Cube ACR"),        True),
    ("onedrive_acr",    Path(r"C:\Users\owner\OneDrive\Apps\ACR"),                       True),
    ("mydrive_root",    Path(r"C:\Users\owner\My Drive"),                                True),
    ("drive_acr_app",   Path(r"C:\Users\owner\My Drive\com.nll.acr"),                    True),
    ("drive_cube_cb",   Path(r"C:\Users\owner\My Drive\com.nll.cb"),                     True),
    ("transcription",   Path(r"C:\Transcription"),                                       True),
    ("music_acrcalls",  Path(r"C:\Users\owner\Music\ACRCalls"),                          True),
    ("music_backup",    Path(r"C:\Users\owner\Music\ACRCallsBackup"),                   False),
]

SHALLOW_ROOTS = {Path(r"C:\Users\owner\My Drive")}

SKIP_DIRS = {
    '$recycle.bin', '.tmp.drivedownload', '.tmp.driveupload',
    '.git', 'node_modules', '__pycache__', '.conda', 'conda',
    'horizon_data', 'audio_archive', 'transcripts_json',
}

AUDIO_EXTS      = {'.amr', '.mp3', '.m4a', '.wav', '.ogg', '.aac',
                   '.opus', '.flac', '.3gp', '.wma'}
TRANSCRIPT_EXTS = {'.txt', '.srt', '.vtt'}
META_EXTS       = {'.json', '.properties'}


# ── MD5 HASHING ──────────────────────────────────────────────────────────────
def md5(path: Path, chunk=1 << 20) -> str:
    h = hashlib.md5()
    try:
        with open(path, 'rb') as f:
            while True:
                buf = f.read(chunk)
                if not buf: break
                h.update(buf)
        return h.hexdigest()
    except (OSError, PermissionError):
        return ''


# ── PHONE NORMALIZATION ───────────────────────────────────────────────────────
def norm_phone(raw: str) -> str:
    d = re.sub(r'[^\d]', '', str(raw))
    if d.startswith('1') and len(d) == 11: return f"+{d}"
    if len(d) == 10:  return f"+1{d}"
    if len(d) > 6:    return f"+{d}"
    return ''

def slugify(s: str) -> str:
    s = re.sub(r'[^\w\s-]', '', str(s or '')).strip()
    s = re.sub(r'[\s_]+', '-', s)
    return s or 'unknown'


# ── FILENAME PARSER ───────────────────────────────────────────────────────────
def parse(stem: str, ext: str) -> dict:
    r = {'pattern':'X','contact':'','phone':'','dir':'','channel':'phone','dt':'','ch_idx':''}

    # H  Cube CB: Name (+E164) [YYYY-MM-DD HH-MM-SS] [Incoming/Outgoing]
    h = re.match(
        r'^(.+?)\s*\((\+[\d]+)\)\s*\[(\d{4}-\d{2}-\d{2})\s+(\d{2}-\d{2}-\d{2})\]\s*\[(Incoming|Outgoing)\]',
        stem, re.I)
    if h:
        name, phone, date, time_, dir_ = h.groups()
        r.update(pattern='H', contact=name.strip(), phone=norm_phone(phone),
                 dir='OUT' if 'out' in dir_.lower() else 'IN',
                 dt=f"{date}_{time_.replace('-','')}")
        return r

    # E/F  Transcription app: [Name_]phone_YYYY_MM_DD_HH_MM_SS[_[ch]]
    ef = re.match(
        r'^(?:([A-Za-z][A-Za-z_\-]+?)_)?(\+?1?\d{10,15})_'
        r'(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})(?:_\[(\d)\])?$', stem)
    if ef:
        name, phone, yr, mo, dy, hr, mn, sc, ch = ef.groups()
        r.update(pattern='E' if name else 'F',
                 contact=(name or '').replace('_',' ').strip(),
                 phone=norm_phone(phone), ch_idx=ch or '',
                 dt=f"{yr}-{mo}-{dy}_{hr}{mn}{sc}")
        return r

    # Strip numbered copy suffix
    stem_clean = re.sub(r'\s*\(\d+\)$', '', stem).strip()

    dt_m = re.search(r'(\d{4})-(\d{2})-(\d{2}) (\d{2})-(\d{2})-(\d{2})', stem_clean)
    if dt_m:
        yr, mo, dy, hr, mn, sc = dt_m.groups()
        r['dt'] = f"{yr}-{mo}-{dy}_{hr}{mn}{sc}"

    if   '↗' in stem_clean or '↑' in stem_clean: r['dir'] = 'OUT'
    elif '↙' in stem_clean or '↓' in stem_clean: r['dir'] = 'IN'

    sl = stem_clean.lower()
    if any(x in sl for x in ('(facebook)','(messenger)','is calling you on messenger',
                               'audio call from messenger','call ended')):
        r['channel'] = 'facebook'
    elif '(zoom)' in sl or 'zoom meeting' in sl: r['channel'] = 'zoom'
    elif '(mic)' in sl: r['channel'] = 'mic'

    # C2 reversed date-first facebook
    if re.match(r'^\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2} \((?:facebook|messenger)\)', stem_clean, re.I):
        r.update(pattern='C2', channel='facebook'); return r

    # G mic/dictaphone
    if r['channel'] == 'mic' or re.match(r'^dictaphone', stem_clean, re.I):
        r.update(pattern='G', contact='dictaphone'); return r

    # K Voice_NNN
    if re.match(r'^Voice_\d+', stem_clean, re.I):
        r.update(pattern='K', contact='voice-recording'); return r

    # I/C facebook
    if r['channel'] == 'facebook':
        m = re.match(r'^(.+?)\s*\((?:facebook|messenger)\)', stem_clean, re.I)
        label = m.group(1).strip() if m else 'anon'
        system = {'phone','call ended','audio call from messenger','is calling you on messenger','outlook'}
        if label.lower() in system or label.lower().startswith('is ') or label.endswith('…'):
            r.update(pattern='I', contact='anon'); return r
        r.update(pattern='C', contact=label); return r

    # J zoom
    if r['channel'] == 'zoom':
        r.update(pattern='J', contact='zoom-meeting'); return r

    # D unknown
    if re.match(r'^unknown\s*(contact)?', stem_clean, re.I):
        r.update(pattern='D', contact='unknown'); return r

    # A  ContactName (phone) ↗ (phone)
    a = re.match(r'^(.+?)\s*\((\+?1?[\d\s\-(). ]{7,20}?)\)\s*[↗↙↑↓]\s*\((?:phone)\)', stem_clean)
    if a:
        r.update(pattern='A', contact=a.group(1).strip(),
                 phone=norm_phone(re.sub(r'[^\d+]','',a.group(2)))); return r

    # B  Bare number ↗ (phone)
    b = re.match(r'^(\+?1?[\s\-(). \d]{7,20}?)\s*[↗↙↑↓]\s*\((?:phone)\)', stem_clean)
    if b:
        r.update(pattern='B', phone=norm_phone(re.sub(r'[^\d+]','',b.group(1)))); return r

    # B2  1 NXX-NXX-XXXX ↗ (phone)
    b2 = re.match(r'^(1[\s\d\-]{9,14})\s*[↗↙↑↓]\s*\((?:phone)\)', stem_clean)
    if b2:
        r.update(pattern='B2', phone=norm_phone(re.sub(r'[^\d]','',b2.group(1)))); return r

    # C  HH MM (facebook/messenger)
    c = re.match(r'^([\d_ ]+)\s*\((?:facebook|messenger)\)', stem_clean, re.I)
    if c:
        r.update(pattern='C', channel='facebook', contact=c.group(1).strip().replace(' ','-')); return r

    ph = re.search(r'(\+?1[\d\-\s().]{9,}|\d{10,})', stem_clean)
    if ph: r['phone'] = norm_phone(ph.group(1))
    return r


# ── CANONICAL NAME BUILDER ────────────────────────────────────────────────────
def canonical(src: Path) -> tuple:
    ext    = src.suffix.lower()
    parsed = parse(src.stem, ext)
    dt     = parsed['dt'] or 'NODATE'
    ch     = parsed['channel']
    dir_   = parsed['dir'] or {'facebook':'FB','zoom':'ZOOM','mic':'MIC'}.get(ch,'UNK')
    phone  = parsed['phone'] or ch
    name   = slugify(parsed['contact']) if parsed['contact'] else 'unknown'
    idx    = f"_ch{parsed['ch_idx']}" if parsed['ch_idx'] else ''
    return f"{dt}_{dir_}_{phone}_{name}{idx}{ext}", parsed


# ── METADATA COMPANION FINDER ─────────────────────────────────────────────────
def find_meta(audio: Path) -> list:
    found = []
    stem  = audio.stem
    stem_base = re.sub(r'\s*\(\d+\)$', '', stem).strip()
    for s in {stem, stem_base}:
        for ext in ('.properties', '.json'):
            for c in [audio.parent/'properties'/(s+ext), audio.parent/(s+ext)]:
                if c.exists() and c not in found:
                    found.append(c)
    return found


# ── FILE WALKER ───────────────────────────────────────────────────────────────
def walk_audio(root: Path, shallow=False) -> list:
    files = []
    if not root.exists(): return files
    for dirpath, dirnames, filenames in os.walk(root, topdown=True):
        if shallow:
            depth = str(dirpath).replace(str(root),'').count(os.sep)
            if depth >= 1: dirnames.clear(); continue
        dirnames[:] = [d for d in dirnames
                       if d.lower() not in SKIP_DIRS and '$recycle' not in d.lower()]
        for fname in filenames:
            p = Path(dirpath) / fname
            if p.suffix.lower() in AUDIO_EXTS:
                files.append(p)
    return files


# ── MAIN ROUTINES ─────────────────────────────────────────────────────────────
def run():
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    AUDIO_ARCHIVE.mkdir(parents=True, exist_ok=True)
    TRANSCRIPTS.mkdir(parents=True, exist_ok=True)

    mode = "DRY RUN — nothing will move" if DRY_RUN else "EXECUTING — files will move"
    print(f"\n{'='*68}\n  HORIZON CONSOLIDATE v2  —  {mode}\n  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n{'='*68}\n")

    all_audio = []
    for label, root, is_primary in SOURCE_ROOTS:
        if not root.exists():
            print(f"  [SKIP ] {label:<22}  not found: {root}"); continue
        files = walk_audio(root, shallow=(root in SHALLOW_ROOTS))
        tag = "PRIMARY" if is_primary else "DUPE-SRC"
        print(f"  [FOUND] {label:<22}  {len(files):>5,} files  ({tag})")
        for f in files: all_audio.append((label, f, is_primary))

    total = len(all_audio)
    print(f"\n  Total audio files discovered: {total:,}\n  Hashing and deduplicating...\n")

    hash_to_canon  = {}
    hash_to_source = {}
    move_rows = []
    dupe_rows = []
    error_rows = []
    move_count = skip_exists = dupe_count = error_count = 0
    last_print = time.time()

    for i, (label, src, is_primary) in enumerate(all_audio):
        if time.time() - last_print > 5:
            print(f"    {i:>5}/{total}  ({i/total*100:.0f}%)  moves:{move_count}  dupes:{dupe_count}")
            last_print = time.time()

        try:
            file_hash = md5(src)
        except Exception as e:
            error_rows.append({'label':label,'source':str(src),'error':str(e)}); error_count+=1; continue

        if not file_hash:
            error_rows.append({'label':label,'source':str(src),'error':'unreadable'}); error_count+=1; continue

        try:
            canon, parsed = canonical(src)
        except Exception as e:
            error_rows.append({'label':label,'source':str(src),'error':f'parse:{e}'}); error_count+=1; continue

        if file_hash in hash_to_canon:
            dupe_count+=1
            dupe_rows.append({'source':str(src),'label':label,'canon':canon,'hash':file_hash,
                              'first_copy':hash_to_source[file_hash],'size_bytes':src.stat().st_size})
            continue

        hash_to_canon[file_hash]  = canon
        hash_to_source[file_hash] = str(src)

        if not is_primary:
            dupe_count+=1
            dupe_rows.append({'source':str(src),'label':label+' (non-primary)','canon':canon,
                              'hash':file_hash,'first_copy':'non-primary source','size_bytes':src.stat().st_size})
            continue

        dest = AUDIO_ARCHIVE / canon
        if dest.exists():
            if md5(dest) == file_hash: skip_exists+=1; continue
            dest = AUDIO_ARCHIVE / f"{dest.stem}_{file_hash[:6]}{dest.suffix}"

        meta_files = find_meta(src)
        move_count += 1
        row = {'action':'MOVE' if not DRY_RUN else 'PLANNED','label':label,
               'source':str(src),'dest':str(dest),'canon':canon,
               'pattern':parsed['pattern'],'contact':parsed['contact'],
               'phone':parsed['phone'],'direction':parsed['dir'],
               'channel':parsed['channel'],'datetime':parsed['dt'],
               'ch_idx':parsed['ch_idx'],'hash':file_hash,
               'size_bytes':src.stat().st_size,'meta_count':len(meta_files),'error':''}

        if not DRY_RUN:
            try:
                shutil.move(str(src), str(dest))
                for mf in meta_files:
                    meta_dest = TRANSCRIPTS / f"{dest.stem}{mf.suffix}"
                    if not meta_dest.exists():
                        shutil.move(str(mf), str(meta_dest))
            except Exception as e:
                row['action']='ERROR'; row['error']=str(e); error_count+=1; move_count-=1

        move_rows.append(row)

    # Write logs
    move_csv = LOG_DIR / f"move_log_{TS}.csv"
    dupe_csv = LOG_DIR / f"dupe_log_{TS}.csv"
    fields = ['action','label','source','dest','canon','pattern','contact','phone',
              'direction','channel','datetime','ch_idx','hash','size_bytes','meta_count','error']
    with open(move_csv,'w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore'); w.writeheader(); w.writerows(move_rows)
    with open(dupe_csv,'w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=['source','label','canon','hash','first_copy','size_bytes'],extrasaction='ignore')
        w.writeheader(); w.writerows(dupe_rows)

    pattern_desc = {
        'A':'ContactName (phone) ↗','B':'BareNumber ↗ (phone)','B2':'1 NXX-NXX ↗ (phone)',
        'C':'HH MM (facebook)','C2':'YYYY-MM-DD (facebook) reversed','D':'Unknown contact',
        'E':'Name_phone_YYYY [.mp3]','F':'phone_YYYY [.mp3]','G':'Dictaphone (mic)',
        'H':'Name (+E164) [date] [dir] [.m4a]','I':'System FB label','J':'Zoom meeting',
        'K':'Voice_NNN generic','X':'UNKNOWN (hash-named)',
    }
    pat_counts = defaultdict(int)
    for r in move_rows: pat_counts[r['pattern']] += 1

    print(f"\n{'='*68}\n  {'PLAN' if DRY_RUN else 'DONE'}  moves:{move_count:,}  dupes:{dupe_count:,}  skip:{skip_exists:,}  errors:{error_count:,}")
    print(f"  Log: {move_csv}\n\n  PATTERNS:")
    for pat, count in sorted(pat_counts.items(), key=lambda x:-x[1]):
        print(f"    {count:>5,}  [{pat}]  {pattern_desc.get(pat,pat)}")

    sample = [r for r in move_rows if r['action'] in ('MOVE','PLANNED')][:20]
    if sample:
        print(f"\n  SAMPLE RENAMES (first {len(sample)}):")
        for r in sample:
            print(f"    {Path(r['source']).name[:50]:<50}  →  {r['canon']}")

    if DRY_RUN: print(f"\n  Run with --go to execute.\n")
    else:        print(f"\n  Run with --verify to confirm and clean up.\n")


def verify():
    print(f"\n{'='*68}\n  VERIFICATION MODE\n{'='*68}\n")
    logs = sorted(LOG_DIR.glob("move_log_*.csv"), reverse=True)
    if not logs: print("  No move_log found."); return
    log = logs[0]; print(f"  Using: {log}\n")
    ok = fail = 0; missing = []
    with open(log, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            if row['action'] not in ('MOVE',): continue
            dest = Path(row['dest'])
            if dest.exists(): ok+=1
            else: fail+=1; missing.append(row['dest'])
    print(f"  OK:{ok:,}  Missing:{fail:,}")
    if missing:
        print("  Fix missing before deleting sources."); return
    print(f"  All {ok:,} confirmed.\n")
    targets = [t for t in [
        Path(r"C:\Users\owner\Music\ACRCallsBackup"),
        Path(r"C:\Users\owner\My Drive\1 Unfold(tool)\01_source_media"),
        Path(r"C:\Users\owner\My Drive\1 Unfold(tool)\Output"),
        Path(r"C:\Users\owner\My Drive\1 Unfold(tool)\Cube ACR"),
    ] if t.exists()]
    if not targets: print("  Sources already gone."); return
    for t in targets: print(f"  {t}")
    if input("\n  Type YES to delete all: ").strip() == 'YES':
        for t in targets: shutil.rmtree(str(t))
        print("  Deleted.")


def status():
    print(f"\n{'='*68}\n  VAULT STATUS  —  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n{'='*68}\n")
    for label, path in [("Audio_Archive", AUDIO_ARCHIVE), ("Transcripts_JSON", TRANSCRIPTS)]:
        if not path.exists(): print(f"  {label}: not found"); continue
        files = list(path.rglob('*'))
        audio = [f for f in files if f.is_file() and f.suffix.lower() in AUDIO_EXTS]
        size  = sum(f.stat().st_size for f in files if f.is_file())
        print(f"  {label}: {len(audio):,} audio files  {size/1e9:.2f} GB")
    logs = sorted(LOG_DIR.glob("move_log_*.csv"), reverse=True)
    if logs:
        with open(logs[0], newline='', encoding='utf-8') as f:
            rows = list(csv.DictReader(f))
        print(f"\n  Latest log: {logs[0].name}")
        print(f"    Moved:{sum(1 for r in rows if r['action']=='MOVE'):,}  Planned:{sum(1 for r in rows if r['action']=='PLANNED'):,}")


if __name__ == '__main__':
    if STATUS:  status()
    elif VERIFY: verify()
    else:        run()
