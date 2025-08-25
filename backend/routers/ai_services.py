from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import logging
import requests
import json
import re
import tempfile
import subprocess
import ast
import textwrap
import xml.etree.ElementTree as ET

logger = logging.getLogger(__name__)
router = APIRouter()

# 상수 정의
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://192.168.0.2:11434")
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_TIMEOUT = 30.0
DEFAULT_CODE_TIMEOUT = 5

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

def normalize_python_code(code: str) -> str:
    """Python 코드의 들여쓰기를 정규화하고 문법 오류를 수정"""
    lines = code.split('\n')
    normalized_lines = []
    indent_level = 0
    
    # 들여쓰기가 필요한 키워드들
    indent_keywords = {
        'def', 'class', 'if', 'elif', 'else:', 'for', 'while', 
        'try:', 'except', 'finally:', 'with'
    }
    
    # 현재 들여쓰기 레벨을 유지하는 키워드들
    maintain_indent_keywords = {
        'return', 'break', 'continue', 'pass', 'raise'
    }
    
    # 최상위 레벨 키워드들
    top_level_keywords = {'import', 'from'}
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        if any(line.startswith(keyword) for keyword in indent_keywords):
            normalized_lines.append('    ' * indent_level + line)
            indent_level += 1
        elif any(line.startswith(keyword) for keyword in maintain_indent_keywords):
            normalized_lines.append('    ' * indent_level + line)
        elif any(line.startswith(keyword) for keyword in top_level_keywords):
            normalized_lines.append(line)
        else:
            normalized_lines.append('    ' * indent_level + line)
    
    return '\n'.join(normalized_lines)

def clean_python_response(response_text: str) -> str:
    """AI 응답에서 순수 Python 코드만 추출"""
    # 마크다운 코드 블록 제거
    code = re.sub(r'^```python\s*|\s*```$', '', response_text, flags=re.MULTILINE)
    
    # 설명 텍스트 제거
    lines = code.split('\n')
    code_lines = []
    
    for line in lines:
        line = line.strip()
        if (line.startswith(('def ', 'import ', 'from ', '#', '')) or
            (line and not any(line.startswith(prefix) for prefix in ['This function', 'Here is']))):
            code_lines.append(line)
    
    return '\n'.join(code_lines).strip()

def create_ollama_prompt(description: str) -> str:
    """Ollama용 프롬프트 생성"""
    return f"""당신은 Python 코드 작성 전문가입니다.

아래 요구사항에 맞는 Python 함수 코드를 생성해주세요.
중요: 마크다운 코드 블록(```)이나 다른 텍스트를 포함하지 말고 순수한 Python 코드만 반환하세요.

요구사항: {description}

코드 작성 규칙:
1. 함수명은 의미있게 작성
2. 입력 파라미터의 타입을 명시 (예: a: list[int], b: str)
3. 반환값이 있을 경우 'result' 변수에 저장 후 반환
4. 적절한 에러 처리 포함
5. 간결하고 읽기 쉬운 코드 작성

예시 형식:
def function_name(param1: type1, param2: type2):
    # 함수 로직
    result = some_calculation
    return result"""

def create_openai_prompt(description: str) -> str:
    """OpenAI용 프롬프트 생성"""
    return f"""Please complete python code just send it for the following task: {description}. 
To make it easier for users to understand, please specify the type of input parameters. 
For example: 'a: list[int]' or 'b: str', etc. 
Also, if there is a return value, please make sure to save that value in a variable named 'result' and then return that 'result' value.
IMPORTANT: Return ONLY the Python code without any explanation or additional text."""

def generate_python_code_from_natural_language(description: str, model_name: str, model_type: str) -> str:
    """자연어 설명을 받아서 Python 코드를 생성하는 함수"""
    try:
        if model_type == "ollama":
            return generate_python_with_ollama(description, model_name)
        elif model_type == "openai":
            return generate_python_with_openai(description, model_name)
        else:
            raise ValueError(f"지원하지 않는 모델 타입: {model_type}")
    except Exception as e:
        logger.error(f"Python 코드 생성 중 오류: {e}")
        raise e

def generate_python_with_ollama(description: str, model_name: str) -> str:
    """Ollama를 사용하여 Python 코드 생성"""
    prompt = create_ollama_prompt(description)
    
    with requests.Session() as session:
        request_data = {
            "model": model_name,
            "prompt": prompt,
            "stream": False,
            "raw": True
        }
        
        response = session.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json=request_data,
            timeout=DEFAULT_TIMEOUT
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Ollama API 오류: {response.status_code}")
        
        response_data = response.json()
        python_code = response_data.get("response", "").strip()
        
        # Python 코드 정리 및 정규화
        python_code = clean_python_response(python_code)
        return normalize_python_code(python_code)

def generate_python_with_openai(description: str, model_name: str) -> str:
    """OpenAI를 사용하여 Python 코드 생성"""
    openai_key = os.getenv("OPENAI_API_KEY")
    if not openai_key:
        raise ValueError("OpenAI API 키가 설정되지 않았습니다.")
    
    prompt = create_openai_prompt(description)
    
    with requests.Session() as session:
        request_data = {
            "model": model_name,
            "messages": [
                {
                    "role": "system", 
                    "content": "You are an assistant that writes python code. Return ONLY the code without any explanation."
                },
                {
                    "role": "user", 
                    "content": prompt
                }
            ],
            "temperature": 0
        }
        
        response = session.post(
            OPENAI_API_URL,
            headers={
                "Authorization": f"Bearer {openai_key}",
                "Content-Type": "application/json"
            },
            json=request_data,
            timeout=DEFAULT_TIMEOUT
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"OpenAI API 오류: {response.status_code}")
        
        data = response.json()
        python_code = data["choices"][0]["message"]["content"].strip()
        
        # Python 코드 정리 및 정규화
        python_code = clean_python_response(python_code)
        return normalize_python_code(python_code)

@router.post("/execute-code", response_model=CodeExecuteResponse)
def execute_code(request: CodeExecuteRequest):
    """Python 코드를 실행하고 결과를 반환"""
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(request.code)
            temp_file = f.name

        try:
            process = subprocess.Popen(
                ['python', temp_file],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            stdout, stderr = process.communicate(timeout=DEFAULT_CODE_TIMEOUT)

            return {
                "output": stdout,
                "error": stderr
            }
        finally:
            os.unlink(temp_file)

    except subprocess.TimeoutExpired:
        return {
            "output": "",
            "error": f"코드 실행 시간이 초과되었습니다 ({DEFAULT_CODE_TIMEOUT}초 제한)."
        }
    except Exception as e:
        return {
            "output": "",
            "error": f"코드 실행 중 오류가 발생했습니다: {str(e)}"
        }

@router.get("/models")
def get_models():
    """사용 가능한 모델 목록을 반환"""
    try:
        available_models = get_available_models()
        if not available_models:
            logger.error("환경 변수에서 모델 목록을 가져올 수 없습니다.")
            raise HTTPException(status_code=500, detail="모델 목록이 설정되지 않았습니다.")

        # Ollama 모델 정보 업데이트
        update_ollama_model_info(available_models)
        return {"models": available_models}
            
    except Exception as e:
        logger.error(f"모델 목록 조회 중 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def update_ollama_model_info(available_models: List[dict]) -> None:
    """Ollama 모델 정보를 업데이트"""
    with requests.Session() as session:
        try:
            headers = {
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
            response = session.get(f"{OLLAMA_BASE_URL}/api/tags", headers=headers, timeout=DEFAULT_TIMEOUT)
            
            if response.status_code != 200:
                logger.error(f"Ollama API 응답: {response.status_code}, {response.text}")
                return
            
            data = response.json()
            ollama_models = data.get("models", [])
            
            for model in available_models:
                if model["type"] == "ollama":
                    ollama_model = next((m for m in ollama_models if m["name"] == model["name"]), None)
                    if ollama_model:
                        model.update({
                            "size": ollama_model.get("size", 0),
                            "digest": ollama_model.get("digest", ""),
                            "modified_at": ollama_model.get("modified_at", "")
                        })
                
        except requests.RequestError as e:
            logger.error(f"Ollama API 요청 오류: {e}")

@router.post("/generate-block")
def generate_block(request: GenerateBlockRequest):
    """자연어 설명을 받아서 Python 코드를 먼저 생성하고, 이를 규칙기반으로 Blockly XML로 변환"""
    try:
        logger.info(f"블록 생성 요청: description='{request.description}' model_name='{request.model_name}' model_type='{request.model_type}'")

        # 1단계: 자연어를 Python 코드로 변환
        logger.info("1단계: 자연어를 Python 코드로 변환 중...")
        python_code = generate_python_code_from_natural_language(
            request.description, 
            request.model_name, 
            request.model_type
        )
        
        logger.info(f"생성된 Python 코드:\n{python_code}")
        
        # 2단계: Python 코드를 규칙기반으로 Blockly XML로 변환
        logger.info("2단계: Python 코드를 Blockly XML로 변환 중...")
        xml_blocks = create_function_block_xml(python_code)
        
        if not xml_blocks:
            raise HTTPException(status_code=500, detail="변환할 수 있는 함수를 찾을 수 없습니다.")
        
        # XML 조합
        xml_code = create_blockly_xml(xml_blocks)
        
        logger.info(f"블록 생성 완료: {len(xml_blocks)}개 블록 생성")
        return {"xml": xml_code, "python_code": python_code}
            
    except Exception as e:
        logger.error(f"블록 생성 중 오류 발생: {e}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

def create_blockly_xml(blocks: List[ET.Element]) -> str:
    """Blockly XML 블록들을 하나의 XML 문자열로 조합"""
    xml_code = f'<xml xmlns="https://developers.google.com/blockly/xml">\n'
    for block in blocks:
        xml_code += f'  {ET.tostring(block, encoding="unicode")}\n'
    xml_code += '</xml>'
    return xml_code

def extract_body_code(func_node, source_lines):
    """함수 본문 전체 코드를 들여쓰기 맞춰 추출"""
    body_lines = []
    for stmt in func_node.body:
        if hasattr(stmt, 'lineno') and hasattr(stmt, 'end_lineno'):
            body_lines.extend(source_lines[stmt.lineno - 1: stmt.end_lineno])
        else:
            # lineno가 없는 경우 간단한 처리
            body_lines.append(ast.dump(stmt))
    
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
        tree = ast.parse(code)
        source_lines = code.splitlines()
        function_defs = [node for node in tree.body if isinstance(node, ast.FunctionDef)]
        blocks = []

        for func in function_defs:
            block = create_single_function_block(func, source_lines)
            blocks.append(block)

        return blocks
        
    except Exception as e:
        logger.error(f"XML 변환 중 오류: {e}")
        raise e

def create_single_function_block(func: ast.FunctionDef, source_lines: List[str]) -> ET.Element:
    """단일 함수를 Blockly 블록으로 변환"""
    block = ET.Element("block")
    block.set("type", "ast_Summarized_FunctionDef")
    block.set("line_number", str(getattr(func, 'lineno', 1)))
    block.set("inline", "false")

    # Mutation 정보 추가
    add_mutation_info(block, func)
    
    # 함수명 필드 추가
    add_name_field(block, func)
    
    # 파라미터 블록들 추가
    add_parameter_blocks(block, func)
    
    # 본문 블록 추가
    add_body_block(block, func, source_lines)

    return block

def add_mutation_info(block: ET.Element, func: ast.FunctionDef) -> None:
    """Mutation 정보를 블록에 추가"""
    mutation = ET.SubElement(block, "mutation")
    mutation.set("decorators", str(len(func.decorator_list)))
    mutation.set("parameters", str(len(func.args.args)))
    mutation.set("returns", "true" if func.returns else "false")

def add_name_field(block: ET.Element, func: ast.FunctionDef) -> None:
    """함수명 필드를 블록에 추가"""
    name_field = ET.SubElement(block, "field")
    name_field.set("name", "NAME")
    name_field.text = func.name

def add_parameter_blocks(block: ET.Element, func: ast.FunctionDef) -> None:
    """파라미터 블록들을 추가"""
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

def add_body_block(block: ET.Element, func: ast.FunctionDef, source_lines: List[str]) -> None:
    """본문 블록을 추가"""
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
        add_return_value_block(body_block, func)

def add_return_value_block(body_block: ET.Element, func: ast.FunctionDef) -> None:
    """반환값 블록을 추가"""
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

@router.post("/python-to-blockly-rule-based")
def convert_python_to_blockly_rule_based(request: PythonToBlocklyRequest):
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
        xml_code = create_blockly_xml(xml_blocks)
        
        logger.info(f"규칙기반 변환 완료: {len(xml_blocks)}개 블록 생성")
        return {"xml": xml_code}
            
    except Exception as e:
        logger.error(f"규칙기반 변환 중 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 