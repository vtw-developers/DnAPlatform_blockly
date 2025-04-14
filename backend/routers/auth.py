from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from typing import Optional, List
from database import get_db_connection
from models import UserCreate, User, Token, UserLogin, UserUpdate, UserListResponse, UserRole
from utils import (
    verify_password,
    get_password_hash,
    create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    get_current_user,
    get_current_admin_user
)

router = APIRouter()

async def create_admin_if_not_exists():
    """기본 관리자 계정이 없는 경우 생성"""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # 관리자 계정 존재 여부 확인
        cur.execute("SELECT * FROM users WHERE role = 'admin'")
        if not cur.fetchone():
            # 관리자 계정 생성
            admin_email = "admin@example.com"
            admin_password = "admin123"  # 실제 운영 환경에서는 더 강력한 비밀번호 사용
            hashed_password = get_password_hash(admin_password)
            
            cur.execute("""
                INSERT INTO users (email, name, password_hash, role, organization, is_active)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (admin_email, "관리자", hashed_password, UserRole.ADMIN, "시스템", True))
            
            conn.commit()
            print(f"기본 관리자 계정이 생성되었습니다. 이메일: {admin_email}, 비밀번호: {admin_password}")
    finally:
        conn.close()

# 서버 시작 시 관리자 계정 생성
import asyncio
asyncio.create_task(create_admin_if_not_exists())

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

@router.get("/users", response_model=UserListResponse)
async def get_users(
    skip: int = 0,
    limit: int = 10,
    current_user: dict = Depends(get_current_admin_user)
):
    """관리자용 사용자 목록 조회"""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # 전체 사용자 수 조회
        cur.execute("SELECT COUNT(*) as count FROM users")
        result = cur.fetchone()
        total = result['count'] if isinstance(result, dict) else result[0]
        
        # 사용자 목록 조회
        cur.execute("""
            SELECT id, email, name, role, organization, is_active, created_at, updated_at 
            FROM users 
            ORDER BY created_at DESC 
            LIMIT %s OFFSET %s
        """, (limit, skip))
        
        users = cur.fetchall()
        return {"users": users, "total": total}
    finally:
        conn.close()

@router.patch("/users/{user_id}", response_model=User)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: dict = Depends(get_current_admin_user)
):
    """관리자용 사용자 정보 수정"""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # 수정할 사용자 존재 여부 확인
        cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="사용자를 찾을 수 없습니다."
            )
            
        # 마지막 관리자 권한 변경 방지
        if user["role"] == "admin" and user_update.role == "user":
            cur.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'")
            admin_count = cur.fetchone()[0]
            if admin_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="마지막 관리자의 권한을 변경할 수 없습니다."
                )
        
        # 사용자 정보 수정
        update_fields = []
        update_values = []
        
        if user_update.name is not None:
            update_fields.append("name = %s")
            update_values.append(user_update.name)
            
        if user_update.organization is not None:
            update_fields.append("organization = %s")
            update_values.append(user_update.organization)
            
        if user_update.role is not None:
            update_fields.append("role = %s")
            update_values.append(user_update.role)
            
        if user_update.is_active is not None:
            update_fields.append("is_active = %s")
            update_values.append(user_update.is_active)
            
        if not update_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="수정할 정보가 없습니다."
            )
            
        update_values.append(user_id)
        
        query = f"""
            UPDATE users 
            SET {", ".join(update_fields)}, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, email, name, role, organization, is_active, created_at, updated_at
        """
        
        cur.execute(query, update_values)
        updated_user = cur.fetchone()
        conn.commit()
        return updated_user
    finally:
        conn.close()

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: dict = Depends(get_current_admin_user)
):
    """관리자용 사용자 삭제"""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # 삭제할 사용자 존재 여부 확인
        cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="사용자를 찾을 수 없습니다."
            )
            
        # 마지막 관리자 삭제 방지
        if user["role"] == "admin":
            cur.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'")
            admin_count = cur.fetchone()[0]
            if admin_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="마지막 관리자는 삭제할 수 없습니다."
                )
        
        # 사용자 삭제
        cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
        return {"message": "사용자가 삭제되었습니다."}
    finally:
        conn.close() 