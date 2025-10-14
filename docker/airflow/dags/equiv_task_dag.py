from airflow.decorators import dag
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
import logging
from airflow.hooks.base import BaseHook
import os
import sys
import importlib.util

def get_openai_api_key():
    """OpenAI API 키를 가져옵니다."""
    try:
        conn = BaseHook.get_connection("openai_default")
        return conn.password
    except Exception:
        return os.getenv('OPENAI_API_KEY', '')

def run_sem_equiv_test(**context):
    """sem_equiv_test() 함수를 호출하여 테스트 케이스를 생성합니다."""
    # API 키 가져오기
    api_key = get_openai_api_key()
    
    # REST API 파라미터 추출
    dag_run = context.get('dag_run')
    if dag_run and dag_run.conf:
        model_name = dag_run.conf.get('model_name', 'qwen3:32b')
        model_type = dag_run.conf.get('model_type', 'ollama')
        origin_code = dag_run.conf.get('origin_code', '')
        temp = dag_run.conf.get('temp', 0.0)
        
        # OpenAI 호환 API 설정
        openai_base_url = dag_run.conf.get('openai_base_url', 'http://localhost:11434/v1')
        
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
        temp = 0.0
        openai_base_url = 'http://localhost:11434/v1'
    
    if not origin_code:
        raise ValueError("origin_code는 필수 파라미터입니다.")
    
    # sem_equiv_test 함수가 있는 파일 경로 설정
    sem_equiv_file_path = "/data/workspace/sem_equiv/langgraph/main.py"
    
    if not os.path.exists(sem_equiv_file_path):
        raise FileNotFoundError(f"sem_equiv_test 파일을 찾을 수 없습니다: {sem_equiv_file_path}")
    
    # 파일이 있는 디렉토리를 sys.path에 추가
    sem_equiv_dir = os.path.dirname(sem_equiv_file_path)
    if sem_equiv_dir not in sys.path:
        sys.path.insert(0, sem_equiv_dir)
    
    try:
        # 환경 변수 설정
        os.environ["OPENAI_API_KEY"] = api_key
        
        # 작업 디렉토리를 sem_equiv 디렉토리로 변경
        original_cwd = os.getcwd()
        os.chdir(sem_equiv_dir)
        
        # main 모듈에서 sem_equiv_test 함수 동적 로딩
        spec = importlib.util.spec_from_file_location("main", sem_equiv_file_path)
        main_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(main_module)
        sem_equiv_test = main_module.sem_equiv_test
        
        # sem_equiv_test 함수 호출
        result = sem_equiv_test(
            origin_code=origin_code,
            generate_test_model=model_name,
            temperature=temp,
            generate_test_backend=model_type,
            openai_base_url=openai_base_url,
            openai_api_key=api_key
        )
        
        # 결과는 튜플 (equiv_code, test_cases)
        equiv_code, test_cases = result
        
        # XCom에 결과 저장
        context['task_instance'].xcom_push(key='sem_equiv_code', value=equiv_code)
        context['task_instance'].xcom_push(key='sem_equiv_test_cases', value=test_cases)
        
        logging.info(f"sem_equiv_test 실행 완료. 테스트 케이스 길이: {len(test_cases)}")
        
        # 결과 반환 (equiv_code와 test_cases 모두 포함)
        return {
            'equiv_code': equiv_code,
            'test_cases': test_cases
        }
        
    except Exception as e:
        logging.error(f"sem_equiv_test 실행 실패: {str(e)}")
        raise
    finally:
        # 원래 작업 디렉토리로 복원
        os.chdir(original_cwd)

@dag(
    dag_id="equiv_task",
    start_date=datetime(2025, 2, 17),
    catchup=False,
    tags=['equiv_task-sj'],
    schedule_interval=None,
    default_args={
        'retries': 2,
        'retry_delay': timedelta(minutes=1),
        'execution_timeout': timedelta(minutes=15),
    }
)
def equiv_task_dag():
    """
    sem_equiv_test() 함수를 호출하여 semantic equivalent 코드와 테스트 케이스를 생성하는 DAG
    """
    
    sem_equiv_task = PythonOperator(
        task_id="run_sem_equiv_test",
        python_callable=run_sem_equiv_test,
        provide_context=True,
        retries=1,
        retry_delay=timedelta(minutes=2),
        execution_timeout=timedelta(minutes=15),
    )
    
    return sem_equiv_task

# DAG 객체 생성
dag = equiv_task_dag()