/**
 * Google Sheets 연결 점검 스크립트
 *
 * 실행:
 *   node --env-file=.env.local scripts/check-sheets.mjs
 *
 * 확인하는 것:
 *   1. 서비스 계정 인증이 되는지
 *   2. 대상 스프레드시트를 읽을 수 있는지
 *   3. 9개 시트가 모두 있고 헤더가 들어갔는지
 *   4. settings 필수 키가 채워졌는지
 *   5. 쓰기 권한이 있는지 (audit_logs 에 점검 기록 1행을 남긴다)
 *
 * 서비스 계정 키는 화면에 출력하지 않는다.
 */

import { JWT } from "google-auth-library";

const REQUIRED_SHEETS = [
  "settings",
  "applicants",
  "members",
  "activities",
  "activity_participants",
  "budget_items",
  "activity_logs",
  "photos",
  "audit_logs",
];

const REQUIRED_SETTINGS = [
  "program_id",
  "program_name",
  "cohort",
  "organization_name",
  "recruitment_start_at",
  "recruitment_end_at",
  "activity_start_date",
  "activity_end_date",
  "total_budget",
  "minimum_participants",
];

const CONTACT_SETTINGS = ["contact_name", "contact_email", "contact_phone"];

const API = "https://sheets.googleapis.com/v4/spreadsheets";

const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID;
const rawKey = process.env.GOOGLE_PRIVATE_KEY;

let failures = 0;

function pass(message) {
  console.log(`  OK    ${message}`);
}

function warn(message) {
  console.log(`  주의  ${message}`);
}

function fail(message) {
  failures += 1;
  console.log(`  실패  ${message}`);
}

function section(title) {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------------------

section("1. 환경변수");

if (!clientEmail) fail("GOOGLE_SERVICE_ACCOUNT_EMAIL 이 없습니다.");
else pass(`서비스 계정: ${clientEmail}`);

if (!spreadsheetId) fail("SHEETS_SPREADSHEET_ID 가 없습니다.");
else pass(`스프레드시트 ID: ${spreadsheetId}`);

if (!rawKey) fail("GOOGLE_PRIVATE_KEY 가 없습니다.");
else if (!rawKey.includes("BEGIN PRIVATE KEY"))
  fail("GOOGLE_PRIVATE_KEY 형식이 올바르지 않습니다. BEGIN PRIVATE KEY 구문이 없습니다.");
else pass(`개인키 확인 (길이 ${rawKey.length}자, 내용은 출력하지 않음)`);

if (failures > 0) {
  console.log("\n환경변수를 먼저 채운 뒤 다시 실행하세요.");
  process.exit(1);
}

const privateKey = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;

// ---------------------------------------------------------------------------

section("2. 인증");

const client = new JWT({
  email: clientEmail,
  key: privateKey,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

let token;
try {
  const result = await client.getAccessToken();
  token = result.token;
  if (!token) throw new Error("토큰이 비어 있습니다.");
  pass("액세스 토큰 발급 성공");
} catch (error) {
  fail(`토큰 발급 실패: ${describe(error)}`);
  console.log("\n확인할 것: Cloud 프로젝트에서 Google Sheets API 사용 설정, 개인키 값 정확성");
  process.exit(1);
}

async function api(path, init) {
  const response = await fetch(`${API}/${spreadsheetId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status} ${body.slice(0, 300)}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------

section("3. 스프레드시트 접근");

let meta;
try {
  meta = await api("?fields=properties.title,sheets.properties.title");
  pass(`문서 제목: ${meta.properties.title}`);
} catch (error) {
  fail(`스프레드시트를 읽지 못했습니다: ${describe(error)}`);
  console.log(
    `\n확인할 것: 스프레드시트를 ${clientEmail} 에게 편집자로 공유했는지, SHEETS_SPREADSHEET_ID 가 맞는지`,
  );
  process.exit(1);
}

const existing = meta.sheets.map((sheet) => sheet.properties.title);

section("4. 시트 구성");

const missing = REQUIRED_SHEETS.filter((name) => !existing.includes(name));
if (missing.length > 0) {
  fail(`없는 시트: ${missing.join(", ")}`);
  console.log("        → setup/sheets-setup.gs 의 setupAll 을 실행하세요.");
} else {
  pass(`9개 시트 모두 존재`);
}

const extra = existing.filter((name) => !REQUIRED_SHEETS.includes(name));
if (extra.length > 0) {
  warn(`스키마에 없는 시트: ${extra.join(", ")}`);
}

// 헤더 확인
for (const name of REQUIRED_SHEETS.filter((n) => existing.includes(n))) {
  try {
    const range = encodeURIComponent(`${name}!A1:ZZ1`);
    const data = await api(`/values/${range}`);
    const headers = (data.values?.[0] ?? []).filter(Boolean);
    if (headers.length === 0) {
      fail(`${name}: 헤더가 비어 있습니다.`);
    } else {
      pass(`${name}: 헤더 ${headers.length}개`);
    }
  } catch (error) {
    fail(`${name}: 헤더를 읽지 못했습니다 (${describe(error)})`);
  }
}

// ---------------------------------------------------------------------------

section("5. settings 값");

if (existing.includes("settings")) {
  try {
    const data = await api(`/values/${encodeURIComponent("settings!A2:C")}`);
    const map = new Map(
      (data.values ?? [])
        .filter((row) => row[0])
        .map((row) => [String(row[0]).trim(), String(row[1] ?? "").trim()]),
    );

    const emptyRequired = REQUIRED_SETTINGS.filter((key) => !map.get(key));
    if (emptyRequired.length > 0) {
      fail(`값이 비어 있는 필수 설정: ${emptyRequired.join(", ")}`);
    } else {
      pass(`필수 설정 ${REQUIRED_SETTINGS.length}개 모두 채워짐`);
      console.log(`        프로그램명: ${map.get("program_name")}`);
      console.log(
        `        모집 기간: ${map.get("recruitment_start_at")} ~ ${map.get("recruitment_end_at")}`,
      );
      console.log(`        총 지원금: ${map.get("total_budget")}`);
    }

    const emptyContact = CONTACT_SETTINGS.filter((key) => !map.get(key));
    if (emptyContact.length > 0) {
      warn(
        `문의처가 비어 있습니다: ${emptyContact.join(", ")} · 모집 페이지 하단에 표시되지 않습니다.`,
      );
    } else {
      pass("문의처 설정 완료");
    }

    // 모집 상태 계산
    const start = new Date(map.get("recruitment_start_at") ?? "");
    const end = new Date(map.get("recruitment_end_at") ?? "");
    const now = new Date();
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const phase = now < start ? "모집 예정" : now > end ? "모집 마감" : "모집 중";
      pass(`현재 모집 상태: ${phase}`);
    }
  } catch (error) {
    fail(`settings 를 읽지 못했습니다: ${describe(error)}`);
  }
}

// ---------------------------------------------------------------------------

section("6. 쓰기 권한");

if (existing.includes("audit_logs")) {
  try {
    const now = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
      dateStyle: "short",
      timeStyle: "medium",
    })
      .format(new Date())
      .replace(" ", "T");

    await api(
      `/values/${encodeURIComponent("audit_logs!A1")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        body: JSON.stringify({
          values: [
            [
              `AUD-CHECK-${now.replace(/[-:T]/g, "")}`,
              "system",
              "activity",
              "-",
              "connection_check",
              "",
              "",
              "연결 점검 스크립트 실행",
              `${now}+09:00`,
            ],
          ],
        }),
      },
    );
    pass("쓰기 성공 · audit_logs 에 점검 기록 1행을 남겼습니다.");
  } catch (error) {
    fail(`쓰기 실패: ${describe(error)}`);
    console.log(
      `        → 스프레드시트 공유 권한이 '뷰어'가 아니라 '편집자'인지 확인하세요. (${clientEmail})`,
    );
  }
} else {
  warn("audit_logs 시트가 없어 쓰기 권한을 확인하지 못했습니다.");
}

// ---------------------------------------------------------------------------

console.log("");
if (failures === 0) {
  console.log("모든 점검을 통과했습니다. NEWBIE_DATA_SOURCE=sheets 로 실행할 수 있습니다.");
  process.exit(0);
} else {
  console.log(`실패 ${failures}건. 위 안내를 확인하세요.`);
  process.exit(1);
}

function describe(error) {
  return error instanceof Error ? error.message : String(error);
}
