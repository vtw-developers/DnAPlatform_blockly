from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from datetime import datetime
import sys
from io import StringIO
import traceback

app = FastAPI()

# CORS 설정 추가
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 모든 origin 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 사용자 코드를 여기에 삽입
USER_CODE = """
{user_code}
"""

# 사용자 코드를 실행할 함수
def execute_user_code(params=None):
    # 출력을 캡처하기 위한 StringIO 객체
    output = StringIO()
    old_stdout = sys.stdout
    sys.stdout = output
    
    # 사용자 코드를 로컬 네임스페이스에서 실행
    local_namespace = {}
    result = None
    error = None
    
    try:
        # 코드 실행
        exec(USER_CODE, {}, local_namespace)
        
        # main 함수가 있다면 실행
        if 'main' in local_namespace and callable(local_namespace['main']):
            result = local_namespace['main'](params) if params else local_namespace['main']()
    except Exception as e:
        error = {
            "type": type(e).__name__,
            "message": str(e),
            "traceback": traceback.format_exc()
        }
    
    # 출력 캡처 종료
    sys.stdout = old_stdout
    captured_output = output.getvalue()
    output.close()
    
    return {
        "result": result,
        "output": captured_output.strip() if captured_output else None,
        "error": error
    }

@app.post("/execute")
async def execute_endpoint(request: Request):
    try:
        # 요청 바디를 파라미터로 전달
        params = await request.json()
        result = execute_user_code(params)
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

@app.get("/test")
async def test_endpoint():
    """테스트 엔드포인트"""
    try:
        execution_result = execute_user_code()
        
        # 실행 결과 포맷팅
        response = {
            "status": "error" if execution_result.get("error") else "success",
            "message": "테스트 실행 중 오류가 발생했습니다." if execution_result.get("error") else "테스트가 성공적으로 실행되었습니다.",
            "details": {
                "result": execution_result.get("result"),
                "output": execution_result.get("output"),
                "error": execution_result.get("error")
            }
        }
        
        status_code = 500 if execution_result.get("error") else 200
        return JSONResponse(status_code=status_code, content=response)
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": "테스트 실행 중 오류가 발생했습니다.",
                "error": str(e)
            }
        )

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port) 