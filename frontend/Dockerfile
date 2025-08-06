# 빌드 스테이지
FROM node:lts-alpine as build

WORKDIR /app

# 먼저 package.json만 복사하여 의존성 설치
COPY frontend/package*.json ./
RUN npm install

# 루트 디렉토리의 .env 파일 복사
COPY .env ./.env

# 프론트엔드 소스 파일 복사
COPY frontend/ .

# 빌드 실행
RUN npm run build

# 프로덕션 스테이지
FROM nginx:alpine

# Nginx 설정 파일 복사
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# 빌드된 파일 복사 (dist 디렉토리에서 복사)
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Nginx 실행
CMD ["nginx", "-g", "daemon off;"] 