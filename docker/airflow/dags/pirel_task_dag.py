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
        origin_code = dag_run.conf.get('origin_code')
        logging.info(f"REST API로부터 받은 origin_code: {origin_code}")
        # target_lang = dag_run.conf.get('target_lang')
        # logging.info(f"REST API로부터 받은 target_lang: {target_lang}")
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
        temp_output_file = os.path.join(temp_dir, "pirel_translate.js")
        
        # 환경 변수로 출력 파일 경로 전달
        env = os.environ.copy()
        env["OUTPUT_FILE"] = temp_output_file
        
        # PiREL 작업 디렉토리 설정
        pirel_dir = "/data/workspace/PiREL-private/src"
        file_path = os.path.join(pirel_dir, "api_vtw_exec.py")
        
        # Python 3.12 가상환경의 Python 경로 설정
        venv_python = "/opt/airflow/pirel_env/.venv/bin/python"
        
        try:
            result = subprocess.run(
                [venv_python, file_path, origin_code, target_lang],
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