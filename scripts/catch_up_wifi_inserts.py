"""
Catch-up script: reads call_recordings.SKIPPED_SHORT records and inserts
any missing ones into call_records. Loops until old sync finishes and
all records are present. Run once; exits when gap = 0 for 3 consecutive checks.
"""
import time
import re
import urllib.request
import urllib.error
import json

SUPABASE_URL = "https://jykucnzotuqingrhufdx.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5a3VjbnpvdHVxaW5ncmh1ZmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA3NjQ3MSwiZXhwIjoyMDg3NjUyNDcxfQ.wHDjNq9ySSYhxb27E8qJ2xIdVZmVUOQxdyAHnrmAAMc"

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

UUID_PAT = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
PHONE_PAT = re.compile(r'^[\+\d\s\-\(\)]{7,}$')


def rpc_query(sql):
    url = f"{SUPABASE_URL}/rest/v1/rpc/execute_sql"
    data = json.dumps({"query": sql}).encode()
    req = urllib.request.Request(url, data=data, headers={**HEADERS, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"error": str(e)}


def get_counts():
    """Return (call_records_wifi, call_recordings_acr_wifi)."""
    try:
        # call_records count
        url1 = f"{SUPABASE_URL}/rest/v1/call_records?acr_channel=eq.wifi_sync&select=id"
        req1 = urllib.request.Request(url1, headers={**HEADERS, "Prefer": "count=exact", "Range": "0-0"})
        with urllib.request.urlopen(req1, timeout=10) as r:
            cr_count = int(r.headers.get("Content-Range", "0-0/0").split("/")[-1])

        # call_recordings count
        url2 = f"{SUPABASE_URL}/rest/v1/call_recordings?canonical_name=like.acr_wifi_%25&select=id"
        req2 = urllib.request.Request(url2, headers={**HEADERS, "Prefer": "count=exact", "Range": "0-0"})
        with urllib.request.urlopen(req2, timeout=10) as r:
            arc_count = int(r.headers.get("Content-Range", "0-0/0").split("/")[-1])

        return cr_count, arc_count
    except Exception as e:
        print(f"  [count error] {e}")
        return 0, 0


def fetch_skipped_not_in_records(batch_size=500):
    """Fetch SKIPPED_SHORT records not yet in call_records."""
    url = (f"{SUPABASE_URL}/rest/v1/call_recordings"
           f"?canonical_name=like.acr_wifi_%25&status=eq.SKIPPED_SHORT&select=parse_notes"
           f"&limit={batch_size}")
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        rows = json.loads(r.read())

    # Fetch existing acr_patterns
    url2 = (f"{SUPABASE_URL}/rest/v1/call_records"
            f"?acr_channel=eq.wifi_sync&select=acr_pattern&limit=10000")
    req2 = urllib.request.Request(url2, headers=HEADERS)
    with urllib.request.urlopen(req2, timeout=30) as r:
        existing = {row["acr_pattern"] for row in json.loads(r.read())}

    new_rows = []
    for row in rows:
        try:
            notes = json.loads(row["parse_notes"] or "{}")
            acr_id = notes.get("acr_id")
            if not acr_id:
                continue
            pattern = f"wifi_{acr_id}"
            if pattern in existing:
                continue

            contact = notes.get("contact") or ""
            if UUID_PAT.match(contact) or PHONE_PAT.match(contact) or not contact:
                contact_name = "Unknown"
                phone = contact if PHONE_PAT.match(contact) else None
            else:
                contact_name = contact
                phone = None

            new_rows.append({
                "contact_name": contact_name,
                "phone_number": phone,
                "acr_channel": "wifi_sync",
                "status": "pending",
                "acr_pattern": pattern,
            })
        except Exception:
            pass
    return new_rows


def insert_batch(rows):
    if not rows:
        return 0
    url = f"{SUPABASE_URL}/rest/v1/call_records"
    data = json.dumps(rows).encode()
    req = urllib.request.Request(url, data=data, headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            r.read()
        return len(rows)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  [insert error {e.code}] {body[:200]}")
        return 0


def main():
    zero_gap_count = 0
    total_inserted = 0
    iteration = 0

    print("Starting catch-up WiFi insert loop...")
    print("Will exit when gap=0 for 3 consecutive checks.\n")

    while True:
        iteration += 1
        cr_count, arc_count = get_counts()
        gap = arc_count - cr_count
        print(f"[{iteration:03d}] call_records={cr_count:,}  call_recordings={arc_count:,}  gap={gap}  total_ingested_so_far={total_inserted:,}")

        if gap <= 0:
            zero_gap_count += 1
            if zero_gap_count >= 3:
                print(f"\nAll {arc_count:,} records are in call_records. Done!")
                print(f"Total inserted by this script: {total_inserted:,}")
                break
            print(f"  Gap is 0 ({zero_gap_count}/3 consecutive). Waiting for sync to add more...")
            time.sleep(5)
            continue
        else:
            zero_gap_count = 0

        # Fetch and insert missing records
        try:
            missing = fetch_skipped_not_in_records(batch_size=1000)
        except Exception as e:
            print(f"  [fetch error] {e}")
            time.sleep(3)
            continue

        if not missing:
            print(f"  Nothing to insert right now (gap={gap} may be timing artifact)")
            time.sleep(3)
            continue

        # Insert in chunks of 200
        for i in range(0, len(missing), 200):
            chunk = missing[i:i+200]
            n = insert_batch(chunk)
            total_inserted += n
            if n:
                print(f"  Inserted {n} records (chunk {i//200+1})")

        time.sleep(2)


if __name__ == "__main__":
    main()
