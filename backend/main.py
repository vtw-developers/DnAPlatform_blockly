from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5000"],
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

class CodeBlock(CodeBlockBase):
    id: int
    created_at: datetime
    updated_at: datetime

# 테이블 생성
def create_tables():
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS code_blocks (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                code TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        logger.info("테이블이 성공적으로 생성되었습니다.")
    except Exception as e:
        logger.error(f"테이블 생성 중 오류 발생: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

# 앱 시작 시 테이블 생성
@app.on_event("startup")
async def startup_event():
    create_tables()
    logger.info("애플리케이션이 시작되었습니다.")

# API 엔드포인트
@app.post("/api/code-blocks", response_model=CodeBlock)
async def create_code_block(code_block: CodeBlockBase):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO code_blocks (title, description, code)
            VALUES (%s, %s, %s)
            RETURNING id, title, description, code, created_at, updated_at
        """, (code_block.title, code_block.description, code_block.code))
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

@app.get("/api/code-blocks", response_model=List[CodeBlock])
async def get_code_blocks():
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, title, description, code, created_at, updated_at
            FROM code_blocks
            ORDER BY created_at DESC
        """)
        results = cur.fetchall()
        return [dict(row) for row in results]
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
            SELECT id, title, description, code, created_at, updated_at
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True) 