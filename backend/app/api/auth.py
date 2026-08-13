from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.auth.firebase_auth import verify_firebase_token
from app.auth.jwt import create_access_token
from app.core import security
from app.core.config import settings
from app.core.database import get_db
from app.models.models import User
from app.schemas.schemas import FirebaseLogin, Token, UserCreate, UserLogin, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_KWARGS = dict(
    httponly=True,
    secure=settings.cookie_secure,
    samesite="lax",
    max_age=settings.effective_jwt_expire_minutes * 60,
)


@router.post("/firebase", response_model=Token)
async def firebase_login(
    payload: FirebaseLogin,
    response: Response,
    db: Session = Depends(get_db),
):
    try:
        fb_data = await verify_firebase_token(payload.id_token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Firebase verification failed") from exc

    firebase_uid = fb_data.get("uid")
    if not firebase_uid:
        raise HTTPException(status_code=401, detail="Firebase token did not contain a user ID")

    email = fb_data.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Firebase token did not contain an email")

    name = fb_data.get("name") or "Firebase User"
    avatar = fb_data.get("picture")
    username = fb_data.get("github_username") or email.split("@", 1)[0]
    github_id = fb_data.get("github_id")

    user = db.query(User).filter(
        (User.firebase_uid == firebase_uid) | (User.email == email)
    ).first()

    if not user:
        user = User(
            firebase_uid=firebase_uid,
            github_id=github_id,
            email=email,
            full_name=name,
            username=username,
            avatar_url=avatar,
            github_login=username,
            github_avatar=avatar,
            github_access_token=payload.github_access_token,
        )
        db.add(user)
    else:
        user.firebase_uid = firebase_uid
        if github_id:
            user.github_id = github_id
        if avatar:
            user.avatar_url = avatar
            user.github_avatar = avatar
        if username:
            user.username = username
            user.github_login = username
        if payload.github_access_token:
            user.github_access_token = payload.github_access_token

    try:
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise

    jwt_token = create_access_token(user.id)
    response.set_cookie("access_token", jwt_token, **COOKIE_KWARGS)
    return {"access_token": jwt_token, "token_type": "bearer"}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/", samesite="lax", httponly=True)
    return {"ok": True}


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return user


# Legacy direct-auth endpoints are retained for existing local development data.
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user_in.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="A user with this email already exists.")

    new_user = User(
        email=user_in.email,
        hashed_password=security.get_password_hash(user_in.password),
        full_name=user_in.full_name,
        username=user_in.email.split("@", 1)[0],
    )
    db.add(new_user)
    try:
        db.commit()
        db.refresh(new_user)
    except Exception:
        db.rollback()
        raise
    return new_user


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    response: Response = None,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not user.hashed_password or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(user.id)
    if response:
        response.set_cookie("access_token", access_token, **COOKIE_KWARGS)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login/json", response_model=Token)
def login_json(user_in: UserLogin, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_in.email).first()
    if not user or not user.hashed_password or not security.verify_password(user_in.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    access_token = create_access_token(user.id)
    response.set_cookie("access_token", access_token, **COOKIE_KWARGS)
    return {"access_token": access_token, "token_type": "bearer"}
