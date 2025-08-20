import os
import sys
import json
import logging
import docker
import httpx
import string
import base64
from fastapi import FastAPI, HTTPException, Request, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.responses import StreamingResponse
from dotenv import load_dotenv
from typing import List, Optional, Dict, Any
from datetime import datetime
import time
import random
from pydantic import BaseModel
from routers import code_blocks, ai_services, proxy, auth, deploy, py2js_rules
from database import wait_for_db, create_tables
import shutil
import pytz
from routers.auth import create_admin_if_not_exists

# 환경 설정 로드
env = os.getenv('ENV', 'development')
env_file = f'.env.{env}'
load_dotenv(dotenv_path=f'../{env_file}')

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI 앱 생성
app = FastAPI(
    title="Blockly Platform API",
    description="Blockly Platform Backend API",
    version="1.0.0"
)

# Docker client initialization
os.environ['DOCKER_HOST'] = 'unix:///var/run/docker.sock'
docker_client = docker.from_env()

# CORS 설정
allowed_origins = os.getenv('ALLOWED_ORIGINS', 'http://localhost:5000').split(',')
origins = [origin.strip() for origin in allowed_origins]

logger.info(f"Configured CORS allowed_origins: {origins}")

# CORS 미들웨어에 디버그 콜백 추가
async def debug_cors(request, call_next):
    origin = request.headers.get('origin')
    logger.info(f"Incoming request from origin: {origin}")
    response = await call_next(request)
    # CORS 헤더 추가
    if origin in origins:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    logger.info(f"Response CORS headers: {dict(response.headers)}")
    return response

app.middleware("http")(debug_cors)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# 신뢰할 수 있는 호스트 설정
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]
)

# 데이터베이스 초기화
if not wait_for_db():
    raise Exception("데이터베이스 연결 실패")
create_tables()

# 라우터 등록
app.include_router(code_blocks.router, prefix="/api", tags=["code-blocks"])
app.include_router(ai_services.router, prefix="/api", tags=["ai-services"])
app.include_router(proxy.router, prefix="/api/proxy", tags=["proxy"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(deploy.router, prefix="/api", tags=["deploy"])
app.include_router(py2js_rules.router, prefix="/api", tags=["py2js-rules"])


class CodeVerifyRequest(BaseModel):
    code: str
    model_name: str
    model_type: str
    temperature: float = 0.0  # temperature 필드 추가 (기본값: 0.0)

class VerifyResponse(BaseModel):
    dag_run_id: str

# <<<< MODIFIED: /api/code/verify endpoint >>>>
@app.post("/api/code/verify", response_model=VerifyResponse)
async def trigger_code_verification(payload: CodeVerifyRequest):
    """
    Receives code and model name, triggers the Airflow verification DAG
    using the same address and credentials as the proxy, and returns the dag_run_id.
    """
    # <<<< MODIFIED: Use address and auth from proxy.py >>>>
    # Get Airflow URL from env var or use the default found in proxy.py
    airflow_base_url = os.getenv("AIRFLOW_BASE_URL", "http://192.168.0.2:8080")
    airflow_dag_trigger_url = f"{airflow_base_url}/api/v1/dags/equiv_task/dagRuns"
    # Use the hardcoded auth header found in proxy.py
    airflow_auth_header = "Basic YWRtaW46dnR3MjEwMzAy" # admin:vtw210302

    # Generate a unique dag_run_id (still useful)
    timestamp = int(time.time() * 1000)
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    dag_run_id = f"api_verify_{timestamp}_{random_str}" # Now correctly formatted

    airflow_payload = {
        "dag_run_id": dag_run_id,
        "conf": {
            "origin_code": payload.code,
            "model_name": payload.model_name,
            "model_type": payload.model_type,
            "temp": payload.temperature  # temperature 값 전달
        }
    }
    headers = {
        'Content-Type': 'application/json',
        'Authorization': airflow_auth_header,
        'Accept': 'application/json'
    }

    logger.info(f"Triggering Airflow DAG '{airflow_dag_trigger_url}' via backend with run_id: {dag_run_id}")

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                airflow_dag_trigger_url,
                json=airflow_payload,
                headers=headers
            )
            response.raise_for_status()
            airflow_response_data = response.json()
            logger.info(f"Airflow response: {airflow_response_data}")
            returned_dag_run_id = airflow_response_data.get("dag_run_id", dag_run_id)
            return VerifyResponse(dag_run_id=returned_dag_run_id)
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error triggering Airflow DAG: {e.response.status_code} - {e.response.text}")
            raise HTTPException(status_code=e.response.status_code, detail=f"Airflow DAG 트리거 실패: {e.response.text}")
        except httpx.RequestError as e:
            logger.error(f"Request error triggering Airflow DAG: {e}")
            raise HTTPException(status_code=503, detail=f"Airflow 연결 실패: {e}") # Keep 503 for connection issues
        except Exception as e:
            logger.exception("Unexpected error during Airflow DAG trigger")
            raise HTTPException(status_code=500, detail=f"내부 서버 오류: {e}")

# --- ADDED: Conversion Endpoint Models & Functions --- 

class CodeConvertRequest(BaseModel):
    code: str
    # snart_content는 백엔드에서 자동으로 처리하므로 제거됨

class ConvertResponse(BaseModel):
    dag_run_id: str

class RuleGenerateRequest(BaseModel):
    code: str  # 실제 Python 코드
    
class DagStatusResponse(BaseModel):
    dag_run_id: str
    state: str
    error: Optional[str] = None
class XComResponse(BaseModel):
    value: Optional[str] = None # Assuming the result is a string, adjust if needed
    error: Optional[str] = None

@app.post("/api/code/convert", response_model=ConvertResponse)
async def trigger_code_conversion(payload: CodeConvertRequest):
    """
    Triggers the pirel_task DAG for code conversion.
    변환 시점에 최신 변환규칙을 자동으로 조회하여 snart_content를 생성합니다.
    """
    airflow_base_url = os.getenv("AIRFLOW_BASE_URL", "http://192.168.0.2:8080")
    # <<<< CHANGED: Use pirel_task DAG >>>>
    airflow_dag_trigger_url = f"{airflow_base_url}/api/v1/dags/pirel_task/dagRuns"
    airflow_auth_header = "Basic YWRtaW46dnR3MjEwMzAy"
    timestamp = int(time.time() * 1000)
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    dag_run_id = f"api_convert_{timestamp}_{random_str}" # Different prefix
    
    # 변환 시점에 최신 변환규칙을 자동으로 조회하여 snart_content 생성
    snart_content = await generate_snart_content_from_db()
    
    airflow_payload = {
        "dag_run_id": dag_run_id,
        "conf": {
            "origin_code": payload.code,
            "snart_content": snart_content  # 백엔드에서 자동 생성한 변환규칙
        }
    }
    headers = {
        'Content-Type': 'application/json',
        'Authorization': airflow_auth_header,
        'Accept': 'application/json'
    }
    logger.info(f"Triggering Conversion Airflow DAG '{airflow_dag_trigger_url}' via backend with run_id: {dag_run_id}")
    logger.info(f"자동 생성된 snart_content 길이: {len(snart_content)}")
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(airflow_dag_trigger_url, json=airflow_payload, headers=headers)
            response.raise_for_status()
            airflow_response_data = response.json()
            logger.info(f"Conversion Airflow response: {airflow_response_data}")
            returned_dag_run_id = airflow_response_data.get("dag_run_id", dag_run_id)
            return ConvertResponse(dag_run_id=returned_dag_run_id)
        # Keep the same error handling structure
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error triggering Conversion Airflow DAG: {e.response.status_code} - {e.response.text}")
            raise HTTPException(status_code=e.response.status_code, detail=f"Airflow DAG 트리거 실패: {e.response.text}")
        except httpx.RequestError as e:
            logger.error(f"Request error triggering Conversion Airflow DAG: {e}")
            raise HTTPException(status_code=503, detail=f"Airflow 연결 실패: {e}")
        except Exception as e:
            logger.exception("Unexpected error during Conversion Airflow DAG trigger")
            raise HTTPException(status_code=500, detail=f"내부 서버 오류: {e}")

@app.post("/api/code/rule-generate", response_model=ConvertResponse)
async def trigger_translation_rule_creation(payload: RuleGenerateRequest):
    """
    Triggers the rule_task DAG for translation rule creation.
    """
    airflow_base_url = os.getenv("AIRFLOW_BASE_URL", "http://192.168.0.2:8080")
    airflow_dag_trigger_url = f"{airflow_base_url}/api/v1/dags/rule_task/dagRuns"
    airflow_auth_header = "Basic YWRtaW46dnR3MjEwMzAy"
    
    timestamp = int(time.time() * 1000)
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    dag_run_id = f"api_rule_{timestamp}_{random_str}"
    
    # 변환 시점에 최신 변환규칙을 자동으로 조회하여 snart_content 생성
    snart_content = await generate_snart_content_from_db()
    
    airflow_payload = {
        "dag_run_id": dag_run_id,
        "conf": {           
            "origin_code": payload.code,
            "snart_content": snart_content  # 백엔드에서 자동 생성한 변환규칙
        }
    }
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': airflow_auth_header,
        'Accept': 'application/json'
    }
    
    logger.info(f"Triggering Translation Rule Creation Airflow DAG '{airflow_dag_trigger_url}' via backend with run_id: {dag_run_id}")
    logger.info(f"Translation Rule Creation payload: {airflow_payload}")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(airflow_dag_trigger_url, json=airflow_payload, headers=headers)
            response.raise_for_status()
            airflow_response_data = response.json()
            logger.info(f"Translation Rule Creation Airflow response: {airflow_response_data}")
            returned_dag_run_id = airflow_response_data.get("dag_run_id", dag_run_id)
            return ConvertResponse(dag_run_id=returned_dag_run_id)
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error triggering Translation Rule Creation Airflow DAG: {e.response.status_code} - {e.response.text}")
            raise HTTPException(status_code=e.response.status_code, detail=f"Airflow DAG 트리거 실패: {e.response.text}")
        except httpx.RequestError as e:
            logger.error(f"Request error triggering Translation Rule Creation Airflow DAG: {e}")
            raise HTTPException(status_code=503, detail=f"Airflow 연결 실패: {e}")
        except Exception as e:
            logger.exception("Unexpected error during Translation Rule Creation Airflow DAG trigger")
            raise HTTPException(status_code=500, detail=f"내부 서버 오류: {e}")

@app.get("/api/code/convert/status/{run_id}", response_model=DagStatusResponse)
async def get_conversion_dag_status(run_id: str):
    """
    Gets the status of a specific pirel_task DAG run.
    """
    airflow_base_url = os.getenv("AIRFLOW_BASE_URL", "http://192.168.0.2:8080")
    airflow_dag_status_url = f"{airflow_base_url}/api/v1/dags/pirel_task/dagRuns/{run_id}"
    airflow_auth_header = "Basic YWRtaW46dnR3MjEwMzAy"
    headers = {
        'Authorization': airflow_auth_header,
        'Accept': 'application/json'
    }
    logger.info(f"Checking Conversion DAG status for run_id: {run_id}")
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(airflow_dag_status_url, headers=headers)
            # Airflow might return 404 if run_id not found yet, treat as running or specific error?
            # For now, let 404 raise an exception
            response.raise_for_status()
            data = response.json()
            logger.info(f"Conversion DAG status response for {run_id}: {data.get('state')}")
            return DagStatusResponse(dag_run_id=data.get("dag_run_id", run_id), state=data.get("state", "unknown"))
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error getting Conversion DAG status for {run_id}: {e.response.status_code} - {e.response.text}")
            # Return a specific state or raise?
            # For simplicity, returning state as 'error' might work for the frontend polling
            return DagStatusResponse(dag_run_id=run_id, state="error", error=f"상태 조회 실패 ({e.response.status_code}): {e.response.text}")
        except httpx.RequestError as e:
            logger.error(f"Request error getting Conversion DAG status for {run_id}: {e}")
            return DagStatusResponse(dag_run_id=run_id, state="error", error=f"Airflow 연결 실패: {e}")
        except Exception as e:
            logger.exception(f"Unexpected error getting Conversion DAG status for {run_id}")
            return DagStatusResponse(dag_run_id=run_id, state="error", error=f"내부 서버 오류: {e}")

@app.get("/api/code/convert/result/{run_id}", response_model=XComResponse)
async def get_conversion_dag_result(run_id: str):
    """
    Gets the result (XCom value) from the get_result task of a pirel_task DAG run.
    """
    airflow_base_url = os.getenv("AIRFLOW_BASE_URL", "http://192.168.0.2:8080")
    # <<<< CHANGED: Use XCom endpoint >>>>
    # Assumes the task ID storing the result is 'get_result'
    airflow_xcom_url = f"{airflow_base_url}/api/v1/dags/pirel_task/dagRuns/{run_id}/taskInstances/get_result/xcomEntries/return_value"
    airflow_auth_header = "Basic YWRtaW46dnR3MjEwMzAy"
    headers = {
        'Authorization': airflow_auth_header,
        'Accept': 'application/json'
    }
    logger.info(f"Getting Conversion DAG result for run_id: {run_id}")
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(airflow_xcom_url, headers=headers)
            response.raise_for_status()
            data = response.json()
            logger.info(f"Conversion DAG result response for {run_id}: {data}")
            encoded_value = data.get("value")
            decoded_value = None
            decode_error_message = None # Variable to store decoding error

            if encoded_value:
                try:
                    # First, try base64 decoding
                    # Add validate=True for stricter base64 check
                    decoded_bytes = base64.b64decode(encoded_value, validate=True)
                    try:
                        # Then, try UTF-8 decoding
                        decoded_value = decoded_bytes.decode('utf-8')
                        logger.info(f"Successfully decoded XCom for {run_id} as UTF-8.")
                    except UnicodeDecodeError:
                        logger.warning(f"XCom value for {run_id} is not valid UTF-8 after base64 decode. Bytes: {decoded_bytes[:50]}...")
                        # Set specific error message instead of raising exception
                        decode_error_message = "결과 디코딩 실패: UTF-8 인코딩 형식이 아닙니다."

                except (base64.binascii.Error, ValueError) as b64_error:
                    # Base64 decoding failed, assume it might be plain text
                    logger.warning(f"XCom value for {run_id} does not appear to be base64 encoded: {b64_error}. Assuming plain text.")
                    if isinstance(encoded_value, str):
                         # Check if the original string itself is valid utf-8
                         try:
                             encoded_value.encode('utf-8').decode('utf-8')
                             decoded_value = encoded_value # Treat as plain text
                         except UnicodeError:
                             decode_error_message = "결과 디코딩 실패: Base64가 아니며 UTF-8 문자열도 아닙니다."
                    else:
                         decode_error_message = "결과 디코딩 실패: Base64 형식이 아니며 문자열도 아닙니다."
                except Exception as e:
                    logger.error(f"Unexpected error during XCom decoding for {run_id}: {e}")
                    decode_error_message = f"결과 처리 중 예상치 못한 오류: {e}"

            # Return error if decoding failed, otherwise return value (which could be None)
            if decode_error_message:
                return XComResponse(error=decode_error_message)
            else:
                return XComResponse(value=decoded_value)

        except httpx.HTTPStatusError as e:
            # Common case: 404 if task instance or xcom doesn't exist yet
            logger.warning(f"HTTP error getting Conversion DAG result for {run_id}: {e.response.status_code} - {e.response.text}")
            error_detail = e.response.text
            try: # Try to parse JSON error from Airflow
                error_json = e.response.json()
                error_detail = error_json.get('detail', error_detail)
            except: pass
            return XComResponse(error=f"결과 조회 실패 ({e.response.status_code}): {error_detail}")
        except httpx.RequestError as e:
            logger.error(f"Request error getting Conversion DAG result for {run_id}: {e}")
            return XComResponse(error=f"Airflow 연결 실패: {e}")
        except Exception as e:
            logger.exception(f"Unexpected error getting Conversion DAG result for {run_id}")
            return XComResponse(error=f"내부 서버 오류: {e}")

# --- END Conversion Section ---

# --- Rule Generation Endpoint Functions ---

@app.get("/api/code/rule-generate/result/{run_id}", response_model=XComResponse)
async def get_rule_generation_dag_result(run_id: str):
    """
    Gets the result (XCom value) from the rule_task DAG run.
    First checks if the DAG is completed, then retrieves the result.
    """
    airflow_base_url = os.getenv("AIRFLOW_BASE_URL", "http://192.168.0.2:8080")
    airflow_auth_header = "Basic YWRtaW46dnR3MjEwMzAy"
    headers = {
        'Authorization': airflow_auth_header,
        'Accept': 'application/json'
    }
    
    logger.info(f"Getting Rule Generation DAG result for run_id: {run_id}")
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            # First, check DAG status
            dag_status_url = f"{airflow_base_url}/api/v1/dags/rule_task/dagRuns/{run_id}"
            status_response = await client.get(dag_status_url, headers=headers)
            status_response.raise_for_status()
            dag_data = status_response.json()
            dag_state = dag_data.get("state", "unknown")
            
            logger.info(f"DAG state for {run_id}: {dag_state}")
            
            # If DAG is not completed, return appropriate message
            if dag_state in ["running", "queued"]:
                return XComResponse(error="DAG가 아직 실행 중입니다. 잠시 후 다시 시도해주세요.")
            elif dag_state in ["failed", "error"]:
                return XComResponse(error=f"DAG 실행이 실패했습니다. 상태: {dag_state}")
            
            # DAG is completed, now get the result
            airflow_xcom_url = f"{airflow_base_url}/api/v1/dags/rule_task/dagRuns/{run_id}/taskInstances/rule_generator/xcomEntries/rule_generate_result"
            
            response = await client.get(airflow_xcom_url, headers=headers)
            response.raise_for_status()
            data = response.json()
            logger.info(f"Rule Generation DAG result response for {run_id}: {data}")
            encoded_value = data.get("value")
            decoded_value = None
            decode_error_message = None

            if encoded_value:
                try:
                    # First, try base64 decoding
                    decoded_bytes = base64.b64decode(encoded_value, validate=True)
                    try:
                        # Then, try UTF-8 decoding
                        decoded_value = decoded_bytes.decode('utf-8')
                        logger.info(f"Successfully decoded XCom for {run_id} as UTF-8.")
                    except UnicodeDecodeError:
                        logger.warning(f"XCom value for {run_id} is not valid UTF-8 after base64 decode. Bytes: {decoded_bytes[:50]}...")
                        decode_error_message = "결과 디코딩 실패: UTF-8 인코딩 형식이 아닙니다."

                except (base64.binascii.Error, ValueError) as b64_error:
                    # Base64 decoding failed, assume it might be plain text
                    logger.warning(f"XCom value for {run_id} does not appear to be base64 encoded: {b64_error}. Assuming plain text.")
                    if isinstance(encoded_value, str):
                         try:
                             encoded_value.encode('utf-8').decode('utf-8')
                             decoded_value = encoded_value # Treat as plain text
                         except UnicodeError:
                             decode_error_message = "결과 디코딩 실패: Base64가 아니며 UTF-8 문자열도 아닙니다."
                    else:
                         decode_error_message = "결과 디코딩 실패: Base64 형식이 아니며 문자열도 아닙니다."
                except Exception as e:
                    logger.error(f"Unexpected error during XCom decoding for {run_id}: {e}")
                    decode_error_message = f"결과 처리 중 예상치 못한 오류: {e}"

            # Return error if decoding failed, otherwise return value (which could be None)
            if decode_error_message:
                return XComResponse(error=decode_error_message)
            else:
                return XComResponse(value=decoded_value)

        except httpx.HTTPStatusError as e:
            # Common case: 404 if task instance or xcom doesn't exist yet
            logger.warning(f"HTTP error getting Rule Generation DAG result for {run_id}: {e.response.status_code} - {e.response.text}")
            error_detail = e.response.text
            try: # Try to parse JSON error from Airflow
                error_json = e.response.json()
                error_detail = error_json.get('detail', error_detail)
            except: pass
            return XComResponse(error=f"결과 조회 실패 ({e.response.status_code}): {error_detail}")
        except httpx.RequestError as e:
            logger.error(f"Request error getting Rule Generation DAG result for {run_id}: {e}")
            return XComResponse(error=f"Airflow 연결 실패: {e}")
        except Exception as e:
            logger.exception(f"Unexpected error getting Rule Generation DAG result for {run_id}")
            return XComResponse(error=f"내부 서버 오류: {e}")

# --- END Rule Generation Section ---

# --- Verification Endpoint Models & Functions --- 

# <<<< ADDED: Endpoint to get Verification status via backend >>>>
@app.get("/api/code/verify/status/{run_id}", response_model=DagStatusResponse)
async def get_verification_dag_status(run_id: str):
    """
    Gets the status of a specific equiv_task DAG run.
    Mirrors get_conversion_dag_status but targets the equiv_task DAG.
    """
    airflow_base_url = os.getenv("AIRFLOW_BASE_URL", "http://192.168.0.2:8080")
    # <<<< CHANGED: Use equiv_task DAG path >>>>
    airflow_dag_status_url = f"{airflow_base_url}/api/v1/dags/equiv_task/dagRuns/{run_id}"
    airflow_auth_header = "Basic YWRtaW46dnR3MjEwMzAy"
    headers = {
        'Authorization': airflow_auth_header,
        'Accept': 'application/json'
    }
    logger.info(f"Checking Verification DAG status for run_id: {run_id}")
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(airflow_dag_status_url, headers=headers)
            response.raise_for_status()
            data = response.json()
            # <<<< ADDED: Log raw response and extracted state >>>>
            logger.info(f"Verification DAG status response (RAW from Airflow): {data}")
            actual_state = data.get("state", "unknown")
            logger.info(f"Extracted state: {actual_state}")
            return DagStatusResponse(dag_run_id=data.get("dag_run_id", run_id), state=actual_state)
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error getting Verification DAG status for {run_id}: {e.response.status_code} - {e.response.text}")
            return DagStatusResponse(dag_run_id=run_id, state="error", error=f"상태 조회 실패 ({e.response.status_code}): {e.response.text}")
        except httpx.RequestError as e:
            logger.error(f"Request error getting Verification DAG status for {run_id}: {e}")
            return DagStatusResponse(dag_run_id=run_id, state="error", error=f"Airflow 연결 실패: {e}")
        except Exception as e:
            logger.exception(f"Unexpected error getting Verification DAG status for {run_id}")
            return DagStatusResponse(dag_run_id=run_id, state="error", error=f"내부 서버 오류: {e}")

# <<<< ADDED: Endpoint to get Verification result via backend >>>>
@app.get("/api/code/verify/result/{run_id}", response_model=XComResponse)
async def get_verification_dag_result(run_id: str):
    """
    Gets the result (XCom value) from the get_result task of an equiv_task DAG run.
    Mirrors get_conversion_dag_result but targets the equiv_task DAG.
    """
    airflow_base_url = os.getenv("AIRFLOW_BASE_URL", "http://192.168.0.2:8080")
    # <<<< CHANGED: Use equiv_task DAG path >>>>
    airflow_xcom_url = f"{airflow_base_url}/api/v1/dags/equiv_task/dagRuns/{run_id}/taskInstances/get_result/xcomEntries/return_value"
    airflow_auth_header = "Basic YWRtaW46dnR3MjEwMzAy"
    headers = {
        'Authorization': airflow_auth_header,
        'Accept': 'application/json'
    }
    logger.info(f"Getting Verification DAG result for run_id: {run_id}")
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(airflow_xcom_url, headers=headers)
            response.raise_for_status()
            data = response.json()
            logger.info(f"Verification DAG result response for {run_id}: {data}")
            encoded_value = data.get("value")
            decoded_value = None
            decode_error_message = None

            if encoded_value:
                try:
                    decoded_bytes = base64.b64decode(encoded_value, validate=True)
                    try:
                        decoded_value = decoded_bytes.decode('utf-8')
                        logger.info(f"Successfully decoded Verification XCom for {run_id} as UTF-8.")
                    except UnicodeDecodeError:
                        logger.warning(f"Verification XCom value for {run_id} is not valid UTF-8: {decoded_bytes[:50]}...")
                        decode_error_message = "결과 디코딩 실패: UTF-8 인코딩 형식이 아닙니다."
                except (base64.binascii.Error, ValueError) as b64_error:
                    logger.warning(f"Verification XCom value for {run_id} not base64: {b64_error}. Assuming plain text.")
                    if isinstance(encoded_value, str):
                         try:
                             encoded_value.encode('utf-8').decode('utf-8')
                             decoded_value = encoded_value
                         except UnicodeError:
                             decode_error_message = "결과 디코딩 실패: Base64가 아니며 UTF-8 문자열도 아닙니다."
                    else:
                         decode_error_message = "결과 디코딩 실패: Base64 형식이 아니며 문자열도 아닙니다."
                except Exception as e:
                    logger.error(f"Unexpected error during Verification XCom decoding for {run_id}: {e}")
                    decode_error_message = f"결과 처리 중 예상치 못한 오류: {e}"

            if decode_error_message:
                return XComResponse(error=decode_error_message)
            else:
                return XComResponse(value=decoded_value)

        except httpx.HTTPStatusError as e:
           logger.warning(f"HTTP error getting Verification DAG result for {run_id}: {e.response.status_code} - {e.response.text}")
           error_detail = e.response.text
           try:
               error_json = e.response.json()
               error_detail = error_json.get('detail', error_detail)
           except: pass
           return XComResponse(error=f"결과 조회 실패 ({e.response.status_code}): {error_detail}")
        except httpx.RequestError as e:
           logger.error(f"Request error getting Verification DAG result for {run_id}: {e}")
           return XComResponse(error=f"Airflow 연결 실패: {e}")
        except Exception as e:
           logger.exception(f"Unexpected error getting Verification DAG result for {run_id}")
           return XComResponse(error=f"내부 서버 오류: {e}")

@app.post("/api/upload-jar")
async def upload_jar(file: UploadFile = File(...)):
    save_dir = "/app/jar"  # 백엔드 도커 내부 경로
    os.makedirs(save_dir, exist_ok=True)
    save_path = os.path.join(save_dir, file.filename)
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"path": save_path}  # 도커 내부 경로 반환

@app.get("/")
async def root():
    return {"message": "Blockly Platform API is running"}

@app.get("/api/container/status")
async def get_container_status(port: int) -> Dict[str, Any]:
    """Get the status of a deployed container."""
    try:
        # Try both container name patterns
        container_names = [f"graalpy-app-{port}", f"graalvm-app-{port}", f"jpype-app-{port}"]
        for container_name in container_names:
            try:
                container = docker_client.containers.get(container_name)
                return {
                    "exists": True,
                    "status": container.status,
                    "port": port,
                    "created": container.attrs["Created"],
                    "state": container.attrs["State"]
                }
            except docker.errors.NotFound:
                continue
        
        # If no container is found with either name
        return {
            "exists": False,
            "status": "not_found",
            "port": port
        }
    except Exception as e:
        logging.error(f"Error getting container status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/container/start")
async def start_container(request: Request) -> Dict[str, str]:
    """Start a stopped container."""
    try:
        data = await request.json()
        port = data.get('port')
        if not port:
            raise HTTPException(status_code=422, detail="Port is required")
        
        container_names = [f"graalpy-app-{port}", f"graalvm-app-{port}", f"jpype-app-{port}"]
        container = None
        
        for container_name in container_names:
            try:
                container = docker_client.containers.get(container_name)
                break
            except docker.errors.NotFound:
                continue
                
        if not container:
            raise HTTPException(status_code=404, detail=f"Container on port {port} not found")
        
        container.start()
        return {"status": "started", "message": f"Container on port {port} started successfully"}
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail=f"Container on port {port} not found")
    except Exception as e:
        logging.error(f"Error starting container: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/container/stop")
async def stop_container(request: Request) -> Dict[str, str]:
    """Stop a running container."""
    try:
        data = await request.json()
        port = data.get('port')
        if not port:
            raise HTTPException(status_code=422, detail="Port is required")
            
        # Try both container name patterns
        container_names = [f"graalpy-app-{port}", f"graalvm-app-{port}", f"jpype-app-{port}"]
        container = None
        
        for container_name in container_names:
            try:
                container = docker_client.containers.get(container_name)
                break
            except docker.errors.NotFound:
                continue
                
        if not container:
            raise HTTPException(status_code=404, detail=f"Container on port {port} not found")
            
        container.stop()
        return {"status": "stopped", "message": f"Container on port {port} stopped successfully"}
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail=f"Container on port {port} not found")
    except Exception as e:
        logging.error(f"Error stopping container: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/container/remove")
async def remove_container(request: Request) -> Dict[str, str]:
    """Remove a container."""
    try:
        data = await request.json()
        port = data.get('port')
        if not port:
            raise HTTPException(status_code=422, detail="Port is required")
            
        # Try both container name patterns
        container_names = [f"graalpy-app-{port}", f"graalvm-app-{port}", f"jpype-app-{port}"]
        container = None
        
        for container_name in container_names:
            try:
                container = docker_client.containers.get(container_name)
                break
            except docker.errors.NotFound:
                continue
                
        if not container:
            raise HTTPException(status_code=404, detail=f"Container on port {port} not found")
            
        container.remove(force=True)
        return {"status": "removed", "message": f"Container on port {port} removed successfully"}
    
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail=f"Container on port {port} not found")
    except Exception as e:
        logging.error(f"Error removing container: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/test-service")
async def test_service(request: Request, port: int) -> Dict[str, Any]:
    """Test a deployed service by making a request to its test endpoint."""
    logger.info(f"Testing service on port {port}")
    try:
        # 타임아웃 설정 추가
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                # 컨테이너 정보 확인
                container_names = [f"graalpy-app-{port}", f"graalvm-app-{port}", f"jpype-app-{port}"]
                container = None
                host_port = None
                container_ip = None
                
                for container_name in container_names:
                    try:
                        container = docker_client.containers.get(container_name)
                        # 모든 네트워크 확인
                        networks = container.attrs['NetworkSettings']['Networks']
                        logger.info(f"Container {container_name} networks: {networks}")
                        
                        # 첫 번째 사용 가능한 네트워크의 IP 사용
                        for network_name, network_settings in networks.items():
                            if 'IPAddress' in network_settings:
                                container_ip = network_settings['IPAddress']
                                logger.info(f"Using IP {container_ip} from network {network_name}")
                                break
                        
                        # 호스트 포트 확인
                        for port_binding in container.attrs['NetworkSettings']['Ports'].items():
                            if port_binding[1]:
                                host_port = port_binding[1][0]['HostPort']
                                break
                        
                        if host_port and container_ip:
                            break
                    except docker.errors.NotFound:
                        continue
                    except KeyError as e:
                        logger.warning(f"Container {container_name} network settings not found: {str(e)}")
                        continue
                
                if not container or not host_port or not container_ip:
                    logger.error(f"Container not found or network settings incomplete for port {port}")
                    return {
                        "status": "error",
                        "message": "컨테이너를 찾을 수 없거나 네트워크 설정이 불완전합니다.",
                        "details": {"error": {"message": "Container not found or network settings incomplete"}}
                    }
                
                logger.info(f"Found container {container.name} with IP {container_ip} and host port {host_port}")
                
                # 서비스 URL 구성 (컨테이너 IP 사용)
                service_url = f"http://{container_ip}:{port}/test"
                logger.info(f"Making request to service URL: {service_url}")
                
                # 프록시 요청 헤더 설정
                headers = {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Origin': request.headers.get('origin', '')
                }
                
                response = await client.get(service_url, headers=headers, timeout=5.0)
                logger.info(f"Service response status: {response.status_code}")
                
                if response.status_code == 200:
                    return {
                        "status": "success",
                        "statusCode": response.status_code,
                        "data": response.json() if response.headers.get("content-type") == "application/json" else response.text
                    }
                else:
                    logger.error(f"Service returned non-200 status: {response.status_code}")
                    return {
                        "status": "error",
                        "message": f"서비스가 {response.status_code} 상태로 응답했습니다.",
                        "details": {"error": {"message": f"Service returned status {response.status_code}"}}
                    }
            except httpx.TimeoutException:
                logger.error(f"Service test timed out for port {port}")
                return {
                    "status": "error",
                    "message": "서비스 응답 시간 초과",
                    "details": {"error": {"message": "Service test timed out"}}
                }
            except httpx.RequestError as e:
                logger.error(f"Error connecting to service on port {port}: {str(e)}")
                return {
                    "status": "error",
                    "message": "서비스 연결 실패",
                    "details": {"error": {"message": str(e)}}
                }
    except Exception as e:
        logger.error(f"Error testing service on port {port}: {str(e)}")
        return {
            "status": "error",
            "message": "서비스 테스트 중 오류 발생",
            "details": {"error": {"message": str(e)}}
        }

@app.get("/api/containers/list")
async def list_containers() -> List[Dict[str, Any]]:
    """Get list of all deployed containers."""
    try:
        containers = []
        # 모든 컨테이너 조회
        all_containers = docker_client.containers.list(all=True)
        
        for container in all_containers:
            # jpype-app 또는 graalpy-app으로 시작하는 컨테이너만 필터링
            if container.name.startswith(('jpype-app-', 'graalpy-app-', 'graalvm-app-')):
                # 포트 정보 추출
                port = None
                for port_binding in container.attrs['NetworkSettings']['Ports'].items():
                    if port_binding[1]:
                        host_port = port_binding[1][0]['HostPort']
                        port = int(host_port)
                        break

                # 생성 시간을 KST로 변환
                created_at = datetime.fromisoformat(container.attrs['Created'].replace('Z', '+00:00'))
                kst = pytz.timezone('Asia/Seoul')
                created_at_kst = created_at.astimezone(kst)

                containers.append({
                    "name": container.name,
                    "port": port,
                    "status": container.status,
                    "created_at": created_at_kst.strftime('%Y-%m-%d %H:%M:%S'),
                    "state": container.attrs['State']
                })
        
        return containers
    except Exception as e:
        logging.error(f"Error listing containers: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.on_event("startup")
async def startup_event():
    await create_admin_if_not_exists()

# Example: If running directly with uvicorn
# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000) 

# 변환 시점에 최신 변환규칙을 자동으로 조회하여 snart_content 생성하는 함수
async def generate_snart_content_from_db() -> str:
    """
    데이터베이스에서 최신 변환규칙을 조회하여 leet.snart 파일 형식으로 변환합니다.
    leet.snart의 정확한 구조를 따라야 하며, 데이터베이스에 있는 데이터만 사용합니다.
    """
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        
        # 데이터베이스 연결
        from database import get_db_connection
        connection = get_db_connection()
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        # 모든 규칙 조회 (ID 순으로 정렬, is_commented 필드 포함)
        query = """
        SELECT examples, mark, rules, is_commented
        FROM py2js_rule 
        ORDER BY id
        """
        
        cursor.execute(query)
        rules = cursor.fetchall()
        
        # 커서와 연결 종료
        cursor.close()
        connection.close()
        
        # leet.snart 파일 형식으로 변환
        snart_content = ''
        
        for i, rule in enumerate(rules):
            # 각 rule 블록 시작
            
            # examples가 있는 경우에만 주석으로 추가 (규칙 상단에)
            if rule['examples'] and rule['examples'].strip():
                # examples 내용에 따옴표가 포함된 경우 이스케이프 처리
                escaped_examples = rule['examples'].replace('"', '\\"').replace("'", "\\'")
                snart_content += f'; examples: "{escaped_examples}"\n'
            
            # mark가 있는 경우에만 주석으로 추가 (규칙 상단에)
            if rule['mark'] and rule['mark'].strip():
                try:
                    mark_data = json.loads(rule['mark']) if isinstance(rule['mark'], str) else rule['mark']
                    snart_content += f'; mark: {json.dumps(mark_data)}\n'
                except:
                    snart_content += f'; mark: {rule["mark"]}\n'
            
            # rules 내용 추가 (실제 match_expand 규칙)
            if rule['rules'] and rule['rules'].strip():
                # 주석 처리된 규칙인 경우 ;; 추가
                if rule.get('is_commented', False):
                    # 이미 ;;가 포함되어 있다면 그대로 사용
                    if rule['rules'].startswith(';;'):
                        snart_content += f"{rule['rules']}"
                    else:
                        snart_content += f";;{rule['rules']}"
                else:
                    # 일반 규칙은 그대로 사용
                    snart_content += f"{rule['rules']}"
            else:
                # 빈 규칙인 경우 건너뛰기
                continue
            
            # 규칙 사이에 빈 줄 추가 (마지막 규칙이 아닌 경우)
            if i < len(rules) - 1:
                snart_content += '\n\n'
            else:
                # 마지막 규칙 뒤에도 빈 줄 추가
                snart_content += '\n'
        
        logger.info(f"데이터베이스에서 {len(rules)}개의 변환규칙을 조회하여 leet.snart 형식으로 생성했습니다.")
        logger.info(f"생성된 .snart 내용 길이: {len(snart_content)}")
        
        # 생성된 내용의 match_expand 개수 확인
        match_expand_count = snart_content.count('(match_expand')
        ext_match_expand_count = snart_content.count('(ext_match_expand')
        total_count = match_expand_count + ext_match_expand_count
        
        logger.info(f"생성된 .snart의 match_expand 개수: {match_expand_count}")
        logger.info(f"생성된 .snart의 ext_match_expand 개수: {ext_match_expand_count}")
        logger.info(f"생성된 .snart의 총 규칙 개수: {total_count}")
        
        # 개수 검증
        if total_count != len(rules):
            logger.warning(f"경고: 생성된 총 규칙 개수({total_count})가 DB 규칙 개수({len(rules)})와 다릅니다!")
        
        # Airflow DAG에서 기대하는 형식 검증
        expected_count = len(("\n" + snart_content).split("\n(match_expand")) + len(("\n" + snart_content).split("\n(ext_match_expand")) - 2
        logger.info(f"Airflow DAG에서 기대하는 규칙 개수: {expected_count}")
        
        # S-expression 파서를 위한 형식 검증
        # 각 규칙이 올바른 괄호 구조를 가지고 있는지 확인
        import re
        rule_pattern = r'\(match_expand[^()]*(?:\([^()]*\)[^()]*)*\)'
        parsed_rules = re.findall(rule_pattern, snart_content, re.DOTALL)
        logger.info(f"S-expression 파서로 파싱 가능한 규칙 개수: {len(parsed_rules)}")
        
        return snart_content
        
    except Exception as e:
        logger.error(f"변환규칙 조회 및 .snart 생성 중 오류: {e}")
        # 오류 발생 시 빈 내용 반환 (기본 변환으로 진행)
        return "" 