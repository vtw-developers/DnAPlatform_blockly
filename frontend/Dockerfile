FROM nginx:alpine

# Nginx 설정 파일 복사
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 빌드된 파일 복사
COPY build /usr/share/nginx/html

# Nginx 실행
CMD ["nginx", "-g", "daemon off;"] 