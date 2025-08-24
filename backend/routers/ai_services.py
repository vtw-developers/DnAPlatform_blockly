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
import ast
import textwrap
import xml.etree.ElementTree as ET

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
    model_name: str = "qwen3:32b"

class ModelInfo(BaseModel):
    name: str
    type: str
    description: str

class GenerateBlockRequest(BaseModel):
    description: str
    model_name: str
    model_type: str

class PythonToBlocklyRequest(BaseModel):
    python_code: str
    model_name: str = "qwen3:32b"
    model_type: str = "ollama"

def get_available_models():
    """환경 변수에서 사용 가능한 모델 목록을 가져옵니다."""
    try:
        models_json = os.getenv("AVAILABLE_MODELS", "[]")
        return json.loads(models_json)
    except json.JSONDecodeError as e:
        logger.error(f"모델 목록 JSON 파싱 오류: {e}")
        return []

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
        # 환경 변수에서 모델 목록 가져오기
        available_models = get_available_models()
        if not available_models:
            logger.error("환경 변수에서 모델 목록을 가져올 수 없습니다.")
            raise HTTPException(status_code=500, detail="모델 목록이 설정되지 않았습니다.")

        # Ollama 모델 정보 가져오기
        ollama_url = os.getenv("OLLAMA_BASE_URL", "http://192.168.0.2:11434")
        async with httpx.AsyncClient() as client:
            try:
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
                
                # Ollama 모델 정보 업데이트
                for model in available_models:
                    if model["type"] == "ollama":
                        # Ollama 서버에서 해당 모델 정보 찾기
                        ollama_model = next((m for m in ollama_models if m["name"] == model["name"]), None)
                        if ollama_model:
                            model.update({
                                "size": ollama_model.get("size", 0),
                                "digest": ollama_model.get("digest", ""),
                                "modified_at": ollama_model.get("modified_at", "")
                            })
                
                return {"models": available_models}
                
            except httpx.RequestError as e:
                logger.error(f"Ollama API 요청 오류: {e}")
                # Ollama 서버 연결 실패 시에도 설정된 모델 목록은 반환
                return {"models": available_models}
            
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
# gen_block_py.py에서 추출한 핵심 함수들
def extract_body_code(func_node, source_lines):
    """함수 본문 전체 코드를 들여쓰기 맞춰 추출"""
    body_lines = []
    for stmt in func_node.body:
        if hasattr(stmt, 'lineno') and hasattr(stmt, 'end_lineno'):
            body_lines.extend(source_lines[stmt.lineno - 1: stmt.end_lineno])
        else:
            # lineno가 없는 경우 간단한 처리
            body_lines.append(ast.unparse(stmt))
    
    if body_lines:
        return textwrap.dedent("\n".join(body_lines)).strip()
    return ""

def extract_return_var(func_node):
    """마지막 return 문의 변수명을 추출"""
    for stmt in reversed(func_node.body):
        if isinstance(stmt, ast.Return):
            if isinstance(stmt.value, ast.Name):
                return stmt.value.id, getattr(stmt, 'lineno', 0)
    return None, None

def create_function_block_xml(code):
    """Python 코드를 Blockly XML로 변환하는 핵심 함수"""
    try:
        import ast
        import xml.etree.ElementTree as ET
        import textwrap
        
        tree = ast.parse(code)
        source_lines = code.splitlines()
        function_defs = [node for node in tree.body if isinstance(node, ast.FunctionDef)]
        blocks = []

        for func in function_defs:
            block = ET.Element("block")
            block.set("type", "ast_Summarized_FunctionDef")
            block.set("line_number", str(getattr(func, 'lineno', 1)))
            block.set("inline", "false")

            mutation = ET.SubElement(block, "mutation")
            mutation.set("decorators", str(len(func.decorator_list)))
            mutation.set("parameters", str(len(func.args.args)))
            mutation.set("returns", "true" if func.returns else "false")

            name_field = ET.SubElement(block, "field")
            name_field.set("name", "NAME")
            name_field.text = func.name

            for i, arg in enumerate(func.args.args):
                value = ET.SubElement(block, "value")
                value.set("name", f"PARAMETER{i}")

                param_block = ET.SubElement(value, "block")
                param_block.set("type", "ast_FunctionParameter")
                param_block.set("line_number", str(getattr(arg, "lineno", getattr(func, 'lineno', 1))))
                param_block.set("movable", "false")
                param_block.set("deletable", "false")

                param_field = ET.SubElement(param_block, "field")
                param_field.set("name", "NAME")
                param_field.text = arg.arg

            # BODY block
            statement = ET.SubElement(block, "statement")
            statement.set("name", "BODY")

            has_return = any(isinstance(stmt, ast.Return) for stmt in func.body)
            body_block_type = "ast_ReturnFull" if has_return else "ast_Raw"
            body_block = ET.SubElement(statement, "block")
            body_block.set("type", body_block_type)
            body_block.set("line_number", str(func.body[0].lineno if func.body else getattr(func, 'lineno', 1)))

            body_field = ET.SubElement(body_block, "field")
            body_field.set("name", "TEXT")
            body_code = extract_body_code(func, source_lines)
            body_field.text = body_code

            if has_return:
                return_var, return_lineno = extract_return_var(func)
                if return_var:
                    value = ET.SubElement(body_block, "value")
                    value.set("name", "VALUE")

                    return_block = ET.SubElement(value, "block")
                    return_block.set("type", "ast_Name")
                    return_block.set("line_number", str(return_lineno or getattr(func, 'lineno', 1)))

                    var_field = ET.SubElement(return_block, "field")
                    var_field.set("name", "VAR")
                    var_field.text = return_var

            blocks.append(block)

        return blocks
        
    except Exception as e:
        logger.error(f"XML 변환 중 오류: {e}")
        raise e

@router.post("/python-to-blockly-rule-based")
async def convert_python_to_blockly_rule_based(request: PythonToBlocklyRequest):
    """
    Python 코드를 규칙기반으로 Blockly XML로 변환합니다.
    gen_block_py.py의 로직을 직접 백엔드에 구현했습니다.
    """
    try:
        logger.info(f"규칙기반 Python to Blockly 변환 요청: {request.python_code[:50]}...")
        
        # Python 코드를 직접 처리하여 XML 생성
        xml_blocks = create_function_block_xml(request.python_code)
        
        if not xml_blocks:
            raise HTTPException(status_code=500, detail="변환할 수 있는 함수를 찾을 수 없습니다.")
        
        # XML 조합
        xml_code = f'<xml xmlns="https://developers.google.com/blockly/xml">\n'
        for block in xml_blocks:
            xml_code += f'  {ET.tostring(block, encoding="unicode")}\n'
        xml_code += '</xml>'
        
        logger.info(f"규칙기반 변환 완료: {len(xml_blocks)}개 블록 생성")
        return {"xml": xml_code}
            
    except Exception as e:
        logger.error(f"규칙기반 변환 중 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 