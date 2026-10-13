from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    must_change_password: bool
    profile_completed: bool
    role_id: int


class ChangePasswordRequest(BaseModel):
    new_password: str
    confirm_password: str
    # Only required when the user is NOT in the first-login flow.
    current_password: str | None = None


class ChangePasswordResponse(BaseModel):
    message: str
    access_token: str
    token_type: str
    role_id: int
    profile_completed: bool