from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
import logging
import time
import sqlite3
import subprocess
import tempfile
import httpx
from starlette.responses import StreamingResponse
import re
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import json
import xml.etree.ElementTree as ET

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI()

# CORS 설정을 위한 환경변수 처리
def get_allowed_origins():
    # 환경변수에서 허용된 출처들을 가져옴
    origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5000").split(",")
    # 공백 제거 및 중복 제거
    origins = [origin.strip() for origin in origins if origin.strip()]
    return list(set(origins))

# CORS 미들웨어 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# 프록시 설정
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

# HTTPS 리다이렉트 (프로덕션 환경에서 사용)
# app.add_middleware(HTTPSRedirectMiddleware)

# 신뢰할 수 있는 호스트 설정
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]  # 개발 환경에서는 모든 호스트 허용
)

# 데이터베이스 연결
def get_db_connection():
    try:
        return psycopg2.connect(
            host=os.getenv("DB_HOST", "postgres"),
            database=os.getenv("DB_NAME", "blockly_db"),
            user=os.getenv("DB_USER", "blockly_user"),
            password=os.getenv("DB_PASSWORD", "blockly_password"),
            cursor_factory=RealDictCursor
        )
    except Exception as e:
        logger.error(f"데이터베이스 연결 오류: {e}")
        raise HTTPException(status_code=500, detail="데이터베이스 연결 실패")

# 모델 정의
class CodeBlockBase(BaseModel):
    title: str
    description: str
    code: str
    blockly_xml: Optional[str] = None

class CodeBlock(CodeBlockBase):
    id: int
    created_at: datetime
    updated_at: datetime

class CodeBlockResponse(BaseModel):
    blocks: List[CodeBlock]
    total: int

class CodeBlockCreate(CodeBlockBase):
    pass

class CodeBlockUpdate(CodeBlockBase):
    pass

class DeleteCodeBlocks(BaseModel):
    ids: List[int]

class CodeExecuteRequest(BaseModel):
    code: str

class CodeExecuteResponse(BaseModel):
    output: str
    error: str

class CodeVerifyRequest(BaseModel):
    code: str
    model_name: str = "qwen2.5-coder:32b"  # 기본값 설정

class ModelInfo(BaseModel):
    name: str
    size: int
    digest: str
    modified_at: str

class GenerateBlockRequest(BaseModel):
    description: str
    model_name: str
    model_type: str

def wait_for_db():
    max_retries = 30
    retry_interval = 2  # seconds
    
    for i in range(max_retries):
        try:
            conn = psycopg2.connect(
                host=os.getenv("DB_HOST", "postgres"),
                database=os.getenv("DB_NAME", "blockly_db"),
                user=os.getenv("DB_USER", "blockly_user"),
                password=os.getenv("DB_PASSWORD", "blockly_password")
            )
            conn.close()
            logger.info("데이터베이스 연결 성공")
            return True
        except Exception as e:
            logger.warning(f"데이터베이스 연결 시도 {i+1}/{max_retries} 실패: {e}")
            time.sleep(retry_interval)
    
    return False

def create_tables():
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 테이블이 이미 존재하는지 확인
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'code_blocks'
            ) as exists;
        """)
        result = cur.fetchone()
        table_exists = result['exists']
        
        if not table_exists:
            cur.execute("""
                CREATE TABLE code_blocks (
                    id SERIAL PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    code TEXT NOT NULL,
                    blockly_xml TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()
            logger.info("code_blocks 테이블이 성공적으로 생성되었습니다.")
        else:
            # 컬럼 이름 변경 및 불필요한 컬럼 제거
            try:
                # blocklyXml -> blockly_xml 변경
                cur.execute("""
                    ALTER TABLE code_blocks
                    RENAME COLUMN "blocklyXml" TO blockly_xml;
                """)
                logger.info("blocklyXml 컬럼 이름을 blockly_xml로 변경했습니다.")
            except Exception as e:
                logger.info("blockly_xml 컬럼이 이미 존재합니다.")

            try:
                # blocks_xml 컬럼이 있다면 제거
                cur.execute("""
                    ALTER TABLE code_blocks
                    DROP COLUMN IF EXISTS blocks_xml;
                """)
                logger.info("불필요한 blocks_xml 컬럼을 제거했습니다.")
            except Exception as e:
                logger.info("blocks_xml 컬럼이 존재하지 않습니다.")

            conn.commit()
            
    except Exception as e:
        logger.error(f"테이블 생성 중 오류 발생: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()

@app.on_event("startup")
async def startup_event():
    try:
        if not wait_for_db():
            raise Exception("데이터베이스 연결 실패")
        create_tables()
        logger.info("애플리케이션이 시작되었습니다.")
    except Exception as e:
        logger.error(f"애플리케이션 시작 중 오류 발생: {e}")
        raise

# API 엔드포인트
@app.post("/api/code-blocks", response_model=CodeBlock)
async def create_code_block(code_block: CodeBlockCreate):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO code_blocks (title, description, code, blockly_xml)
            VALUES (%s, %s, %s, %s)
            RETURNING id, title, description, code, blockly_xml, created_at, updated_at
        """, (code_block.title, code_block.description, code_block.code, code_block.blockly_xml))
        result = cur.fetchone()
        conn.commit()
        logger.info(f"새로운 코드 블록이 생성되었습니다. ID: {result['id']}")
        return dict(result)
    except Exception as e:
        logger.error(f"코드 블록 생성 중 오류 발생: {e}")
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()

@app.put("/api/code-blocks/{code_block_id}", response_model=CodeBlock)
async def update_code_block(code_block_id: int, code_block: CodeBlockUpdate):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE code_blocks
            SET title = %s,
                description = %s,
                code = %s,
                blockly_xml = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, title, description, code, blockly_xml, created_at, updated_at
        """, (code_block.title, code_block.description, code_block.code, code_block.blockly_xml, code_block_id))
        result = cur.fetchone()
        if result is None:
            raise HTTPException(status_code=404, detail="Code block not found")
        conn.commit()
        logger.info(f"코드 블록이 수정되었습니다. ID: {result['id']}")
        return dict(result)
    except Exception as e:
        logger.error(f"코드 블록 수정 중 오류 발생: {e}")
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()

@app.get("/api/code-blocks", response_model=CodeBlockResponse)
async def get_code_blocks(page: int = 1, per_page: int = 10):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 전체 레코드 수 조회
        cur.execute("SELECT COUNT(*) as total FROM code_blocks")
        total = cur.fetchone()['total']
        
        # 페이지네이션된 데이터 조회
        offset = (page - 1) * per_page
        cur.execute("""
            SELECT id, title, description, code, blockly_xml, created_at, updated_at
            FROM code_blocks
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """, (per_page, offset))
        results = cur.fetchall()
        
        return {
            "blocks": [dict(row) for row in results],
            "total": total
        }
    except Exception as e:
        logger.error(f"코드 블록 조회 중 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()

@app.get("/api/code-blocks/{code_block_id}", response_model=CodeBlock)
async def get_code_block(code_block_id: int):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, title, description, code, blockly_xml, created_at, updated_at
            FROM code_blocks
            WHERE id = %s
        """, (code_block_id,))
        result = cur.fetchone()
        if result is None:
            raise HTTPException(status_code=404, detail="Code block not found")
        return dict(result)
    except Exception as e:
        logger.error(f"코드 블록 조회 중 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()

@app.delete("/api/code-blocks")
async def delete_code_blocks(delete_request: DeleteCodeBlocks):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # SQLite에서는 IN 절에 ?를 직접 사용할 수 없어서 각 ID에 대해 ? 대신 실제 값을 사용
        placeholders = ','.join(str(id) for id in delete_request.ids)
        query = f"DELETE FROM code_blocks WHERE id IN ({placeholders})"
        cur.execute(query)
        conn.commit()
        
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="No code blocks were deleted")
        
        return {"message": "Code blocks deleted successfully"}
    except Exception as e:
        logger.error(f"코드 블록 삭제 중 오류 발생: {e}")
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()

@app.post("/api/execute-code", response_model=CodeExecuteResponse)
async def execute_code(request: CodeExecuteRequest):
    try:
        # 임시 파일 생성
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(request.code)
            temp_file = f.name

        try:
            # Python 코드 실행
            process = subprocess.Popen(
                ['python', temp_file],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            stdout, stderr = process.communicate(timeout=5)  # 5초 타임아웃

            return {
                "output": stdout,
                "error": stderr
            }
        finally:
            # 임시 파일 삭제
            os.unlink(temp_file)

    except subprocess.TimeoutExpired:
        return {
            "output": "",
            "error": "코드 실행 시간이 초과되었습니다 (5초 제한)."
        }
    except Exception as e:
        return {
            "output": "",
            "error": f"코드 실행 중 오류가 발생했습니다: {str(e)}"
        }

@app.post("/api/proxy/airflow/{path:path}")
async def proxy_to_airflow_post(path: str, request: Request):
    airflow_base_url = os.getenv("AIRFLOW_BASE_URL", "http://192.168.0.2:8080")
    target_url = f"{airflow_base_url}/{path}"

    try:
        # 클라이언트 요청의 body를 읽음
        body = await request.json()
        
        # 요청 본문을 그대로 전달
        headers = {
            "Content-Type": "application/json",
            "Authorization": "Basic YWRtaW46dnR3MjEwMzAy"  # admin:vtw210302의 Base64 인코딩
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                target_url,
                json=body,
                headers=headers,
                timeout=30.0
            )

        return StreamingResponse(
            content=response.iter_bytes(),
            status_code=response.status_code,
            headers=dict(response.headers)
        )
    except Exception as e:
        logger.error(f"Airflow API 프록시 중 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/proxy/airflow/{path:path}")
async def proxy_to_airflow_get(path: str, request: Request):
    airflow_base_url = os.getenv("AIRFLOW_BASE_URL", "http://192.168.0.2:8080")
    target_url = f"{airflow_base_url}/{path}"

    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": "Basic YWRtaW46dnR3MjEwMzAy"  # admin:vtw210302의 Base64 인코딩
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(
                target_url,
                headers=headers,
                timeout=30.0
            )

        return StreamingResponse(
            content=response.iter_bytes(),
            status_code=response.status_code,
            headers=dict(response.headers)
        )
    except Exception as e:
        logger.error(f"Airflow API 프록시 중 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/models")
async def get_models():
    try:
        ollama_url = os.getenv("OLLAMA_BASE_URL", "http://192.168.0.2:11434")
        async with httpx.AsyncClient() as client:
            # Ollama 모델 가져오기
            headers = {
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
            response = await client.get(f"{ollama_url}/api/tags", headers=headers, timeout=30.0)
            if response.status_code != 200:
                logger.error(f"Ollama API 응답: {response.status_code}, {response.text}")
                raise HTTPException(status_code=response.status_code, detail="Ollama 서버에서 모델 목록을 가져오는데 실패했습니다.")
            
            data = response.json()
            logger.info(f"Ollama API 응답: {data}")  # 응답 로깅
            ollama_models = data.get("models", [])
            
            # OpenAI 모델 추가
            openai_models = [
                {"name": "gpt-4-0125-preview", "type": "openai", "size": 0, "modified_at": "", "digest": "", "description": "최신 GPT-4 모델, 코드 생성 능력 향상"},
                {"name": "gpt-4-1106-preview", "type": "openai", "size": 0, "modified_at": "", "digest": "", "description": "JSON 모드 지원, 구조화된 출력에 강점"},
                {"name": "gpt-4-vision-preview", "type": "openai", "size": 0, "modified_at": "", "digest": "", "description": "시각적 이해 가능, 블록 구조 분석에 유용"},
                {"name": "gpt-3.5-turbo-0125", "type": "openai", "size": 0, "modified_at": "", "digest": "", "description": "빠른 응답, 기본적인 코드 생성"}
            ]
            
            # Ollama 모델 형식 변환
            formatted_ollama_models = [
                {
                    "name": model["name"],
                    "type": "ollama",
                    "size": model.get("size", 0),
                    "digest": model.get("digest", ""),
                    "modified_at": model.get("modified_at", "")
                }
                for model in ollama_models
            ]
            
            logger.info(f"포맷된 Ollama 모델: {formatted_ollama_models}")  # 포맷된 모델 로깅
            
            # 모든 모델 합치기
            all_models = formatted_ollama_models + openai_models
            return {"models": all_models}
            
    except Exception as e:
        logger.error(f"모델 목록 조회 중 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-block")
async def generate_block(request: GenerateBlockRequest):
    try:
        logger.info(f"블록 생성 요청: description='{request.description}' model_name='{request.model_name}' model_type='{request.model_type}'")

        prompt = f"""당신은 Blockly XML 생성 전문가입니다.

아래 요구사항에 맞는 XML 코드를 생성해주세요.
중요: 마크다운 코드 블록(```)이나 다른 텍스트를 포함하지 말고 순수한 XML만 반환하세요.

요구사항: {request.description}

XML 형식 규칙:
1. 반드시 <xml xmlns="https://developers.google.com/blockly/xml">로 시작
2. 블록 좌표는 x="50" y="50"로 시작
3. 모든 블록은 고유 id 필수

사용 가능한 블록 목록:

1. 수학 연산 블록:
   - math_number: 숫자 값 (예: <value name="NUM"><shadow type="math_number"><field name="NUM">123</field></shadow></value>)
   - math_arithmetic: 사칙연산
     * 연산자: ADD(덧셈), MINUS(뺄셈), MULTIPLY(곱셈), DIVIDE(나눗셈)
   - math_single: 단항 연산
     * 연산자: ROOT(제곱근), ABS(절대값), NEG(음수), LN(자연로그), LOG10(로그), EXP(지수), POW10(10의 거듭제곱)
   - math_round: 반올림/올림/내림
     * 연산자: ROUND(반올림), ROUNDUP(올림), ROUNDDOWN(내림)
   - math_modulo: 나머지 연산

2. 텍스트 블록:
   - text: 문자열 값
   - text_print: 출력
   - text_join: 문자열 결합
   - text_length: 문자열 길이
   - text_isEmpty: 문자열 비어있는지 확인

3. 논리 블록:
   - logic_compare: 비교 연산
     * 연산자: EQ(같음), NEQ(다름), LT(미만), LTE(이하), GT(초과), GTE(이상)
   - logic_operation: 논리 연산
     * 연산자: AND(그리고), OR(또는)
   - logic_negate: 논리 부정(NOT)
   - logic_boolean: 참/거짓 값
   - logic_null: null 값

4. 제어 블록:
   - controls_if: 조건문
   - controls_repeat_ext: 반복문 (횟수 지정)
   - controls_whileUntil: while/until 반복문
   - controls_for: for 반복문
   - controls_forEach: 리스트 순회

5. 변수 블록:
   - variables_get: 변수 값 가져오기
   - variables_set: 변수 값 설정하기

6. 리스트 블록:
   - lists_create_empty: 빈 리스트 생성
   - lists_create_with: 값으로 리스트 생성
   - lists_length: 리스트 길이
   - lists_isEmpty: 리스트 비어있는지 확인
   - lists_indexOf: 리스트에서 값 찾기
   - lists_getIndex: 리스트에서 값 가져오기
   - lists_setIndex: 리스트 값 설정하기

블록 연결 규칙:
1. value 태그: 다른 블록의 값을 입력으로 받을 때 사용
2. statement 태그: 제어 블록 내부의 실행 문장을 포함할 때 사용
3. next 태그: 순차적으로 실행될 다음 블록을 연결할 때 사용
4. field 태그: 블록의 설정값을 지정할 때 사용

응답 형식:
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="[블록타입]" id="[고유ID]" x="50" y="50">
    [블록 내용]
  </block>
</xml>"""

        logger.info("생성된 프롬프트:")
        logger.info("-" * 80)
        logger.info(prompt)
        logger.info("-" * 80)

        if request.model_type == "ollama":
            ollama_url = os.getenv("OLLAMA_BASE_URL", "http://192.168.0.2:11434")
            logger.info(f"Ollama URL: {ollama_url}")
            
            async with httpx.AsyncClient() as client:
                try:
                    request_data = {
                        "model": request.model_name,
                        "prompt": prompt,
                        "stream": False,
                        "raw": True
                    }
                    logger.info(f"Ollama API 요청 데이터: {request_data}")
                    
                    response = await client.post(
                        f"{ollama_url}/api/generate",
                        json=request_data,
                        timeout=30.0
                    )
                    
                    logger.info(f"Ollama API 응답 상태 코드: {response.status_code}")
                    logger.info(f"Ollama API 응답 헤더: {dict(response.headers)}")
                    response_text = response.text
                    logger.info(f"Ollama API 응답 내용: {response_text}")
                    
                    if response.status_code != 200:
                        error_msg = f"Ollama API 오류 - 상태 코드: {response.status_code}, 응답: {response_text}"
                        logging.error(error_msg)
                        raise HTTPException(status_code=500, detail=error_msg)
                        
                    try:
                        response_data = response.json()
                    except json.JSONDecodeError as e:
                        error_msg = f"Ollama API 응답 JSON 파싱 오류: {str(e)}, 응답 내용: {response_text}"
                        logging.error(error_msg)
                        raise HTTPException(status_code=500, detail=error_msg)
                        
                    if "response" not in response_data:
                        error_msg = f"Ollama API 응답에 'response' 필드가 없습니다: {response_data}"
                        logging.error(error_msg)
                        raise HTTPException(status_code=500, detail=error_msg)
                    
                    xml_code = response_data.get("response", "").strip()
                    logger.info(f"추출된 XML 코드: {xml_code}")
                    
                    # XML 시작과 끝 태그 확인
                    if not xml_code.startswith("<xml"):
                        xml_code = f'<xml xmlns="https://developers.google.com/blockly/xml">{xml_code}'
                    if not xml_code.endswith("</xml>"):
                        xml_code = f"{xml_code}</xml>"
                    
                    logger.info(f"최종 XML:\n{xml_code}")
                    return {"xml": xml_code}
                    
                except httpx.RequestError as e:
                    error_msg = f"Ollama API 요청 오류: {str(e)}"
                    logging.error(error_msg)
                    raise HTTPException(status_code=500, detail=error_msg)
                except Exception as e:
                    error_msg = f"Ollama API 처리 중 오류: {str(e)}"
                    logging.error(error_msg)
                    import traceback
                    logging.error(f"상세 오류:\n{traceback.format_exc()}")
                    raise HTTPException(status_code=500, detail=error_msg)
        
        elif request.model_type == "openai":
            openai_key = os.getenv("OPENAI_API_KEY")
            if not openai_key:
                error_msg = "OpenAI API 키가 설정되지 않았습니다."
                logging.error(error_msg)
                raise HTTPException(status_code=500, detail=error_msg)
                
            async with httpx.AsyncClient() as client:
                try:
                    request_data = {
                        "model": request.model_name,
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are a Blockly XML code generation expert. Return ONLY the XML code without any markdown formatting or additional text."
                            },
                            {
                                "role": "user",
                                "content": prompt
                            }
                        ],
                        "temperature": 0.7,
                        "max_tokens": 2000
                    }
                    
                    response = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {openai_key}",
                            "Content-Type": "application/json"
                        },
                        json=request_data,
                        timeout=30.0
                    )
                    
                    if response.status_code != 200:
                        error_msg = f"OpenAI API 오류: 상태 코드 {response.status_code}"
                        logging.error(error_msg)
                        raise HTTPException(status_code=500, detail=error_msg)
                    
                    data = response.json()
                    content = data["choices"][0]["message"]["content"].strip()
                    
                    # 마크다운 코드 블록 제거
                    content = re.sub(r'^```xml\s*|\s*```$', '', content, flags=re.MULTILINE)
                    xml_code = content.strip()
                    
                    logger.info(f"생성된 XML:\n{xml_code}")
                    return {"xml": xml_code}
                    
                except Exception as e:
                    error_msg = f"OpenAI API 처리 중 오류: {str(e)}"
                    logging.error(error_msg)
                    raise HTTPException(status_code=500, detail=error_msg)
        
        else:
            raise HTTPException(
                status_code=400,
                detail=f"지원하지 않는 모델 타입입니다: {request.model_type}"
            )
            
    except Exception as e:
        logger.error(f"블록 생성 중 오류 발생: {e}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.get("/api/ollama/{path:path}")
async def proxy_to_ollama(path: str, request: Request):
    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://192.168.0.2:11434")
    target_url = f"{ollama_url}/{path}"
    
    try:
        logger.info(f"Ollama API 요청: {target_url}")
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        async with httpx.AsyncClient() as client:
            response = await client.get(
                target_url,
                headers=headers,
                timeout=30.0
            )
            
        logger.info(f"Ollama API 응답: {response.status_code}")
        
        # CORS 헤더 추가
        headers = dict(response.headers)
        headers["Access-Control-Allow-Origin"] = "*"
        headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        headers["Access-Control-Allow-Headers"] = "Content-Type"
        
        return StreamingResponse(
            content=response.iter_bytes(),
            status_code=response.status_code,
            headers=headers
        )
    except Exception as e:
        logger.error(f"Ollama API 프록시 중 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ollama/{path:path}")
async def proxy_to_ollama_post(path: str, request: Request):
    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://192.168.0.2:11434")
    target_url = f"{ollama_url}/{path}"
    
    try:
        body = await request.json()
        logger.info(f"Ollama API 요청: {target_url}, 본문: {body}")
        
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(
                target_url,
                json=body,
                headers=headers,
                timeout=30.0
            )
            
        logger.info(f"Ollama API 응답: {response.status_code}")
        
        # CORS 헤더 추가
        headers = dict(response.headers)
        headers["Access-Control-Allow-Origin"] = "*"
        headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        headers["Access-Control-Allow-Headers"] = "Content-Type"
        
        return StreamingResponse(
            content=response.iter_bytes(),
            status_code=response.status_code,
            headers=headers
        )
    except Exception as e:
        logger.error(f"Ollama API 프록시 중 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True) 