from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import tempfile
import subprocess
import os
import logging
from utils import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# 상수 정의
DEFAULT_CODE_TIMEOUT = 5

# 모델 정의
class UserInfo(BaseModel):
    name: str
    email: str

class CodeBlockBase(BaseModel):
    title: str
    description: str
    code: str
    blockly_xml: Optional[str] = None

class CodeBlock(CodeBlockBase):
    id: int
    user_id: int
    is_shared: bool = False
    user: Optional[UserInfo] = None
    created_at: datetime
    updated_at: datetime

class ConvertedCodeBase(BaseModel):
    source_code_id: int
    description: str
    converted_code: str

class ConvertedCode(ConvertedCodeBase):
    id: int
    source_code_title: str
    user_id: int
    created_at: datetime
    user: Optional[UserInfo] = None

class ConvertedCodeResponse(BaseModel):
    blocks: List[ConvertedCode]
    total: int

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
            RETURNING id, title, description, code, blockly_xml, user_id, created_at, updated_at
        """, (code_block.title, code_block.description, code_block.code, code_block.blockly_xml, code_block_id))
        
        result = cur.fetchone()
        if result is None:
            raise HTTPException(status_code=404, detail="Code block not found")
            
        # 사용자 정보 조회
        cur.execute("""
            SELECT name, email
            FROM users
            WHERE id = %s
        """, (result['user_id'],))
        user_info = cur.fetchone()
        
        formatted_block = dict(result)
        if user_info:
            formatted_block['user'] = {
                'name': user_info['name'],
                'email': user_info['email']
            }
            
        conn.commit()
        return formatted_block
        
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
    filter_type: str = 'my',  # 'my' 또는 'shared'
    current_user: dict = Depends(get_current_user)
):
    """코드 블록 조회 (필터링 지원)"""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # WHERE 절 구성
        where_clause = ""
        query_params = []
        
        if filter_type == 'my':
            where_clause = "WHERE cb.user_id = %s"
            query_params.append(current_user["id"])
        elif filter_type == 'shared':
            where_clause = "WHERE cb.user_id != %s AND cb.is_shared = true"
            query_params.append(current_user["id"])
        
        # 전체 개수 조회
        count_query = f"""
            SELECT COUNT(*) as total 
            FROM code_blocks cb 
            {where_clause}
        """
        cur.execute(count_query, query_params)
        total = cur.fetchone()['total']
        
        # 페이지네이션된 데이터 조회
        offset = (page - 1) * limit
        query_params.extend([limit, offset])
        
        blocks_query = f"""
            SELECT 
                cb.id, 
                cb.title, 
                cb.description, 
                cb.code, 
                cb.blockly_xml, 
                cb.created_at, 
                cb.updated_at,
                cb.user_id,
                cb.is_shared,
                u.name as user_name,
                u.email as user_email
            FROM code_blocks cb
            LEFT JOIN users u ON cb.user_id = u.id
            {where_clause}
            ORDER BY cb.created_at DESC
            LIMIT %s OFFSET %s
        """
        
        cur.execute(blocks_query, query_params)
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
            SELECT id, title, description, code, blockly_xml, user_id, is_shared, created_at, updated_at
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

@router.patch("/code-blocks/{code_block_id}/share", response_model=CodeBlock)
async def toggle_share_code_block(
    code_block_id: int,
    current_user: dict = Depends(get_current_user)
):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 먼저 코드 블록의 소유자 확인
        cur.execute("""
            SELECT user_id, is_shared
            FROM code_blocks
            WHERE id = %s
        """, (code_block_id,))
        block = cur.fetchone()
        
        if not block:
            raise HTTPException(status_code=404, detail="Code block not found")
            
        if block['user_id'] != current_user['id']:
            raise HTTPException(status_code=403, detail="Not authorized to share this code block")
        
        # 공유 상태 토글
        cur.execute("""
            UPDATE code_blocks
            SET is_shared = NOT is_shared,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, title, description, code, blockly_xml, user_id, is_shared, created_at, updated_at
        """, (code_block_id,))
        
        result = cur.fetchone()
        
        # 사용자 정보 조회
        cur.execute("""
            SELECT name, email
            FROM users
            WHERE id = %s
        """, (result['user_id'],))
        user_info = cur.fetchone()
        
        formatted_block = dict(result)
        if user_info:
            formatted_block['user'] = {
                'name': user_info['name'],
                'email': user_info['email']
            }
            
        conn.commit()
        return formatted_block
        
    except Exception as e:
        logger.error(f"코드 블록 공유 상태 변경 중 오류 발생: {e}")
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()

@router.post("/code/converted", response_model=ConvertedCode)
async def save_converted_code(
    converted_code: ConvertedCodeBase,
    current_user: dict = Depends(get_current_user)
):
    """변환된 코드 저장"""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # 원본 코드 존재 여부 확인
        cur.execute("""
            SELECT id FROM code_blocks WHERE id = %s
        """, (converted_code.source_code_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Source code not found")
        
        # 변환된 코드 저장
        cur.execute("""
            INSERT INTO converted_codes (
                source_code_id, description, converted_code, user_id
            ) VALUES (%s, %s, %s, %s)
            RETURNING id, source_code_id, description, converted_code, user_id, created_at
        """, (
            converted_code.source_code_id,
            converted_code.description,
            converted_code.converted_code,
            current_user["id"]
        ))
        
        result = cur.fetchone()
        
        # 부모 코드의 제목 조회
        cur.execute("""
            SELECT title as source_code_title
            FROM code_blocks
            WHERE id = %s
        """, (converted_code.source_code_id,))
        parent_code = cur.fetchone()
        
        # 사용자 정보 조회
        cur.execute("""
            SELECT name, email
            FROM users
            WHERE id = %s
        """, (current_user["id"],))
        user_info = cur.fetchone()
        
        formatted_result = dict(result)
        formatted_result['source_code_title'] = parent_code['source_code_title']
        if user_info:
            formatted_result['user'] = {
                'name': user_info['name'],
                'email': user_info['email']
            }
            
        conn.commit()
        return formatted_result
    except Exception as e:
        logger.error(f"변환된 코드 저장 중 오류 발생: {e}")
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/code/converted/{source_code_id}", response_model=ConvertedCodeResponse)
async def get_converted_codes(
    source_code_id: int,
    current_user: dict = Depends(get_current_user)
):
    """변환된 코드 목록 조회"""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # 원본 코드 존재 여부 확인
        cur.execute("""
            SELECT id FROM code_blocks WHERE id = %s
        """, (source_code_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Source code not found")
        
        # 변환된 코드 목록 조회
        cur.execute("""
            SELECT 
                cc.id, 
                cc.source_code_id, 
                cb.title as source_code_title,
                cc.description, 
                cc.converted_code, 
                cc.user_id,
                cc.created_at,
                u.name as user_name,
                u.email as user_email
            FROM converted_codes cc
            LEFT JOIN code_blocks cb ON cc.source_code_id = cb.id
            LEFT JOIN users u ON cc.user_id = u.id
            WHERE cc.source_code_id = %s
            ORDER BY cc.created_at DESC
        """, (source_code_id,))
        
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
            
        return {"blocks": formatted_blocks, "total": len(formatted_blocks)}
    except Exception as e:
        logger.error(f"변환된 코드 목록 조회 중 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.put("/code/converted/{converted_code_id}", response_model=ConvertedCode)
async def update_converted_code(
    converted_code_id: int,
    converted_code: ConvertedCodeBase,
    current_user: dict = Depends(get_current_user)
):
    """변환된 코드 수정"""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # 변환된 코드 존재 여부 및 소유자 확인
        cur.execute("""
            SELECT id, user_id
            FROM converted_codes
            WHERE id = %s
        """, (converted_code_id,))
        existing_code = cur.fetchone()
        
        if not existing_code:
            raise HTTPException(status_code=404, detail="Converted code not found")
            
        if existing_code['user_id'] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to update this code")
        
        # 변환된 코드 수정
        cur.execute("""
            UPDATE converted_codes
            SET description = %s,
                converted_code = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, source_code_id, description, converted_code, user_id, created_at
        """, (
            converted_code.description,
            converted_code.converted_code,
            converted_code_id
        ))
        
        result = cur.fetchone()
        
        # 부모 코드의 제목 조회
        cur.execute("""
            SELECT title as source_code_title
            FROM code_blocks
            WHERE id = %s
        """, (result['source_code_id'],))
        parent_code = cur.fetchone()
        
        # 사용자 정보 조회
        cur.execute("""
            SELECT name, email
            FROM users
            WHERE id = %s
        """, (current_user["id"],))
        user_info = cur.fetchone()
        
        formatted_result = dict(result)
        formatted_result['source_code_title'] = parent_code['source_code_title']
        if user_info:
            formatted_result['user'] = {
                'name': user_info['name'],
                'email': user_info['email']
            }
            
        conn.commit()
        return formatted_result
    except Exception as e:
        logger.error(f"변환된 코드 수정 중 오류 발생: {e}")
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.delete("/code/converted")
async def delete_converted_codes(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    변환된 코드(들) 삭제
    body: { "ids": [1, 2, 3] }
    """
    data = await request.json()
    ids: List[int] = data.get('ids', [])
    if not ids:
        raise HTTPException(status_code=400, detail="No ids provided")

    conn = get_db_connection()
    try:
        cur = conn.cursor()
        # 본인 소유 코드만 삭제
        cur.execute(
            "DELETE FROM converted_codes WHERE id = ANY(%s) AND user_id = %s",
            (ids, current_user["id"])
        )
        conn.commit()
        return {"success": True, "deleted": cur.rowcount}
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close() 
        
@router.post("/execute-code", response_model=CodeExecuteResponse)
def execute_code(request: CodeExecuteRequest):
    """Python 코드를 실행하고 결과를 반환"""
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(request.code)
            temp_file = f.name

        try:
            process = subprocess.Popen(
                ['python', temp_file],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            stdout, stderr = process.communicate(timeout=DEFAULT_CODE_TIMEOUT)

            return {
                "output": stdout,
                "error": stderr
            }
        finally:
            os.unlink(temp_file)

    except subprocess.TimeoutExpired:
        return {
            "output": "",
            "error": f"코드 실행 시간이 초과되었습니다 ({DEFAULT_CODE_TIMEOUT}초 제한)."
        }
    except Exception as e:
        return {
            "output": "",
            "error": f"코드 실행 중 오류가 발생했습니다: {str(e)}"
        }