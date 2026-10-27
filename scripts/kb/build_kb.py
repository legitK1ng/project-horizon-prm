#!/usr/bin/env python3
"""
build_kb.py -- Vector Prime knowledge-base builder for the Horizon PRM project.

Read-only ingestion of the canonical 'horizon' project and its 'eclipse' sibling
fork. Produces:
  - kb.sqlite        : SQLite (FTS5 full-text index + dense lexical TF-IDF vector column)
  - MANIFEST.json    : counts, exclude list, timestamp, honest skip accounting

Honest note: the stored vectors are LEXICAL (TF-IDF bag-of-tokens), NOT semantic.
Cosine similarity works fully offline. See README.md for the upgrade path to a real
embeddings model (sentence-transformers / embeddings API).

This script does NOT modify any source project.
"""
import os, re, sys, json, hashlib, sqlite3, datetime, math
import numpy as np

# ----------------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------------
KB_DIR = r"C:/Users/owner/horizon-knowledge-base"
CANON_ROOT = r"C:/Users/owner/Desktop/horizon"
ECLIPSE_ROOT = r"C:/Users/owner/My Drive/horizon"

# Directories excluded from ingestion (per task spec)
EXCLUDE_DIRS = {
    "node_modules", ".venv", "venv", ".venv-wsl", "__pycache__",
    "dist", "build", ".git", ".vite", "playwright-report",
}

# Binary / non-text extensions: never source code or .md docs -> skip (recorded)
BINARY_EXT = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".bmp", ".tiff",
    ".jar", ".wav", ".mp3", ".m4a", ".aac", ".ogg", ".flac", ".webm",
    ".mp4", ".mov", ".avi", ".mkv", ".zip", ".gz", ".tar", ".tgz", ".7z",
    ".bin", ".download", ".exe", ".dll", ".so", ".dylib", ".class",
    ".ttf", ".otf", ".woff", ".woff2", ".eot", ".pdf", ".pak", ".dat",
    ".keystore", ".jks", ".p12", ".crt", ".der", ".pyc",
}

# Generated / regenerable artifacts: not authored source -> skip (recorded)
GENERATED_EXT = {".map", ".tsbuildinfo"}

MAX_TEXT_BYTES = 5_000_000  # skip text files larger than this (regenerable / minified)

# Lexical vector parameters
MIN_DF = 2          # term must appear in >= MIN_DF docs to enter vocab
VOCAB_CAP = 60000   # hard cap on vocabulary size (keep highest document-frequency)

# Language detection by extension
LANG_BY_EXT = {
    ".ts": "typescript", ".tsx": "tsx", ".js": "javascript", ".jsx": "jsx",
    ".mjs": "javascript", ".cjs": "javascript",
    ".py": "python", ".rs": "rust", ".java": "java", ".kt": "kotlin",
    ".kts": "kotlin", ".swift": "swift", ".sql": "sql",
    ".css": "css", ".scss": "scss", ".sass": "sass", ".less": "less",
    ".html": "html", ".htm": "html", ".xml": "xml", ".svg": "svg",
    ".json": "json", ".json5": "json", ".geojson": "json",
    ".yaml": "yaml", ".yml": "yaml", ".toml": "toml",
    ".md": "markdown", ".mdx": "markdown", ".txt": "text",
    ".sh": "shell", ".bash": "shell", ".ps1": "powershell", ".bat": "batch",
    ".cmd": "batch", ".gradle": "gradle", ".properties": "properties",
    ".ini": "ini", ".cfg": "ini", ".conf": "ini", ".env": "dotenv",
    ".gitignore": "gitignore", ".gitattributes": "gitattributes",
    ".nvmrc": "text", ".cursorrules": "text", ".mcp.json": "json",
    ".editorconfig": "ini", ".npmrc": "ini", ".example": "text",
    ".lock": "text", ".log": "text", ".pro": "prolog", ".gs": "genscript",
}

# Surface assignment for the canonical (horizon) root by top-level component
CANON_SURFACE_MAP = [
    ("src/", "web"),
    ("mcp-backend/", "backend"),
    ("supabase/", "supabase"),
    ("capacitor-horizon/", "mobile-capacitor"),
    ("android/", "mobile-android"),
    ("docs/", "docs"),
]
# Files not under any of the above (root-level: AGENTS.md, README.md, package.json,
# metadata.json, REORG_MANIFEST.json, capacitor.config.ts, etc.) -> surface "root".


# ----------------------------------------------------------------------------
# Symbol extraction (per language, top-level declarations / definitions)
# ----------------------------------------------------------------------------
SYMBOL_PATTERNS = {
    "typescript": [
        r"export\s+default\s+function\s+([A-Za-z_$][\w$]*)",
        r"export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)",
        r"(?:async\s+)?function\s+([A-Za-z_$][\w$]*)",
        r"export\s+(?:default\s+)?class\s+([A-Za-z_$][\w$]*)",
        r"class\s+([A-Za-z_$][\w$]*)",
        r"export\s+(?:default\s+)?interface\s+([A-Za-z_$][\w$]*)",
        r"interface\s+([A-Za-z_$][\w$]*)",
        r"export\s+(?:default\s+)?type\s+([A-Za-z_$][\w$]*)",
        r"type\s+([A-Za-z_$][\w$]*)",
        r"export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)",
        r"(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[:=]",
    ],
    "tsx": [
        r"export\s+default\s+function\s+([A-Za-z_$][\w$]*)",
        r"export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)",
        r"(?:async\s+)?function\s+([A-Za-z_$][\w$]*)",
        r"export\s+(?:default\s+)?class\s+([A-Za-z_$][\w$]*)",
        r"class\s+([A-Za-z_$][\w$]*)",
        r"export\s+(?:default\s+)?interface\s+([A-Za-z_$][\w$]*)",
        r"interface\s+([A-Za-z_$][\w$]*)",
        r"export\s+(?:default\s+)?type\s+([A-Za-z_$][\w$]*)",
        r"type\s+([A-Za-z_$][\w$]*)",
        r"export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)",
        r"const\s+([A-Za-z_$][\w$]*)\s*[:=]",
    ],
    "javascript": [
        r"export\s+default\s+function\s+([A-Za-z_$][\w$]*)",
        r"export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)",
        r"(?:async\s+)?function\s+([A-Za-z_$][\w$]*)",
        r"export\s+(?:default\s+)?class\s+([A-Za-z_$][\w$]*)",
        r"class\s+([A-Za-z_$][\w$]*)",
        r"export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)",
        r"(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[:=]",
        r"function\s+([A-Za-z_$][\w$]*)\s*\(",
    ],
    "jsx": [
        r"export\s+default\s+function\s+([A-Za-z_$][\w$]*)",
        r"export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)",
        r"(?:async\s+)?function\s+([A-Za-z_$][\w$]*)",
        r"export\s+(?:default\s+)?class\s+([A-Za-z_$][\w$]*)",
        r"class\s+([A-Za-z_$][\w$]*)",
        r"const\s+([A-Za-z_$][\w$]*)\s*[:=]",
    ],
    "python": [
        r"async\s+def\s+([A-Za-z_][\w]*)",
        r"def\s+([A-Za-z_][\w]*)",
        r"^class\s+([A-Za-z_][\w]*)",
        r"class\s+([A-Za-z_][\w]*)\s*\(",
    ],
    "rust": [
        r"pub\s+fn\s+([A-Za-z_][\w]*)",
        r"fn\s+([A-Za-z_][\w]*)",
        r"pub\s+struct\s+([A-Za-z_][\w]*)",
        r"struct\s+([A-Za-z_][\w]*)",
        r"pub\s+enum\s+([A-Za-z_][\w]*)",
        r"enum\s+([A-Za-z_][\w]*)",
        r"pub\s+trait\s+([A-Za-z_][\w]*)",
        r"trait\s+([A-Za-z_][\w]*)",
        r"mod\s+([A-Za-z_][\w]*)",
        r"impl(?:<[^>]*>)?\s+(?:[A-Za-z_][\w]*\s*for\s+)?([A-Za-z_][\w]*)",
    ],
    "sql": [
        r"CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`\"\[]?([A-Za-z_][\w]*)[`\"\]]?",
        r"CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?[`\"\[]?([A-Za-z_][\w]*)[`\"\]]?",
        r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:IF\s+NOT\s+EXISTS\s+)?[`\"\[]?([A-Za-z_][\w]*)[`\"\]]?",
        r"CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`\"\[]?([A-Za-z_][\w]*)[`\"\]]?",
        r"CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?[`\"\[]?([A-Za-z_][\w]*)[`\"\]]?",
        r"CREATE\s+TRIGGER\s+(?:IF\s+NOT\s+EXISTS\s+)?[`\"\[]?([A-Za-z_][\w]*)[`\"\]]?",
    ],
    "java": [
        r"public\s+(?:static\s+)?(?:final\s+)?(?:class|interface|enum)\s+([A-Za-z_][\w]*)",
        r"(?:private|protected|public)?\s*(?:static\s+)?(?:final\s+)?(?:class|interface|enum)\s+([A-Za-z_][\w]*)",
        r"(?:public|private|protected|static|final|\s)*\s([A-Za-z_][\w]*)\s*\([^;]*\)\s*\{",  # rough method
    ],
    "kotlin": [
        r"fun\s+([A-Za-z_][\w]*)",
        r"class\s+([A-Za-z_][\w]*)",
        r"interface\s+([A-Za-z_][\w]*)",
        r"object\s+([A-Za-z_][\w]*)",
        r"data\s+class\s+([A-Za-z_][\w]*)",
    ],
    "swift": [
        r"func\s+([A-Za-z_][\w]*)",
        r"class\s+([A-Za-z_][\w]*)",
        r"struct\s+([A-Za-z_][\w]*)",
        r"enum\s+([A-Za-z_][\w]*)",
        r"protocol\s+([A-Za-z_][\w]*)",
    ],
}

COMPILED = {lang: [re.compile(p, re.MULTILINE) for p in pats]
            for lang, pats in SYMBOL_PATTERNS.items()}


def extract_symbols(lang, text):
    pats = COMPILED.get(lang)
    if not pats:
        return []
    syms = []
    seen = set()
    for rx in pats:
        for m in rx.finditer(text):
            name = m.group(1)
            if name and name not in seen:
                seen.add(name)
                syms.append(name)
    return syms


# ----------------------------------------------------------------------------
# Tokenization (camelCase / snake / digit splitting, for lexical vectors)
# ----------------------------------------------------------------------------
def camel_split(ident):
    s = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", ident)
    s = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", " ", s)
    s = re.sub(r"(?<=[a-zA-Z])(?=[0-9])", " ", s)
    s = re.sub(r"(?<=[0-9])(?=[a-zA-Z])", " ", s)
    return s.split()


def tokenize(text):
    toks = []
    for chunk in re.split(r"[^a-zA-Z0-9_]+", text):
        if not chunk:
            continue
        for sub in camel_split(chunk):
            if len(sub) >= 2:
                toks.append(sub.lower())
    return toks


# ----------------------------------------------------------------------------
# Walk + classify
# ----------------------------------------------------------------------------
def classify_and_walk(root, root_label):
    """Yield dicts describing each file. root_label in {'horizon','eclipse'}."""
    for dp, dns, fns in os.walk(root):
        dns[:] = [d for d in dns if d not in EXCLUDE_DIRS]
        for fn in fns:
            abspath = os.path.join(dp, fn)
            try:
                relpath = os.path.relpath(abspath, root).replace(os.sep, "/")
            except ValueError:
                # Windows reserved device name (e.g. 'nul') -> not ingestible
                continue
            ext = os.path.splitext(fn)[1].lower()
            # special-case extensionless / dotted config files
            lower = fn.lower()
            yield {
                "root_label": root_label,
                "abspath": abspath,
                "relpath": relpath,
                "filename": fn,
                "ext": ext,
                "lower": lower,
            }


def decide_surface_and_action(meta):
    """Return (surface, action) where action in
    {'ingest','skip_binary','skip_generated','skip_toolarge'}."""
    root_label = meta["root_label"]
    relpath = meta["relpath"]
    ext = meta["ext"]
    lower = meta["lower"]

    if root_label == "eclipse":
        # All eclipse fork files tagged surface="eclipse" (per task spec).
        surface = "eclipse"
    else:
        surface = "root"
        for prefix, sname in CANON_SURFACE_MAP:
            if relpath.startswith(prefix):
                surface = sname
                break

    if ext in BINARY_EXT or lower.endswith(tuple(BINARY_EXT)):
        return surface, "skip_binary"
    if ext in GENERATED_EXT or lower.endswith(tuple(GENERATED_EXT)):
        return surface, "skip_generated"
    return surface, "ingest"


def lang_for(meta):
    ext = meta["ext"]
    lower = meta["lower"]
    if ext in LANG_BY_EXT:
        return LANG_BY_EXT[ext]
    # extensionless / dotted fallback
    if lower in LANG_BY_EXT:
        return LANG_BY_EXT[lower]
    # dotfiles like .env.local, .env.example
    if lower.startswith(".env"):
        return "dotenv"
    if lower in (".gitignore", ".gitattributes", ".npmrc", ".nvmrc", ".editorconfig",
                 ".cursorrules", ".mcp.json"):
        return LANG_BY_EXT.get(lower, "text")
    return "text"  # default: treat as text (will be validated by decode)


# ----------------------------------------------------------------------------
# Main build
# ----------------------------------------------------------------------------
def main():
    os.makedirs(KB_DIR, exist_ok=True)
    db_path = os.path.join(KB_DIR, "kb.sqlite")
    if os.path.exists(db_path):
        os.remove(db_path)

    # Step 1: discover + classify every file
    discovered = []
    for root, label in [(CANON_ROOT, "horizon"), (ECLIPSE_ROOT, "eclipse")]:
        if not os.path.isdir(root):
            print(f"[WARN] root not found: {root}", file=sys.stderr)
            continue
        for meta in classify_and_walk(root, label):
            surface, action = decide_surface_and_action(meta)
            meta["surface"] = surface
            meta["action"] = action
            discovered.append(meta)

    # Step 2: read + tokenize ingestible files
    records = []          # successfully ingested
    skipped_binary = []
    skipped_generated = []
    skipped_toolarge = []
    read_errors = []      # files we tried to ingest but failed to read/decode

    df = {}               # term -> document frequency
    doc_tokens = []       # parallel to records: list of tokens

    for meta in discovered:
        action = meta["action"]
        abspath = meta["abspath"]
        if action == "skip_binary":
            skipped_binary.append(abspath)
            continue
        if action == "skip_generated":
            skipped_generated.append(abspath)
            continue
        # action == 'ingest'
        try:
            with open(abspath, "rb") as f:
                raw = f.read()
        except Exception as e:
            read_errors.append({"path": abspath, "error": f"read: {e}"})
            continue
        if len(raw) > MAX_TEXT_BYTES:
            skipped_toolarge.append(abspath)
            continue
        # decode
        text = None
        for enc in ("utf-8", "utf-8-sig"):
            try:
                text = raw.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        if text is None:
            # not valid UTF-8 -> treat as binary
            skipped_binary.append(abspath)
            continue

        lang = lang_for(meta)
        line_count = text.count("\n") + (1 if text and not text.endswith("\n") else 0)
        sha = hashlib.sha256(raw).hexdigest()
        toks = tokenize(text)
        syms = extract_symbols(lang, text) if lang in COMPILED else []

        # doc_id assigned later; store provisional
        relpath = meta["relpath"]
        if meta["root_label"] == "eclipse":
            display_path = "eclipse/" + relpath
        else:
            display_path = relpath

        records.append({
            "doc_id": None,
            "path": display_path,
            "abspath": abspath,
            "relpath": relpath,
            "root_label": meta["root_label"],
            "surface": meta["surface"],
            "filename": meta["filename"],
            "ext": meta["ext"],
            "lang": lang,
            "line_count": line_count,
            "byte_size": len(raw),
            "sha256": sha,
            "symbols": syms,
            "content": text,
        })
        doc_tokens.append(toks)
        # accumulate document frequency
        for t in set(toks):
            df[t] = df.get(t, 0) + 1

    # Step 3: build vocabulary + idf
    vocab_terms = [t for t, c in df.items() if c >= MIN_DF]
    vocab_terms.sort(key=lambda t: (-df[t], t))
    if len(vocab_terms) > VOCAB_CAP:
        vocab_terms = vocab_terms[:VOCAB_CAP]
    term_idx = {t: i for i, t in enumerate(vocab_terms)}
    dim = len(vocab_terms)
    N = len(records)
    idf = np.array([math.log((N + 1) / (df[t] + 1)) + 1.0 for t in vocab_terms],
                   dtype=np.float32)

    # Step 4: build dense normalized vectors
    vectors = np.zeros((N, dim), dtype=np.float32)
    for i, toks in enumerate(doc_tokens):
        counts = {}
        for t in toks:
            j = term_idx.get(t)
            if j is not None:
                counts[j] = counts.get(j, 0) + 1
        for j, c in counts.items():
            vectors[i, j] = c * idf[j]
        norm = np.linalg.norm(vectors[i])
        if norm > 0:
            vectors[i] /= norm

    # Step 5: write SQLite
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL;")
    cur.execute("""
        CREATE TABLE files (
            doc_id INTEGER PRIMARY KEY,
            path TEXT UNIQUE,
            abspath TEXT,
            relpath TEXT,
            root_label TEXT,
            surface TEXT,
            filename TEXT,
            ext TEXT,
            lang TEXT,
            line_count INTEGER,
            byte_size INTEGER,
            sha256 TEXT,
            symbols TEXT,
            content TEXT
        );
    """)
    cur.execute("""
        CREATE TABLE vectors (
            doc_id INTEGER PRIMARY KEY,
            dim INTEGER,
            vector BLOB
        );
    """)
    cur.execute("""
        CREATE TABLE vocab (
            term TEXT PRIMARY KEY,
            idx INTEGER,
            idf REAL
        );
    """)
    cur.execute("""
        CREATE VIRTUAL TABLE fts USING fts5(
            path, surface, lang, content,
            content='files',
            content_rowid='doc_id',
            tokenize='unicode61'
        );
    """)

    for i, rec in enumerate(records):
        doc_id = i + 1
        rec["doc_id"] = doc_id
        cur.execute(
            """INSERT INTO files
               (doc_id,path,abspath,relpath,root_label,surface,filename,ext,lang,
                line_count,byte_size,sha256,symbols,content)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (doc_id, rec["path"], rec["abspath"], rec["relpath"], rec["root_label"],
             rec["surface"], rec["filename"], rec["ext"], rec["lang"],
             rec["line_count"], rec["byte_size"], rec["sha256"],
             json.dumps(rec["symbols"]), rec["content"]),
        )
        cur.execute("INSERT INTO vectors (doc_id,dim,vector) VALUES (?,?,?)",
                    (doc_id, dim, vectors[i].tobytes()))
        # FTS external-content row (rowid must equal doc_id)
        cur.execute(
            "INSERT INTO fts (rowid,path,surface,lang,content) VALUES (?,?,?,?,?)",
            (doc_id, rec["path"], rec["surface"], rec["lang"], rec["content"]),
        )

    for idx, term in enumerate(vocab_terms):
        cur.execute("INSERT INTO vocab (term,idx,idf) VALUES (?,?,?)",
                    (term, idx, float(idf[idx])))

    cur.execute("CREATE INDEX ix_files_surface ON files(surface);")
    cur.execute("CREATE INDEX ix_files_lang ON files(lang);")
    conn.commit()

    # verify FTS populated
    cnt = cur.execute("SELECT count(*) FROM fts;").fetchone()[0]
    print(f"[INFO] FTS rows: {cnt}")

    conn.close()

    # Step 6: MANIFEST
    by_lang = {}
    by_surface = {}
    total_lines = 0
    for rec in records:
        by_lang[rec["lang"]] = by_lang.get(rec["lang"], 0) + 1
        by_surface[rec["surface"]] = by_surface.get(rec["surface"], 0) + 1
        total_lines += rec["line_count"]

    manifest = {
        "name": "Horizon PRM Knowledge Base (Vector Prime)",
        "description": ("Single-source-of-truth knowledge base of the Horizon PRM "
                        "project: canonical 'horizon' + 'eclipse' sibling fork. "
                        "FTS5 full-text index + dense lexical (TF-IDF) vectors."),
        "build_timestamp_utc": datetime.datetime.utcnow().isoformat() + "Z",
        "roots": {
            "canonical": CANON_ROOT,
            "eclipse": ECLIPSE_ROOT,
        },
        "totals": {
            "files_indexed": len(records),
            "total_lines": total_lines,
            "vector_dimensionality": dim,
            "vocabulary_size": dim,
            "total_discovered_files": len(discovered),
        },
        "by_language": dict(sorted(by_lang.items(), key=lambda x: -x[1])),
        "by_surface": dict(sorted(by_surface.items(), key=lambda x: -x[1])),
        "skipped": {
            "binary_or_nontext": len(skipped_binary),
            "generated_artifacts": len(skipped_generated),
            "too_large_over_5mb": len(skipped_toolarge),
            "read_errors": len(read_errors),
        },
        "read_failures": read_errors,
        "skipped_binary_sample": skipped_binary[:200],
        "skipped_generated_sample": skipped_generated[:200],
        "skipped_toolarge_sample": skipped_toolarge[:200],
        "exclude_dirs": sorted(EXCLUDE_DIRS),
        "binary_extensions": sorted(BINARY_EXT),
        "generated_extensions": sorted(GENERATED_EXT),
        "vector": {
            "type": "lexical_tfidf_dense",
            "model": None,
            "note": ("LEXICAL vectors only (TF-IDF bag-of-tokens with camelCase/snake "
                     "splitting). NOT semantic. Cosine works offline. Upgrade path: "
                     "sentence-transformers or an embeddings API -> replace the "
                     "vectors table + vectorize() in query.py."),
            "min_df": MIN_DF,
            "vocab_cap": VOCAB_CAP,
            "tokenizer": "lowercase, [a-zA-Z0-9_]+ with camelCase/snake/digit splitting, min len 2",
        },
        "deliverables": ["kb.sqlite", "query.py", "MANIFEST.json", "README.md"],
    }
    with open(os.path.join(KB_DIR, "MANIFEST.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print("=== BUILD COMPLETE ===")
    print(f"files_indexed      : {len(records)}")
    print(f"total_lines        : {total_lines}")
    print(f"vector_dim         : {dim}")
    print(f"vocab_size         : {dim}")
    print(f"skipped_binary     : {len(skipped_binary)}")
    print(f"skipped_generated  : {len(skipped_generated)}")
    print(f"skipped_toolarge   : {len(skipped_toolarge)}")
    print(f"read_errors        : {len(read_errors)}")
    print(f"by_surface         : {by_surface}")
    print(f"db_size_mb         : {os.path.getsize(db_path)/1e6:.1f}")


if __name__ == "__main__":
    main()
