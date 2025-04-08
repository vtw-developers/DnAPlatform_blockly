from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.responses import StreamingResponse
import os
from dotenv import load_dotenv
import logging
from typing import List, Optional
from datetime import datetime
import httpx
from pydantic import BaseModel
import time
import random
import string

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 환경 변수 로드
load_dotenv()

# FastAPI 앱 생성
app = FastAPI(
    title="Blockly Platform API",
    description="Blockly Platform Backend API",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://121.65.128.115:5050", "http://192.168.0.2:5050"],
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

# 라우터 임포트
from routers import code_blocks, ai_services, proxy

# 라우터 등록
app.include_router(code_blocks.router, prefix="/api", tags=["code-blocks"])
app.include_router(ai_services.router, prefix="/api", tags=["ai-services"])
app.include_router(proxy.router, prefix="/api/proxy", tags=["proxy"])

# <<<< ADDED: Pydantic models for verify endpoint >>>>
class CodeVerifyRequest(BaseModel):
    code: str
    model_name: str

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
            "model_name": payload.model_name
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

# Request model reuses CodeVerifyRequest
# Response model reuses VerifyResponse (for trigger)

class DagStatusResponse(BaseModel):
    dag_run_id: str
    state: str
    error: Optional[str] = None

class XComResponse(BaseModel):
    value: Optional[str] = None # Assuming the result is a string, adjust if needed
    error: Optional[str] = None

@app.post("/api/code/convert", response_model=VerifyResponse)
async def trigger_code_conversion(payload: CodeVerifyRequest):
    """
    Triggers the pirel_task DAG for code conversion.
    """
    airflow_base_url = os.getenv("AIRFLOW_BASE_URL", "http://192.168.0.2:8080")
    # <<<< CHANGED: Use pirel_task DAG >>>>
    airflow_dag_trigger_url = f"{airflow_base_url}/api/v1/dags/pirel_task/dagRuns"
    airflow_auth_header = "Basic YWRtaW46dnR3MjEwMzAy"
    timestamp = int(time.time() * 1000)
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    dag_run_id = f"api_convert_{timestamp}_{random_str}" # Different prefix
    airflow_payload = {
        "dag_run_id": dag_run_id,
        "conf": {
            "origin_code": payload.code,
            "model_name": payload.model_name
        }
    }
    headers = {
        'Content-Type': 'application/json',
        'Authorization': airflow_auth_header,
        'Accept': 'application/json'
    }
    logger.info(f"Triggering Conversion Airflow DAG '{airflow_dag_trigger_url}' via backend with run_id: {dag_run_id}")
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(airflow_dag_trigger_url, json=airflow_payload, headers=headers)
            response.raise_for_status()
            airflow_response_data = response.json()
            logger.info(f"Conversion Airflow response: {airflow_response_data}")
            returned_dag_run_id = airflow_response_data.get("dag_run_id", dag_run_id)
            return VerifyResponse(dag_run_id=returned_dag_run_id)
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
            response.raise_for_status() # Raise for 4xx/5xx
            data = response.json()
            logger.info(f"Conversion DAG result response for {run_id}: {data}")
            # The API returns {"key": "return_value", "timestamp": ..., "value": ...}
            # We need to decode the value if it's base64 encoded
            encoded_value = data.get("value")
            decoded_value = None
            if encoded_value:
                try:
                    import base64
                    decoded_value = base64.b64decode(encoded_value).decode('utf-8')
                except Exception as decode_error:
                    logger.error(f"Failed to decode XCom value for {run_id}: {decode_error}")
                    return XComResponse(error=f"결과 디코딩 실패: {decode_error}")

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

@app.get("/")
async def root():
    return {"message": "Blockly Platform API is running"}

# Example: If running directly with uvicorn
# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000) 