from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from typing import Optional
from database import get_db_connection
from models import UserCreate, User, Token, UserLogin, UserUpdate
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
            INSERT INTO users (email, name, password_hash, role, organization)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, email, name, role, organization, is_active, created_at, updated_at
        """, (user.email, user.name, hashed_password, user.role, user.organization))
        
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
            "SELECT id, email, name, role, organization, is_active, created_at, updated_at FROM users WHERE email = %s",
            (current_user["email"],)
        )
        user = cur.fetchone()
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    finally:
        conn.close()

@router.patch("/me", response_model=User)
async def update_user_profile(user_update: UserUpdate, current_user: dict = Depends(get_current_user)):
    """현재 로그인한 사용자 정보 수정"""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        update_fields = []
        update_values = []
        
        if user_update.name is not None:
            update_fields.append("name = %s")
            update_values.append(user_update.name)
            
        if user_update.organization is not None:
            update_fields.append("organization = %s")
            update_values.append(user_update.organization)
            
        if user_update.password is not None:
            update_fields.append("password_hash = %s")
            update_values.append(get_password_hash(user_update.password))
            
        if not update_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="수정할 정보가 없습니다."
            )
            
        update_values.append(current_user["email"])
        
        query = f"""
            UPDATE users 
            SET {", ".join(update_fields)}, updated_at = CURRENT_TIMESTAMP
            WHERE email = %s
            RETURNING id, email, name, role, organization, is_active, created_at, updated_at
        """
        
        cur.execute(query, update_values)
        updated_user = cur.fetchone()
        
        if updated_user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="사용자를 찾을 수 없습니다."
            )
            
        conn.commit()
        return updated_user
    finally:
        conn.close() 