import subprocess
import urllib.parse
import urllib.request
import time
import os

ARTIFACT_PATH = r"C:\Users\owner\.gemini\antigravity\brain\28608a9f-9307-4127-9c05-f1134b56dbf9\artifacts\qr.png"
CLI_PATH = r".\tools\signal-cli-0.14.2\bin\signal-cli.bat"

print("Starting auto-refreshing QR code generator...")

while True:
    print("Launching signal-cli link...")
    p = subprocess.Popen([CLI_PATH, "link", "--name", "Horizon PRM"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    
    uri = ""
    # Read until we get the URI
    for line in iter(p.stdout.readline, ''):
        line = line.strip()
        if line.startswith("sgnl://"):
            uri = line
            break
            
    if uri:
        print("Generated new URI, updating artifact...")
        quoted = urllib.parse.quote_plus(uri)
        try:
            urllib.request.urlretrieve(f'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={quoted}', ARTIFACT_PATH)
            print("Artifact updated! Ready to scan.")
        except Exception as e:
            print(f"Failed to download QR: {e}")
    else:
        print("Could not get URI.")
        
    try:
        # Wait up to 50 seconds for the user to scan
        p.wait(timeout=50)
        if p.returncode == 0:
            print("SUCCESS! Device linked successfully!")
            break
        else:
            print("Link command failed or was closed by server. Retrying...")
    except subprocess.TimeoutExpired:
        print("50 seconds elapsed. Regenerating to prevent timeout...")
        subprocess.call(['taskkill', '/F', '/T', '/PID', str(p.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(2)

print("Done. You can now start the daemon.")
