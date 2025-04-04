import os
import time
import psycopg2
from psycopg2.extras import RealDictCursor
import logging

logger = logging.getLogger(__name__)

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
        raise Exception("데이터베이스 연결 실패")

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