import os
import sys
import traceback

def diagnostic():
    print("🔍 DIAGNOSTIC START")
    
    # 1. Check os.environ
    print("Checking os.environ keys and values...")
    for k, v in os.environ.items():
        if '\0' in k or '\0' in v:
            print(f"❌ FOUND NULL BYTE IN ENV: {k}")
            return
            
    # 2. Check sys.path
    print("Checking sys.path...")
    for p in sys.path:
        if '\0' in p:
            print(f"❌ FOUND NULL BYTE IN sys.path: {p}")
            return

    # 3. Attempt progressive imports
    try:
        print("Importing dotenv...")
        import dotenv
        print("Loading .env...")
        dotenv.load_dotenv()
        
        print("Importing FastAPI...")
        from fastapi import FastAPI
        
        print("Importing routers.calls...")
        from routers import calls
        
        print("Importing main...")
        import main
        
        print("✅ ALL IMPORTS SUCCESSFUL")
    except Exception:
        print("❌ IMPORT FAILED")
        traceback.print_exc()

if __name__ == "__main__":
    diagnostic()
