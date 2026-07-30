import "server-only";

import { JWT } from "google-auth-library";

import { getSheetsCredentials } from "./config";

// drive.readonly 는 명함 이미지를 읽어 로그인 사용자에게 전달하기 위해 필요하다.
// 쓰기 권한은 요청하지 않는다. 파일 생성은 Apps Script 가 담당한다.
const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.readonly",
];
const API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

let cachedClient: JWT | null = null;

export function getClient(): JWT {
  if (cachedClient) {
    return cachedClient;
  }

  const { clientEmail, privateKey } = getSheetsCredentials();
  cachedClient = new JWT({ email: clientEmail, key: privateKey, scopes: SCOPES });
  return cachedClient;
}

/** Google API 호출용 액세스 토큰. Drive 접근에서도 사용한다. */
export async function getAccessToken(): Promise<string> {
  const { token } = await getClient().getAccessToken();

  if (!token) {
    throw new Error("Google 액세스 토큰을 발급하지 못했습니다. 서비스 계정 설정을 확인하세요.");
  }

  return token;
}

async function authorizedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  const { spreadsheetId } = getSheetsCredentials();

  const response = await fetch(`${API_BASE}/${spreadsheetId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Sheets API 오류 ${response.status}: ${body.slice(0, 500)}`);
  }

  return response;
}

/** 시트 전체를 2차원 배열로 읽는다. 첫 행은 헤더다. */
async function readRawRows(sheetName: string): Promise<string[][]> {
  const range = encodeURIComponent(`${sheetName}!A1:ZZ`);
  const response = await authorizedFetch(
    `/values/${range}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`,
  );
  const data = (await response.json()) as { values?: string[][] };
  return data.values ?? [];
}

export type SheetRow = Record<string, string>;

/**
 * 시트를 헤더 기준 객체 배열로 읽는다.
 *
 * 컬럼 순서가 바뀌어도 동작하도록 항상 헤더 이름으로 매핑한다.
 * 빈 값은 빈 문자열로 채워 undefined 접근을 막는다.
 */
export async function readSheet(sheetName: string): Promise<SheetRow[]> {
  const rows = await readRawRows(sheetName);
  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((h) => String(h ?? "").trim());

  return rows.slice(1).flatMap((row) => {
    const record: SheetRow = {};
    let hasValue = false;

    headers.forEach((header, index) => {
      if (!header) return;
      const value = String(row[index] ?? "").trim();
      record[header] = value;
      if (value) hasValue = true;
    });

    // 완전히 빈 행은 건너뛴다.
    return hasValue ? [record] : [];
  });
}

/** 시트의 헤더 순서를 그대로 읽는다. append 시 컬럼 정렬에 사용한다. */
export async function readHeaders(sheetName: string): Promise<string[]> {
  const range = encodeURIComponent(`${sheetName}!A1:ZZ1`);
  const response = await authorizedFetch(`/values/${range}?majorDimension=ROWS`);
  const data = (await response.json()) as { values?: string[][] };
  return (data.values?.[0] ?? []).map((h) => String(h ?? "").trim());
}

/**
 * 시트 마지막에 한 행을 추가한다.
 *
 * 값은 컬럼명 기준 객체로 넘기고, 실제 시트 헤더 순서에 맞춰 배열로 변환한다.
 * 시트에서 컬럼 순서를 바꿔도 잘못된 칸에 쓰이지 않는다.
 */
export async function appendRow(sheetName: string, values: SheetRow): Promise<void> {
  const headers = await readHeaders(sheetName);

  if (headers.length === 0) {
    throw new Error(`${sheetName} 시트에 헤더가 없습니다. setup/sheets-setup.gs 를 먼저 실행하세요.`);
  }

  const unknown = Object.keys(values).filter((key) => !headers.includes(key));
  if (unknown.length > 0) {
    throw new Error(`${sheetName} 시트에 없는 컬럼입니다: ${unknown.join(", ")}`);
  }

  const row = headers.map((header) => values[header] ?? "");
  const range = encodeURIComponent(`${sheetName}!A1`);

  await authorizedFetch(
    `/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ values: [row] }),
    },
  );
}
