# Safe: Strong SHA-256 Hashing Algorithm
import hashlib

def hash_token_safe(token: str):
    return hashlib.sha256(token.encode()).hexdigest()
