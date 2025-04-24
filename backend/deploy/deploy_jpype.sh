#!/bin/bash

# 인자로 포트와 Python 코드를 받음
PORT=$1
PYTHON_CODE=$2

# 작업 디렉토리 생성
WORK_DIR=$(mktemp -d)
echo "작업 디렉토리 생성: $WORK_DIR"

# 필요한 디렉토리 생성
mkdir -p "$WORK_DIR/jars"
echo "jars 디렉토리 생성 완료"

# Dockerfile.jpype 복사
cp "$(dirname "$0")/Dockerfile.jpype" "$WORK_DIR/Dockerfile"
cp "$(dirname "$0")/requirements.jpype.txt" "$WORK_DIR/"
echo "Dockerfile.jpype 복사 완료"

# Python 코드 출력 (디버깅용)
echo "Python 코드:"
echo "$PYTHON_CODE"

# jar 파일 경로 추출 및 복사 (작은따옴표와 큰따옴표 모두 처리)
JAR_PATHS=$(echo "$PYTHON_CODE" | grep -o "['\"]\/app\/jar\/[^'\"]*\.jar['\"]" | tr -d "'\"")
echo "JAR_PATHS: $JAR_PATHS"
if [ -n "$JAR_PATHS" ]; then
    echo "jar 파일 경로 발견"
    while IFS= read -r JAR_PATH; do
        echo "찾고있는 jar 파일 경로: $JAR_PATH"
        # 백엔드 도커에서 jar 파일 복사
        docker cp dna-platform-backend:"$JAR_PATH" "$WORK_DIR/jars/$(basename "$JAR_PATH")"
        if [ $? -eq 0 ]; then
            echo "jar 파일 복사 성공: $(basename "$JAR_PATH")"
        else
            echo "Error: jar 파일 복사 실패: $JAR_PATH"
            # 디버깅을 위한 백엔드 도커 내부 경로 확인
            docker exec dna-platform-backend ls -la "$(dirname "$JAR_PATH")"
        fi
    done <<< "$JAR_PATHS"
    
    echo "복사된 jar 파일 목록:"
    ls -la "$WORK_DIR/jars"
else
    echo "Warning: Python 코드에서 jar 파일 경로를 찾을 수 없습니다."
fi

# Python 앱 템플릿에 사용자 코드 삽입
echo "$PYTHON_CODE" > "$WORK_DIR/user_code.txt"

# Python 앱 템플릿 복사 및 사용자 코드 삽입
awk -v code="$(cat "$WORK_DIR/user_code.txt")" '
  /\{user_code\}/ {
    print code
    next
  }
  { print }
' "$(dirname "$0")/app_template.py" > "$WORK_DIR/app.py"

echo "Python 앱 생성 완료"

# 컨테이너 이름 설정
CONTAINER_NAME="jpype-app-$PORT"

# 도커 이미지 빌드
echo "도커 이미지 빌드 시작..."
if ! command -v docker &> /dev/null; then
    echo "도커가 설치되어 있지 않습니다."
    exit 1
fi

# 작업 디렉토리 내용 확인
echo "작업 디렉토리 내용:"
ls -la "$WORK_DIR"
echo "jars 디렉토리 내용:"
ls -la "$WORK_DIR/jars"

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
        -e "CLASSPATH=/app/lib/*" \
        -e "JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64" \
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