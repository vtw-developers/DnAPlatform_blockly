from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import uvicorn
import os
from datetime import datetime

app = FastAPI()

# 사용자 코드를 여기에 삽입
USER_CODE = """
{user_code}
"""

# 사용자 코드를 실행할 함수
def execute_user_code(params=None):
    # 사용자 코드를 로컬 네임스페이스에서 실행
    local_namespace = {}
    try:
        exec(USER_CODE, {}, local_namespace)
        if 'main' in local_namespace and callable(local_namespace['main']):
            result = local_namespace['main'](params) if params else local_namespace['main']()
            return {"result": result}
        return {"result": "코드 실행 완료"}
    except Exception as e:
        return {"error": str(e)}

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

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port) 