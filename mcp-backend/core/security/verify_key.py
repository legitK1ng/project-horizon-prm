"""
verify_key.py — FIELD_ENCRYPTION_MASTER_KEY startup verifier

Runs at ingestion server startup (ingestion_server.py) before routes go live.
Performs a presence check + round-trip encrypt/decrypt test using the configured
master key.

On failure: logs CRITICAL and raises SystemExit(1), preventing the server from
starting in a state where it would silently corrupt or lose transcript data.

On success: logs confirmation and returns.

See Constitution §8 — Transcript Encryption (REQ-037).
See TECHNICAL_CORRECTIONS.md PATCH-07.
"""

import logging
import os
import sys

logger = logging.getLogger("horizon.startup")

_CANARY_PLAINTEXT = "horizon-key-verification-canary-v1"


def verify_encryption_key() -> None:
    """
    Verify FIELD_ENCRYPTION_MASTER_KEY is present and functional.
    Call this BEFORE any routes are registered in ingestion_server.py lifespan.

    Raises SystemExit(1) on failure — this is intentional. A misconfigured key
    causes every incoming call to write unrecoverable ciphertext to Supabase.
    """
    master_key = os.environ.get("FIELD_ENCRYPTION_MASTER_KEY")

    # 1. Presence check — crypto.py silently falls back to a dev key when absent,
    #    so we must catch the missing key here before any crypto call.
    if not master_key:
        logger.critical(
            "STARTUP FAILURE: FIELD_ENCRYPTION_MASTER_KEY is not set.\n"
            "All transcript data requires this key for AES-256-GCM encryption.\n"
            "If you have lost this key, existing encrypted transcripts are UNRECOVERABLE.\n"
            "Generate a new key with: python -c \"import secrets; print(secrets.token_urlsafe(32))\"\n"
            "Store it in a password manager SEPARATE from this codebase."
        )
        sys.exit(1)

    # 2. Import crypto — validates the module loads cleanly
    try:
        from core.security.crypto import encrypt_data, decrypt_data
    except ImportError as exc:
        logger.critical(f"STARTUP FAILURE: Cannot import crypto module: {exc}")
        sys.exit(1)

    # 3. Round-trip encrypt
    try:
        ciphertext_b64, iv_b64 = encrypt_data(_CANARY_PLAINTEXT)
    except Exception as exc:
        logger.critical(
            f"STARTUP FAILURE: FIELD_ENCRYPTION_MASTER_KEY failed encryption test.\n"
            f"Error: {exc}\n"
            "The key may be malformed or corrupted."
        )
        sys.exit(1)

    # 4. Round-trip decrypt
    try:
        recovered = decrypt_data(ciphertext_b64, iv_b64)
    except Exception as exc:
        logger.critical(
            f"STARTUP FAILURE: FIELD_ENCRYPTION_MASTER_KEY failed decryption test.\n"
            f"Error: {exc}\n"
            "The key may have changed since transcripts were encrypted, or is malformed.\n"
            "WARNING: Do NOT delete this key — transcripts encrypted under it would be lost."
        )
        sys.exit(1)

    # 5. Value integrity check
    if recovered != _CANARY_PLAINTEXT:
        logger.critical(
            "STARTUP FAILURE: FIELD_ENCRYPTION_MASTER_KEY round-trip integrity check failed.\n"
            "Encrypted and decrypted values do not match — key may be corrupted."
        )
        sys.exit(1)

    # 6. Warn on short keys (token_urlsafe(32) → ~43 chars)
    if len(master_key) < 32:
        logger.warning(
            f"FIELD_ENCRYPTION_MASTER_KEY is {len(master_key)} chars — "
            "minimum recommended is 43 (output of secrets.token_urlsafe(32)). "
            "Consider rotating to a stronger key."
        )

    logger.info(
        f"✓ FIELD_ENCRYPTION_MASTER_KEY verified — "
        f"key length: {len(master_key)} chars, round-trip: PASS"
    )
