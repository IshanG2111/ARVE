import logging
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.auth.firebase_auth import verify_firebase_token
from app.auth.jwt import create_access_token
from app.models.models import User
from app.schemas.schemas import UserResponse, Token, FirebaseLogin
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_KWARGS = dict(
    httponly=True,
    secure=False,   # Set True in production (requires HTTPS)
    samesite="lax",
    max_age=settings.effective_jwt_expire_minutes * 60,
)


@router.post("/firebase", response_model=Token)
async def firebase_login(
    payload: FirebaseLogin,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Verifies Firebase ID token, upserts User record with firebase_uid,
    github_access_token, and outputs ARVE access token + sets HTTP-only cookie.
    """
    try:
        fb_data = await verify_firebase_token(payload.id_token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Firebase verification failed: {str(e)}")

    firebase_uid = fb_data.get("uid")
    email = fb_data.get("email") or f"{firebase_uid}@users.firebase.local"
    name = fb_data.get("name") or "Firebase User"
    avatar = fb_data.get("picture")
    username = fb_data.get("github_username") or email.split("@")[0]
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

    db.commit()
    db.refresh(user)

    jwt_token = create_access_token(user.id)
    response.set_cookie("access_token", jwt_token, **COOKIE_KWARGS)

    return {"access_token": jwt_token, "token_type": "bearer"}


@router.post("/logout")
async def logout(response: Response):
    """Clears the access_token httpOnly cookie."""
    response.delete_cookie("access_token", path="/", samesite="lax", httponly=True)
    return {"ok": True}


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return user

