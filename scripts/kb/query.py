#!/usr/bin/env python3
"""
query.py — CLI for the Horizon PRM Knowledge Base (Vector Prime).

Single source of truth for the Horizon PRM project. Every other agent consults
this, not the raw repos, so answers stay grounded in the indexed, complete truth.

Modes
-----
  search "<text>"   Full-text (FTS5) + lexical vector (TF-IDF cosine) search.
  fetch  "<path>"   Return a file's FULL indexed content by stored path.
  list              List all indexed files with metadata.
  stats             Corpus counts.

Examples
--------
  python query.py search "Cyber-Noir theme scanlines"
  python query.py search "WebNative native plugin fallback" --kind vector
  python query.py fetch "eclipse/src/index.css"
  python query.py list --surface eclipse --lang tsx --limit 20
  python query.py stats

NOTE: the stored vectors are LEXICAL (TF-IDF bag-of-tokens), NOT semantic.
Cosine works fully offline. To upgrade to real semantics, replace the vector
column + the tokenizer with sentence-transformers / an embeddings API, then
re-run build_kb.py. See README.md.
"""
from __future__ import annotations
import argparse, json, math, os, re, sqlite3, sys
import numpy as np

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "kb.sqlite")
VEC_CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".vectors_cache.npz")

# ---- tokenizer (MUST match build_kb.py) -------------------------------------
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

# ---- lazy corpus access ------------------------------------------------------
_conn = None
def conn():
    global _conn
    if _conn is None:
        _conn = sqlite3.connect(DB)
    return _conn

_vocab = None
def vocab():
    global _vocab
    if _vocab is None:
        rows = conn().execute("SELECT term, idx, idf FROM vocab").fetchall()
        _vocab = {term: (idx, idf) for term, idx, idf in rows}
    return _vocab

def load_vectors():
    """Return (doc_ids:np.array[int], matrix:np.ndarray[float32], cached)."""
    needs_build = True
    if os.path.exists(VEC_CACHE):
        try:
            npz = np.load(VEC_CACHE, allow_pickle=False)
            if npz["db_mtime"] == os.path.getmtime(DB):
                return npz["doc_ids"], npz["matrix"], True
        except Exception:
            pass
    # build from sqlite
    rows = conn().execute("SELECT doc_id, vector FROM vectors ORDER BY doc_id").fetchall()
    doc_ids = np.array([r[0] for r in rows], dtype=np.int64)
    matrix = np.stack([np.frombuffer(r[1], dtype=np.float32) for r in rows]).astype(np.float32)
    try:
        np.savez(VEC_CACHE, doc_ids=doc_ids, matrix=matrix, db_mtime=np.float64(os.path.getmtime(DB)))
    except Exception:
        pass
    return doc_ids, matrix, False

def query_vector(text):
    v = np.zeros(30696, dtype=np.float32)
    vb = vocab()
    for t, c in __import__("collections").Counter(tokenize(text)).items():
        ent = vb.get(t)
        if ent is not None:
            idx, idf = ent
            v[idx] = c * idf
    n = np.linalg.norm(v)
    if n > 0:
        v /= n
    return v

# ---- commands ----------------------------------------------------------------
def cmd_search(args):
    c = conn()
    limit = args.limit
    kind = args.kind
    q = args.text

    fts_rows = []
    if kind in ("fts", "both"):
        sql = ("SELECT rowid, path, surface, lang, snippet(fts, 3, '\033[36m', '\033[0m', '…', 12) "
               "FROM fts WHERE fts MATCH ?")
        params = [q]
        if args.surface:
            sql += " AND surface = ?"; params.append(args.surface)
        sql += " ORDER BY rank LIMIT ?"; params.append(limit)
        fts_rows = c.execute(sql, params).fetchall()

    vec_rows = []
    if kind in ("vector", "both"):
        vq = query_vector(q)
        doc_ids, matrix, _ = load_vectors()
        sims = matrix @ vq  # cosine (both normalized)
        top = np.argsort(-sims)[:limit]
        for yi in top:
            yi = int(yi)
            score = float(sims[yi])
            if score <= 0:
                continue
            did = int(doc_ids[yi])
            meta = c.execute("SELECT path, surface, lang, line_count FROM files WHERE doc_id=?",
                             (did,)).fetchone()
            if meta is None:
                continue
            if args.surface and meta[1] != args.surface:
                continue
            vec_rows.append((meta[0], meta[1], meta[2], meta[3], score))

    if kind == "fts" or kind == "both":
        print(f"\n\033[1mFTS5 FULL-TEXT MATCHES ({len(fts_rows)})\033[0m")
        for rowid, path, surface, lang, snip in fts_rows:
            print(f"  [{surface}/{lang}] {path}")
            print(f"    {snip}")
    if kind == "vector" or kind == "both":
        label = "VECTOR (TF-IDF cosine)" if kind == "both" else "VECTOR (TF-IDF cosine)"
        print(f"\n\033[1m{label} MATCHES ({len(vec_rows)})\033[0m")
        for path, surface, lang, lines, score in vec_rows:
            print(f"  {score:.3f}  [{surface}/{lang}] {path}  ({lines} lines)")
    if not fts_rows and not vec_rows:
        print("  (no matches)")

def cmd_fetch(args):
    c = conn()
    p = args.path
    row = c.execute("SELECT content, path, surface, lang, line_count, sha256, symbols "
                    "FROM files WHERE path = ?", (p,)).fetchone()
    if row is None:
        # try prefix/suffix heuristics
        alt = c.execute("SELECT content, path, surface, lang, line_count, sha256, symbols "
                        "FROM files WHERE path = ? OR path = ? LIMIT 1",
                        (p, "eclipse/" + p.lstrip("/"))).fetchone()
        row = alt
    if row is None:
        print(f"NOT FOUND: {p}", file=sys.stderr); sys.exit(1)
    content, path, surface, lang, lines, sha, symbols = row
    print(f"# PATH: {path}")
    print(f"# SURFACE: {surface}  LANG: {lang}  LINES: {lines}  SHA256: {sha}")
    if symbols:
        print(f"# SYMBOLS: {symbols}")
    print("#" + "=" * 70)
    sys.stdout.write(content)

def cmd_list(args):
    c = conn()
    sql = "SELECT path, surface, lang, line_count, sha256, symbols FROM files WHERE 1=1"
    params = []
    if args.surface:
        sql += " AND surface = ?"; params.append(args.surface)
    if args.lang:
        sql += " AND lang = ?"; params.append(args.lang)
    sql += " ORDER BY surface, path"
    if args.limit:
        sql += " LIMIT ?"; params.append(args.limit)
    for path, surface, lang, lines, sha, symbols in c.execute(sql, params):
        sym = (symbols[:60] + "…") if symbols and len(symbols) > 60 else (symbols or "")
        print(f"{surface:16} {lang:12} {str(lines):>7}L  {path}  {sym}")

def cmd_stats(args):
    c = conn()
    total = c.execute("SELECT count(*) FROM files").fetchone()[0]
    lines = c.execute("SELECT COALESCE(SUM(line_count),0) FROM files").fetchone()[0]
    print(f"Indexed files : {total}")
    print(f"Total lines   : {lines}")
    print(f"Vocab size    : {c.execute('SELECT count(*) FROM vocab').fetchone()[0]}")
    print("By surface:")
    for surface, n in c.execute("SELECT surface, count(*) AS n FROM files GROUP BY surface ORDER BY n DESC"):
        print(f"  {surface:18} {n}")
    print("By language:")
    for lang, n in c.execute("SELECT lang, count(*) AS n FROM files GROUP BY lang ORDER BY n DESC LIMIT 15"):
        print(f"  {lang:14} {n}")

def main():
    ap = argparse.ArgumentParser(description="Horizon PRM Knowledge Base query CLI (Vector Prime)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("search", help="full-text + lexical vector search")
    s.add_argument("text"); s.add_argument("--limit", type=int, default=10)
    s.add_argument("--kind", choices=["fts", "vector", "both"], default="both")
    s.add_argument("--surface", default=None)

    f = sub.add_parser("fetch", help="return full content of a file by stored path")
    f.add_argument("path")

    l = sub.add_parser("list", help="list indexed files")
    l.add_argument("--surface", default=None); l.add_argument("--lang", default=None)
    l.add_argument("--limit", type=int, default=None)

    sub.add_parser("stats", help="corpus statistics")

    args = ap.parse_args()
    if args.cmd == "search": cmd_search(args)
    elif args.cmd == "fetch": cmd_fetch(args)
    elif args.cmd == "list": cmd_list(args)
    elif args.cmd == "stats": cmd_stats(args)

if __name__ == "__main__":
    main()
