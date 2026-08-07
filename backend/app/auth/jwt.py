from datetime import datetime, timedelta, timezone
from typing import Union
import jwt
from app.core.config import settings

def create_access_token(user_id: Union[int, str]) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.effective_jwt_expire_minutes)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.effective_jwt_secret, algorithm=settings.effective_jwt_algorithm)

def decode_access_token(token: str) -> Union[str, None]:
    try:
        payload = jwt.decode(token, settings.effective_jwt_secret, algorithms=[settings.effective_jwt_algorithm])
        return payload.get("sub")
    except Exception:
        return None
