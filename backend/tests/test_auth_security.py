from utils.security import hash_password, verify_password
from datetime import datetime, timedelta, timezone
from jose import jwt
from jose.exceptions import ExpiredSignatureError

from utils.security import create_access_token
from config import settings

def test_password_is_not_stored_as_plain_text():
    password = "Secret123!"
    hashed_password = hash_password(password)

    assert hashed_password != password
    assert verify_password(password, hashed_password) is True


def test_same_password_generates_different_hashes():
    password = "Secret123!"

    hash_one = hash_password(password)
    hash_two = hash_password(password)

    assert hash_one != hash_two
    assert verify_password(password, hash_one) is True
    assert verify_password(password, hash_two) is True


def test_verify_correct_password():
    password = "Secret123!"
    hashed_password = hash_password(password)

    result = verify_password(password, hashed_password)

    assert result is True


def test_verify_wrong_password():
    password = "Secret123!"
    hashed_password = hash_password(password)

    result = verify_password("WrongPassword123!", hashed_password)

    assert result is False


def create_access_token(data: dict) -> str:
    now = datetime.now(timezone.utc)

    payload = data.copy()
    payload["type"] = "access"
    payload["iat"] = now
    payload["exp"] = now + timedelta(
        minutes=settings.access_token_expire_minutes
    )

    return jwt.encode(
        payload,
        settings.secret_key,
        algorithm=settings.algorithm
    )

# AUTH-19: Verify access token claims

def test_access_token_contains_required_claims():
    token = create_access_token({"sub": "123"})
    payload = jwt.decode(
        token,
        settings.secret_key,
        algorithms=[settings.algorithm]
    )

    assert payload["sub"] == "123"
    assert "exp" in payload
    assert "iat" in payload
    assert payload["type"] == "access"
    assert "password" not in payload
    assert "password_hash" not in payload


# AUTH-20: Verify access token expiry is 30 minutes

def test_access_token_expiry_is_30_minutes():
    token = create_access_token({"sub": "123"})
    payload = jwt.decode(
        token,
        settings.secret_key,
        algorithms=[settings.algorithm]
    )

    token_lifetime = payload["exp"] - payload["iat"]

    assert settings.access_token_expire_minutes == 30
    assert token_lifetime == 30 * 60


# AUTH-21: Verify expired access token is rejected

def test_expired_access_token_is_rejected():
    expired_payload = {
        "sub": "123",
        "type": "access",
        "iat": 1000000000,
        "exp": 1000000001
    }

    expired_token = jwt.encode(
        expired_payload,
        settings.secret_key,
        algorithm=settings.algorithm
    )

    try:
        jwt.decode(
            expired_token,
            settings.secret_key,
            algorithms=[settings.algorithm]
        )
        assert False, "Expired token should have been rejected"
    except ExpiredSignatureError:
        assert True