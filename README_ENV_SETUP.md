# 환경변수 설정 가이드

## 개요

DnAPlatform은 모든 서비스(Backend, Frontend, Airflow)의 환경변수를 루트 디렉토리의 `.env` 파일에서 중앙 집중식으로 관리합니다.

## 설정 방법

### 1. 환경변수 파일 생성

```bash
# 예시 파일을 복사
cp .env.example .env

# 실제 값으로 편집
nano .env
```

### 2. 주요 설정 항목

#### Database Configuration
```env
DB_HOST=postgres
DB_PORT=5432
DB_NAME=blockly_db
DB_USER=blockly_user
DB_PASSWORD=blockly_password
```

#### Backend Server Configuration
```env
PORT=8000
SECRET_KEY=your_secret_key_here_change_this_in_production
ALLOWED_ORIGINS=http://localhost:5000,http://192.168.0.2:5050,http://121.65.128.115:5050
```

#### Frontend Configuration
```env
VITE_API_URL=http://192.168.0.2:8000/api
VITE_LOCAL_API_URL=http://192.168.0.2:8000/api
VITE_INTERNAL_API_URL=http://192.168.0.2:8000/api
VITE_PUBLIC_API_URL=http://121.65.128.115:8000/api
VITE_PORT=5000
VITE_INTERNAL_PORT=5050
```

#### AI Service Configuration
```env
OLLAMA_BASE_URL=http://192.168.0.2:11434
USE_LOCAL_LLM=true
ENABLE_OLLAMA=true
ENABLE_OPENAI=false
OPENAI_API_KEY=your_openai_api_key_here
```

#### Airflow Configuration
```env
AIRFLOW_UID=50000
AIRFLOW_GID=0
```

## 보안 주의사항

### ✅ 권장사항
- `.env` 파일은 Git에 포함되지 않음 (`.gitignore`에 포함)
- 실제 운영 환경에서는 모든 비밀번호와 API 키를 변경
- `SECRET_KEY`는 반드시 변경하여 사용

### ❌ 주의사항
- `.env` 파일을 Git에 커밋하지 마세요
- API 키나 비밀번호를 코드에 직접 작성하지 마세요
- `.env.example` 파일에는 실제 값이 아닌 예시 값만 포함

## 서비스 재시작

환경변수를 변경한 후에는 서비스를 재시작해야 합니다:

```bash
# Docker Compose 재시작
docker-compose down
docker-compose up -d

# 또는 특정 서비스만 재시작
docker-compose restart backend
docker-compose restart frontend
docker-compose restart airflow
```

## 문제 해결

### 환경변수가 적용되지 않는 경우
1. `.env` 파일이 루트 디렉토리에 있는지 확인
2. Docker Compose 재시작
3. 컨테이너 로그 확인: `docker-compose logs backend`

### API 키 관련 에러
1. `OPENAI_API_KEY`가 올바르게 설정되었는지 확인
2. Airflow UI에서 Connection 설정 확인
3. 환경변수 파일의 형식 확인 (공백 없이)

## 파일 구조

```
DnAPlatform_blockly/
├── .env.example          # 환경변수 예시 파일
├── .env                  # 실제 환경변수 파일 (Git에 포함되지 않음)
├── docker-compose.yml    # Docker Compose 설정
├── backend/              # 백엔드 서비스
├── frontend/             # 프론트엔드 서비스
└── docker/airflow/       # Airflow 서비스
``` 