from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class CodeBlockBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    code: str = Field(..., min_length=1)
    blockly_xml: Optional[str] = None

class CodeBlockCreate(CodeBlockBase):
    pass

class CodeBlockUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    code: Optional[str] = Field(None, min_length=1)
    blockly_xml: Optional[str] = None

class CodeBlock(CodeBlockBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CodeBlockResponse(BaseModel):
    success: bool
    message: str
    data: Optional[CodeBlock] = None

class DeleteCodeBlocks(BaseModel):
    ids: list[int]

class CodeExecuteRequest(BaseModel):
    code: str

class CodeExecuteResponse(BaseModel):
    output: str
    error: Optional[str] = None

class CodeVerifyRequest(BaseModel):
    model_name: str

class GenerateBlockRequest(BaseModel):
    description: str
    model_name: str
    model_type: str = "ollama"  # ollama 또는 openai 