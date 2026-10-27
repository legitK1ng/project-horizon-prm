"""
Google Drive connector for the Horizon Vault Scanner.

Reuses the already-installed `google-api-python-client` + `google-auth`.
Auth precedence (set ONE):
  1. GOOGLE_DRIVE_SA_PATH      -> service-account JSON (share the folder to this SA)
  2. GOOGLE_DRIVE_TOKEN_PATH   -> OAuth token JSON {access_token, refresh_token}
  3. (fallback) client_secret + stored refresh token via google_people_service pattern

Read-only: the scanner never modifies Drive.
"""
import io
import json
import logging
import os
import re
from pathlib import Path
from typing import Iterator, Optional, Tuple

logger = logging.getLogger("horizon.drive")

# Restrict to audio so we don't paginate over the whole vault.
_AUDIO_QUERY = (
    " and (mimeType contains 'audio' or "
    "name contains '.amr' or name contains '.m4a' or "
    "name contains '.mp3' or name contains '.wav' or "
    "name contains '.ogg' or name contains '.aac')"
)
_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]


def _build_creds():
    from google.oauth2 import service_account
    from google.oauth2.credentials import Credentials
    import google.auth.transport.requests as gtr

    sa = os.environ.get("GOOGLE_DRIVE_SA_PATH")
    if sa and Path(sa).exists():
        return service_account.Credentials.from_service_account_file(
            sa, scopes=_SCOPES
        )

    tok = os.environ.get("GOOGLE_DRIVE_TOKEN_PATH")
    if tok and Path(tok).exists():
        try:
            data = json.loads(Path(tok).read_text())
        except Exception as e:
            raise RuntimeError(f"Could not read Drive token {tok}: {e}")
        creds = Credentials(
            token=data.get("access_token"),
            refresh_token=data.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=os.environ.get("GOOGLE_CLIENT_ID"),
            client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
        )
        if not creds.valid:
            creds.refresh(gtr.Request())
        return creds

    raise RuntimeError(
        "No Drive credentials. Set GOOGLE_DRIVE_SA_PATH (service-account JSON, "
        "folder shared to it) or GOOGLE_DRIVE_TOKEN_PATH (OAuth token JSON)."
    )


class DriveConnector:
    """List + download audio files from a Drive folder."""

    def __init__(self, folder_id: str, staging_dir: str):
        self.folder_id = folder_id
        self.staging = Path(staging_dir)
        self.staging.mkdir(parents=True, exist_ok=True)
        from googleapiclient.discovery import build
        self.svc = build("drive", "v3", credentials=_build_creds())
        self._drive_files = self.svc.files()

    def list_audio(
        self, modified_after: Optional[str] = None
    ) -> Iterator[Tuple[str, str, Optional[str]]]:
        """Yield (file_id, name, modified_time) for audio under the folder."""
        q = f"'{self.folder_id}' in parents and trashed=false" + _AUDIO_QUERY
        if modified_after:
            q += f" and modifiedTime > '{modified_after}'"
        page_token = None
        while True:
            resp = self._drive_files.list(
                q=q,
                spaces="drive",
                pageSize=200,
                fields="nextPageToken, files(id,name,modifiedTime,size)",
                pageToken=page_token,
            ).execute()
            for f in resp.get("files", []):
                yield f["id"], f["name"], f.get("modifiedTime")
            page_token = resp.get("nextPageToken")
            if not page_token:
                break

    def download(self, file_id: str, name: str) -> Path:
        """Download to staging (cached by name). Returns local path."""
        dest = self.staging / name
        if dest.exists() and dest.stat().st_size > 0:
            return dest
        req = self._drive_files.get_media(fileId=file_id)
        buf = io.BytesIO()
        from googleapiclient.http import MediaIoBaseDownload
        dl = MediaIoBaseDownload(buf, req)
        done = False
        while not done:
            _, done = dl.next_chunk()
        dest.write_bytes(buf.getvalue())
        logger.info(f"[DRIVE] Downloaded {name} -> {dest}")
        return dest

    def find_sidecar_ids(self, audio_name: str) -> Iterator[Tuple[str, str]]:
        """Yield (file_id, name) for the .properties/.json companion of an audio file.

        ACR stores sidecars either flat in the same folder, or in a
        `properties/` subfolder — with the same stem (minus any (N) copy suffix).
        The sidecar carries the richest metadata: GPS lat/lon, reverse-geocoded
        address, duration_ms, callee E.164. Without it we lose location + duration.
        """
        stem = Path(audio_name).stem
        base = re.sub(r"\s*\(\d+\)$", "", stem).strip()
        exts = (".properties", ".json")
        seen = set()
        for s in {stem, base}:
            for ext in exts:
                for parent in ("", "properties/"):
                    cand = f"{parent}{s}{ext}"
                    q = (
                        f"'{self.folder_id}' in parents and trashed=false "
                        f"and name = '{cand.replace(chr(39), chr(92)+chr(39))}'"
                    )
                    try:
                        resp = self._drive_files.list(
                            q=q, pageSize=2, fields="files(id,name)"
                        ).execute()
                    except Exception as e:
                        logger.warning(f"[DRIVE] sidecar lookup failed for {cand}: {e}")
                        continue
                    for f in resp.get("files", []):
                        if f["id"] not in seen:
                            seen.add(f["id"])
                            yield f["id"], f["name"]

    def latest_modified(self) -> Optional[str]:
        """Most recent modifiedTime in the folder (for incremental polls)."""
        try:
            resp = self._drive_files.list(
                q=f"'{self.folder_id}' in parents and trashed=false" + _AUDIO_QUERY,
                pageSize=1,
                orderBy="modifiedTime desc",
                fields="files(modifiedTime)",
            ).execute()
            files = resp.get("files", [])
            return files[0]["modifiedTime"] if files else None
        except Exception as e:  # pragma: no cover
            logger.warning(f"[DRIVE] latest_modified failed: {e}")
            return None
