# SUNNY 공개 사이트 이미지. 빌드 컨텍스트는 frontend/ (frontend/.dockerignore 적용).
# 11/2·11/3 수동 배포에 쓴 Dockerfile과 같은 구성이다. 빌드 시점 env는 넣지 않는다 —
# 서버 전용 값은 jun의 compose.yml(env_file)에서 실행 시점에 받는다.
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0
COPY --from=build /app/package.json /app/package-lock.json /app/next.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/.next ./.next
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
