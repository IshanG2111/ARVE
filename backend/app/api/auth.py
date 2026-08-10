import secrets
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core import security
from app.auth.github import build_authorize_url, exchange_code_for_token, fetch_github_user
from app.auth.firebase_auth import verify_firebase_token
from app.auth.jwt import create_access_token
from app.models.models import User
from app.schemas.schemas import UserCreate, UserLogin, UserResponse, Token, FirebaseLogin
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



@router.get("/github/login")
async def github_login(request: Request):
    """Initiates GitHub OAuth flow via top-level browser redirect."""
    state = secrets.token_urlsafe(24)
    is_demo = settings.effective_github_client_id == "arve_demo_client_id"

    if is_demo:
        # In demo mode, directly redirect to callback with mock code
        redirect_target = f"{settings.effective_github_redirect_uri}?code=mock_github_code&state={state}"
        response = RedirectResponse(redirect_target)
        response.set_cookie("oauth_state", state, httponly=True, samesite="lax", max_age=600)
        return response

    auth_url = build_authorize_url(state)
    response = RedirectResponse(auth_url)
    response.set_cookie("oauth_state", state, httponly=True, samesite="lax", max_age=600)
    return response


@router.get("/github/callback")
async def github_callback(
    code: str,
    state: Optional[str] = None,
    request: Request = None,
    db: Session = Depends(get_db),
):
    """
    Handles GitHub OAuth redirect callback, verifies state, upserts user,
    issues JWT httpOnly cookie, and redirects browser to dashboard.
    """
    expected_state = request.cookies.get("oauth_state") if request else None

    # Validate state unless demo mode or absent state cookie
    if expected_state and state and state != expected_state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    if code in ("mock_github_code", "mock_code") or settings.effective_github_client_id == "arve_demo_client_id":
        gh_user = {
            "id": 10293847,
            "login": "octocat-dev",
            "email": "octocat@github.com",
            "name": "Octocat Security Tester",
            "avatar_url": "https://avatars.githubusercontent.com/u/583231?v=4",
        }
        access_token = "mock_github_access_token_123"
    else:
        try:
            access_token = await exchange_code_for_token(code)
            gh_user = await fetch_github_user(access_token)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    gh_id_str = str(gh_user["id"])
    email = gh_user.get("email") or f"{gh_user['login']}@users.noreply.github.com"
    login = gh_user["login"]
    avatar = gh_user.get("avatar_url")

    # Upsert user
    user = db.query(User).filter((User.github_id == gh_id_str) | (User.email == email)).first()

    if not user:
        user = User(
            email=email,
            full_name=gh_user.get("name") or login,
            github_id=gh_id_str,
            github_login=login,
            github_avatar=avatar,
            username=login,
            avatar_url=avatar,
            github_access_token=access_token,
        )
        db.add(user)
    else:
        user.github_id = gh_id_str
        user.github_login = login
        user.github_avatar = avatar
        user.username = login
        user.avatar_url = avatar
        user.github_access_token = access_token

    db.commit()
    db.refresh(user)

    jwt_token = create_access_token(user.id)

    redirect = RedirectResponse(f"{settings.effective_frontend_url}/dashboard", status_code=status.HTTP_302_FOUND)
    redirect.set_cookie("access_token", jwt_token, **COOKIE_KWARGS)
    redirect.delete_cookie("oauth_state")
    return redirect


@router.post("/logout")
async def logout(response: Response):
    """Clears the access_token httpOnly cookie."""
    response.delete_cookie("access_token")
    return {"ok": True}


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return user


# Legacy / direct API auth routes
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user_in.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="A user with this email already exists.")
    
    new_user = User(
        email=user_in.email,
        hashed_password=security.get_password_hash(user_in.password),
        full_name=user_in.full_name,
        username=user_in.email.split("@")[0]
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), response: Response = None, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
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
    if not user or not security.verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    access_token = create_access_token(user.id)
    response.set_cookie("access_token", access_token, **COOKIE_KWARGS)
    return {"access_token": access_token, "token_type": "bearer"}
