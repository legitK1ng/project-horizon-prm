#!/usr/bin/env python3
"""
ACR Audio File Scanner & Pattern Analyzer
==========================================
Scans specified drives/folders for ALL audio files using MIME type detection
(not just extension), maps folder structure, extracts naming patterns, and
exports a full inventory CSV + pattern report.

Run: python acr_scanner.py
"""

import os
import csv
import json
import re
import hashlib
import mimetypes
import struct
from pathlib import Path
from collections import defaultdict, Counter
from datetime import datetime
import sys

# ─── CONFIG ───────────────────────────────────────────────────────────────────
SCAN_ROOTS = [
    "C:\\",
    "G:\\",
]

# Directories to skip entirely (saves time)
SKIP_DIRS = {
    "Windows", "Program Files", "Program Files (x86)",
    "$Recycle.Bin", "System Volume Information",
    "AppData\\Local\\Temp", "node_modules", ".git",
    "AppData\\Local\\Microsoft", "AppData\\Roaming\\Microsoft",
}

OUTPUT_DIR = Path.home() / "ACR_Audit"
OUTPUT_DIR.mkdir(exist_ok=True)

TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")
CSV_OUT   = OUTPUT_DIR / f"acr_audio_inventory_{TIMESTAMP}.csv"
JSON_OUT  = OUTPUT_DIR / f"acr_pattern_report_{TIMESTAMP}.json"
LOG_OUT   = OUTPUT_DIR / f"acr_scan_log_{TIMESTAMP}.txt"

# ─── AUDIO MAGIC BYTES (MIME detection without python-magic) ─────────────────
AUDIO_SIGNATURES = [
    # (offset, bytes, mime_type, description)
    (0,  b'ID3',                          'audio/mpeg',       'MP3 (ID3 tag)'),
    (0,  b'\xff\xfb',                     'audio/mpeg',       'MP3'),
    (0,  b'\xff\xf3',                     'audio/mpeg',       'MP3'),
    (0,  b'\xff\xf2',                     'audio/mpeg',       'MP3'),
    (0,  b'fLaC',                         'audio/flac',       'FLAC'),
    (0,  b'OggS',                         'audio/ogg',        'OGG'),
    (0,  b'RIFF',                         'audio/wav',        'WAV (check sub)'),
    (0,  b'FORM',                         'audio/aiff',       'AIFF'),
    (0,  b'\x1aE\xdf\xa3',               'audio/webm',       'WebM/MKV'),
    (4,  b'ftyp',                         'audio/mp4',        'MP4/M4A/AAC container'),
    (0,  b'#!AMR',                        'audio/amr',        'AMR'),
    (0,  b'IMDI',                         'audio/amr',        'AMR (variant)'),
    (0,  b'\x06\xe6\x00\x00',            'audio/amr',        'AMR (NB)'),
    (0,  b'3gp5',                         'audio/3gpp',       '3GPP'),
    (0,  b'\x00\x00\x00 ftyp3gp',        'audio/3gpp',       '3GPP'),
    (0,  b'.snd',                         'audio/basic',      'AU/SND'),
    (0,  b'dss ',                         'audio/dss',        'DSS (Olympus)'),
    (0,  b'ds2 ',                         'audio/ds2',        'DS2 (Olympus)'),
    (0,  b'\x00\x00\x01\xba',           'audio/mpeg',        'MPEG stream'),
]

AUDIO_EXTENSIONS = {
    '.mp3', '.m4a', '.m4b', '.aac', '.ogg', '.oga', '.opus',
    '.wav', '.wave', '.flac', '.wma', '.amr', '.3gp', '.3gpp',
    '.mp4', '.m4p', '.mp2', '.mpga', '.aiff', '.aif', '.au',
    '.ra', '.ram', '.mid', '.midi', '.dss', '.ds2', '.gsm',
    '.webm', '.caf', '.ape', '.wv', '.mka', '.spx', '.tta',
}

def detect_audio_mime(path: Path) -> tuple[str, str]:
    """Returns (mime_type, method) — method is 'magic', 'extension', or 'wav_sub'"""
    try:
        with open(path, 'rb') as f:
            header = f.read(16)
        
        for offset, sig, mime, desc in AUDIO_SIGNATURES:
            chunk = header[offset:offset+len(sig)]
            if chunk == sig:
                # Special case: WAV — check sub-type
                if mime == 'audio/wav' and len(header) >= 12:
                    sub = header[8:12]
                    if sub == b'WAVE':
                        return 'audio/wav', 'magic'
                    elif sub == b'AVI ':
                        return 'video/avi', 'magic'
                    else:
                        return 'audio/riff-unknown', 'magic'
                # MP4 container — distinguish M4A vs video
                if mime == 'audio/mp4':
                    ext = path.suffix.lower()
                    if ext in ('.m4a', '.m4b', '.m4p', '.aac'):
                        return 'audio/mp4', 'magic+ext'
                    elif ext in ('.mp4', '.mov'):
                        return 'video/mp4', 'magic+ext'
                    else:
                        return 'audio/mp4', 'magic'  # assume audio if unknown
                return mime, 'magic'
        
        # Fallback to extension
        ext = path.suffix.lower()
        if ext in AUDIO_EXTENSIONS:
            mime_guess, _ = mimetypes.guess_type(str(path))
            return mime_guess or f'audio/x-{ext.lstrip(".")}', 'extension'
        
        return '', ''
    
    except (IOError, OSError, struct.error):
        return '', 'error'

def should_skip(dirpath: str) -> bool:
    for skip in SKIP_DIRS:
        if skip.lower() in dirpath.lower():
            return True
    return False

def file_size_human(size_bytes: int) -> str:
    for unit in ['B','KB','MB','GB']:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"

def extract_date_from_name(name: str) -> str:
    """Try to find any date pattern in a filename."""
    patterns = [
        r'(\d{4})[-_](\d{2})[-_](\d{2})',          # 2023-04-15
        r'(\d{2})[-_](\d{2})[-_](\d{4})',          # 04-15-2023
        r'(\d{8})',                                  # 20230415
        r'(\d{4})(\d{2})(\d{2})_(\d{6})',          # 20230415_143022
        r'(\d{13})',                                 # unix ms timestamp
    ]
    for p in patterns:
        m = re.search(p, name)
        if m:
            return m.group(0)
    return ''

def extract_phone_from_name(name: str) -> str:
    patterns = [
        r'\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
        r'\+\d{7,15}',
        r'\d{10,15}',
    ]
    for p in patterns:
        m = re.search(p, name)
        if m:
            return m.group(0)
    return ''

def classify_name_pattern(name: str) -> str:
    """Rough pattern classifier for ACR filenames."""
    stem = Path(name).stem
    
    if re.match(r'^Call_\d{4}-\d{2}-\d{2}', stem):
        return 'ACR_Call_YYYY-MM-DD'
    if re.match(r'^\d{4}-\d{2}-\d{2}_\d{6}', stem):
        return 'YYYY-MM-DD_HHMMSS'
    if re.match(r'^\d{8}_\d{6}', stem):
        return 'YYYYMMDD_HHMMSS'
    if re.match(r'^record_\d+', stem, re.I):
        return 'record_N'
    if re.match(r'^call_record', stem, re.I):
        return 'call_record_*'
    if re.search(r'\+\d{7,}', stem):
        return 'contains_E164_phone'
    if re.search(r'\d{10,}', stem):
        return 'contains_long_number'
    if re.search(r'\d{4}-\d{2}-\d{2}', stem):
        return 'contains_ISO_date'
    if re.search(r'\d{13}', stem):
        return 'unix_ms_timestamp'
    if re.match(r'^[A-Z][a-z]+ [A-Z][a-z]+', stem):
        return 'ContactName_*'
    if re.search(r'unknown|private|hidden|blocked', stem, re.I):
        return 'unknown_caller'
    if re.search(r'incoming|outgoing|missed', stem, re.I):
        return 'direction_labeled'
    return 'OTHER'

# ─── MAIN SCAN ────────────────────────────────────────────────────────────────
def scan():
    print(f"\n{'='*60}")
    print("  ACR AUDIO SCANNER — starting up")
    print(f"{'='*60}")
    print(f"  Output folder: {OUTPUT_DIR}")
    print(f"  Scanning: {', '.join(SCAN_ROOTS)}")
    print(f"{'='*60}\n")

    records = []
    errors  = []
    folder_depths = []
    scanned_dirs  = 0
    skipped_dirs  = 0

    pattern_counter  = Counter()
    ext_counter      = Counter()
    mime_counter     = Counter()
    folder_counter   = Counter()
    date_found       = 0
    phone_found      = 0
    has_json_sibling = 0
    has_html_sibling = 0

    with open(LOG_OUT, 'w', encoding='utf-8') as log:
        log.write(f"Scan started: {datetime.now()}\n")

        for root_str in SCAN_ROOTS:
            root = Path(root_str)
            if not root.exists():
                msg = f"[SKIP] Root not found: {root_str}"
                print(msg); log.write(msg + "\n")
                continue

            print(f"[SCAN] Entering {root_str} ...")
            log.write(f"Scanning root: {root_str}\n")

            for dirpath, dirnames, filenames in os.walk(root_str, topdown=True):
                # Prune skip dirs in-place
                dirnames[:] = [
                    d for d in dirnames
                    if not should_skip(os.path.join(dirpath, d))
                ]

                scanned_dirs += 1
                if scanned_dirs % 500 == 0:
                    print(f"  ... {scanned_dirs} dirs scanned, {len(records)} audio files found so far")

                depth = dirpath.replace(root_str, '').count(os.sep)
                folder_depths.append(depth)
                
                # Collect sibling filenames for context
                sibling_set = set(f.lower() for f in filenames)
                local_json = any(f.endswith('.json') for f in filenames)
                local_html = any(f.endswith('.html') or f.endswith('.htm') for f in filenames)

                for fname in filenames:
                    fpath = Path(dirpath) / fname
                    ext   = fpath.suffix.lower()

                    # Quick pre-filter: skip obviously non-audio by extension
                    # but still attempt magic on unknown extensions
                    is_known_audio_ext = ext in AUDIO_EXTENSIONS

                    mime, method = detect_audio_mime(fpath)
                    
                    if not mime.startswith('audio/'):
                        continue  # not audio

                    # We have an audio file!
                    try:
                        stat     = fpath.stat()
                        size_b   = stat.st_size
                        mtime    = datetime.fromtimestamp(stat.st_mtime).isoformat()
                        ctime    = datetime.fromtimestamp(stat.st_ctime).isoformat()
                    except OSError:
                        size_b, mtime, ctime = 0, '', ''
                        errors.append(str(fpath))

                    date_str  = extract_date_from_name(fname)
                    phone_str = extract_phone_from_name(fname)
                    pattern   = classify_name_pattern(fname)

                    if date_str:  date_found += 1
                    if phone_str: phone_found += 1
                    if local_json: has_json_sibling += 1
                    if local_html: has_html_sibling += 1

                    pattern_counter[pattern] += 1
                    ext_counter[ext or '(no ext)'] += 1
                    mime_counter[mime] += 1
                    folder_counter[dirpath] += 1

                    records.append({
                        'filepath':      str(fpath),
                        'filename':      fname,
                        'stem':          fpath.stem,
                        'extension':     ext,
                        'mime_type':     mime,
                        'mime_method':   method,
                        'size_bytes':    size_b,
                        'size_human':    file_size_human(size_b),
                        'mtime':         mtime,
                        'ctime':         ctime,
                        'folder_depth':  depth,
                        'folder_path':   dirpath,
                        'date_in_name':  date_str,
                        'phone_in_name': phone_str,
                        'name_pattern':  pattern,
                        'json_sibling':  local_json,
                        'html_sibling':  local_html,
                    })

    # ─── WRITE CSV ────────────────────────────────────────────────────────────
    if records:
        fieldnames = list(records[0].keys())
        with open(CSV_OUT, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(records)
        print(f"\n✓ CSV written: {CSV_OUT}")
    else:
        print("\n⚠  No audio files found.")

    # ─── WRITE JSON PATTERN REPORT ────────────────────────────────────────────
    total_bytes = sum(r['size_bytes'] for r in records)
    report = {
        'scan_timestamp': TIMESTAMP,
        'scan_roots': SCAN_ROOTS,
        'summary': {
            'total_audio_files':    len(records),
            'total_size_bytes':     total_bytes,
            'total_size_human':     file_size_human(total_bytes),
            'dirs_scanned':         scanned_dirs,
            'files_with_date':      date_found,
            'files_with_phone':     phone_found,
            'files_with_json_sibling': has_json_sibling,
            'files_with_html_sibling': has_html_sibling,
            'max_folder_depth':     max(folder_depths) if folder_depths else 0,
            'avg_folder_depth':     round(sum(folder_depths)/len(folder_depths), 1) if folder_depths else 0,
        },
        'by_mime_type':     dict(mime_counter.most_common()),
        'by_extension':     dict(ext_counter.most_common()),
        'by_name_pattern':  dict(pattern_counter.most_common()),
        'top_20_folders_by_count': dict(folder_counter.most_common(20)),
        'errors':           errors[:50],  # cap at 50
    }

    with open(JSON_OUT, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)
    print(f"✓ Pattern report written: {JSON_OUT}")

    # ─── PRINT SUMMARY ────────────────────────────────────────────────────────
    s = report['summary']
    print(f"""
{'='*60}
  SCAN COMPLETE
{'='*60}
  Audio files found : {s['total_audio_files']:,}
  Total size        : {s['total_size_human']}
  Dirs scanned      : {s['dirs_scanned']:,}
  Max nesting depth : {s['max_folder_depth']}
  Files with date   : {s['files_with_date']:,}
  Files with phone  : {s['files_with_phone']:,}
  Files near JSON   : {s['files_with_json_sibling']:,}
  Files near HTML   : {s['files_with_html_sibling']:,}
{'='*60}

  MIME TYPES FOUND:""")
    for m, c in mime_counter.most_common():
        print(f"    {c:>6,}  {m}")

    print(f"\n  NAME PATTERNS FOUND:")
    for p, c in pattern_counter.most_common():
        print(f"    {c:>6,}  {p}")

    print(f"\n  Output folder: {OUTPUT_DIR}")
    print(f"  Upload the JSON file back to Claude for phase 2.\n")

if __name__ == '__main__':
    scan()