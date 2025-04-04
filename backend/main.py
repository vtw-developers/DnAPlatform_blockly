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

@app.get("/")
async def root():
    return {"message": "Blockly Platform API is running"} 