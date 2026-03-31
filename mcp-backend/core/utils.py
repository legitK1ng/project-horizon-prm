import uuid
import hashlib
import logging

logger = logging.getLogger(__name__)

def generate_stable_uuid(identifier: str) -> str:
    """
    REQ-031: Deterministically generate a UUID from a string identifier.
    Ensures 'demo-user' always maps to the same UUID for DB foreign keys.
    """
    hash_obj = hashlib.sha256(identifier.encode())
    hash_hex = hash_obj.hexdigest()
    # Use first 32 chars of SHA256 hash to create a valid UUID
    return str(uuid.UUID(hash_hex[:32]))
