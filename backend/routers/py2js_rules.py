from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from database import get_db_connection
from pydantic import BaseModel

# Pydantic 모델 정의
class Py2JsRuleUpdate(BaseModel):
    examples: Optional[str] = None
    mark: Optional[str] = None
    rules: Optional[str] = None
    is_commented: Optional[bool] = None

class Py2JsRuleCreate(BaseModel):
    examples: str
    mark: str
    rules: str
    is_commented: bool = False

router = APIRouter(tags=["py2js-rules"])

@router.post("/py2js-rules")
async def create_py2js_rule(rule_create: Py2JsRuleCreate):
    """
    새로운 Python to JavaScript 변환규칙을 생성합니다.
    """
    try:
        # 데이터베이스 연결
        connection = get_db_connection()
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        # 새 규칙 삽입
        query = """
        INSERT INTO py2js_rule (examples, mark, rules, is_commented, created_at, updated_at)
        VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, examples, mark, rules, is_commented, created_at, updated_at
        """
        
        cursor.execute(query, (
            rule_create.examples,
            rule_create.mark,
            rule_create.rules,
            rule_create.is_commented
        ))
        
        new_rule = cursor.fetchone()
        
        # 커밋 및 연결 종료
        connection.commit()
        cursor.close()
        connection.close()
        
        # 결과 반환
        return dict(new_rule)
        
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"변환규칙 생성 중 오류가 발생했습니다: {str(e)}"
        )

@router.get("/py2js-rules")
async def get_py2js_rules():
    """
    Python to JavaScript 변환규칙 목록을 조회합니다.
    """
    try:
        # 데이터베이스 연결
        connection = get_db_connection()
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        # 모든 규칙 조회 (ID 순으로 정렬)
        query = """
        SELECT id, examples, mark, rules, is_commented
        FROM py2js_rule 
        ORDER BY id
        """
        
        cursor.execute(query)
        rules = cursor.fetchall()
        
        # 커서와 연결 종료
        cursor.close()
        connection.close()
        
        # 결과 반환
        return [dict(rule) for rule in rules]
        
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"변환규칙 조회 중 오류가 발생했습니다: {str(e)}"
        )

@router.get("/py2js-rules/{rule_id}")
async def get_py2js_rule_by_id(rule_id: int):
    """
    특정 ID의 Python to JavaScript 변환규칙을 조회합니다.
    """
    try:
        # 데이터베이스 연결
        connection = get_db_connection()
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        # 특정 ID의 규칙 조회
        query = """
        SELECT id, examples, mark, rules, is_commented
        FROM py2js_rule 
        WHERE id = %s
        """
        
        cursor.execute(query, (rule_id,))
        rule = cursor.fetchone()
        
        # 커서와 연결 종료
        cursor.close()
        connection.close()
        
        if not rule:
            raise HTTPException(
                status_code=404, 
                detail=f"ID {rule_id}의 변환규칙을 찾을 수 없습니다."
            )
        
        # 결과 반환
        return dict(rule)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"변환규칙 조회 중 오류가 발생했습니다: {str(e)}"
        )

@router.get("/py2js-rules/count")
async def get_py2js_rules_count():
    """
    Python to JavaScript 변환규칙의 총 개수를 조회합니다.
    """
    try:
        # 데이터베이스 연결
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # 규칙 개수 조회
        query = "SELECT COUNT(*) FROM py2js_rule"
        
        cursor.execute(query)
        count = cursor.fetchone()[0]
        
        # 커서와 연결 종료
        cursor.close()
        connection.close()
        
        # 결과 반환
        return {"count": count}
        
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"변환규칙 개수 조회 중 오류가 발생했습니다: {str(e)}"
        )

@router.put("/py2js-rules/{rule_id}")
async def update_py2js_rule(rule_id: int, rule_update: Py2JsRuleUpdate):
    """
    특정 ID의 Python to JavaScript 변환규칙을 수정합니다.
    """
    try:
        # 데이터베이스 연결
        connection = get_db_connection()
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        # 업데이트할 필드들 구성
        update_fields = []
        update_values = []
        
        if rule_update.examples is not None:
            update_fields.append("examples = %s")
            update_values.append(rule_update.examples)
        
        if rule_update.mark is not None:
            update_fields.append("mark = %s")
            update_values.append(rule_update.mark)
        
        if rule_update.rules is not None:
            update_fields.append("rules = %s")
            update_values.append(rule_update.rules)
        
        if rule_update.is_commented is not None:
            update_fields.append("is_commented = %s")
            update_values.append(rule_update.is_commented)
        
        if not update_fields:
            raise HTTPException(
                status_code=400,
                detail="수정할 필드가 없습니다."
            )
        
        # updated_at 필드 추가
        update_fields.append("updated_at = CURRENT_TIMESTAMP")
        
        # 쿼리 실행
        query = f"""
        UPDATE py2js_rule 
        SET {', '.join(update_fields)}
        WHERE id = %s
        """
        
        update_values.append(rule_id)
        cursor.execute(query, update_values)
        
        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail=f"ID {rule_id}의 변환규칙을 찾을 수 없습니다."
            )
        
        # 수정된 규칙 조회
        cursor.execute("""
            SELECT id, examples, mark, rules, is_commented 
            FROM py2js_rule 
            WHERE id = %s
        """, (rule_id,))
        
        updated_rule = cursor.fetchone()
        
        # 커밋 및 연결 종료
        connection.commit()
        cursor.close()
        connection.close()
        
        # 결과 반환
        return dict(updated_rule)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"변환규칙 수정 중 오류가 발생했습니다: {str(e)}"
        )

@router.delete("/py2js-rules/{rule_id}")
async def delete_py2js_rule(rule_id: int):
    """
    특정 ID의 Python to JavaScript 변환규칙을 삭제합니다.
    """
    try:
        # 데이터베이스 연결
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # 규칙 삭제
        query = "DELETE FROM py2js_rule WHERE id = %s"
        cursor.execute(query, (rule_id,))
        
        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail=f"ID {rule_id}의 변환규칙을 찾을 수 없습니다."
            )
        
        # 커밋 및 연결 종료
        connection.commit()
        cursor.close()
        connection.close()
        
        # 결과 반환
        return {"message": f"ID {rule_id}의 변환규칙이 삭제되었습니다."}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"변환규칙 삭제 중 오류가 발생했습니다: {str(e)}"
        )
