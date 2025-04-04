# 빌드 스테이지
FROM node:16 as build

WORKDIR /app

# 먼저 package.json만 복사하여 의존성 설치
COPY package*.json ./
RUN npm install

# 그 다음 소스 파일 복사
COPY tsconfig.json ./
COPY public ./public
COPY src ./src

# 빌드 실행
RUN npm run build

# 프로덕션 스테이지
FROM nginx:alpine

# Nginx 설정 파일 복사
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# 빌드된 파일 복사
COPY --from=build /app/build /usr/share/nginx/html

# Nginx 실행
CMD ["nginx", "-g", "daemon off;"] 