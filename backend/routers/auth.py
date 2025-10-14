from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from typing import Optional, List
import logging
from database import get_db_connection
from models import UserCreate, User, Token, UserLogin, UserUpdate, UserListResponse, UserRole
from utils import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    get_current_user,
    get_current_admin_user,
    refresh_access_token,
    create_password_reset_token,
    verify_reset_token,
    reset_password_with_token,
    send_password_reset_email
)
from pydantic import BaseModel

# 비밀번호 재설정 관련 모델
class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

class PasswordResetResponse(BaseModel):
    message: str
    success: bool

logger = logging.getLogger(__name__)
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
        
        # 리프레시 토큰 생성
        refresh_token = create_refresh_token(
            data={"sub": user["email"], "role": user["role"]}
        )
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60  # 초 단위로 반환
        }
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

class RefreshTokenRequest(BaseModel):
    refresh_token: str

@router.post("/refresh", response_model=Token)
async def refresh_token(request: RefreshTokenRequest):
    """리프레시 토큰을 사용하여 새로운 액세스 토큰 발급"""
    try:
        new_access_token = refresh_access_token(request.refresh_token)
        return {
            "access_token": new_access_token,
            "refresh_token": request.refresh_token,  # 기존 리프레시 토큰 유지
            "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="리프레시 토큰이 유효하지 않습니다."
        )

@router.post("/extend-session")
async def extend_session(current_user: dict = Depends(get_current_user)):
    """사용자 액션이 있을 때 세션을 자동으로 연장"""
    # 이 엔드포인트는 사용자 액션이 있을 때마다 호출되어 세션을 연장
    # 실제로는 미들웨어나 다른 방식으로 자동 처리됨
    return {"message": "세션이 연장되었습니다.", "user": current_user["email"]}

@router.post("/forgot-password", response_model=PasswordResetResponse)
async def forgot_password(request: PasswordResetRequest):
    """비밀번호 재설정 요청 - 이메일로 재설정 링크 발송"""
    try:
        # 토큰 생성
        reset_token = create_password_reset_token(request.email)
        
        if not reset_token:
            # 보안을 위해 사용자가 존재하지 않아도 성공 메시지 반환
            return PasswordResetResponse(
                message="해당 이메일로 비밀번호 재설정 링크를 발송했습니다.",
                success=True
            )
        
        # 이메일 발송
        email_sent = send_password_reset_email(request.email, reset_token)
        
        if email_sent:
            return PasswordResetResponse(
                message="해당 이메일로 비밀번호 재설정 링크를 발송했습니다.",
                success=True
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요."
            )
            
    except Exception as e:
        logger.error(f"비밀번호 재설정 요청 처리 중 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
        )

@router.get("/verify-reset-token/{token}")
async def verify_password_reset_token(token: str):
    """비밀번호 재설정 토큰 검증"""
    token_data = verify_reset_token(token)
    
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않거나 만료된 토큰입니다."
        )
    
    return {
        "message": "유효한 토큰입니다.",
        "email": token_data["email"]
    }

@router.post("/reset-password", response_model=PasswordResetResponse)
async def reset_password(request: PasswordResetConfirm):
    """비밀번호 재설정 실행"""
    try:
        # 비밀번호 길이 검증
        if len(request.new_password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="비밀번호는 최소 6자 이상이어야 합니다."
            )
        
        # 토큰으로 비밀번호 재설정
        success = reset_password_with_token(request.token, request.new_password)
        
        if success:
            return PasswordResetResponse(
                message="비밀번호가 성공적으로 재설정되었습니다.",
                success=True
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="유효하지 않거나 만료된 토큰입니다."
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"비밀번호 재설정 처리 중 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
        ) 