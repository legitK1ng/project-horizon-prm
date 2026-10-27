import logging
import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend

# REQ-037: Field-Level Encryption
# Uses AES-256-GCM for robust, authenticated encryption of sensitive relationship notes.

logger = logging.getLogger(__name__)

# Derived key is cached after first derivation — PBKDF2 with 100k iterations
# is intentionally slow and must not run on every encrypt/decrypt call.
_derived_key: bytes | None = None


def _get_master_key() -> bytes:
    """Derive (once) and cache the 256-bit AES key from the environment passphrase."""
    global _derived_key
    if _derived_key is not None:
        return _derived_key

    raw_key = os.environ.get("FIELD_ENCRYPTION_MASTER_KEY")
    if not raw_key:
        logger.warning("[CRYPTO] FIELD_ENCRYPTION_MASTER_KEY not set — using insecure dev key.")
        raw_key = "development-secret-do-not-use-in-production"

    # We use PBKDF2 to derive a 32-byte key from the string secret
    # This allows users to provide a human-readable passphrase if they wish.
    salt = b"horizon_static_salt"  # In a multi-tenant system, this should be per-user
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100_000,
        backend=default_backend(),
    )
    _derived_key = kdf.derive(raw_key.encode())
    return _derived_key


def encrypt_data(plain_text: str) -> tuple[str, str]:
    """
    Encrypts string data using AES-256-GCM.
    Returns (encrypted_base64, iv_base64).
    """
    if not plain_text:
        return "", ""

    key = _get_master_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)  # GCM standard nonce size

    ciphertext = aesgcm.encrypt(nonce, plain_text.encode(), None)

    return (
        base64.b64encode(ciphertext).decode("utf-8"),
        base64.b64encode(nonce).decode("utf-8"),
    )


def decrypt_data(encrypted_base64: str, iv_base64: str) -> str:
    """
    Decrypts AES-256-GCM data.
    """
    if not encrypted_base64 or not iv_base64:
        return ""

    try:
        key = _get_master_key()
        aesgcm = AESGCM(key)

        ciphertext = base64.b64decode(encrypted_base64.encode("utf-8"))
        nonce = base64.b64decode(iv_base64.encode("utf-8"))

        decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, None)
        return decrypted_bytes.decode("utf-8")
    except Exception as e:
        logger.error(f"[CRYPTO] Decryption failed: {e}")
        return "[DECRYPTION_FAILED]"
