#!/bin/bash

# 인자로 포트와 코드를 받음
PORT=$1
CODE=$2

# 작업 디렉토리 생성
WORK_DIR=$(mktemp -d)
echo "작업 디렉토리 생성: $WORK_DIR"

# Java 파일 생성 (UTF-8로 저장)
echo "$CODE" | iconv -f UTF-8 -t UTF-8 > "$WORK_DIR/PythonWrapper.java"

# 설정 파일 복사
cp "$(dirname "$0")/Dockerfile.graalvm" "$WORK_DIR/Dockerfile"
cp "$(dirname "$0")/requirements.graalvm.txt" "$WORK_DIR/"
echo "설정 파일 복사 완료"

# 변환/랩핑된 코드 출력 (디버깅용)
echo "변환/랩핑된 코드:"
echo "$CODE"

# 컨테이너 이름 설정
CONTAINER_NAME="graalvm-app-$PORT"

# 도커 이미지 빌드
echo "도커 이미지 빌드 시작..."
if ! command -v docker &> /dev/null; then
    echo "도커가 설치되어 있지 않습니다."
    exit 1
fi

# 이전 이미지 제거
docker rmi -f "$CONTAINER_NAME" 2>/dev/null || true

# 새 이미지 빌드
if ! docker build --no-cache -t "$CONTAINER_NAME" "$WORK_DIR"; then
    echo "도커 이미지 빌드 실패"
    exit 1
fi

echo "도커 이미지 빌드 성공"

# 기존 컨테이너 정리
echo "기존 컨테이너 확인 및 정리..."
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

# 도커 네트워크 생성 (이미 존재하면 무시)
DOCKER_NETWORK="dna-platform-network"
docker network create "$DOCKER_NETWORK" 2>/dev/null || true

# 새 컨테이너 실행 및 결과 캡처
echo "Java 코드 실행 및 결과 확인 중..."
if ! RESULT=$(docker run --rm \
    --name "${CONTAINER_NAME}_test" \
    --network "$DOCKER_NETWORK" \
    "$CONTAINER_NAME" 2>&1); then
    echo "테스트 실행 실패:"
    echo "$RESULT"
    exit 1
fi

echo "실행 결과:"
echo "$RESULT"

# 실제 서비스 컨테이너 실행
echo "서비스 컨테이너 실행 중 (포트: $PORT)..."
if ! docker run -d \
    --name "$CONTAINER_NAME" \
    --network "$DOCKER_NETWORK" \
    -p "$PORT:$PORT" \
    -e "PORT=$PORT" \
    -e "PYTHONUNBUFFERED=1" \
    -e "PYTHONPATH=/app" \
    "$CONTAINER_NAME"; then
    echo "서비스 컨테이너 실행 실패"
    exit 1
fi

# 컨테이너 시작 대기
echo "컨테이너 시작 대기 중..."
sleep 5

# 컨테이너 상태 확인
if docker ps | grep -q "$CONTAINER_NAME"; then
    echo "컨테이너가 실행 중입니다"
    
    # 컨테이너 로그 확인
    docker logs "$CONTAINER_NAME"
else
    echo "컨테이너 실행 실패"
    docker logs "$CONTAINER_NAME"
    exit 1
fi

# 작업 디렉토리 정리
rm -rf "$WORK_DIR"
echo "배포 완료" 