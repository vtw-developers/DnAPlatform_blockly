import os
import tempfile
import subprocess
import logging
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from database import get_db_connection

logger = logging.getLogger(__name__)

# 비밀번호 해싱을 위한 설정
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT 설정
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")  # 실제 운영 환경에서는 안전한 키로 변경
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7  # 리프레시 토큰은 7일간 유효

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """비밀번호 검증"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """비밀번호 해싱"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """JWT 액세스 토큰 생성"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict) -> str:
    """JWT 리프레시 토큰 생성"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def refresh_access_token(refresh_token: str) -> str:
    """리프레시 토큰을 사용하여 새로운 액세스 토큰 생성"""
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        token_type = payload.get("type")
        
        if token_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="유효하지 않은 리프레시 토큰입니다."
            )
        
        # 새로운 액세스 토큰 생성
        user_data = {"sub": payload.get("sub"), "role": payload.get("role")}
        return create_access_token(user_data)
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="리프레시 토큰이 만료되었습니다."
        )

def extend_session_if_needed(token: str) -> str:
    """사용자 액션이 있을 때 세션을 자동으로 연장"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        token_type = payload.get("type")
        
        if token_type != "access":
            return token
        
        # 토큰 만료 시간이 5분 이내라면 자동으로 연장
        exp_timestamp = payload.get("exp")
        if exp_timestamp:
            exp_time = datetime.fromtimestamp(exp_timestamp)
            time_until_expiry = exp_time - datetime.utcnow()
            
            # 5분 이내에 만료되는 경우 새로운 토큰 생성
            if time_until_expiry.total_seconds() < 300:  # 5분 = 300초
                user_data = {"sub": payload.get("sub"), "role": payload.get("role")}
                return create_access_token(user_data)
        
        return token
        
    except JWTError:
        return token

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """현재 인증된 사용자 정보 조회"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
            
        # 데이터베이스에서 사용자 정보 조회
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT id, email, name, role, organization, is_active FROM users WHERE email = %s",
                (email,)
            )
            user = cur.fetchone()
            if user is None:
                raise credentials_exception
            return dict(user)
        finally:
            conn.close()
            
    except JWTError:
        raise credentials_exception

async def get_current_admin_user(current_user: dict = Depends(get_current_user)) -> dict:
    """현재 사용자가 관리자인지 확인"""
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다."
        )
    return current_user

def execute_python_code(code: str, timeout: int = 10) -> tuple[str, Optional[str]]:
    """
    Python 코드를 실행하고 결과를 반환합니다.
    
    Args:
        code (str): 실행할 Python 코드
        timeout (int): 실행 제한 시간 (초)
        
    Returns:
        tuple[str, Optional[str]]: (출력, 에러 메시지)
    """
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        temp_path = f.name
    
    try:
        result = subprocess.run(
            ['python', temp_path],
            capture_output=True,
            text=True,
            timeout=timeout
        )
        return result.stdout, result.stderr if result.stderr else None
    except subprocess.TimeoutExpired:
        return "", "코드 실행 시간 초과"
    except Exception as e:
        return "", str(e)
    finally:
        try:
            os.unlink(temp_path)
        except:
            pass

def get_ollama_models(ollama_api_url: str) -> list[str]:
    """
    Ollama에서 사용 가능한 모델 목록을 가져옵니다.
    
    Args:
        ollama_api_url (str): Ollama API URL
        
    Returns:
        list[str]: 모델 이름 목록
    """
    try:
        import httpx
        response = httpx.get(f"{ollama_api_url}/api/tags")
        if response.status_code == 200:
            models = response.json().get('models', [])
            return [model['name'] for model in models]
        return []
    except Exception as e:
        logger.error(f"Ollama 모델 목록 가져오기 실패: {e}")
        return []

def generate_reset_token() -> str:
    """비밀번호 재설정 토큰 생성"""
    return secrets.token_urlsafe(32)

def create_password_reset_token(email: str) -> Optional[str]:
    """비밀번호 재설정 토큰 생성 및 저장"""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # 사용자 존재 확인
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        user = cur.fetchone()
        
        if not user:
            return None
        
        # 기존 토큰들을 만료시킴
        cur.execute(
            "UPDATE password_reset_tokens SET used = true WHERE user_id = %s AND used = false",
            (user['id'],)
        )
        
        # 새 토큰 생성
        token = generate_reset_token()
        expires_at = datetime.utcnow() + timedelta(hours=1)  # 1시간 후 만료
        
        cur.execute("""
            INSERT INTO password_reset_tokens (user_id, token, expires_at)
            VALUES (%s, %s, %s)
        """, (user['id'], token, expires_at))
        
        conn.commit()
        return token
        
    except Exception as e:
        logger.error(f"비밀번호 재설정 토큰 생성 실패: {e}")
        conn.rollback()
        return None
    finally:
        conn.close()

def verify_reset_token(token: str) -> Optional[dict]:
    """비밀번호 재설정 토큰 검증"""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        cur.execute("""
            SELECT prt.*, u.email, u.id as user_id
            FROM password_reset_tokens prt
            JOIN users u ON prt.user_id = u.id
            WHERE prt.token = %s AND prt.used = false AND prt.expires_at > %s
        """, (token, datetime.utcnow()))
        
        result = cur.fetchone()
        return dict(result) if result else None
        
    except Exception as e:
        logger.error(f"비밀번호 재설정 토큰 검증 실패: {e}")
        return None
    finally:
        conn.close()

def reset_password_with_token(token: str, new_password: str) -> bool:
    """토큰을 사용하여 비밀번호 재설정"""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # 토큰 검증
        token_data = verify_reset_token(token)
        if not token_data:
            return False
        
        # 비밀번호 해싱
        hashed_password = get_password_hash(new_password)
        
        # 비밀번호 업데이트
        cur.execute(
            "UPDATE users SET password_hash = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
            (hashed_password, token_data['user_id'])
        )
        
        # 토큰을 사용됨으로 표시
        cur.execute(
            "UPDATE password_reset_tokens SET used = true WHERE token = %s",
            (token,)
        )
        
        conn.commit()
        return True
        
    except Exception as e:
        logger.error(f"비밀번호 재설정 실패: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

def send_password_reset_email(email: str, reset_token: str) -> bool:
    """비밀번호 재설정 이메일 발송 (개발용 - 실제로는 이메일 서비스 사용)"""
    try:
        # 개발 환경에서는 콘솔에 출력
        reset_url = f"http://localhost:5050/reset-password?token={reset_token}"
        
        logger.info(f"""
        ===========================================
        비밀번호 재설정 이메일 (개발용)
        ===========================================
        받는 사람: {email}
        재설정 링크: {reset_url}
        토큰: {reset_token}
        만료 시간: 1시간
        ===========================================
        """)
        
        # 실제 운영 환경에서는 여기에 이메일 발송 로직 구현
        # SMTP 설정이 있다면 실제 이메일 발송
        smtp_host = os.getenv("SMTP_HOST")
        if smtp_host:
            try:
                return send_actual_email(email, reset_url)
            except Exception as e:
                logger.warning(f"이메일 발송 실패, 개발 모드로 전환: {e}")
                return True  # 이메일 발송 실패해도 성공으로 처리
        
        return True  # 개발 환경에서는 항상 성공으로 처리
        
    except Exception as e:
        logger.error(f"비밀번호 재설정 이메일 발송 실패: {e}")
        return False

def send_actual_email(email: str, reset_url: str) -> bool:
    """실제 이메일 발송 (SMTP 설정이 있는 경우)"""
    try:
        smtp_host = os.getenv("SMTP_HOST", "localhost")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER", "")
        smtp_password = os.getenv("SMTP_PASSWORD", "")
        from_email = os.getenv("FROM_EMAIL", "noreply@dnaplatform.com")
        
        msg = MIMEMultipart()
        msg['From'] = from_email
        msg['To'] = email
        msg['Subject'] = "DnA Platform - 비밀번호 재설정"
        
        body = f"""
        안녕하세요,
        
        DnA Platform 비밀번호 재설정을 요청하셨습니다.
        
        아래 링크를 클릭하여 새로운 비밀번호를 설정해주세요:
        {reset_url}
        
        이 링크는 1시간 후에 만료됩니다.
        
        만약 비밀번호 재설정을 요청하지 않으셨다면 이 이메일을 무시해주세요.
        
        감사합니다.
        DnA Platform 팀
        """
        
        msg.attach(MIMEText(body, 'plain', 'utf-8'))
        
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        if smtp_user and smtp_password:
            server.login(smtp_user, smtp_password)
        
        text = msg.as_string()
        server.sendmail(from_email, email, text)
        server.quit()
        
        return True
        
    except Exception as e:
        logger.error(f"실제 이메일 발송 실패: {e}")
        return False