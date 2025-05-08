#!/bin/bash

set -e

# DB 접속 정보
DB_HOST=${POSTGRES_HOST:-postgres}
DB_PORT=${POSTGRES_PORT:-5432}
DB_NAME=${POSTGRES_DB:-blockly_db}
DB_USER=${POSTGRES_USER:-blockly_user}
DB_PASS=${POSTGRES_PASSWORD:-blockly_password}

function exec_psql() {
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -tAc "$1"
}

# users 테이블 없으면 생성
if [[ $(exec_psql "SELECT to_regclass('public.users') IS NOT NULL;") != "t" ]]; then
  echo "[entrypoint] users 테이블 생성"
  exec_psql "CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, name VARCHAR(50) NOT NULL, password_hash VARCHAR(255) NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'user', organization VARCHAR(100), is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);"
fi

# code_blocks 테이블 없으면 생성
if [[ $(exec_psql "SELECT to_regclass('public.code_blocks') IS NOT NULL;") != "t" ]]; then
  echo "[entrypoint] code_blocks 테이블 생성"
  exec_psql "CREATE TABLE code_blocks (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT, code TEXT NOT NULL, blockly_xml TEXT, user_id INTEGER REFERENCES users(id), is_shared BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);"
fi

# converted_codes 테이블 없으면 생성
if [[ $(exec_psql "SELECT to_regclass('public.converted_codes') IS NOT NULL;") != "t" ]]; then
  echo "[entrypoint] converted_codes 테이블 생성"
  exec_psql "CREATE TABLE converted_codes (id SERIAL PRIMARY KEY, source_code_id INTEGER REFERENCES code_blocks(id) ON DELETE CASCADE, description TEXT, converted_code TEXT NOT NULL, user_id INTEGER REFERENCES users(id), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);"
fi

# 기존 백엔드 실행
exec uvicorn main:app --host 0.0.0.0 --port 8000 