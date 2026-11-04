import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 이메일 인증 query의 비밀 링크를 개발 요청 로그에 남기지 않는다.
  logging: { incomingRequests: { ignore: [/\/api\/(?:auth|uploads)(?:\/|\?|$)/] } },
  // next dev 가 frontend/AGENTS.md 끝에 자기 안내문을 덧붙이는 것을 막는다.
  // 영역 규칙 파일은 팀장만 고친다 (AGENTS.md "절대 하지 말 것" 8).
  agentRules: false,
};

export default nextConfig;
