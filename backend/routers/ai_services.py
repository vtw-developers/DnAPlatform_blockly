from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import logging
import httpx
import json
import re
import tempfile
import subprocess

logger = logging.getLogger(__name__)
router = APIRouter()

# 모델 정의
class CodeExecuteRequest(BaseModel):
    code: str

class CodeExecuteResponse(BaseModel):
    output: str
    error: str

class CodeVerifyRequest(BaseModel):
    code: str
    model_name: str = "qwen2.5-coder:32b"

class ModelInfo(BaseModel):
    name: str
    size: int
    digest: str
    modified_at: str

class GenerateBlockRequest(BaseModel):
    description: str
    model_name: str
    model_type: str

@router.post("/execute-code", response_model=CodeExecuteResponse)
async def execute_code(request: CodeExecuteRequest):
    try:
        # 임시 파일 생성
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(request.code)
            temp_file = f.name

        try:
            # Python 코드 실행
            process = subprocess.Popen(
                ['python', temp_file],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            stdout, stderr = process.communicate(timeout=5)  # 5초 타임아웃

            return {
                "output": stdout,
                "error": stderr
            }
        finally:
            # 임시 파일 삭제
            os.unlink(temp_file)

    except subprocess.TimeoutExpired:
        return {
            "output": "",
            "error": "코드 실행 시간이 초과되었습니다 (5초 제한)."
        }
    except Exception as e:
        return {
            "output": "",
            "error": f"코드 실행 중 오류가 발생했습니다: {str(e)}"
        }

@router.get("/models")
async def get_models():
    try:
        ollama_url = os.getenv("OLLAMA_BASE_URL", "http://192.168.0.2:11434")
        async with httpx.AsyncClient() as client:
            # Ollama 모델 가져오기
            headers = {
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
            response = await client.get(f"{ollama_url}/api/tags", headers=headers, timeout=30.0)
            if response.status_code != 200:
                logger.error(f"Ollama API 응답: {response.status_code}, {response.text}")
                raise HTTPException(status_code=response.status_code, detail="Ollama 서버에서 모델 목록을 가져오는데 실패했습니다.")
            
            data = response.json()
            logger.info(f"Ollama API 응답: {data}")
            ollama_models = data.get("models", [])
            
            # OpenAI 모델 추가
            openai_models = [
                {"name": "gpt-4-0125-preview", "type": "openai", "size": 0, "modified_at": "", "digest": "", "description": "최신 GPT-4 모델, 코드 생성 능력 향상"},
                {"name": "gpt-4-1106-preview", "type": "openai", "size": 0, "modified_at": "", "digest": "", "description": "JSON 모드 지원, 구조화된 출력에 강점"},
                {"name": "gpt-4-vision-preview", "type": "openai", "size": 0, "modified_at": "", "digest": "", "description": "시각적 이해 가능, 블록 구조 분석에 유용"},
                {"name": "gpt-3.5-turbo-0125", "type": "openai", "size": 0, "modified_at": "", "digest": "", "description": "빠른 응답, 기본적인 코드 생성"}
            ]
            
            # Ollama 모델 형식 변환
            formatted_ollama_models = [
                {
                    "name": model["name"],
                    "type": "ollama",
                    "size": model.get("size", 0),
                    "digest": model.get("digest", ""),
                    "modified_at": model.get("modified_at", "")
                }
                for model in ollama_models
            ]
            
            logger.info(f"포맷된 Ollama 모델: {formatted_ollama_models}")
            
            # 모든 모델 합치기
            all_models = formatted_ollama_models + openai_models
            return {"models": all_models}
            
    except Exception as e:
        logger.error(f"모델 목록 조회 중 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-block")
async def generate_block(request: GenerateBlockRequest):
    try:
        logger.info(f"블록 생성 요청: description='{request.description}' model_name='{request.model_name}' model_type='{request.model_type}'")

        prompt = f"""당신은 Blockly XML 생성 전문가입니다.

아래 요구사항에 맞는 XML 코드를 생성해주세요.
중요: 마크다운 코드 블록(```)이나 다른 텍스트를 포함하지 말고 순수한 XML만 반환하세요.

요구사항: {request.description}

XML 형식 규칙:
1. 반드시 <xml xmlns="https://developers.google.com/blockly/xml">로 시작
2. 블록 좌표는 x="50" y="50"로 시작
3. 모든 블록은 고유 id 필수

사용 가능한 블록 목록:

1. 수학 연산 블록:
   - math_number: 숫자 값 (예: <value name="NUM"><shadow type="math_number"><field name="NUM">123</field></shadow></value>)
   - math_arithmetic: 사칙연산
     * 연산자: ADD(덧셈), MINUS(뺄셈), MULTIPLY(곱셈), DIVIDE(나눗셈)
   - math_single: 단항 연산
     * 연산자: ROOT(제곱근), ABS(절대값), NEG(음수), LN(자연로그), LOG10(로그), EXP(지수), POW10(10의 거듭제곱)
   - math_round: 반올림/올림/내림
     * 연산자: ROUND(반올림), ROUNDUP(올림), ROUNDDOWN(내림)
   - math_modulo: 나머지 연산

2. 텍스트 블록:
   - text: 문자열 값
   - text_print: 출력
   - text_join: 문자열 결합
   - text_length: 문자열 길이
   - text_isEmpty: 문자열 비어있는지 확인

3. 논리 블록:
   - logic_compare: 비교 연산
     * 연산자: EQ(같음), NEQ(다름), LT(미만), LTE(이하), GT(초과), GTE(이상)
   - logic_operation: 논리 연산
     * 연산자: AND(그리고), OR(또는)
   - logic_negate: 논리 부정(NOT)
   - logic_boolean: 참/거짓 값
   - logic_null: null 값

4. 제어 블록:
   - controls_if: 조건문
   - controls_repeat_ext: 반복문 (횟수 지정)
   - controls_whileUntil: while/until 반복문
   - controls_for: for 반복문
   - controls_forEach: 리스트 순회

5. 변수 블록:
   - variables_get: 변수 값 가져오기
   - variables_set: 변수 값 설정하기

6. 리스트 블록:
   - lists_create_empty: 빈 리스트 생성
   - lists_create_with: 값으로 리스트 생성
   - lists_length: 리스트 길이
   - lists_isEmpty: 리스트 비어있는지 확인
   - lists_indexOf: 리스트에서 값 찾기
   - lists_getIndex: 리스트에서 값 가져오기
   - lists_setIndex: 리스트 값 설정하기

블록 연결 규칙:
1. value 태그: 다른 블록의 값을 입력으로 받을 때 사용
2. statement 태그: 제어 블록 내부의 실행 문장을 포함할 때 사용
3. next 태그: 순차적으로 실행될 다음 블록을 연결할 때 사용
4. field 태그: 블록의 설정값을 지정할 때 사용

응답 형식:
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="[블록타입]" id="[고유ID]" x="50" y="50">
    [블록 내용]
  </block>
</xml>"""

        logger.info("생성된 프롬프트:")
        logger.info("-" * 80)
        logger.info(prompt)
        logger.info("-" * 80)

        if request.model_type == "ollama":
            ollama_url = os.getenv("OLLAMA_BASE_URL", "http://192.168.0.2:11434")
            logger.info(f"Ollama URL: {ollama_url}")
            
            async with httpx.AsyncClient() as client:
                try:
                    request_data = {
                        "model": request.model_name,
                        "prompt": prompt,
                        "stream": False,
                        "raw": True
                    }
                    logger.info(f"Ollama API 요청 데이터: {request_data}")
                    
                    response = await client.post(
                        f"{ollama_url}/api/generate",
                        json=request_data,
                        timeout=30.0
                    )
                    
                    logger.info(f"Ollama API 응답 상태 코드: {response.status_code}")
                    logger.info(f"Ollama API 응답 헤더: {dict(response.headers)}")
                    response_text = response.text
                    logger.info(f"Ollama API 응답 내용: {response_text}")
                    
                    if response.status_code != 200:
                        error_msg = f"Ollama API 오류 - 상태 코드: {response.status_code}, 응답: {response_text}"
                        logging.error(error_msg)
                        raise HTTPException(status_code=500, detail=error_msg)
                        
                    try:
                        response_data = response.json()
                    except json.JSONDecodeError as e:
                        error_msg = f"Ollama API 응답 JSON 파싱 오류: {str(e)}, 응답 내용: {response_text}"
                        logging.error(error_msg)
                        raise HTTPException(status_code=500, detail=error_msg)
                        
                    if "response" not in response_data:
                        error_msg = f"Ollama API 응답에 'response' 필드가 없습니다: {response_data}"
                        logging.error(error_msg)
                        raise HTTPException(status_code=500, detail=error_msg)
                    
                    xml_code = response_data.get("response", "").strip()
                    logger.info(f"추출된 XML 코드: {xml_code}")
                    
                    # XML 시작과 끝 태그 확인
                    if not xml_code.startswith("<xml"):
                        xml_code = f'<xml xmlns="https://developers.google.com/blockly/xml">{xml_code}'
                    if not xml_code.endswith("</xml>"):
                        xml_code = f"{xml_code}</xml>"
                    
                    logger.info(f"최종 XML:\n{xml_code}")
                    return {"xml": xml_code}
                    
                except httpx.RequestError as e:
                    error_msg = f"Ollama API 요청 오류: {str(e)}"
                    logging.error(error_msg)
                    raise HTTPException(status_code=500, detail=error_msg)
                except Exception as e:
                    error_msg = f"Ollama API 처리 중 오류: {str(e)}"
                    logging.error(error_msg)
                    import traceback
                    logging.error(f"상세 오류:\n{traceback.format_exc()}")
                    raise HTTPException(status_code=500, detail=error_msg)
        
        elif request.model_type == "openai":
            openai_key = os.getenv("OPENAI_API_KEY")
            if not openai_key:
                error_msg = "OpenAI API 키가 설정되지 않았습니다."
                logging.error(error_msg)
                raise HTTPException(status_code=500, detail=error_msg)
                
            async with httpx.AsyncClient() as client:
                try:
                    request_data = {
                        "model": request.model_name,
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are a Blockly XML code generation expert. Return ONLY the XML code without any markdown formatting or additional text."
                            },
                            {
                                "role": "user",
                                "content": prompt
                            }
                        ],
                        "temperature": 0.7,
                        "max_tokens": 2000
                    }
                    
                    response = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {openai_key}",
                            "Content-Type": "application/json"
                        },
                        json=request_data,
                        timeout=30.0
                    )
                    
                    if response.status_code != 200:
                        error_msg = f"OpenAI API 오류: 상태 코드 {response.status_code}"
                        logging.error(error_msg)
                        raise HTTPException(status_code=500, detail=error_msg)
                    
                    data = response.json()
                    content = data["choices"][0]["message"]["content"].strip()
                    
                    # 마크다운 코드 블록 제거
                    content = re.sub(r'^```xml\s*|\s*```$', '', content, flags=re.MULTILINE)
                    xml_code = content.strip()
                    
                    logger.info(f"생성된 XML:\n{xml_code}")
                    return {"xml": xml_code}
                    
                except Exception as e:
                    error_msg = f"OpenAI API 처리 중 오류: {str(e)}"
                    logging.error(error_msg)
                    raise HTTPException(status_code=500, detail=error_msg)
        
        else:
            raise HTTPException(
                status_code=400,
                detail=f"지원하지 않는 모델 타입입니다: {request.model_type}"
            )
            
    except Exception as e:
        logger.error(f"블록 생성 중 오류 발생: {e}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        ) 