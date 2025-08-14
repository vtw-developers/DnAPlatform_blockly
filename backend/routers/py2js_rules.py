from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from database import get_db_connection

router = APIRouter(tags=["py2js-rules"])

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
