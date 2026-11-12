from datetime import datetime, timedelta, timezone
import jwt
from config import settings

now = datetime.now(timezone.utc)

payload = {
    "user_id": 4,
    "sid": 147,
    "type": "refresh",
    "iat": now - timedelta(hours=2),
    "exp": now - timedelta(hours=1)
}

token = jwt.encode(
    payload,
    settings.secret_key,
    algorithm=settings.algorithm
)

print(token)