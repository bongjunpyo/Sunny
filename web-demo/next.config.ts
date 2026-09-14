import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 홈 폴더에 다른 package-lock.json이 있어 프로젝트 루트를 직접 지정
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;
