from datetime import datetime, timedelta, timezone
from jose import jwt
from config import settings

payload = {
    "user_id": 118,
    "sid": "test-session",
    "type": "access",
    "iat": datetime.now(timezone.utc) - timedelta(hours=2),
    "exp": datetime.now(timezone.utc) - timedelta(hours=1),
}

token = jwt.encode(
    payload,
    settings.secret_key,
    algorithm=settings.algorithm
)

print(token)