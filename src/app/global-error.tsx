"use client";

/**
 * 최상위 레이아웃까지 무너졌을 때의 마지막 방어선.
 *
 * app/error.tsx 는 레이아웃 안에서 난 오류만 받는다. 레이아웃 자체가
 * 무너지면 이 파일이 html·body 부터 새로 그린다. 그래서 여기서는
 * globals.css 의 디자인 토큰을 쓸 수 없다고 보고 색을 직접 적는다.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#f6f7f9",
          color: "#1b2436",
          fontFamily:
            "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
        }}
      >
        <main style={{ maxWidth: "520px", width: "100%" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>
            화면을 불러오지 못했습니다
          </h1>

          <p style={{ marginTop: "16px", lineHeight: 1.7, color: "#4a5468" }}>
            잠시 문제가 생겼습니다. 다시 시도해 주세요.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "28px",
              border: "none",
              borderRadius: "8px",
              background: "#2f6fd0",
              color: "#ffffff",
              padding: "12px 20px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>

          <p style={{ marginTop: "36px", fontSize: "12px", color: "#78829a" }}>
            계속 같으면 운영자에게 알려 주세요.
            {error.digest ? ` 오류 번호 ${error.digest}` : ""}
          </p>
        </main>
      </body>
    </html>
  );
}
