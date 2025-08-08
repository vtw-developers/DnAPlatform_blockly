#!/bin/bash

# Airflow 초기화 스크립트
echo "=== Airflow 초기화 시작 ==="

# 데이터베이스 준비 대기
echo "데이터베이스 연결 확인 중..."
while ! pg_isready -h airflow-db -p 5432 -U airflow_user; do
    echo "데이터베이스 대기 중..."
    sleep 2
done
echo "데이터베이스 연결 성공!"

# uv 설치 및 가상환경 설정
echo "uv 설치 및 가상환경 설정 중..."
if ! command -v uv &> /dev/null; then
    echo "uv 설치 중..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.cargo/bin:$PATH"
fi

# 기존 가상환경 디렉토리 삭제
echo "기존 가상환경 정리 중..."
rm -rf /opt/airflow/pirel_env
rm -rf /opt/airflow/equiv_env

# PiREL 가상환경 생성
echo "PiREL 가상환경 생성 중..."
mkdir -p /opt/airflow/pirel_env
cd /opt/airflow/pirel_env

# uv로 프로젝트 초기화
uv init --name pirel-env --python 3.11

# PiREL 전용 패키지 설치
echo "PiREL 가상환경에 패키지 설치 중..."
uv add langchain-core langchain langchain-community langchain-openai "tree-sitter==0.20.4" jsbeautifier openai pyparsing python-Levenshtein apted
echo "PiREL 가상환경 패키지 설치 완료!"

# Equiv 가상환경 생성
echo "Equiv 가상환경 생성 중..."
mkdir -p /opt/airflow/equiv_env
cd /opt/airflow/equiv_env

# uv로 프로젝트 초기화
uv init --name equiv-env --python 3.11

# Equiv 전용 패키지 설치
echo "Equiv 가상환경에 패키지 설치 중..."
uv add langchain-core langchain langchain-community langchain-openai openai
echo "Equiv 가상환경 패키지 설치 완료!"

# 기본 패키지들 설치 (Airflow용)
echo "기본 패키지 설치 중..."
if [ -f "/opt/airflow/requirements.txt" ]; then
    pip install -r /opt/airflow/requirements.txt
    echo "기본 패키지 설치 완료!"
else
    echo "경고: requirements.txt 파일을 찾을 수 없습니다."
fi

# Airflow 데이터베이스 초기화
echo "Airflow 데이터베이스 초기화 중..."
airflow db init
echo "데이터베이스 초기화 완료!"

# 관리자 사용자 생성
echo "관리자 사용자 생성 중..."
airflow users create \
    --username admin \
    --password vtw210302 \
    --firstname admin \
    --lastname admin \
    --role Admin \
    --email admin@example.com || echo "관리자 사용자가 이미 존재합니다."

echo "=== Airflow 초기화 완료 ==="

# Airflow 서비스 시작
echo "Airflow 서비스 시작 중..."
airflow scheduler & 
airflow webserver 