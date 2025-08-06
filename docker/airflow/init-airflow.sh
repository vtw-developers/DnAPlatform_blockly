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

# requirements.txt 설치
echo "패키지 설치 중..."
if [ -f "/opt/airflow/requirements.txt" ]; then
    pip install -r /opt/airflow/requirements.txt
    echo "패키지 설치 완료!"
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