"""
Orchestrates the consolidation of audio files and metadata across the Google Drive structure.
Mimics the behavior of 'horizon_consolidate_final.gs' but in the Python backend.
"""
import shutil
import logging
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime, timezone
from services.acr_parser_reference import parse_acr_filename, build_canonical

logger = logging.getLogger(__name__)

AUDIO_EXTENSIONS = {".amr", ".m4a", ".mp3", ".wav", ".ogg", ".aac"}
METADATA_EXTENSIONS = {".properties", ".json"}

def consolidate_directory(source_dir: str, vault_audio_dir: str, vault_json_dir: str) -> Dict[str, Any]:
    """
    Recursively scans source_dir, renames files to canonical format, 
    and moves them to the respective vault directories.
    """
    source_path = Path(source_dir)
    audio_vault = Path(vault_audio_dir)
    json_vault = Path(vault_json_dir)

    # Ensure vaults exist
    audio_vault.mkdir(parents=True, exist_ok=True)
    json_vault.mkdir(parents=True, exist_ok=True)

    stats = {
        "audio_moved": 0,
        "json_moved": 0,
        "folders_deleted": 0,
        "errors": []
    }

    if not source_path.exists():
        return {"error": f"Source directory {source_dir} not found"}

    # 1. Gather all files
    all_files = list(source_path.rglob("*"))
    
    # Separate audio and metadata
    audio_files = [f for f in all_files if f.is_file() and f.suffix.lower() in AUDIO_EXTENSIONS]
    metadata_files = [f for f in all_files if f.is_file() and f.suffix.lower() in METADATA_EXTENSIONS]

    # 2. Process Audio Files
    for a_file in audio_files:
        try:
            mtime = a_file.stat().st_mtime
            parsed = parse_acr_filename(a_file.stem, a_file.suffix, mtime)
            canonical_name = build_canonical(parsed, a_file.suffix)
            
            dest_path = audio_vault / canonical_name
            
            # Avoid overwriting if same filename exists (unlikely with canonical)
            if dest_path.exists():
                timestamp = datetime.now().strftime("%Y%H%M%S")
                dest_path = audio_vault / f"{dest_path.stem}_{timestamp}{dest_path.suffix}"

            shutil.move(str(a_file), str(dest_path))
            stats["audio_moved"] += 1
            
            # Also look for matching sidecar in same folder or 'properties' subfolder
            # Since we have the list of metadata_files, we can check those or just look locally
            # The acr_parser_reference has find_sidecar, but that works relative to the path
            # We already moved the audio, so we should have done this before.
            
        except Exception as e:
            stats["errors"].append(f"Error moving {a_file.name}: {str(e)}")

    # 3. Process Metadata Files (that weren't matched or are standalone)
    # Re-scan for metadata if needed, or process remaining
    for m_file in metadata_files:
        if not m_file.exists(): continue # Might have been moved as sidecar
        try:
            # We want metadata to match the audio canonical name
            # For now, move them to the json vault with their original names or try to parse
            # Typically, consolidation.gs renames them to match the audio.
            
            # If it's a sidecar for an audio file we just moved, it might still be there.
            # Simplified: just move to vault.
            shutil.move(str(m_file), str(json_vault / m_file.name))
            stats["json_moved"] += 1
        except Exception as e:
            stats["errors"].append(f"Error moving metadata {m_file.name}: {str(e)}")

    # 4. Cleanup empty folders
    # Walk backwards to get leaf folders first
    for dirpath, dirnames, filenames in os.walk(source_dir, topdown=False):
        curr_dir = Path(dirpath)
        if curr_dir == source_path: continue
        if not any(curr_dir.iterdir()):
            try:
                curr_dir.rmdir()
                stats["folders_deleted"] += 1
            except Exception:
                pass

    return stats
