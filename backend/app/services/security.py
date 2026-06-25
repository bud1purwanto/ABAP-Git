import bcrypt

_BCRYPT_PREFIXES = ("$2a$", "$2b$", "$2y$")


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def is_hashed(password: str) -> bool:
    return password.startswith(_BCRYPT_PREFIXES)


def verify_password(plain_password: str, stored_password: str) -> bool:
    if is_hashed(stored_password):
        return bcrypt.checkpw(plain_password.encode("utf-8"), stored_password.encode("utf-8"))
    # Legacy plaintext row (pre-existing data) — compare directly.
    return plain_password == stored_password
