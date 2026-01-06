import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # 데이터베이스 설정
    DB_HOST: str = os.getenv("DB_HOST", "postgres")
    DB_NAME: str = os.getenv("DB_NAME", "blockly_db")
    DB_USER: str = os.getenv("DB_USER", "blockly_user")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "blockly_password")
    
    # AI 서비스 설정
    OLLAMA_API_URL: str = os.getenv("OLLAMA_API_URL", "http://ollama:11434")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_API_URL: str = os.getenv("OPENAI_API_URL", "https://api.openai.com/v1")
    
    # Airflow 설정
    AIRFLOW_API_URL: str = os.getenv("AIRFLOW_API_URL", "http://airflow:8080")
    AIRFLOW_USERNAME: str = os.getenv("AIRFLOW_USERNAME", "airflow")
    AIRFLOW_PASSWORD: str = os.getenv("AIRFLOW_PASSWORD", "airflow")
    
    # CORS 설정
    CORS_ORIGINS: List[str] = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5000,http://localhost:8000"
    ).split(",")
    
    # 애플리케이션 설정
    APP_TITLE: str = "Blockly Platform API"
    APP_DESCRIPTION: str = "Blockly Platform의 백엔드 API"
    APP_VERSION: str = "1.0.0"
    
    class Config:
        env_file = ".env"

settings = Settings() 