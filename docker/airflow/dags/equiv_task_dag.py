from airflow.decorators import dag
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
import logging
from airflow.hooks.base import BaseHook
import os
import sys
import subprocess
import json

def get_openai_api_key():
    """OpenAI API 키를 가져옵니다."""
    try:
        conn = BaseHook.get_connection("openai_default")
        return conn.password
    except Exception:
        return os.getenv('OPENAI_API_KEY', '')

def run_sem_equiv_test(**context):
    """subprocess를 사용하여 sem_equiv_test() 함수를 호출하여 테스트 케이스를 생성합니다."""
    # API 키 가져오기
    api_key = get_openai_api_key()
    
    # REST API 파라미터 추출
    dag_run = context.get('dag_run')
    if dag_run and dag_run.conf:
        model_name = dag_run.conf.get('model_name', 'qwen3:32b')
        model_type = dag_run.conf.get('model_type', 'ollama')
        origin_code = dag_run.conf.get('origin_code', '')
        temp = dag_run.conf.get('temp', 0.0)
        
        # 모델에 따른 API URL 자동 선택
        if 'gpt' in model_name.lower():
            # GPT 계열 모델: 공식 OpenAI API 사용
            model_type = 'openai'
            openai_base_url = 'https://api.openai.com/v1'
            # deprecated 모델을 현재 사용 가능한 모델로 변경
            if model_name in ['gpt-4-vision-preview', 'gpt-4-1106-preview', 'gpt-4-0125-preview']:
                model_name = 'gpt-4o'
        else:
            # 로컬 모델: 로컬 OpenAI 호환 API 사용
            model_type = 'openai'
            openai_base_url = 'http://192.168.0.2:8001/v1'
        
        # 사용자가 직접 지정한 경우 덮어쓰기
        if 'openai_base_url' in dag_run.conf:
            openai_base_url = dag_run.conf.get('openai_base_url')
    else:
        model_name = 'qwen3:32b'
        model_type = 'ollama'
        origin_code = ""
        temp = 0.0
        openai_base_url = 'http://localhost:11434/v1'
    
    if not origin_code:
        raise ValueError("origin_code는 필수 파라미터입니다.")
    
    # sem_equiv 프로젝트 경로 설정
    sem_equiv_dir = "/data/workspace/sem_equiv/langgraph"
    main_script_path = os.path.join(sem_equiv_dir, "sem_equiv_test_exec.py")
    
    if not os.path.exists(main_script_path):
        raise FileNotFoundError(f"sem_equiv sem_equiv_test_exec.py 파일을 찾을 수 없습니다: {main_script_path}")
    
    try:
        # 환경 변수 설정
        env = os.environ.copy()
        env["OPENAI_API_KEY"] = api_key
        
        # 호스트의 Python 직접 실행 (권한 문제 완전 회피)
        venv_python = "/data/workspace/sem_equiv/.venv/bin/python3"
        
        # subprocess로 sem_equiv_test_exec.py 실행 (호스트 Python 직접 사용)
        cmd = [venv_python, "sem_equiv_test_exec.py", origin_code, model_name, model_type, str(temp), openai_base_url]
        
        logging.info(f"실행 명령어: {' '.join(cmd)}")
        logging.info(f"작업 디렉토리: {sem_equiv_dir}")
        logging.info(f"모델: {model_name}, 온도: {temp}, 백엔드: {model_type}")
        
        # 원본 디렉토리에서 실행 (권한 문제는 --no-sync로 해결)
        result = subprocess.run(
            cmd,
            cwd=sem_equiv_dir,
            env=env,
            capture_output=True,
            text=True,
            timeout=300  # 5분 타임아웃
        )
        
        if result.returncode != 0:
            logging.error(f"subprocess 실행 실패: {result.stderr}")
            raise RuntimeError(f"sem_equiv_test 실행 실패: {result.stderr}")
        
        # JSON 결과 파싱
        try:
            result_data = json.loads(result.stdout.strip())
            equiv_code = result_data["equiv_code"]
            test_cases = result_data["test_cases"]
        except json.JSONDecodeError as e:
            logging.error(f"JSON 파싱 실패: {result.stdout}")
            raise RuntimeError(f"결과 파싱 실패: {e}")
        
        # XCom에 결과 저장
        context['task_instance'].xcom_push(key='sem_equiv_code', value=equiv_code)
        context['task_instance'].xcom_push(key='sem_equiv_test_cases', value=test_cases)
        
        logging.info(f"sem_equiv_test 실행 완료. 테스트 케이스 길이: {len(test_cases)}")
        
        # 결과 반환
        return {
            'equiv_code': equiv_code,
            'test_cases': test_cases
        }
        
    except subprocess.TimeoutExpired:
        logging.error("sem_equiv_test 실행 시간 초과")
        raise RuntimeError("sem_equiv_test 실행 시간 초과")
    except Exception as e:
        logging.error(f"sem_equiv_test 실행 실패: {str(e)}")
        raise

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