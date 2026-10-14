from fastapi import Response

from config import settings

REFRESH_COOKIE_PATH = "/api/v1/auth"


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        key=settings.access_cookie_name, value=access_token,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True, secure=settings.cookie_secure, samesite="lax", path="/",
    )
    response.set_cookie(
        key=settings.refresh_cookie_name, value=refresh_token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        httponly=True, secure=settings.cookie_secure, samesite="lax",
        path=REFRESH_COOKIE_PATH,
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(
        key=settings.access_cookie_name, path="/",
        httponly=True, secure=settings.cookie_secure, samesite="lax",
    )
    response.delete_cookie(
        key=settings.refresh_cookie_name, path=REFRESH_COOKIE_PATH,
        httponly=True, secure=settings.cookie_secure, samesite="lax",
    )