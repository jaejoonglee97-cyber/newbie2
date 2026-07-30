import "server-only";

/**
 * 서버 전용 설정.
 *
 * 서비스 계정 키, 업로드 시크릿, 로그인 비밀번호는 절대 클라이언트로 내려보내지 않는다.
 * 이 파일은 "server-only" 를 import 하므로 클라이언트 컴포넌트에서
 * 실수로 import 하면 빌드가 실패한다.
 */

export type DataSource = "sheets" | "mock";

/**
 * mock 은 개인정보가 없는 가상 데이터로 화면과 접수 흐름을 검증하기 위한 모드다.
 * 서비스 계정 설정이 끝나기 전까지는 mock 으로 개발한다.
 */
export function getDataSource(): DataSource {
  const explicit = process.env.NEWBIE_DATA_SOURCE?.trim();
  if (explicit === "sheets" || explicit === "mock") {
    return explicit;
  }

  const configured =
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.SHEETS_SPREADSHEET_ID;

  return configured ? "sheets" : "mock";
}

export function getSheetsCredentials() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !spreadsheetId || !rawKey) {
    throw new Error(
      "Google Sheets 환경변수가 없습니다. GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, SHEETS_SPREADSHEET_ID 를 설정하세요.",
    );
  }

  // Vercel 환경변수에는 개인키 줄바꿈이 \n 문자열로 들어간다.
  const privateKey = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;

  return { clientEmail, privateKey, spreadsheetId };
}

/**
 * 명함 업로드 중계 설정.
 *
 * 설정되지 않으면 명함 업로드만 비활성화되고 신청 접수는 정상 동작한다.
 * 명함은 선택 항목이므로 모집을 막지 않는다.
 */
export function getUploadConfig(): { url: string; secret: string } | null {
  const url = process.env.APPS_SCRIPT_UPLOAD_URL?.trim();
  const secret = process.env.APPS_SCRIPT_UPLOAD_SECRET?.trim();

  if (!url || !secret) {
    return null;
  }

  return { url, secret };
}

export function isCardUploadEnabled(): boolean {
  return getUploadConfig() !== null || getDataSource() === "mock";
}

/**
 * 공동 비밀번호 로그인 설정.
 *
 * 비밀번호를 코드에 두지 않는다. 값이 없으면 해당 권한으로 로그인할 수 없다.
 * SESSION_SECRET 은 쿠키 서명용이며, 바뀌면 기존 로그인이 모두 무효가 된다.
 */
export function getAuthConfig() {
  return {
    memberPassword: process.env.ALUMNI_PASSWORD?.trim() ?? "",
    adminPassword: process.env.ADMIN_PASSWORD?.trim() ?? "",
    sessionSecret: process.env.SESSION_SECRET?.trim() ?? "",
  };
}
