from airflow.decorators import dag
from airflow.operators.python import PythonOperator
from datetime import datetime
import logging
import json

def run_translator(**context):
    import subprocess
    import tempfile
    import os
    
    # REST API로부터 전달받은 파라미터 추출
    dag_run = context.get('dag_run')
    if dag_run and dag_run.conf:
        source_code_id = dag_run.conf.get('source_code_id')
        source_code_title = dag_run.conf.get('source_code_title')
        source_code = dag_run.conf.get('source_code')  # 실제 Python 코드
        
        logging.info(f"REST API로부터 받은 source_code_id: {source_code_id}")
        logging.info(f"REST API로부터 받은 source_code_title: {source_code_title}")
        logging.info(f"REST API로부터 받은 source_code: {source_code}")
        
        # REST API에서 전달받은 실제 Python 코드 사용
        if source_code:
            origin_code = source_code
        else:
            # fallback: source_code가 없을 경우 기본값 사용
            origin_code = f"""
            # {source_code_title}에 대한 변환규칙 생성
            # Source Code ID: {source_code_id}
            
            def sample_function():
                # 여기에 실제 원본 코드가 들어가야 합니다
                pass
            """
        target_lang = "js"
    else:
        origin_code = """
        def add(a, b):
            return a + b
        """
        logging.info(f"기본값 사용 - origin_code: {origin_code}")
    
    if not origin_code:
        raise ValueError("origin_code는 필수 파라미터입니다.")
    
    # 임시 디렉토리 생성
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_output_file = os.path.join(temp_dir, "rule_generate.js")
        
        # 환경 변수로 출력 파일 경로 전달
        env = os.environ.copy()
        env["OUTPUT_FILE"] = temp_output_file
        
        # PiREL 작업 디렉토리 설정
        pirel_dir = "/data/workspace/PiREL-private"
        file_path = os.path.join(pirel_dir, "rule_generator_exec.py")
        
        # Python 3.12 가상환경의 Python 경로 설정
        venv_python = "/opt/airflow/pirel_env/.venv/bin/python"
        
        try:
            result = subprocess.run(
                [venv_python, file_path, "--origin-code", origin_code],
                check=True,
                capture_output=True,
                text=True,
                env=env,
                cwd="/tmp"
            )
            logging.info(f"Command output: {result.stdout}")
            
        except subprocess.CalledProcessError as e:
            logging.error(f"Command failed with error: {e.stderr}")
            raise
        
        # 결과 파일 읽기
        if os.path.exists(temp_output_file):
            with open(temp_output_file, 'r', encoding='utf-8') as f:
                generated_code = f.read()
        else:
            generated_code = result.stdout
            
        # XCom을 통해 결과 저장
        context['task_instance'].xcom_push(key='rule_generate_result', value=generated_code)
        
        return generated_code

def get_result(**context):
    task_instance = context['task_instance']
    result = task_instance.xcom_pull(task_ids='rule_generator', key='rule_generate_result')
    return result

@dag(
    dag_id="rule_task",
    start_date=datetime(2025, 2, 17),
    catchup=False,
    tags=['rule_task-sj'],
)
def rule_task_dag():
    
    task1 = PythonOperator(
        task_id="rule_generator",
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
dag = rule_task_dag()