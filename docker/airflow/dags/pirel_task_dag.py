from airflow.decorators import dag
from airflow.operators.python import PythonOperator
from datetime import datetime
import logging
import json

def run_translator(**context):
    import subprocess
    import tempfile
    import os
    import re
    
    # REST API로부터 전달받은 파라미터 추출
    dag_run = context.get('dag_run')
    if dag_run and dag_run.conf:
        origin_code = dag_run.conf.get('origin_code')
        snart_content = dag_run.conf.get('snart_content', '')  # snart 내용 추출
        logging.info(f"REST API로부터 받은 origin_code: {origin_code}")
        logging.info(f"REST API로부터 받은 snart_content 길이: {len(snart_content)}")
        # target_lang = dag_run.conf.get('target_lang')
        # logging.info(f"REST API로부터 받은 target_lang: {target_lang}")
        target_lang = "js"
    else:
        origin_code = """
        def add(a, b):
            return a + b
        """
        snart_content = ""
        logging.info(f"기본값 사용 - origin_code: {origin_code}")
    
    # ASCII 호환성 검사
    if not origin_code.isascii():
        logging.warning(f"원본 코드에 ASCII가 아닌 문자가 포함됨: {origin_code}")
        # 한글 문자 위치 찾기
        non_ascii_positions = []
        for i, char in enumerate(origin_code):
            if ord(char) > 127:
                non_ascii_positions.append((i, char))
        logging.warning(f"비ASCII 문자 위치: {non_ascii_positions}")
    
    if not origin_code:
        raise ValueError("origin_code는 필수 파라미터입니다.")
    
    # 한글 문자열을 영어로 변환하는 전처리 함수
    def preprocess_korean_strings(code):
        """한글 문자열을 영어로 변환하여 PiREL이 처리할 수 있도록 함"""
        # 한글 문자열 패턴 찾기 (따옴표 안의 한글)
        # 작은따옴표와 큰따옴표 모두 처리
        korean_patterns = [
            r"'([^']*[가-힣]+[^']*)'",  # 작은따옴표 안의 한글
            r'"([^"]*[가-힣]+[^"]*)"'   # 큰따옴표 안의 한글
        ]
        
        korean_strings = []
        for pattern in korean_patterns:
            matches = re.findall(pattern, code)
            korean_strings.extend(matches)
        
        # 변환 매핑 생성
        korean_to_english = {}
        for i, korean_str in enumerate(korean_strings):
            english_str = f"string_{i}"
            korean_to_english[korean_str] = english_str
        
        # 코드에서 한글 문자열을 영어로 교체
        processed_code = code
        for korean, english in korean_to_english.items():
            # 따옴표를 포함한 전체 문자열을 교체
            processed_code = processed_code.replace(f"'{korean}'", f"'{english}'")
            processed_code = processed_code.replace(f'"{korean}"', f'"{english}"')
        
        logging.info(f"한글 문자열 변환: {korean_to_english}")
        logging.info(f"전처리된 코드: {processed_code}")
        
        return processed_code, korean_to_english
    
    # ASCII 검사 및 강제 변환 함수
    def ensure_ascii_compatible(code):
        """코드가 ASCII 호환인지 확인하고, 필요시 강제 변환"""
        if code.isascii():
            return code, {}
        
        # 한글이 포함된 경우 처리
        logging.warning(f"ASCII가 아닌 문자가 발견됨: {code}")
        
        # 한글 문자열 변환
        processed_code, korean_mapping = preprocess_korean_strings(code)
        
        # 여전히 ASCII가 아닌 경우, 모든 한글 문자를 제거하거나 변환
        if not processed_code.isascii():
            logging.error(f"전처리 후에도 ASCII가 아닌 문자가 남아있음")
            # 모든 한글 문자를 영어로 변환
            ascii_code = ""
            char_mapping = {}
            char_count = 0
            
            for char in processed_code:
                if ord(char) > 127:  # ASCII가 아닌 문자
                    if char not in char_mapping:
                        char_mapping[char] = f"char_{char_count}"
                        char_count += 1
                    ascii_code += char_mapping[char]
                else:
                    ascii_code += char
            
            logging.warning(f"모든 비ASCII 문자를 변환: {char_mapping}")
            return ascii_code, char_mapping
        
        return processed_code, korean_mapping
    
    # 더 강력한 ASCII 변환 함수
    def force_ascii_conversion(code):
        """모든 비ASCII 문자를 안전한 ASCII 문자로 변환"""
        if code.isascii():
            return code, {}
        
        # 한글 문자열을 영어로 변환하는 매핑
        korean_to_english = {
            '첫번째': 'first',
            '두번째': 'second', 
            '세번째': 'third',
            '네번째': 'fourth',
            '다섯번째': 'fifth',
            '여섯번째': 'sixth',
            '일곱번째': 'seventh',
            '여덟번째': 'eighth',
            '아홉번째': 'ninth',
            '열번째': 'tenth'
        }
        
        # 문자열 변환
        processed_code = code
        for korean, english in korean_to_english.items():
            processed_code = processed_code.replace(f"'{korean}'", f"'{english}'")
            processed_code = processed_code.replace(f'"{korean}"', f'"{english}"')
        
        # 여전히 비ASCII 문자가 있다면 제거
        if not processed_code.isascii():
            ascii_only = ""
            for char in processed_code:
                if ord(char) <= 127:
                    ascii_only += char
                else:
                    ascii_only += " "  # 비ASCII 문자는 공백으로 대체
            
            logging.warning(f"비ASCII 문자를 공백으로 대체한 코드: {ascii_only}")
            return ascii_only, korean_to_english
        
        return processed_code, korean_to_english
    
    # 코드 전처리 - 강력한 ASCII 변환
    processed_code, korean_mapping = force_ascii_conversion(origin_code)
    
    # 임시 디렉토리 생성
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_output_file = os.path.join(temp_dir, "pirel_translate.js")
        temp_snart_file = os.path.join(temp_dir, "py2js_rules.snart")
        
        # 1. DAG 파라미터에서 .snart 내용을 받아서 임시 파일로 저장
        if snart_content and snart_content.strip():
            # .snart 파일 저장
            with open(temp_snart_file, 'w', encoding='utf-8') as f:
                f.write(snart_content)
            logging.info(f"전달받은 .snart 내용을 임시 파일로 저장: {temp_snart_file}")
            logging.info(f"Snart 파일 내용 미리보기: {snart_content[:200]}...")
        else:
            logging.warning("DAG 파라미터에 snart_content가 없거나 비어있습니다.")
            temp_snart_file = None
        
        # 환경 변수로 출력 파일 경로와 .snart 파일 경로 전달
        env = os.environ.copy()
        env["OUTPUT_FILE"] = temp_output_file
        if temp_snart_file and os.path.exists(temp_snart_file):
            env["SNART_FILE"] = temp_snart_file
            logging.info(f"SNART_FILE 환경변수 설정: {temp_snart_file}")
        else:
            logging.warning("SNART_FILE을 설정할 수 없습니다.")
        
        # PiREL 작업 디렉토리 설정
        pirel_dir = "/data/workspace/PiREL-private/src"
        file_path = os.path.join(pirel_dir, "api_vtw_exec.py")
        
        # Python 3.12 가상환경의 Python 경로 설정
        venv_python = "/opt/airflow/pirel_env/.venv/bin/python"
        
        try:
            # 서브프로그램에 .snart 파일 경로를 추가 인자로 전달
            cmd_args = [venv_python, file_path, processed_code, target_lang]
            if temp_snart_file:
                cmd_args.append(f"--snart-file={temp_snart_file}")
            
            result = subprocess.run(
                cmd_args,
                check=True,
                capture_output=True,
                text=True,
                env=env,
                cwd="/tmp"
            )
            logging.info(f"Command output: {result.stdout}")
            
        except subprocess.CalledProcessError as e:
            logging.error(f"Command failed with error: {e.stderr}")
            
            # ASCII 에러인 경우 추가 처리
            if "AssertionError" in e.stderr and "isascii" in e.stderr:
                logging.warning("ASCII 검사 실패, 더 강력한 전처리 시도")
                
                # 모든 한글 문자를 제거하고 다시 시도
                ascii_only_code = ""
                for char in processed_code:
                    if ord(char) <= 127:  # ASCII 문자만 유지
                        ascii_only_code += char
                    else:
                        ascii_only_code += " "  # 한글 문자는 공백으로 대체
                
                logging.info(f"ASCII 전용 코드로 재시도: {ascii_only_code}")
                
                try:
                    # 서브프로그램에 .snart 파일 경로를 추가 인자로 전달
                    cmd_args = [venv_python, file_path, ascii_only_code, target_lang]
                    if temp_snart_file:
                        cmd_args.append(f"--snart-file={temp_snart_file}")
                    
                    result = subprocess.run(
                        cmd_args,
                        check=True,
                        capture_output=True,
                        text=True,
                        env=env,
                        cwd="/tmp"
                    )
                    logging.info(f"ASCII 전용 코드 변환 성공: {result.stdout}")
                except subprocess.CalledProcessError as e2:
                    logging.error(f"ASCII 전용 코드 변환도 실패: {e2.stderr}")
                    raise e2
            else:
                raise
        
        # 결과 파일 읽기
        if os.path.exists(temp_output_file):
            with open(temp_output_file, 'r', encoding='utf-8') as f:
                generated_code = f.read()
        else:
            generated_code = result.stdout
        
        # 결과에서 영어 문자열을 다시 한글로 복원
        if korean_mapping:
            for korean, english in korean_mapping.items():
                generated_code = generated_code.replace(f"'{english}'", f"'{korean}'")
                generated_code = generated_code.replace(f'"{english}"', f'"{korean}"')
                # 단일 문자 변환도 복원
                generated_code = generated_code.replace(english, korean)
            logging.info(f"한글 문자열 복원 완료")
            
        # XCom을 통해 결과 저장
        context['task_instance'].xcom_push(key='pirel_translate_result', value=generated_code)
        
        return generated_code

def get_result(**context):
    task_instance = context['task_instance']
    result = task_instance.xcom_pull(task_ids='pirel_translator', key='pirel_translate_result')
    return result

@dag(
    dag_id="pirel_task",
    start_date=datetime(2025, 2, 17),
    catchup=False,
    tags=['pirel_task-sj'],
)
def pirel_task_dag():
    
    task1 = PythonOperator(
        task_id="pirel_translator",
        python_callable=run_translator,
        provide_context=True
    )
        
    task2 = PythonOperator(
        task_id="get_result",
        python_callable=get_result,
        provide_context=True
    )
        
    task1 >> task2

# DAG 객체 생성
dag = pirel_task_dag()