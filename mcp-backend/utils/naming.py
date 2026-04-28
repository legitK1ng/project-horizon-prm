import re
import os
from datetime import datetime, timezone
from typing import Optional, Dict, Any

# ── Configuration ─────────────────────────────────────────────────────────────

AUDIO_EXTS = {
    '.amr', '.mp3', '.m4a', '.wav', '.ogg', '.flac',
    '.aac', '.3gp', '.avi', '.wma', '.opus'
}

SYSTEM_FB_LABELS = {
    'phone', 'call ended', 'audio call from messenger',
    'is calling you on messenger', 'is calling you on messenger…',
    'outlook', 'unknown contact', 'unknown',
}

# ── Utilities ─────────────────────────────────────────────────────────────────

def normalize_phone(raw: str) -> str:
    """Normalize phone number to E.164 format (+1XXXXXXXXXX)."""
    if not raw:
        return ""
    d = re.sub(r'[^\d]', '', raw)
    if d.startswith('1') and len(d) == 11:
        return f"+{d}"
    if len(d) == 10:
        return f"+1{d}"
    if len(d) > 6:
        return f"+{d}"
    return ""

def slugify_name(s: str) -> str:
    """Convert name to URL-safe filename slug."""
    if not s:
        return "unknown"
    # Strip non-ASCII
    s = s.encode('ascii', 'ignore').decode('ascii')
    # Strip special chars
    s = re.sub(r'[^\w\s\-]', '', s)
    # Spaces/underscores to hyphens
    s = re.sub(r'[\s_]+', '-', s.strip())
    # Collapse double hyphens
    s = re.sub(r'-{2,}', '-', s)
    return s.lower() or "unknown"

def get_extension(filename: str) -> str:
    """Get true file extension, handling copy suffixes like ' (1)'."""
    m = re.search(r'(\.[a-zA-Z0-9]+)(\s*\(\d+\))?$', filename)
    if not m:
        return ""
    ext = m.group(1).lower()
    return ext if (ext in AUDIO_EXTS or ext in {'.json', '.properties'}) else ""

# ── Datetime Extractors ───────────────────────────────────────────────────────

def dt_tail(stem: str) -> str:
    """Patterns A/B/C/D/G/I/J/K: YYYY-MM-DD HH-MM-SS at end."""
    m = re.search(r'(\d{4})-(\d{2})-(\d{2}) (\d{2})-(\d{2})-(\d{2})$', stem)
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}_{m.group(4)}{m.group(5)}{m.group(6)}" if m else ""

def dt_head(stem: str) -> str:
    """Patterns C2/Z: YYYY-MM-DD HH-MM-SS at start."""
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2}) (\d{2})-(\d{2})-(\d{2})', stem)
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}_{m.group(4)}{m.group(5)}{m.group(6)}" if m else ""

def dt_underscores(stem: str) -> str:
    """Patterns E/F: YYYY_MM_DD_HH_MM_SS."""
    m = re.search(r'(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})', stem)
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}_{m.group(4)}{m.group(5)}{m.group(6)}" if m else ""

def dt_brackets(stem: str) -> str:
    """Pattern H: [YYYY-MM-DD HH-MM-SS]."""
    m = re.search(r'\[(\d{4}-\d{2}-\d{2})\s+(\d{2}-\d{2}-\d{2})\]', stem)
    if not m:
        return ""
    yr_mo_dy = m.group(1)
    hr_mn_sc = m.group(2).replace('-', '')
    return f"{yr_mo_dy}_{hr_mn_sc}"

def dt_from_unix_ms(ms_str: str) -> str:
    """Pattern T: Unix ms timestamp."""
    try:
        dt = datetime.fromtimestamp(int(ms_str) / 1000.0, tz=timezone.utc)
        return dt.strftime("%Y-%m-%d_%H%M%S")
    except:
        return "NODATE"

# ── Core Parser ───────────────────────────────────────────────────────────────

def parse_filename(filename: str, file_creation_time: Optional[datetime] = None) -> Dict[str, Any]:
    """
    Parse an ACR filename into structured metadata.
    Ported from horizon_consolidate_final.gs
    """
    ext = get_extension(filename)
    stem = filename
    if ext:
        stem = stem[:stem.lower().rfind(ext)]
    # Strip copy suffix
    stem = re.sub(r'\s*\(\d+\)$', '', stem).strip()

    res = {
        "pattern": "X",
        "contact": "",
        "phone": "",
        "direction": "",
        "channel": "phone",
        "datetime": "",
        "channel_idx": ""
    }

    # 1. Pattern T: Unix timestamp
    t = re.match(r'^(\+?1?\d{10,15})-(\d+)-(\d{13,})$', stem)
    if t:
        res.update({
            "pattern": "T",
            "phone": normalize_phone(t.group(1)),
            "datetime": dt_from_unix_ms(t.group(3))
        })
        return res

    # 2. Pattern H: Cube bracket format
    h = re.match(r'^(.+?)\s*\((\+[\d]+)\)\s*\[(\d{4}-\d{2}-\d{2})\s+(\d{2}-\d{2}-\d{2})\]\s*\[(Incoming|Outgoing)\]', stem, re.I)
    if h:
        contact_raw = h.group(1).strip()
        is_uuid = len(contact_raw) >= 20 and all(c in '0123456789abcdef-' for c in contact_raw.lower())
        res.update({
            "pattern": "H",
            "contact": "fb-cube" if is_uuid else contact_raw,
            "phone": normalize_phone(h.group(2)),
            "direction": "OUT" if h.group(5).lower() == "outgoing" else "IN",
            "channel": "facebook" if is_uuid else "phone",
            "datetime": f"{h.group(3)}_{h.group(4).replace('-', '')}"
        })
        return res

    # 3. Pattern E/F: Underscore format
    ef = re.match(r'^(?:([A-Za-z][A-Za-z_\-]+?)_)?(\+?1?\d{10,15})_(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})(?:_\[(\d)\])?$', stem)
    if ef:
        is_unk = (ef.group(1) or "").lower() == "unknown"
        res.update({
            "pattern": "D" if is_unk else ("E" if ef.group(1) else "F"),
            "contact": "unknown" if is_unk else (ef.group(1) or "").replace('_', ' ').strip(),
            "phone": normalize_phone(ef.group(2)),
            "channel_idx": ef.group(9) or "",
            "datetime": f"{ef.group(3)}-{ef.group(4)}-{ef.group(5)}_{ef.group(6)}{ef.group(7)}{ef.group(8)}"
        })
        return res

    # 4. Pattern Z: 2021 date-FIRST
    z = re.match(r'^(\d{4}-\d{2}-\d{2} \d{2}-\d{2})-(\d{2})\s*\((phone|facebook|messenger|zoom|mic)\)\s*(.*)?$', stem, re.I)
    # Note: re-adjusting regex for date-first to match gs logic
    z_full = re.match(r'^(\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2})\s*\((phone|facebook|messenger|zoom|mic)\)\s*(.*)?$', stem, re.I)
    if z_full:
        dt = dt_head(stem)
        ch_raw = z_full.group(2).lower()
        channel = "facebook" if ch_raw == "messenger" else ch_raw
        rest = (z_full.group(3) or "").strip()
        contact, phone, direction = "", "", ""
        
        if channel == "phone":
            za = re.match(r'^(.+?)\s*\((\+?1?[\d\s\-(). ]{7,20}?)\)\s*[↗↙↑↓]', rest)
            if za:
                contact = za.group(1).strip()
                phone = normalize_phone(re.sub(r'[^\d+]', '', za.group(2)))
            else:
                zb = re.match(r'^(\+?1?[\d\s\-(). ]{7,20}?)\s*[↗↙↑↓]', rest)
                if zb:
                    phone = normalize_phone(re.sub(r'[^\d+]', '', zb.group(1)))
            direction = "OUT" if any(a in rest for a in "↗↑") else ("IN" if any(a in rest for a in "↙↓") else "")
        else:
            contact = re.sub(r'\s*[↗↙↑↓].*$', '', rest).strip() or "anon"
            
        res.update({
            "pattern": "Z", "contact": contact, "phone": phone, 
            "direction": direction, "channel": channel, "datetime": dt
        })
        return res

    # 5. Pattern C2: 2022 reversed Facebook
    if re.match(r'^\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2}\s*\((facebook|messenger)\)', stem, re.I):
        res.update({
            "pattern": "C2", "channel": "facebook", "contact": "anon", "datetime": dt_head(stem)
        })
        return res

    # Fallback/General Patterns (Date at end)
    sl = stem.lower()
    if any(k in sl for k in ["facebook", "messenger", "is calling you on messenger", "audio call from messenger"]):
        res["channel"] = "facebook"
    elif "(zoom)" in sl or "zoom meeting" in sl:
        res["channel"] = "zoom"
    elif "(mic)" in sl:
        res["channel"] = "mic"

    if any(a in stem for a in "↗↑"): res["direction"] = "OUT"
    elif any(a in stem for a in "↙↓"): res["direction"] = "IN"

    dt = dt_tail(stem)

    # Pattern G: Mic
    if res["channel"] == "mic" or sl.startswith("dictaphone"):
        res.update({"pattern": "G", "contact": "dictaphone", "datetime": dt})
        return res

    # Pattern K: Voice_NNN
    if re.match(r'^Voice_\d+', stem, re.I):
        dt_file = file_creation_time.strftime("%Y-%m-%d_%H%M%S") if file_creation_time else "NODATE"
        res.update({
            "pattern": "K", "contact": "voice-recording", "channel": "mic", "datetime": dt_file
        })
        return res

    # Pattern D: Unknown
    if re.match(r'^unknown[\s_]*(contact)?', stem, re.I):
        res.update({"pattern": "D", "contact": "unknown", "datetime": dt})
        return res

    # Patterns I and C: Facebook
    if res["channel"] == "facebook":
        fb_m = re.match(r'^(.+?)\s*\((facebook|messenger)\)', stem, re.I)
        label = fb_m.group(1).strip() if fb_m else ""
        is_sys = not label or \
                 label.lower() in SYSTEM_FB_LABELS or \
                 label.lower().startswith("is ") or \
                 label.endswith("…") or \
                 re.match(r'^\d+[:\s]\d{2}$', label)
        res.update({
            "pattern": "I" if is_sys else "C",
            "contact": "anon" if is_sys else label,
            "datetime": dt
        })
        return res

    # Pattern J: Zoom
    if res["channel"] == "zoom":
        res.update({"pattern": "J", "contact": "zoom-meeting", "datetime": dt})
        return res

    # Pattern A: Named contact
    a = re.match(r'^(.+?)\s*\((\+?1?[\d\s\-(). ]{7,20}?)\)\s*[↗↙↑↓]\s*\(phone\)', stem)
    if a:
        res.update({
            "pattern": "A",
            "contact": a.group(1).strip(),
            "phone": normalize_phone(re.sub(r'[^\d+]', '', a.group(2))),
            "datetime": dt
        })
        return res

    # Pattern B: Bare phone
    b = re.match(r'^(\+?1?[\s\-(). \d]{7,25}?)\s*[↗↙↑↓]\s*\(phone\)', stem)
    if b:
        res.update({
            "pattern": "B",
            "phone": normalize_phone(re.sub(r'[^\d+]', '', b.group(1))),
            "datetime": dt
        })
        return res

    # Default Pattern X
    res["datetime"] = dt or (file_creation_time.strftime("%Y-%m-%d_%H%M%S") if file_creation_time else "NODATE")
    return res

def build_canonical_name(parsed: Dict[str, Any], ext: str) -> str:
    """Build standardized filename: YYYY-MM-DD_HHMMSS_DIR_PHONE_ContactName[_chN].ext"""
    dt = parsed.get("datetime") or "NODATE"
    channel = parsed.get("channel", "phone")
    direction = parsed.get("direction")
    
    if not direction:
        direction = {"facebook": "FB", "zoom": "ZOOM", "mic": "MIC"}.get(channel, "UNK")
        
    phone = parsed.get("phone") or channel
    name = slugify_name(parsed.get("contact")) or "unknown"
    idx = f"_ch{parsed['channel_idx']}" if parsed.get("channel_idx") else ""
    
    return f"{dt}_{direction}_{phone}_{name}{idx}{ext}"
