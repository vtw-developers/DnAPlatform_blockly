from airflow.decorators import dag
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
import logging
from airflow.hooks.base import BaseHook
import os

def get_openai_api_key():
    """OpenAI API 키를 가져옵니다."""
    try:
        conn = BaseHook.get_connection("openai_default")
        return conn.password
    except Exception:
        return os.getenv('OPENAI_API_KEY', '')

def run_generator(**context):
    """Semantic equivalent 코드를 생성합니다."""
    import subprocess
    import tempfile
    import os
    
    # API 키 가져오기
    api_key = get_openai_api_key()
    
    # REST API 파라미터 추출
    dag_run = context.get('dag_run')
    if dag_run and dag_run.conf:
        model_name = dag_run.conf.get('model_name', 'qwen3:32b')
        model_type = dag_run.conf.get('model_type', 'ollama')
        origin_code = dag_run.conf.get('origin_code', '')
        temp = dag_run.conf.get('temp', 0)
        
        # GPT 모델인 경우 OpenAI로 설정
        if 'gpt' in model_name.lower():
            model_type = 'openai'
            # deprecated 모델을 현재 사용 가능한 모델로 변경
            if model_name in ['gpt-4-vision-preview', 'gpt-4-1106-preview', 'gpt-4-0125-preview']:
                model_name = 'gpt-4o'
    else:
        model_name = 'qwen3:32b'
        model_type = 'ollama'
        origin_code = ""
        temp = 0
    
    if not origin_code:
        raise ValueError("origin_code는 필수 파라미터입니다.")
    
    # 실행 파일 경로 확인
    file_path = "/data/workspace/Vtw/semantic_equiv/sem_equiv_generator_exec.py"
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"실행 파일을 찾을 수 없습니다: {file_path}")
    
    # 임시 디렉토리에서 실행
    with tempfile.TemporaryDirectory() as temp_dir:
        output_file = os.path.join(temp_dir, "sem_equiv_result.py")
        
        # 환경 변수 설정
        env = os.environ.copy()
        env["OPENAI_API_KEY"] = api_key
        env["OUTPUT_FILE"] = output_file
        env["SEM_EQUIV_OUTPUT_PATH"] = output_file
        
        # subprocess 실행
        try:
            result = subprocess.run(
                ["/usr/local/bin/python", file_path, origin_code, model_name, model_type, str(temp)],
                check=True,
                capture_output=True,
                text=True,
                env=env,
                timeout=300,
                cwd="/tmp"
            )
            
            # 결과 파일 읽기
            if os.path.exists(output_file):
                with open(output_file, 'r', encoding='utf-8') as f:
                    generated_code = f.read()
            else:
                generated_code = result.stdout
            
            # XCom에 결과 저장
            context['task_instance'].xcom_push(key='sem_equiv_result', value=generated_code)
            return generated_code
            
        except subprocess.TimeoutExpired:
            logging.error("subprocess 실행 시간 초과 (5분)")
            raise
        except subprocess.CalledProcessError as e:
            logging.error(f"subprocess 실행 실패: {e}")
            logging.error(f"STDOUT: {e.stdout}")
            logging.error(f"STDERR: {e.stderr}")
            raise

def run_test(**context):
    """Equivalence test를 생성합니다."""
    import subprocess
    import tempfile
    import os
    
    # API 키 가져오기
    api_key = get_openai_api_key()
    
    # REST API 파라미터 추출
    dag_run = context.get('dag_run')
    if dag_run and dag_run.conf:
        model_name = dag_run.conf.get('model_name', 'qwen3:32b')
        model_type = dag_run.conf.get('model_type', 'ollama')
        origin_code = dag_run.conf.get('origin_code', '')
        temp = dag_run.conf.get('temp', 0)
        
        # GPT 모델인 경우 OpenAI로 설정
        if 'gpt' in model_name.lower():
            model_type = 'openai'
            # deprecated 모델을 현재 사용 가능한 모델로 변경
            if model_name in ['gpt-4-vision-preview', 'gpt-4-1106-preview', 'gpt-4-0125-preview']:
                model_name = 'gpt-4o'
    else:
        model_name = 'qwen3:32b'
        model_type = 'ollama'
        origin_code = ""
        temp = 0
    
    if not origin_code:
        raise ValueError("origin_code는 필수 파라미터입니다.")
    
    # 실행 파일 경로 확인
    file_path = "/data/workspace/Vtw/semantic_equiv/equiv_test_generator_exec.py"
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"테스트 실행 파일을 찾을 수 없습니다: {file_path}")
    
    # 임시 디렉토리에서 실행
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_output_file = os.path.join(temp_dir, "equiv_test.py")
        
        # 환경 변수 설정
        env = os.environ.copy()
        env["OUTPUT_FILE"] = temp_output_file
        env["OPENAI_API_KEY"] = api_key
        
        # subprocess 실행
        try:
            result = subprocess.run(
                ["/usr/local/bin/python", file_path, origin_code, model_name, model_type, str(temp)],
                check=True,
                capture_output=True,
                text=True,
                env=env,
                timeout=300,
                cwd="/tmp"
            )
            
            # 결과 파일 읽기
            if os.path.exists(temp_output_file):
                with open(temp_output_file, 'r', encoding='utf-8') as f:
                    result_content = f.read()
            else:
                result_content = result.stdout
            
            # XCom에 결과 저장
            context['task_instance'].xcom_push(key='equiv_test_result', value=result_content)
            return result_content
            
        except subprocess.TimeoutExpired:
            logging.error("subprocess 실행 시간 초과 (5분)")
            raise
        except subprocess.CalledProcessError as e:
            logging.error(f"subprocess 실행 실패: {e}")
            logging.error(f"STDOUT: {e.stdout}")
            logging.error(f"STDERR: {e.stderr}")
            raise

def get_result(**context):
    """생성된 결과를 반환합니다."""
    task_instance = context['task_instance']
    
    # 결과 가져오기
    sem_equiv_result = task_instance.xcom_pull(task_ids='run_sem_equiv_generator', key='sem_equiv_result')
    equiv_test_result = task_instance.xcom_pull(task_ids='equiv_test_generator', key='equiv_test_result')
    
    # 결과 통합
    combined_result = {
        'semantic_equivalent': sem_equiv_result,
        'equiv_test': equiv_test_result
    }
    
    return combined_result

@dag(
    dag_id="equiv_task",
    start_date=datetime(2025, 2, 17),
    catchup=False,
    tags=['equiv_task-sj'],
    schedule_interval=None,
    default_args={
        'retries': 2,
        'retry_delay': timedelta(minutes=1),
        'execution_timeout': timedelta(minutes=10),
    }
)
def equiv_task_dag():
    
    task1 = PythonOperator(
        task_id="run_sem_equiv_generator",
        python_callable=run_generator,
        provide_context=True,
        retries=1,
        retry_delay=timedelta(minutes=1),
        execution_timeout=timedelta(minutes=5),
    )
    
    task2 = PythonOperator(
        task_id="equiv_test_generator",
        python_callable=run_test,
        provide_context=True,
        retries=1,
        retry_delay=timedelta(minutes=1),
        execution_timeout=timedelta(minutes=5),
    )
    
    task3 = PythonOperator(
        task_id="get_result",
        python_callable=get_result,
        provide_context=True,
        retries=1,
        retry_delay=timedelta(minutes=1),
    )
        
    task1 >> task2 >> task3

# DAG 객체 생성
dag = equiv_task_dag()
