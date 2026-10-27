#!/usr/bin/env python3
"""Extract task-bearing content from the Horizon workspace into structured kanban cards."""
import os, re, json, glob

ROOT = r"C:\Users\owner\Desktop\horizon"
# Directories to skip (heavy / binary / generated)
SKIP_DIRS = {"node_modules", ".git", "dist", "build", ".venv", ".pytest_cache",
             "playwright-report", "test-results", "android", "capacitor-horizon",
             "horizon-prm-fixed", "horizon-changed-files", "src_eclipse_backup",
             ".tmp.driveupload", "ACR Phone_files", "New folder", "resources",
             "public", "scripts", ".agent", ".agents", ".claude", ".vscode",
             ".cursorrules", ".cobridge", ".clawhub", ".openclaw", ".obsidian",
             ".omc", ".mcp.json", ".vite", "mcp-backend", "supabase", ".github",
             "tools", "tests", "agent", "agents"}
# Files to skip by extension
SKIP_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".vsix", ".exe", ".docx",
            ".htm", ".html", ".pdf", ".mp4", ".mp3", ".wav", ".zip", ".lock",
            ".json", ".ts", ".tsx", ".js", ".css", ".mjs", ".pyc", ".ico"}
# Explicit high-value doc sources to scan (curated, not the whole tree)
SOURCES = [
    os.path.join(ROOT, "openclaw-tasks.md"),
    os.path.join(ROOT, "docs", "horizon_prm_architecture_review.md"),
    os.path.join(ROOT, "docs", "CONSTITUTION.md"),
    os.path.join(ROOT, "docs", "database_schema_analysis.md"),
    os.path.join(ROOT, "docs", "database-schema-reference.md"),
    os.path.join(ROOT, "docs", "API_CONTRACT.md"),
    os.path.join(ROOT, "docs", "plans", "2026-04-13-ai-chat-stabilization-design.md"),
    os.path.join(ROOT, "docs", "superpowers", "plans", "2026-05-10-local-first-architecture-plan.md"),
    os.path.join(ROOT, "docs", "superpowers", "specs", "2026-05-10-local-first-architecture-design.md"),
    os.path.join(ROOT, "PROJECT_REQS.md"),
    os.path.join(ROOT, "setup.md"),
    os.path.join(ROOT, "README.md"),
    os.path.join(ROOT, "BOOTSTRAP.md"),
    os.path.join(ROOT, "KNOWLEDGE1.md"),
    os.path.join(ROOT, "KNOWLEDGE2.md"),
    os.path.join(ROOT, "KNOWLEDGE3.md"),
]
# Also scan the most recent (FINAL) archived engineering reviews for high-signal items
REVIEWS = glob.glob(os.path.join(ROOT, "docs", "reviews", "archive", "*FINAL*.md"))

def classify(text):
    t = text.lower()
    if re.search(r'\b(done|completed|✅|implemented|resolved|fixed)\b', t) and 'todo' not in t:
        return "Done"
    if re.search(r'(action required|⚠️|conditionally|requires approval|approval before)', t):
        return "Blocked"
    if re.search(r'(in progress|wip|currently|being )', t):
        return "In Progress"
    if re.search(r'(recommend|should (be|implement|become)|next step|action item|todo|fixme|needs? (to|work)|add (test|coverage)|migrate|refactor|implement|set up|configure)', t):
        return "To Do"
    return "Backlog"

def category(text, path):
    t = (text + " " + path).lower()
    if any(k in t for k in ["android", "apk", "capacitor", "mobile", "pixel"]): return "Mobile"
    if any(k in t for k in ["test", "coverage", "playwright", "e2e", "vitest", "pytest"]): return "Testing/QA"
    if any(k in t for k in ["supabase", "backend", "api", "uvicorn", "fastapi", "db", "database", "schema", "sql"]): return "Backend/Data"
    if any(k in t for k in ["frontend", "component", "react", "dashboard", "ui", "css", "tailwind"]): return "Frontend/UI"
    if any(k in t for k in ["ci", "deploy", "docker", "tailscale", "funnel", "cron", "pipeline", "infra"]): return "Infra/CI"
    if any(k in t for k in ["doc", "constitution", "readme", "knowledge", "spec"]): return "Docs"
    if any(k in t for k in ["telegram", "openclaw", "skill", "plugin", "agent"]): return "Agent/Tooling"
    return "General"

def priority(text):
    t = text.lower()
    if any(k in t for k in ["🔴", "high", "critical", "immediate", "conditionally", "action required"]): return "High"
    if any(k in t for k in ["🟠", "med", "medium"]): return "Medium"
    if any(k in t for k in ["🟡", "low"]): return "Low"
    return "Medium"

cards = []
seen = set()

def add(text, source, line, extra=""):
    text = re.sub(r'\s+', ' ', text).strip()
    if len(text) < 12:
        return
    key = (source, text[:60])
    if key in seen:
        return
    seen.add(key)
    col = classify(text)
    cards.append({
        "id": f"{len(cards)+1:03d}",
        "title": (text[:140]),
        "source": os.path.relpath(source, ROOT),
        "line": line,
        "column": col,
        "category": category(text, source),
        "priority": priority(text),
        "note": extra,
    })

# 1) openclaw-tasks.md explicit table + checklist items
def parse_openclaw(path):
    lines = open(path, encoding="utf-8", errors="ignore").read().splitlines()
    for i, ln in enumerate(lines, 1):
        m = re.match(r'\|\s*(\d+)\s*\|\s*\[?(.+?)\]?\(?#.*?\)?\s*\|\s*(🔴|🟠|🟡)?\s*(\w+)', ln)
        if m:
            pri = {"HIGH":"High","MED":"Medium","LOW":"Low"}.get(m.group(3).upper(), "Medium")
            add(f"[OpenClaw] {m.group(2).strip()}", path, i, f"priority={pri}")
        # checklist lines
        cm = re.match(r'\s*-\s*\[\s*\]\s*(.+)', ln)
        if cm:
            add(f"[OpenClaw step] {cm.group(1).strip()}", path, i)

# 2) Generic: bullet/numbered "Recommendation:" and "ACTION REQUIRED" and "Next Steps" blocks
REC_HEAD = re.compile(r'^\s*(?:-\s*)?(?:\*\*)?(Recommendation|ACTION REQUIRED|Action Required|Next Step|Next Steps|Immediate Action Items|Improvement Recommendation)s?[:.]?\*\*?\s*(.*)$', re.I)
SHOULD = re.compile(
    r'should (?:be|become|implement|be implemented|be added|be moved|be in|be verified|be documented)'
    r'|needs? (?:to|work)'
    r'|recommend(?:ed)? (?:to|that)'
    r'|add (?:a |an |the )?(?:\w+ )?(?:test|coverage|logging|monitor|csp|aria|component test)'
    r'|implement (?:a |an |the )?(?:\w+ )?(?:test suite|monitoring|sync|dynamic import)',
    re.I)

def scan_generic(path):
    lines = open(path, encoding="utf-8", errors="ignore").read().splitlines()
    for i, ln in enumerate(lines, 1):
        m = REC_HEAD.match(ln)
        if m:
            body = (m.group(2) or "").strip()
            # capture continuation lines (indented, not a new bullet/header)
            j = i
            while not body and j < len(lines) and j - i < 5:
                j += 1
                cont = lines[j-1].strip()
                if cont and not cont.startswith('#') and not re.match(r'^\s*[-*]\s', cont) and ':' not in cont[:3]:
                    body = cont
            # also grab a following indented/bulleted detail line as the body if present
            if not body and i < len(lines):
                nxt = lines[i].strip()
                if nxt.startswith('-') or nxt.startswith('*'):
                    body = nxt.lstrip('-* ').strip()
            if body:
                add(body, path, i)
            continue
        if SHOULD.search(ln) and len(ln) < 300:
            # take the sentence containing the signal
            for sent in re.split(r'(?<=[.!?])\s+', ln):
                if SHOULD.search(sent):
                    add(sent.strip().lstrip('-*').strip(), path, i)
                    break

for s in SOURCES:
    if os.path.exists(s):
        if os.path.basename(s) == "openclaw-tasks.md":
            parse_openclaw(s)
        else:
            scan_generic(s)

for r in REVIEWS:
    scan_generic(r)

# Curated, evidence-based cards (verified anchors, not guessed)
CURATED = [
    {"title": "Supabase project reactivated (was auto-paused for low traffic)",
     "source": "memory", "line": 0, "column": "Done", "category": "Backend/Data",
     "priority": "Low", "note": "Reactivated by user 2026-08-11; nslookup resolves."},
    {"title": "Fix Minified React #310 crash in Eclipse mobile app",
     "source": "memory", "line": 0, "column": "Done", "category": "Frontend/UI",
     "priority": "High", "note": "Confirmed fixed (mock data build)."},
    {"title": "Wire In Progress / Blocked workflow into kanban board tooling",
     "source": "memory", "line": 0, "column": "In Progress", "category": "Agent/Tooling",
     "priority": "Medium", "note": "Building interactive board from workspace docs."},
    {"title": "Verify backend test environment before production deploy (review gated)",
     "source": "docs/reviews/archive", "line": 0, "column": "Blocked", "category": "Testing/QA",
     "priority": "High", "note": "2026-06-22 FINAL: APPROVE after fixing backend test env."},
]
for c in CURATED:
    key = (c["source"], c["title"][:60])
    if key not in seen:
        seen.add(key)
        cards.append({"id": f"{len(cards)+1:03d}", **c})

# Dedup by normalized title across all sources; keep first occurrence
final = []
keys = set()
for c in cards:
    k = re.sub(r'[^a-z0-9]', '', c["title"].lower())[:50]
    if k in keys:
        continue
    keys.add(k)
    final.append(c)

out = {
    "generated_from": [os.path.relpath(s, ROOT) for s in SOURCES if os.path.exists(s)] + [os.path.relpath(r, ROOT) for r in REVIEWS],
    "card_count": len(final),
    "cards": final,
}
with open(os.path.join(ROOT, "scripts", "kanban_cards.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, indent=2, ensure_ascii=False)

# Summary by column
from collections import Counter
cols = Counter(c["column"] for c in final)
cats = Counter(c["category"] for c in final)
print("TOTAL CARDS:", len(final))
print("BY COLUMN:", dict(cols))
print("BY CATEGORY:", dict(cats))
print("Sample Backlog/ToDo titles:")
for c in final[:8]:
    print(f"  [{c['column']}|{c['category']}|{c['priority']}] {c['title'][:80]}  ({c['source']}:{c['line']})")
