from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum

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

class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"

class UserBase(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=50)
    organization: Optional[str] = Field(None, max_length=100)
    role: UserRole = UserRole.USER
    is_active: bool = True

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=50)
    organization: Optional[str] = Field(None, max_length=100)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=8)

class User(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    email: str
    role: UserRole

class UserListResponse(BaseModel):
    users: List[User]
    total: int 