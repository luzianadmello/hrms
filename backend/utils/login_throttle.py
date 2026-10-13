import time
from threading import Lock

from fastapi import HTTPException, status

from config import settings


_failures: dict[str, list[float]] = {}
_lock = Lock()


def _window() -> float:
    return settings.login_lock_minutes * 60


def _recent(key: str) -> list[float]:
    cutoff = time.time() - _window()
    attempts = [t for t in _failures.get(key, []) if t > cutoff]
    if attempts:
        _failures[key] = attempts
    else:
        _failures.pop(key, None)
    return attempts


def check_not_locked(key: str) -> None:
    with _lock:
        if len(_recent(key)) >= settings.login_max_attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "Too many failed attempts. "
                    f"Try again in {settings.login_lock_minutes} minutes."
                ),
            )


def record_failure(key: str) -> None:
    with _lock:
        _recent(key)
        _failures.setdefault(key, []).append(time.time())


def clear(key: str) -> None:
    with _lock:
        _failures.pop(key, None)
