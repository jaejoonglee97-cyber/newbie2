import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        // 개인정보가 오가는 모든 경로에서 검색 노출을 차단한다.
        // 2단계에서 참여자 열람 영역이 붙기 전까지는 전체를 막아 둔다.
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
