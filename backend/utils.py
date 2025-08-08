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
from database import get_db_connection

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
        당신은 Blockly 워크스페이스 설계 전문가입니다. 아래 설명을 만족하는 완전한 Blockly XML을 생성하세요. 반드시 제공된 툴박스의 블록만 사용하고, 공식 Blockly Python generator 또는 제공된 커스텀 제너레이터와 호환되는 구조로 만듭니다.

        설명:
        {description}
        
        동작 모드
        - ask_clarify: false
        - preferences:
            - prefer_functions: true
            - variable_style: snake_case
            - function_style: snake_case
            - layout: {{x0:20, y0:20, x_step:340, y_step:160}}
        
        허용 블록(당신의 툴박스 기준)
            - 로직: controls_if, logic_compare, logic_operation, logic_negate, logic_boolean, logic_null, logic_ternary
            - 반복: controls_repeat_ext, controls_repeat, controls_whileUntil, controls_for, controls_forEach, controls_flow_statements
            - 수학: math_number, math_arithmetic, math_single, math_trig, math_constant, math_number_property, math_round, math_on_list, math_modulo, math_constrain, math_random_int, math_random_float, math_atan2
            - 텍스트: text, text_multiline, text_join, text_append, text_length, text_isEmpty, text_indexOf, text_charAt, text_getSubstring, text_changeCase, text_trim, text_count, text_replace, text_reverse, text_print, text_prompt_ext
            - 리스트: lists_create_with, lists_repeat, lists_length, lists_isEmpty, lists_indexOf, lists_getIndex, lists_setIndex, lists_getSublist, lists_split, lists_sort, lists_reverse
            - 색상: colour_picker, colour_random, colour_rgb, colour_blend
            - 변수/함수(동적 카테고리): variables_set, variables_get, procedures_defnoreturn, procedures_defreturn, procedures_callnoreturn, procedures_callreturn
            - 커스텀: jpype_start_jvm, jpype_shutdown_jvm, jpype_java_method_call, ast_Summarized_FunctionDef, ast_FunctionParameter, ast_ReturnFull, ast_Name
        위 목록 외 블록은 사용하지 마세요.
        
        설계 규칙
        1. 변수/함수
            - <variables> 섹션을 포함하고, 변수 id는 고유하게 부여합니다(예: var_i, var_total, list_nums). 변수/함수 이름은 snake_case로 작성합니다.
            - 반복되거나 의미 단위가 큰 로직은 procedures_def…로 함수화합니다.
            - 함수 매개변수는 <mutation>과 <arg name="…"/>로 선언하고, 호출 시 procedures_call… 블록을 사용합니다.
        2. 블록 연결/구조
            - 문장 흐름은 <next>로 정확히 연결하여 orphan 블록이 없게 합니다.
            - if-else-if는 controls_if의 <mutation elseif="N" else="0|1">를 정확히 설정합니다.
            - 값 입력 슬롯에는 가능한 shadow 기본값(math_number, text 등)을 제공합니다.
        3. 좌표 배치
            - 모든 최상위 블록에 x,y를 지정합니다.
            - layout 기준으로 좌→우, 상→하로 겹치지 않게 배치합니다.
        4. 커스텀 블록 사용 원칙
            - JPype: 자바 호출이 필요한 경우에만 사용. 순서: jpype_start_jvm → jpype_java_method_call* → jpype_shutdown_jvm. JVM이 이미 시작되었다고 가정하지 마세요.
            - 요약함수(ast_*): “요약된 함수/AST 기반 구성”이 명시된 경우에만 사용. 기본은 표준 procedures_* 우선.
        5. 합리적 가정
            설명이 부족하더라도 ask_clarify=false이므로 합리적 기본값(예: 초기값 0, 반복 10회 등)을 선택해 완성하세요.
        6. 품질 체크
            - 문법적으로 유효한 XML만 출력. Python 코드 생성 시 오류가 없어야 합니다.
            - 지정 툴박스 외 블록 금지, 필수 입력 모두 채우기.
        
        출력 형식
            - 오직 단일 XML만 출력합니다. 설명/주석/프리텍스트 금지.
            - 루트는 <xml xmlns="https://developers.google.com/blockly/xml"> … </xml> 형태여야 합니다.
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