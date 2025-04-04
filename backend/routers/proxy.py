from fastapi import APIRouter, HTTPException, Request
from starlette.responses import StreamingResponse
import os
import logging
import httpx

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/airflow/{path:path}")
async def proxy_to_airflow_post(path: str, request: Request):
    airflow_base_url = os.getenv("AIRFLOW_BASE_URL", "http://192.168.0.2:8080")
    target_url = f"{airflow_base_url}/{path}"

    try:
        # 클라이언트 요청의 body를 읽음
        body = await request.json()
        
        # 요청 본문을 그대로 전달
        headers = {
            "Content-Type": "application/json",
            "Authorization": "Basic YWRtaW46dnR3MjEwMzAy"  # admin:vtw210302의 Base64 인코딩
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                target_url,
                json=body,
                headers=headers,
                timeout=30.0
            )

        return StreamingResponse(
            content=response.iter_bytes(),
            status_code=response.status_code,
            headers=dict(response.headers)
        )
    except Exception as e:
        logger.error(f"Airflow API 프록시 중 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/airflow/{path:path}")
async def proxy_to_airflow_get(path: str, request: Request):
    airflow_base_url = os.getenv("AIRFLOW_BASE_URL", "http://192.168.0.2:8080")
    target_url = f"{airflow_base_url}/{path}"

    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": "Basic YWRtaW46dnR3MjEwMzAy"  # admin:vtw210302의 Base64 인코딩
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(
                target_url,
                headers=headers,
                timeout=30.0
            )

        return StreamingResponse(
            content=response.iter_bytes(),
            status_code=response.status_code,
            headers=dict(response.headers)
        )
    except Exception as e:
        logger.error(f"Airflow API 프록시 중 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/ollama/{path:path}")
async def proxy_to_ollama(path: str, request: Request):
    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://192.168.0.2:11434")
    target_url = f"{ollama_url}/{path}"
    
    try:
        logger.info(f"Ollama API 요청: {target_url}")
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        async with httpx.AsyncClient() as client:
            response = await client.get(
                target_url,
                headers=headers,
                timeout=30.0
            )
            
        logger.info(f"Ollama API 응답: {response.status_code}")
        
        # CORS 헤더 추가
        headers = dict(response.headers)
        headers["Access-Control-Allow-Origin"] = "*"
        headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        headers["Access-Control-Allow-Headers"] = "Content-Type"
        
        return StreamingResponse(
            content=response.iter_bytes(),
            status_code=response.status_code,
            headers=headers
        )
    except Exception as e:
        logger.error(f"Ollama API 프록시 중 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ollama/{path:path}")
async def proxy_to_ollama_post(path: str, request: Request):
    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://192.168.0.2:11434")
    target_url = f"{ollama_url}/{path}"
    
    try:
        body = await request.json()
        logger.info(f"Ollama API 요청: {target_url}, 본문: {body}")
        
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(
                target_url,
                json=body,
                headers=headers,
                timeout=30.0
            )
            
        logger.info(f"Ollama API 응답: {response.status_code}")
        
        # CORS 헤더 추가
        headers = dict(response.headers)
        headers["Access-Control-Allow-Origin"] = "*"
        headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        headers["Access-Control-Allow-Headers"] = "Content-Type"
        
        return StreamingResponse(
            content=response.iter_bytes(),
            status_code=response.status_code,
            headers=headers
        )
    except Exception as e:
        logger.error(f"Ollama API 프록시 중 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 