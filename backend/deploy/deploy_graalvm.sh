#!/bin/bash

# 인자로 포트와 코드를 받음
PORT=$1
CODE=$2

# 작업 디렉토리 생성
WORK_DIR=$(mktemp -d)
echo "작업 디렉토리 생성: $WORK_DIR"

# Dockerfile 복사 (GraalVM 버전 사용)
cp "$(dirname "$0")/Dockerfile.graalvm" "$WORK_DIR/Dockerfile"
echo "GraalVM Dockerfile 복사 완료"

# Python 앱 템플릿에 사용자 코드 삽입
# 임시 파일에 코드 저장
echo "$CODE" > "$WORK_DIR/user_code.txt"

# Python 앱 템플릿 복사 및 사용자 코드 삽입
awk -v code="$(cat "$WORK_DIR/user_code.txt")" '
  /\{user_code\}/ {
    print code
    next
  }
  { print }
' "$(dirname "$0")/app_template.py" > "$WORK_DIR/app.py"

# requirements.txt 복사
cp "$(dirname "$0")/requirements.txt" "$WORK_DIR/requirements.txt"

echo "GraalVM 앱 생성 완료"

# 컨테이너 이름 설정
CONTAINER_NAME="graalvm-app-$PORT"

# 도커 이미지 빌드
echo "도커 이미지 빌드 시작..."
if ! command -v docker &> /dev/null; then
    echo "도커가 설치되어 있지 않습니다."
    exit 1
fi

docker build -t "$CONTAINER_NAME" "$WORK_DIR"
BUILD_RESULT=$?

if [ $BUILD_RESULT -eq 0 ]; then
    echo "도커 이미지 빌드 성공"
    
    # 기존 컨테이너 정리
    echo "기존 컨테이너 확인 및 정리..."
    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
    
    # 도커 네트워크 생성 (이미 존재하면 무시)
    DOCKER_NETWORK="dna-platform-network"
    docker network create "$DOCKER_NETWORK" 2>/dev/null || true
    
    # 새 컨테이너 실행
    echo "새 컨테이너 실행 (포트: $PORT)..."
    docker run \
        --name "$CONTAINER_NAME" \
        --network "$DOCKER_NETWORK" \
        -p "$PORT:$PORT" \
        -e "PORT=$PORT" \
        -e "PYTHONUNBUFFERED=1" \
        -e "PYTHONPATH=/app" \
        -e "GRAALVM_HOME=/usr/lib/graalvm" \
        -e "JAVA_HOME=/usr/lib/graalvm" \
        -d \
        "$CONTAINER_NAME" &

    # 컨테이너 시작 대기
    echo "컨테이너 시작 대기 중..."
    sleep 15

    # 컨테이너 상태 확인
    if docker ps | grep -q "$CONTAINER_NAME"; then
        echo "컨테이너가 실행 중입니다"
        
        # 컨테이너 로그 확인
        echo "컨테이너 로그 확인 중..."
        docker logs "$CONTAINER_NAME"
        
        # 헬스체크
        echo "Waiting for container to be healthy..."
        for i in {1..12}; do
            # 컨테이너 이름으로 직접 접근
            if curl -s -f --connect-timeout 5 --max-time 10 "http://$CONTAINER_NAME:$PORT/health" > /dev/null; then
                echo "Container is healthy!"
                break
            fi
            
            if [ $i -eq 12 ]; then
                echo "Container failed health check after 60 seconds"
                docker logs "$CONTAINER_NAME"
                exit 1
            fi
            echo "Health check attempt $i failed, retrying in 5 seconds..."
            sleep 5
        done
    else
        echo "컨테이너 실행 실패"
        docker logs "$CONTAINER_NAME"
        exit 1
    fi
else
    echo "도커 이미지 빌드 실패"
    exit 1
fi

# 작업 디렉토리 정리
rm -rf "$WORK_DIR"
echo "배포 완료" 