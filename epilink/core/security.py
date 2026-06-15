import hashlib


def hash_physician_id(raw_id: str) -> str:
    return hashlib.sha256(raw_id.encode("utf-8")).hexdigest()
