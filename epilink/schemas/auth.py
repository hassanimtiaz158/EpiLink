from pydantic import BaseModel


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool


class UserSignup(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "viewer"


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
