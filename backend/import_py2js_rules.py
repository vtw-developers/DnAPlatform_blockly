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
import difflib
import hashlib

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class Py2JsRuleImporter:
    """Python to JavaScript 변환 규칙을 DB에 임포트하는 클래스"""
    
    def __init__(self):
        """초기화 - DB 연결 설정"""
        self.db_config = {
            'host': os.getenv("DB_HOST", "localhost"),  # 도커 컨테이너의 호스트
            'port': os.getenv("DB_PORT", "5432"),       # 포트 추가
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
        create_sql = """
        CREATE TABLE IF NOT EXISTS py2js_rule (
            id SERIAL PRIMARY KEY,
            examples TEXT,
            mark TEXT,
            rules TEXT NOT NULL,
            is_commented BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
        
        try:
            self.cursor.execute(create_sql)
            self.connection.commit()
            logger.info("py2js_rule 테이블이 성공적으로 생성되었습니다.")
        except Exception as e:
            logger.error(f"테이블 생성 실패: {e}")
            raise
    
    def clear_table(self):
        """py2js_rule 테이블의 모든 데이터 삭제 및 테이블 재생성"""
        try:
            # 기존 테이블 삭제
            self.cursor.execute("DROP TABLE IF EXISTS py2js_rule")
            self.connection.commit()
            logger.info("기존 py2js_rule 테이블이 삭제되었습니다.")
            
            # 새 테이블 생성
            self.create_table()
            
        except Exception as e:
            self.connection.rollback()
            logger.error(f"테이블 재생성 실패: {e}")
            raise
    
    def parse_leet_snart_file(self, file_path: str) -> List[Dict]:
        """leet.snart 파일을 파싱하여 규칙 데이터 추출"""
        rules_data = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            # match_expand 규칙들을 직접 찾아서 파싱
            rule_blocks = []
            
            # match_expand의 위치들을 모두 찾기 (주석 처리된 것 포함)
            match_positions = []
            start_pos = 0
            while True:
                pos = content.find('(match_expand', start_pos)
                if pos == -1:
                    break
                
                # 이 위치 앞에 주석 처리(;;)가 있는지 확인
                comment_start = pos
                while comment_start > 0 and content[comment_start-1] in [' ', '\t', '\n', '\r']:
                    comment_start -= 1
                
                # 주석 처리된 rule인지 확인
                is_commented = False
                if comment_start >= 2 and content[comment_start-2:comment_start] == ';;':
                    is_commented = True
                
                match_positions.append((pos, is_commented))
                start_pos = pos + 1
            
            logger.info(f"찾은 match_expand 위치 수: {len(match_positions)}")
            
            # 각 match_expand 규칙에 대해 괄호 균형을 맞춰서 끝점 찾기
            for rule_num, (start_pos, is_commented) in enumerate(match_positions, 1):
                # 괄호 균형을 맞춰서 match_expand의 끝점 찾기
                paren_count = 0
                rule_end_pos = start_pos
                in_string = False
                string_delimiter = None
                
                for i in range(start_pos, len(content)):
                    char = content[i]
                    
                    # 문자열 내부 처리
                    if char in ['"', "'"] and (i == 0 or content[i-1] != '\\'):
                        if not in_string:
                            in_string = True
                            string_delimiter = char
                        elif char == string_delimiter:
                            in_string = False
                            string_delimiter = None
                        continue
                    
                    # 문자열 내부에서는 괄호 카운트하지 않음
                    if in_string:
                        continue
                    
                    if char == '(':
                        paren_count += 1
                    elif char == ')':
                        paren_count -= 1
                        if paren_count == 0:
                            rule_end_pos = i + 1
                            break
                
                # 규칙 텍스트 추출
                rule_text = content[start_pos:rule_end_pos]
                
                # 주석 처리된 rule인 경우 원래 형태로 복원
                if is_commented:
                    rule_text = ';;' + rule_text
                
                # 이 규칙 앞쪽의 주석들 찾기
                prev_match_end = 0
                if rule_num > 1:
                    prev_match_end = match_positions[rule_num - 2][0]  # 이전 규칙의 시작점
                    # 이전 규칙의 끝점 찾기
                    prev_paren_count = 0
                    prev_in_string = False
                    prev_string_delimiter = None
                    
                    for i in range(prev_match_end, len(content)):
                        char = content[i]
                        
                        # 문자열 내부 처리
                        if char in ['"', "'"] and (i == 0 or content[i-1] != '\\'):
                            if not prev_in_string:
                                prev_in_string = True
                                prev_string_delimiter = char
                            elif char == prev_string_delimiter:
                                prev_in_string = False
                                prev_string_delimiter = None
                            continue
                        
                        # 문자열 내부에서는 괄호 카운트하지 않음
                        if prev_in_string:
                            continue
                        
                        if char == '(':
                            prev_paren_count += 1
                        elif char == ')':
                            prev_paren_count -= 1
                            if prev_paren_count == 0:
                                prev_match_end = i + 1
                                break
                
                # 주석 영역 추출 (이전 규칙 끝점부터 현재 규칙 시작점까지)
                comment_area = content[prev_match_end:start_pos]
                
                # examples 주석 찾기 - 개선된 정규식으로 따옴표가 제대로 닫힌 경우만 매칭
                examples = None
                examples_pattern = r'; examples:\s*"((?:[^"\\]|\\.)*)"'
                examples_match = re.search(examples_pattern, comment_area, re.DOTALL)
                if examples_match:
                    examples = examples_match.group(1).strip()
                    # 이스케이프된 문자들을 원래대로 복원
                    examples = examples.replace('\\"', '"').replace("\\'", "'")
                
                # mark 주석 찾기
                mark = None
                mark_match = re.search(r'; mark:\s*(.*?)(?:\n|$)', comment_area, re.DOTALL)
                if mark_match:
                    mark = mark_match.group(1).strip()
                
                # 규칙 추가 (중복된 match_expand가 있는지 확인)
                match_expand_count = rule_text.count('(match_expand')
                if match_expand_count > 1:
                    logger.warning(f"Rule {rule_num}: 중복된 match_expand 발견 ({match_expand_count}개)")
                    # 중복된 match_expand가 있는 경우 건너뛰기
                    continue
                
                # 규칙이 비어있지 않은 경우만 추가
                if rule_text.strip():
                    rule_blocks.append({
                        'examples': examples,
                        'mark': mark,
                        'rules': rule_text,
                        'is_commented': is_commented
                    })
                    
                    logger.info(f"Rule {rule_num}: examples={examples is not None}, mark={mark is not None}, rules 길이={len(rule_text)}, 주석처리={is_commented}")
                else:
                    logger.warning(f"Rule {rule_num}: 빈 규칙 텍스트 발견, 건너뛰기")
            
            logger.info(f"파싱된 규칙 수: {len(rule_blocks)}")
            
            # 규칙 데이터 구성
            for block_num, block in enumerate(rule_blocks, 1):
                rules_data.append({
                    'examples': block['examples'],
                    'mark': block['mark'],
                    'rules': block['rules'],
                    'is_commented': block['is_commented']
                })
            
            logger.info(f"총 {len(rules_data)}개의 규칙을 파싱했습니다.")
            return rules_data
            
        except Exception as e:
            logger.error(f"파일 파싱 실패: {e}")
            raise
    
    def insert_rules(self, rules_data: List[Dict]):
        """규칙 데이터를 DB에 삽입"""
        insert_sql = """
        INSERT INTO py2js_rule (examples, mark, rules, is_commented) 
        VALUES (%s, %s, %s, %s)
        """
        
        try:
            for rule in rules_data:
                self.cursor.execute(insert_sql, (
                    rule['examples'],
                    rule['mark'],
                    rule['rules'],
                    rule['is_commented']
                ))
            
            self.connection.commit()
            logger.info(f"{len(rules_data)}개의 규칙을 DB에 삽입했습니다.")
            
        except Exception as e:
            self.connection.rollback()
            logger.error(f"규칙 삽입 실패: {e}")
            raise
    
    def verify_data(self):
        """삽입된 데이터 검증"""
        try:
            self.cursor.execute("SELECT COUNT(*) FROM py2js_rule")
            count = self.cursor.fetchone()['count']
            logger.info(f"DB에 저장된 총 규칙 수: {count}")
            
            # 샘플 데이터 확인
            self.cursor.execute("SELECT id, examples, mark, rules FROM py2js_rule LIMIT 3")
            sample_data = self.cursor.fetchall()
            
            for row in sample_data:
                logger.info(f"샘플 데이터 - ID: {row['id']}, "
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


class Py2JsRuleExporter:
    """DB에서 규칙을 가져와서 snart 파일로 내보내는 클래스"""
    
    def __init__(self):
        """초기화 - DB 연결 설정"""
        self.db_config = {
            'host': os.getenv("DB_HOST", "localhost"),
            'port': os.getenv("DB_PORT", "5432"),
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
    
    def get_all_rules(self) -> List[Dict]:
        """DB에서 모든 규칙을 가져오기"""
        try:
            self.cursor.execute("SELECT examples, mark, rules, is_commented FROM py2js_rule ORDER BY id")
            rules = self.cursor.fetchall()
            logger.info(f"DB에서 {len(rules)}개의 규칙을 가져왔습니다.")
            
            # RealDictCursor는 이미 딕셔너리 형태로 반환하므로 그대로 사용
            return rules
            
        except Exception as e:
            logger.error(f"규칙 조회 실패: {e}")
            raise
    
    def export_to_snart_file(self, output_path: str):
        """DB의 규칙을 snart 파일로 내보내기"""
        try:
            rules = self.get_all_rules()
            
            with open(output_path, 'w', encoding='utf-8') as file:
                for rule in rules:
                    # examples 주석이 있는 경우 추가
                    if rule['examples']:
                        # examples 내용에 따옴표가 포함된 경우 이스케이프 처리
                        escaped_examples = rule['examples'].replace('"', '\\"').replace("'", "\\'")
                        file.write(f'; examples: "{escaped_examples}"\n')
                    
                    # mark 주석이 있는 경우 추가
                    if rule['mark']:
                        file.write(f'; mark: {rule["mark"]}\n')
                    
                    # 규칙 추가 (주석 처리된 경우 ;; 추가)
                    if rule.get('is_commented', False):
                        # 이미 ;;가 포함되어 있다면 그대로 출력
                        if rule['rules'].startswith(';;'):
                            file.write(f'{rule["rules"]}\n\n')
                        else:
                            file.write(f';;{rule["rules"]}\n\n')
                    else:
                        file.write(f'{rule["rules"]}\n\n')
            
            logger.info(f"snart 파일 내보내기 완료: {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"snart 파일 내보내기 실패: {e}")
            raise
    
    def compare_with_original(self, generated_file_path: str, original_file_path: str) -> Dict:
        """생성된 파일과 원본 파일 비교"""
        try:
            # 파일 읽기
            with open(generated_file_path, 'r', encoding='utf-8') as f:
                generated_content = f.read()
            
            with open(original_file_path, 'r', encoding='utf-8') as f:
                original_content = f.read()
            
            # 파일 크기 비교
            generated_size = len(generated_content)
            original_size = len(original_content)
            
            # 해시값 비교
            generated_hash = hashlib.md5(generated_content.encode()).hexdigest()
            original_hash = hashlib.md5(original_content.encode()).hexdigest()
            
            # 차이점 분석
            diff_lines = list(difflib.unified_diff(
                original_content.splitlines(keepends=True),
                generated_content.splitlines(keepends=True),
                fromfile='원본 파일',
                tofile='생성된 파일',
                lineterm=''
            ))
            
            comparison_result = {
                'generated_file_size': generated_size,
                'original_file_size': original_size,
                'size_difference': generated_size - original_size,
                'generated_file_hash': generated_hash,
                'original_file_hash': original_hash,
                'files_identical': generated_hash == original_hash,
                'diff_lines': diff_lines,
                'diff_line_count': len(diff_lines)
            }
            
            logger.info(f"파일 비교 완료:")
            logger.info(f"  - 생성된 파일 크기: {generated_size:,} bytes")
            logger.info(f"  - 원본 파일 크기: {original_size:,} bytes")
            logger.info(f"  - 크기 차이: {comparison_result['size_difference']:,} bytes")
            logger.info(f"  - 파일 동일성: {'동일함' if comparison_result['files_identical'] else '다름'}")
            logger.info(f"  - 차이점 라인 수: {comparison_result['diff_line_count']}")
            
            return comparison_result
            
        except Exception as e:
            logger.error(f"파일 비교 실패: {e}")
            raise
    
    def generate_comparison_report(self, comparison_result: Dict, report_path: str):
        """비교 결과를 보고서로 저장"""
        try:
            with open(report_path, 'w', encoding='utf-8') as f:
                f.write("=== Python to JavaScript 규칙 파일 비교 보고서 ===\n\n")
                f.write(f"생성된 파일 크기: {comparison_result['generated_file_size']:,} bytes\n")
                f.write(f"원본 파일 크기: {comparison_result['original_file_size']:,} bytes\n")
                f.write(f"크기 차이: {comparison_result['size_difference']:,} bytes\n")
                f.write(f"파일 동일성: {'동일함' if comparison_result['files_identical'] else '다름'}\n")
                f.write(f"차이점 라인 수: {comparison_result['diff_line_count']}\n\n")
                
                if comparison_result['diff_lines']:
                    f.write("=== 차이점 상세 내용 ===\n")
                    for line in comparison_result['diff_lines']:
                        f.write(line)
                else:
                    f.write("=== 차이점 없음 ===\n")
            
            logger.info(f"비교 보고서 생성 완료: {report_path}")
            
        except Exception as e:
            logger.error(f"보고서 생성 실패: {e}")
            raise
    
    def close_connection(self):
        """데이터베이스 연결 종료"""
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()
        logger.info("데이터베이스 연결 종료")
    
    def run_export_and_compare(self, output_file_path: str, original_file_path: str, report_file_path: str):
        """전체 내보내기 및 비교 프로세스 실행"""
        try:
            logger.info("Python to JavaScript 규칙 내보내기 및 비교 시작")
            
            # 1. DB 연결
            self.connect_db()
            
            # 2. snart 파일로 내보내기
            generated_file = self.export_to_snart_file(output_file_path)
            
            # 3. 원본 파일과 비교
            comparison_result = self.compare_with_original(generated_file, original_file_path)
            
            # 4. 비교 보고서 생성
            self.generate_comparison_report(comparison_result, report_file_path)
            
            logger.info("Python to JavaScript 규칙 내보내기 및 비교 완료!")
            
            return comparison_result
            
        except Exception as e:
            logger.error(f"내보내기 및 비교 프로세스 실패: {e}")
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


def export_and_compare():
    """내보내기 및 비교 함수"""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    original_file_path = os.path.join(current_dir, 'leet.snart')
    generated_file_path = os.path.join(current_dir, 'generated_leet.snart')
    report_file_path = os.path.join(current_dir, 'comparison_report.txt')
    
    if not os.path.exists(original_file_path):
        logger.error(f"원본 leet.snart 파일을 찾을 수 없습니다: {original_file_path}")
        return
    
    # 내보내기 및 비교 실행
    exporter = Py2JsRuleExporter()
    result = exporter.run_export_and_compare(generated_file_path, original_file_path, report_file_path)
    
    return result


if __name__ == "__main__":
    # 기본 임포트 실행
    main()
    
    # 추가로 내보내기 및 비교 실행
    print("\n" + "="*50)
    print("DB에서 규칙을 가져와서 snart 파일로 만들고 원본과 비교")
    print("="*50)
    export_and_compare()
