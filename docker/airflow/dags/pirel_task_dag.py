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
        
        target_lang = "js"
    else:
        origin_code = """
        def add(a, b):
            return a + b
        """
        snart_content = ""
        logging.info(f"기본값 사용 - origin_code: {origin_code}")    
    
    if not origin_code:
        raise ValueError("origin_code는 필수 파라미터입니다.")
        
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
            cmd_args = [venv_python, file_path, origin_code, target_lang]
            if temp_snart_file:
                cmd_args.append(f"--snart-file={temp_snart_file}")
            
            logging.info(f"실행할 명령어: {cmd_args}")
            logging.info(f"전달할 코드 길이: {len(origin_code)}")
            
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
            logging.error(f"Command failed with error code: {e.returncode}")
            logging.error(f"Command stderr: {e.stderr}")
            logging.error(f"Command stdout: {e.stdout}")
            
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