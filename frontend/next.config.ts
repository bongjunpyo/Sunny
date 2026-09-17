import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // next dev 가 frontend/AGENTS.md 끝에 자기 안내문을 덧붙이는 것을 막는다.
  // 영역 규칙 파일은 팀장만 고친다 (AGENTS.md "절대 하지 말 것" 8).
  agentRules: false,
};

export default nextConfig;
