import os
import tempfile
import subprocess
import logging
from typing import Optional
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer

logger = logging.getLogger(__name__)

# 비밀번호 해싱을 위한 설정
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT 설정
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")  # 실제 운영 환경에서는 안전한 키로 변경
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """비밀번호 검증"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """비밀번호 해싱"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """JWT 토큰 생성"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

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
        role: str = payload.get("role")
        if email is None:
            raise credentials_exception
        token_data = {"email": email, "role": role}
        return token_data
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

def generate_blockly_xml(description: str, model_name: str, model_type: str = "ollama") -> str:
    """
    설명을 기반으로 Blockly XML을 생성합니다.
    
    Args:
        description (str): 블록 생성 설명
        model_name (str): 사용할 모델 이름
        model_type (str): 모델 타입 (ollama 또는 openai)
        
    Returns:
        str: 생성된 Blockly XML
    """
    if model_type == "ollama":
        return generate_blockly_xml_ollama(description, model_name)
    else:
        return generate_blockly_xml_openai(description, model_name)

def generate_blockly_xml_ollama(description: str, model_name: str) -> str:
    """
    Ollama를 사용하여 Blockly XML을 생성합니다.
    
    Args:
        description (str): 블록 생성 설명
        model_name (str): 사용할 Ollama 모델 이름
        
    Returns:
        str: 생성된 Blockly XML
    """
    try:
        import httpx
        from config import settings
        
        prompt = f"""
        다음 설명을 기반으로 Blockly XML 코드를 생성해주세요:
        {description}
        
        XML은 다음과 같은 형식이어야 합니다:
        <xml xmlns="https://developers.google.com/blockly/xml">
            <block type="..." x="..." y="...">
                ...
            </block>
        </xml>
        
        Python 코드를 생성하는 블록이어야 합니다.
        """
        
        response = httpx.post(
            f"{settings.OLLAMA_API_URL}/api/generate",
            json={
                "model": model_name,
                "prompt": prompt,
                "stream": False
            }
        )
        
        if response.status_code == 200:
            return response.json().get('response', '').strip()
        else:
            logger.error(f"Ollama API 오류: {response.text}")
            return ""
    except Exception as e:
        logger.error(f"Ollama XML 생성 실패: {e}")
        return ""

def generate_blockly_xml_openai(description: str, model_name: str) -> str:
    """
    OpenAI를 사용하여 Blockly XML을 생성합니다.
    
    Args:
        description (str): 블록 생성 설명
        model_name (str): 사용할 OpenAI 모델 이름
        
    Returns:
        str: 생성된 Blockly XML
    """
    try:
        import httpx
        from config import settings
        
        prompt = f"""
        다음 설명을 기반으로 Blockly XML 코드를 생성해주세요:
        {description}
        
        XML은 다음과 같은 형식이어야 합니다:
        <xml xmlns="https://developers.google.com/blockly/xml">
            <block type="..." x="..." y="...">
                ...
            </block>
        </xml>
        
        Python 코드를 생성하는 블록이어야 합니다.
        """
        
        response = httpx.post(
            f"{settings.OPENAI_API_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": model_name,
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant that generates Blockly XML code."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7
            }
        )
        
        if response.status_code == 200:
            return response.json()['choices'][0]['message']['content'].strip()
        else:
            logger.error(f"OpenAI API 오류: {response.text}")
            return ""
    except Exception as e:
        logger.error(f"OpenAI XML 생성 실패: {e}")
        return "" 