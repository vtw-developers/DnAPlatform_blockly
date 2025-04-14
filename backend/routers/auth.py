from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from typing import Optional
from database import get_db_connection
from models import UserCreate, User, Token, UserLogin
from utils import (
    verify_password,
    get_password_hash,
    create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    get_current_user
)

router = APIRouter()

@router.post("/register", response_model=User)
async def register(user: UserCreate):
    """새로운 사용자 등록"""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # 이메일 중복 확인
        cur.execute(
            "SELECT * FROM users WHERE email = %s",
            (user.email,)
        )
        if cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 등록된 이메일입니다."
            )
        
        # 비밀번호 해싱
        hashed_password = get_password_hash(user.password)
        
        # 사용자 등록
        cur.execute("""
            INSERT INTO users (email, name, password_hash, role)
            VALUES (%s, %s, %s, %s)
            RETURNING id, email, name, role, is_active, created_at, updated_at
        """, (user.email, user.name, hashed_password, user.role))
        
        new_user = cur.fetchone()
        conn.commit()
        return new_user
    finally:
        conn.close()

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """사용자 로그인"""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # 사용자 조회
        cur.execute(
            "SELECT * FROM users WHERE email = %s",
            (form_data.username,)
        )
        user = cur.fetchone()
        
        if not user or not verify_password(form_data.password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="이메일 또는 비밀번호가 올바르지 않습니다.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 토큰 생성
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user["email"], "role": user["role"]},
            expires_delta=access_token_expires
        )
        
        return {"access_token": access_token, "token_type": "bearer"}
    finally:
        conn.close()

@router.get("/me", response_model=User)
async def read_users_me(current_user: dict = Depends(get_current_user)):
    """현재 로그인한 사용자 정보 조회"""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, email, name, role, is_active, created_at, updated_at FROM users WHERE email = %s",
            (current_user["email"],)
        )
        user = cur.fetchone()
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    finally:
        conn.close() 