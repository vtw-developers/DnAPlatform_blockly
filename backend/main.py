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

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발 환경에서는 모든 origin 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    airflow_base_url = os.getenv("AIRFLOW_BASE_URL", "http://host.docker.internal:8080")
    target_url = f"{airflow_base_url}/{path}"

    try:
        # 클라이언트 요청의 body를 읽음
        body = await request.json()
        
        # 요청 본문을 그대로 전달
        headers = {
            "Content-Type": "application/json",
            "Authorization": "Basic YWRtaW46dnR3MjEwMzAy"  # admin:vtw210302의 Base64 인코딩
        }

        async with httpx.AsyncClient(verify=False) as client:
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
    airflow_base_url = os.getenv("AIRFLOW_BASE_URL", "http://host.docker.internal:8080")
    target_url = f"{airflow_base_url}/{path}"

    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": "Basic YWRtaW46dnR3MjEwMzAy"  # admin:vtw210302의 Base64 인코딩
        }

        async with httpx.AsyncClient(verify=False) as client:
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
        ollama_url = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get(f"{ollama_url}/api/tags")
            if response.status_code == 200:
                models = response.json().get("models", [])
                return {
                    "models": [
                        {
                            "name": model["name"],
                            "size": model.get("size", 0),
                            "digest": model.get("digest", ""),
                            "modified_at": model.get("modified_at", "")
                        }
                        for model in models
                    ]
                }
            else:
                raise HTTPException(status_code=response.status_code, detail="Ollama 서버에서 모델 목록을 가져오는데 실패했습니다.")
    except Exception as e:
        logger.error(f"Ollama 모델 목록 조회 중 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True) 