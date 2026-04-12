import os
from dotenv import load_dotenv
from supabase import create_client
import google.generativeai as genai

load_dotenv()

def check_supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        return "FAIL: Missing credentials"
    try:
        supabase = create_client(url, key)
        # Simple query to verify connection
        res = supabase.table("profiles").select("count", count="exact").limit(1).execute()
        return f"PASS (Connected to {url})"
    except Exception as e:
        return f"FAIL: {e}"

def check_gemini():
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return "FAIL: Missing GOOGLE_API_KEY"
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-pro')
        response = model.generate_content("Ping")
        return f"PASS (Gemini responded: {response.text[:10]})"
    except Exception as e:
        return f"FAIL: {e}"

if __name__ == "__main__":
    print(f"SUPABASE: {check_supabase()}")
    print(f"GEMINI:   {check_gemini()}")
    print(f"HF_TOKEN: {'SET' if os.environ.get('HUGGINGFACE_TOKEN') else 'MISSING'}")
