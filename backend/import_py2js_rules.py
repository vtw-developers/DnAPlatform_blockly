#!/usr/bin/env python3
"""
Python to JavaScript 변환 규칙을 leet.snart 파일에서 추출하여 
PostgreSQL DB의 py2js_rule 테이블에 저장하는 프로그램
"""

import os
import re
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import List, Dict, Optional, Tuple
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class Py2JsRuleImporter:
    """Python to JavaScript 변환 규칙을 DB에 임포트하는 클래스"""
    
    def __init__(self):
        """초기화 - DB 연결 설정"""
        self.db_config = {
            'host': os.getenv("DB_HOST", "postgres"),
            'database': os.getenv("DB_NAME", "blockly_db"),
            'user': os.getenv("DB_USER", "blockly_user"),
            'password': os.getenv("DB_PASSWORD", "blockly_password"),
            'cursor_factory': RealDictCursor
        }
        self.connection = None
        self.cursor = None
    
    def connect_db(self):
        """데이터베이스에 연결"""
        try:
            self.connection = psycopg2.connect(**self.db_config)
            self.cursor = self.connection.cursor()
            logger.info("데이터베이스 연결 성공")
        except Exception as e:
            logger.error(f"데이터베이스 연결 실패: {e}")
            raise
    
    def create_table(self):
        """py2js_rule 테이블 생성"""
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS py2js_rule (
            sn SERIAL PRIMARY KEY,
            examples TEXT,
            mark TEXT,
            rules TEXT NOT NULL
        );
        """
        
        try:
            self.cursor.execute(create_table_sql)
            self.connection.commit()
            logger.info("py2js_rule 테이블 생성 완료")
        except Exception as e:
            logger.error(f"테이블 생성 실패: {e}")
            self.connection.rollback()
            raise
    
    def clear_table(self):
        """기존 데이터 삭제"""
        try:
            self.cursor.execute("DELETE FROM py2js_rule")
            self.connection.commit()
            logger.info("기존 데이터 삭제 완료")
        except Exception as e:
            logger.error(f"데이터 삭제 실패: {e}")
            self.connection.rollback()
            raise
    
    def parse_leet_snart_file(self, file_path: str) -> List[Dict]:
        """leet.snart 파일을 파싱하여 규칙 데이터 추출"""
        rules_data = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            # match_expand로 시작하는 모든 블록을 찾기
            # 각 블록은 다음 match_expand 전까지 또는 파일 끝까지
            rule_blocks = []
            start_pos = 0
            
            while True:
                # match_expand 찾기
                match_pos = content.find('match_expand', start_pos)
                if match_pos == -1:
                    break
                
                # 다음 match_expand 위치 찾기
                next_match = content.find('match_expand', match_pos + 1)
                if next_match == -1:
                    # 마지막 블록
                    block = content[match_pos:].strip()
                else:
                    # 다음 블록 전까지
                    block = content[match_pos:next_match].strip()
                
                rule_blocks.append(block)
                start_pos = next_match if next_match != -1 else len(content)
            
            logger.info(f"파싱된 블록 수: {len(rule_blocks)}")
            
            for block_num, block in enumerate(rule_blocks, 1):
                if not block.strip():
                    continue
                
                # examples, mark, rules 추출
                examples = self._extract_examples(block)
                mark = self._extract_mark(block)
                rules = self._extract_rules(block)
                
                if rules:  # rules가 있는 경우만 추가
                    rules_data.append({
                        'sn': block_num,
                        'examples': examples,
                        'mark': mark,
                        'rules': rules
                    })
            
            logger.info(f"총 {len(rules_data)}개의 규칙을 파싱했습니다.")
            return rules_data
            
        except Exception as e:
            logger.error(f"파일 파싱 실패: {e}")
            raise
    
    def _extract_examples(self, block: str) -> Optional[str]:
        """examples 주석에서 예시 코드 추출"""
        examples_match = re.search(r'; examples: "(.*?)"', block, re.DOTALL)
        if examples_match:
            return examples_match.group(1).strip()
        return None
    
    def _extract_mark(self, block: str) -> Optional[str]:
        """mark 주석에서 마킹 정보 추출"""
        mark_match = re.search(r'; mark: (.*?)(?:\n|$)', block, re.DOTALL)
        if mark_match:
            return mark_match.group(1).strip()
        return None
    
    def _extract_rules(self, block: str) -> Optional[str]:
        """match_expand 규칙 부분 추출"""
        # match_expand로 시작하는 부분을 찾아서 전체 규칙 추출
        rules_match = re.search(r'(match_expand.*?)(?=\n\n|\n;|\n$|$)', block, re.DOTALL)
        if rules_match:
            return rules_match.group(1).strip()
        return None
    
    def insert_rules(self, rules_data: List[Dict]):
        """규칙 데이터를 DB에 삽입"""
        insert_sql = """
        INSERT INTO py2js_rule (sn, examples, mark, rules) 
        VALUES (%s, %s, %s, %s)
        """
        
        try:
            for rule in rules_data:
                self.cursor.execute(insert_sql, (
                    rule['sn'],
                    rule['examples'],
                    rule['mark'],
                    rule['rules']
                ))
            
            self.connection.commit()
            logger.info(f"{len(rules_data)}개의 규칙을 DB에 삽입했습니다.")
            
        except Exception as e:
            logger.error(f"데이터 삽입 실패: {e}")
            self.connection.rollback()
            raise
    
    def verify_data(self):
        """삽입된 데이터 검증"""
        try:
            self.cursor.execute("SELECT COUNT(*) FROM py2js_rule")
            count = self.cursor.fetchone()['count']
            logger.info(f"DB에 저장된 총 규칙 수: {count}")
            
            # 샘플 데이터 확인
            self.cursor.execute("SELECT sn, examples, mark, rules FROM py2js_rule LIMIT 3")
            sample_data = self.cursor.fetchall()
            
            for row in sample_data:
                logger.info(f"샘플 데이터 - SN: {row['sn']}, "
                          f"Examples 길이: {len(row['examples']) if row['examples'] else 0}, "
                          f"Mark 길이: {len(row['mark']) if row['mark'] else 0}, "
                          f"Rules 길이: {len(row['rules'])}")
                
        except Exception as e:
            logger.error(f"데이터 검증 실패: {e}")
            raise
    
    def close_connection(self):
        """데이터베이스 연결 종료"""
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()
        logger.info("데이터베이스 연결 종료")
    
    def run_import(self, file_path: str):
        """전체 임포트 프로세스 실행"""
        try:
            logger.info("Python to JavaScript 규칙 임포트 시작")
            
            # 1. DB 연결
            self.connect_db()
            
            # 2. 테이블 생성
            self.create_table()
            
            # 3. 기존 데이터 삭제
            self.clear_table()
            
            # 4. 파일 파싱
            rules_data = self.parse_leet_snart_file(file_path)
            
            # 5. 데이터 삽입
            self.insert_rules(rules_data)
            
            # 6. 데이터 검증
            self.verify_data()
            
            logger.info("Python to JavaScript 규칙 임포트 완료!")
            
        except Exception as e:
            logger.error(f"임포트 프로세스 실패: {e}")
            raise
        finally:
            self.close_connection()


def main():
    """메인 함수"""
    # leet.snart 파일 경로 설정
    # 현재 스크립트가 backend 디렉토리에 있으므로 같은 디렉토리에서 파일 찾기
    current_dir = os.path.dirname(os.path.abspath(__file__))
    leet_snart_path = os.path.join(current_dir, 'leet.snart')
    
    if not os.path.exists(leet_snart_path):
        logger.error(f"leet.snart 파일을 찾을 수 없습니다: {leet_snart_path}")
        return
    
    # 임포터 실행
    importer = Py2JsRuleImporter()
    importer.run_import(leet_snart_path)


if __name__ == "__main__":
    main()
