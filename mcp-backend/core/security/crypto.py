import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend

# REQ-037: Field-Level Encryption
# Uses AES-256-GCM for robust, authenticated encryption of sensitive relationship notes.

def _get_master_key() -> bytes:
    """Retrieves or derives the 256-bit encryption key from environment."""
    raw_key = os.environ.get("FIELD_ENCRYPTION_MASTER_KEY")
    if not raw_key:
        # Fallback to a development-only key if not set (NOT FOR PRODUCTION)
        # In production, this should throw an EnvironmentError
        print("[WARNING] FIELD_ENCRYPTION_MASTER_KEY not set. Using insecure dev key.")
        raw_key = "development-secret-do-not-use-in-production"
    
    # We use PBKDF2 to derive a 32-byte key from the string secret
    # This allows users to provide a human-readable passphrase if they wish.
    salt = b'horizon_static_salt' # In a multi-tenant system, this should be per-user
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
        backend=default_backend()
    )
    return kdf.derive(raw_key.encode())

def encrypt_data(plain_text: str) -> tuple[str, str]:
    """
    Encrypts string data using AES-256-GCM.
    Returns (encrypted_base64, iv_base64).
    """
    if not plain_text:
        return "", ""
    
    key = _get_master_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12) # GCM standard nonce size
    
    ciphertext = aesgcm.encrypt(nonce, plain_text.encode(), None)
    
    return (
        base64.b64encode(ciphertext).decode('utf-8'),
        base64.b64encode(nonce).decode('utf-8')
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
        
        ciphertext = base64.b64decode(encrypted_base64.encode('utf-8'))
        nonce = base64.b64decode(iv_base64.encode('utf-8'))
        
        decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, None)
        return decrypted_bytes.decode('utf-8')
    except Exception as e:
        print(f"[CRYPTO ERROR] Decryption failed: {str(e)}")
        return "[DECRYPTION_FAILED]"
