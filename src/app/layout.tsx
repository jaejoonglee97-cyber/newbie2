import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "뉴비스쿨 2기 동문회",
  description:
    "중부재단 2026년 신입사회복지사 역량강화교육 뉴비스쿨 2기 동문회 참여 안내 및 참석 희망 신청",
  // 참여자 개인정보가 노출될 수 있는 서비스이므로 검색엔진 수집을 허용하지 않는다.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <a
          href="#main"
          className="sr-only-focusable absolute left-4 top-4 z-50 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white"
        >
          본문으로 바로 가기
        </a>
        {children}
      </body>
    </html>
  );
}
