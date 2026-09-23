# Vulnerable: Weak Hashing Algorithm
import hashlib

def hash_token(token: str):
    return hashlib.md5(token.encode()).hexdigest()
