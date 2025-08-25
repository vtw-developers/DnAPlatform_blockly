from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import os
import logging
import requests
import json
import re
import ast
import textwrap
import xml.etree.ElementTree as ET
from openai import OpenAI
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
router = APIRouter()

# 환경 변수 로드
load_dotenv()

# OpenAI 클라이언트 설정
api_key = os.getenv('OPENAI_API_KEY')
if not api_key:
    logger.warning("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.")
    client = None
else:
    client = OpenAI(api_key=api_key)

# 상수 정의
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://192.168.0.2:11434")
DEFAULT_TIMEOUT = 30.0

# 모델 정의
class CodeVerifyRequest(BaseModel):
    code: str
    model_name: str = "qwen3:32b"

class GenerateBlockRequest(BaseModel):
    description: str
    model_name: str
    model_type: str

class PythonCodeRequest(BaseModel):
    python_code: str



# 유틸리티 함수들


def extract_between(text, start, end):
    """정규식을 사용하여 시작 문자열과 끝 문자열 사이의 내용을 추출"""
    try:
        pattern = re.escape(start) + r'(.*?)' + re.escape(end)
        matches = re.findall(pattern, text, re.DOTALL)  # DOTALL로 줄바꿈 포함 매칭
        return matches
    except Exception as e:
        logger.error(f"extract_between 오류: {e}")
        return []

def generate_code(description):
    """자연어 설명을 받아서 Python 코드를 생성"""
    if not client:
        logger.error("OpenAI 클라이언트가 초기화되지 않았습니다. OPENAI_API_KEY 환경 변수를 확인하세요.")
        return None
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an assistant that writes python code."},
                {"role": "user", "content": f"Please complete python code just send it for the following task: {description}. To make it easier for users to understand, please specify the type of input parameters. For example: 'a: list[int]' or 'b: str', etc. Also, if there is a return value, please make sure to save that value in a variable named 'result' and then return that 'result' value."}
            ],
            temperature=0
        )
        
        # 생성된 코드 추출
        generated_code = response.choices[0].message.content.strip()
        return generated_code
    
    except Exception as e:
        logger.error(f"API 호출 오류: {e}")
        return None

def get_source_segment(source_lines, node):
    """AST 노드로부터 원래 코드 조각 추출"""
    if hasattr(node, 'lineno') and hasattr(node, 'end_lineno'):
        return "\n".join(source_lines[node.lineno - 1: node.end_lineno])
    return ""

def extract_body_code(func_node, source_lines):
    """함수 본문 전체 코드를 들여쓰기 맞춰 추출"""
    body_lines = [get_source_segment(source_lines, stmt) for stmt in func_node.body]
    return textwrap.dedent("\n".join(body_lines)).strip()

def extract_return_var(func_node):
    """마지막 return 문의 변수명을 추출"""
    for stmt in reversed(func_node.body):
        if isinstance(stmt, ast.Return):
            if isinstance(stmt.value, ast.Name):
                return stmt.value.id, stmt.lineno
    return None, None

def create_function_block_xml(code):
    """Python 코드를 Blockly XML로 변환"""
    logger.info(f"Python 코드: {code}")
    tree = ast.parse(code)
    source_lines = code.splitlines()
    function_defs = [node for node in tree.body if isinstance(node, ast.FunctionDef)]
    blocks = []

    for func in function_defs:
        block = ET.Element("block")
        block.set("type", "ast_Summarized_FunctionDef")
        block.set("line_number", str(func.lineno))
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
            param_block.set("line_number", str(getattr(arg, "lineno", func.lineno)))
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
        body_block.set("line_number", str(func.body[0].lineno if func.body else func.lineno))

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
                return_block.set("line_number", str(return_lineno))

                var_field = ET.SubElement(return_block, "field")
                var_field.set("name", "VAR")
                var_field.text = return_var

        blocks.append(block)
        logger.debug(f"생성된 블록: {ET.tostring(block, encoding='unicode')}")

    return blocks

def create_blockly_xml(blocks):
    """Blockly XML 블록들을 하나의 XML로 조합"""
    xml_parts = []
    for block in blocks:
        xml_parts.append(ET.tostring(block, encoding='unicode'))
    
    # Blockly XML 형식에 맞게 <xml> 태그로 감싸기
    xml_content = '\n'.join(xml_parts)
    return f'<xml xmlns="https://developers.google.com/blockly/xml">{xml_content}</xml>'



def get_available_models():
    """환경 변수에서 사용 가능한 모델 목록을 가져옵니다."""
    try:
        models_json = os.getenv("AVAILABLE_MODELS", "[]")
        return json.loads(models_json)
    except json.JSONDecodeError as e:
        logger.error(f"모델 목록 JSON 파싱 오류: {e}")
        return []

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
        python_code = generate_code(request.description)
        
        if python_code is None:
            raise HTTPException(status_code=500, detail="API 호출 실패로 코드를 생성할 수 없습니다.")
        
        logger.info(f"생성된 Python 코드:\n{python_code}")
        
        # 2단계: OpenAI 응답에서 Python 코드 블록만 추출
        logger.info("2단계: Python 코드 블록 추출 중...")
        start_string = "```python"
        end_string = "```"
        extracted_code = extract_between(python_code, start_string, end_string)
        
        if not extracted_code:
            logger.warning("코드 블록을 찾을 수 없습니다. 전체 응답을 사용합니다.")
            extracted_code = [python_code]
        
        logger.info(f"추출된 Python 코드:\n{extracted_code[0]}")
        
        # 3단계: Python 코드를 규칙기반으로 Blockly XML로 변환
        logger.info("3단계: Python 코드를 Blockly XML로 변환 중...")
        xml_blocks = create_function_block_xml(extracted_code[0])
        logger.info(f"블록 정보: {xml_blocks}")
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

@router.post("/python-to-blockly-rule-based")
def convert_python_to_blockly_rule_based(request: PythonCodeRequest):
    """
    Python 코드를 규칙기반으로 Blockly XML로 변환합니다.
    AI 모델을 사용하지 않고 순수 Python 코드만 처리합니다.
    """
    try:
        logger.info(f"Python to Blockly 변환 요청: {request.python_code[:50]}...")
        
        # Python 코드를 직접 처리하여 XML 생성
        xml_blocks = create_function_block_xml(request.python_code)
        
        if not xml_blocks:
            raise HTTPException(status_code=500, detail="변환할 수 있는 함수를 찾을 수 없습니다.")
        
        # XML 조합
        xml_code = create_blockly_xml(xml_blocks)
        
        logger.info(f"Python to Blockly 변환 완료: {len(xml_blocks)}개 블록 생성")
        return {"xml": xml_code}
            
    except Exception as e:
        logger.error(f"Python to Blockly 변환 중 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 