from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import logging
from utils import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

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

@router.post("/code-blocks", response_model=CodeBlockResponse)
async def create_code_block(code_block: CodeBlockCreate, current_user: dict = Depends(get_current_user)):
    """새로운 코드 블록 생성"""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO code_blocks (title, description, code, blockly_xml, user_id)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, title, description, code, blockly_xml, user_id, created_at, updated_at
        """, (code_block.title, code_block.description, code_block.code, code_block.blockly_xml, current_user["id"]))
        
        new_block = cur.fetchone()
        
        # 작성자 정보 추가
        cur.execute("""
            SELECT name, email
            FROM users
            WHERE id = %s
        """, (current_user["id"],))
        user_info = cur.fetchone()
        
        formatted_block = dict(new_block)
        if user_info:
            formatted_block['user'] = {
                'name': user_info['name'],
                'email': user_info['email']
            }
            
        conn.commit()
        return {"blocks": [formatted_block], "total": 1}
    finally:
        conn.close()

@router.put("/code-blocks/{code_block_id}", response_model=CodeBlock)
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

@router.get("/code-blocks", response_model=CodeBlockResponse)
async def get_code_blocks(
    page: int = 1,
    limit: int = 5,
    current_user: dict = Depends(get_current_user)
):
    """모든 코드 블록 조회"""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # 전체 개수 조회
        cur.execute("SELECT COUNT(*) as total FROM code_blocks")
        total = cur.fetchone()['total']
        
        # 페이지네이션된 데이터 조회
        offset = (page - 1) * limit
        cur.execute("""
            SELECT 
                cb.id, 
                cb.title, 
                cb.description, 
                cb.code, 
                cb.blockly_xml, 
                cb.user_id, 
                cb.created_at, 
                cb.updated_at,
                u.name as user_name,
                u.email as user_email
            FROM code_blocks cb
            LEFT JOIN users u ON cb.user_id = u.id
            ORDER BY cb.created_at DESC
            LIMIT %s OFFSET %s
        """, (limit, offset))
        blocks = cur.fetchall()
        
        # 작성자 정보 포맷팅
        formatted_blocks = []
        for block in blocks:
            formatted_block = dict(block)
            if block['user_name'] and block['user_email']:
                formatted_block['user'] = {
                    'name': block['user_name'],
                    'email': block['user_email']
                }
            formatted_block.pop('user_name', None)
            formatted_block.pop('user_email', None)
            formatted_blocks.append(formatted_block)
            
        return {"blocks": formatted_blocks, "total": total}
    finally:
        conn.close()

@router.get("/code-blocks/{code_block_id}", response_model=CodeBlock)
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

@router.delete("/code-blocks")
async def delete_code_blocks(delete_request: DeleteCodeBlocks):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
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