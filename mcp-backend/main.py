import os
import sys
from fastapi import FastAPI
from supabase import create_client, Client
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

# Load environment variables
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

# Initialize Supabase Client
supabase: Client | None = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("Supabase client successfully initialized.", file=sys.stderr)
    except Exception as e:
        print(f"Failed to initialize Supabase client: {e}", file=sys.stderr)
else:
    print("Warning: SUPABASE_URL or SUPABASE_KEY environment variables are missing.", file=sys.stderr)

# Initialize FastMCP Server
mcp = FastMCP("Horizon-MCP-Server")

@mcp.tool()
def get_db_status() -> str:
    """Check if the Supabase database connection is active."""
    if supabase:
        return "Supabase connection is active and configured."
    return "Supabase connection is not initialized."

# Initialize FastAPI App (for future HTTP routes if needed alongside MCP)
app = FastAPI(title="Horizon FastMCP Backend")

@app.get("/health")
def health_check():
    return {
        "status": "ok", 
        "mcp_server": mcp.name,
        "db_connected": supabase is not None
    }

if __name__ == "__main__":
    # If run with 'api', start the standard FastAPI server instead of the MCP stdio server
    if len(sys.argv) > 1 and sys.argv[1] == "api":
        import uvicorn
        print("Starting FastAPI server...", file=sys.stderr)
        uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
    else:
        print("Starting FastMCP server on stdio...", file=sys.stderr)
        mcp.run()
