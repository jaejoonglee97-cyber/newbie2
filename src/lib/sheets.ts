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

/**
 * 한도에 걸렸을 때 기다리는 시간. 뒤로 갈수록 길게 기다린다.
 *
 * Google Sheets 는 서비스 계정 하나당 분당 읽기 60회, 쓰기 60회까지만
 * 받는다. 넘으면 429 를 주는데, 잠시 뒤 다시 보내면 대개 통과한다.
 * 그대로 실패로 돌려주면 활동일지를 저장하다 중간에 멈춘다.
 */
const RETRY_DELAYS_MS = [1000, 2500, 5000];

async function authorizedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  const { spreadsheetId } = getSheetsCredentials();

  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(`${API_BASE}/${spreadsheetId}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      cache: "no-store",
    });

    if (response.ok) {
      return response;
    }

    /*
     * 429(한도 초과)와 503(일시 장애)만 다시 보낸다. 둘 다 요청을 처리하지
     * 않았다는 뜻이라 다시 보내도 같은 줄이 두 번 쓰이지 않는다.
     * 500 은 처리됐는지 알 수 없으므로 다시 보내지 않는다.
     */
    const retryable = response.status === 429 || response.status === 503;
    const delay = RETRY_DELAYS_MS[attempt];

    if (retryable && delay !== undefined) {
      await response.text().catch(() => "");
      console.warn(`[sheets] ${response.status} 응답. ${delay}ms 뒤 다시 시도합니다. (${path})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    const body = await response.text();
    throw new SheetsApiError(response.status, body.slice(0, 500), path);
  }
}

export class SheetsApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    readonly path: string,
  ) {
    super(`Sheets API 오류 ${status}: ${body}`);
    this.name = "SheetsApiError";
  }

  /**
   * 스프레드시트에 그 이름의 시트가 아직 없을 때인지.
   *
   * Sheets API 는 없는 시트를 읽으면 400 과 "Unable to parse range" 를 준다.
   * 권한이나 네트워크 문제와 구분해야 한다.
   */
  get isMissingSheet(): boolean {
    return this.status === 400 && /Unable to parse range/i.test(this.body);
  }
}

/**
 * 시트 전체를 2차원 배열로 읽는다. 첫 행은 헤더다.
 *
 * 아직 만들지 않은 시트를 읽으면 빈 배열을 돌려준다.
 *
 * 기능을 새로 붙이면 시트가 한 개씩 늘어나는데, setupAll 을 다시 돌리기 전까지는
 * 그 시트가 없다. 이때 예외를 그대로 올리면 그 시트와 상관없는 화면까지 통째로
 * 500 이 된다. 없는 시트는 "아직 자료가 없음" 으로 다루고, 권한·네트워크 같은
 * 진짜 오류만 올린다.
 */
async function readRawRows(sheetName: string): Promise<string[][]> {
  const range = encodeURIComponent(`${sheetName}!A1:ZZ`);

  try {
    const response = await authorizedFetch(
      `/values/${range}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`,
    );
    const data = (await response.json()) as { values?: string[][] };
    return data.values ?? [];
  } catch (error) {
    if (error instanceof SheetsApiError && error.isMissingSheet) {
      console.warn(
        `[sheets] ${sheetName} 시트가 없습니다. setup/sheets-setup.gs 의 setupAll 을 실행하세요.`,
      );
      return [];
    }
    throw error;
  }
}

/**
 * 저장하려는 시트가 아직 만들어지지 않았을 때.
 *
 * 운영자에게는 무엇을 해야 하는지 그대로 보여 줘야 하는 오류라 따로 구분한다.
 */
export class SetupRequiredError extends Error {
  constructor(readonly sheetName: string) {
    super(
      `${sheetName} 시트가 아직 없습니다. 스프레드시트에서 확장 프로그램 > Apps Script 를 열어 setupAll 을 한 번 실행해 주세요.`,
    );
    this.name = "SetupRequiredError";
  }
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

/**
 * 시트의 헤더 순서를 그대로 읽는다. append 시 컬럼 정렬에 사용한다.
 *
 * 읽기와 달리 쓰기는 조용히 넘어가면 안 된다. 시트가 없으면 무엇을 해야 하는지
 * 알려 주는 문구로 바꿔 올린다.
 */
export async function readHeaders(sheetName: string): Promise<string[]> {
  const range = encodeURIComponent(`${sheetName}!A1:ZZ1`);

  try {
    const response = await authorizedFetch(`/values/${range}?majorDimension=ROWS`);
    const data = (await response.json()) as { values?: string[][] };
    return (data.values?.[0] ?? []).map((h) => String(h ?? "").trim());
  } catch (error) {
    if (error instanceof SheetsApiError && error.isMissingSheet) {
      throw new SetupRequiredError(sheetName);
    }
    throw error;
  }
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

/**
 * 여러 줄을 한 번에 추가한다.
 *
 * 한 줄씩 appendRow 를 부르면 줄마다 헤더 읽기 1회와 쓰기 1회가 든다.
 * 참여자 22명이면 그것만 44회라 분당 한도(읽기·쓰기 각 60회)에 금방 닿는다.
 * 여기서는 몇 줄이든 헤더 읽기 1회, 쓰기 1회로 끝난다. 한 번에 들어가므로
 * 일부만 들어가는 일도 없다.
 */
export async function appendRows(sheetName: string, rows: SheetRow[]): Promise<void> {
  if (rows.length === 0) return;

  const headers = await readHeaders(sheetName);

  if (headers.length === 0) {
    throw new Error(`${sheetName} 시트에 헤더가 없습니다. setup/sheets-setup.gs 를 먼저 실행하세요.`);
  }

  const unknown = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter(
    (key) => !headers.includes(key),
  );
  if (unknown.length > 0) {
    throw new Error(`${sheetName} 시트에 없는 컬럼입니다: ${unknown.join(", ")}`);
  }

  const values = rows.map((row) => headers.map((header) => row[header] ?? ""));
  const range = encodeURIComponent(`${sheetName}!A1`);

  await authorizedFetch(
    `/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ values }),
    },
  );
}

/**
 * 조건에 맞는 행을 찾는다.
 *
 * match 의 모든 컬럼이 일치하는 행만 고른다. 돌려주는 값은 시트의 실제 행 번호
 * (1부터, 헤더가 1행)와 그 행의 값이다.
 */
async function findRows(
  sheetName: string,
  match: SheetRow,
): Promise<{ headers: string[]; rows: { rowNumber: number; values: string[] }[] }> {
  const raw = await readRawRows(sheetName);

  if (raw.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = raw[0].map((header) => String(header ?? "").trim());

  const unknown = Object.keys(match).filter((key) => !headers.includes(key));
  if (unknown.length > 0) {
    throw new Error(`${sheetName} 시트에 없는 컬럼입니다: ${unknown.join(", ")}`);
  }

  const conditions = Object.entries(match).map(([column, value]) => ({
    index: headers.indexOf(column),
    value,
  }));

  const rows: { rowNumber: number; values: string[] }[] = [];

  for (let i = 1; i < raw.length; i += 1) {
    const values = raw[i] ?? [];
    const matched = conditions.every(
      (condition) => String(values[condition.index] ?? "").trim() === condition.value,
    );

    if (matched) {
      // raw 의 0번이 1행(헤더)이므로 행 번호는 인덱스 + 1 이다.
      rows.push({ rowNumber: i + 1, values });
    }
  }

  return { headers, rows };
}

/** 시트 이름 → sheetId(gid). 행 삭제 API 는 이름이 아니라 gid 를 받는다. */
let cachedSheetIds: Map<string, number> | null = null;

/**
 * 스프레드시트에 실제로 있는 시트 이름 목록.
 *
 * "시트가 없어서 비어 있다"와 "시트는 있는데 자료가 없다"를 구분하려면
 * 필요하다. 진단 화면에서 쓴다.
 */
export async function listSheetTitles(): Promise<string[]> {
  const response = await authorizedFetch("?fields=sheets.properties(sheetId,title)");
  const data = (await response.json()) as {
    sheets?: { properties?: { title?: string } }[];
  };

  return (data.sheets ?? []).flatMap((sheet) => {
    const title = sheet.properties?.title;
    return title ? [title] : [];
  });
}

async function getSheetId(sheetName: string): Promise<number> {
  if (!cachedSheetIds?.has(sheetName)) {
    const response = await authorizedFetch("?fields=sheets.properties(sheetId,title)");
    const data = (await response.json()) as {
      sheets?: { properties?: { sheetId?: number; title?: string } }[];
    };

    cachedSheetIds = new Map(
      (data.sheets ?? []).flatMap((sheet) => {
        const { sheetId, title } = sheet.properties ?? {};
        return typeof sheetId === "number" && title ? [[title, sheetId] as const] : [];
      }),
    );
  }

  const sheetId = cachedSheetIds.get(sheetName);
  if (sheetId === undefined) {
    throw new Error(`${sheetName} 시트를 찾지 못했습니다.`);
  }

  return sheetId;
}

/**
 * 조건에 맞는 행의 일부 컬럼만 고쳐 쓴다. 고친 행 수를 돌려준다.
 *
 * patch 에 없는 컬럼은 기존 값을 그대로 유지한다. 행 전체를 다시 쓰기 때문에
 * 시트에서 컬럼 순서를 바꿔도 엉뚱한 칸에 쓰이지 않는다.
 */
export async function patchRowsWhere(
  sheetName: string,
  match: SheetRow,
  patch: SheetRow,
): Promise<number> {
  const { headers, rows } = await findRows(sheetName, match);

  if (rows.length === 0) {
    return 0;
  }

  const unknown = Object.keys(patch).filter((key) => !headers.includes(key));
  if (unknown.length > 0) {
    throw new Error(`${sheetName} 시트에 없는 컬럼입니다: ${unknown.join(", ")}`);
  }

  const lastColumn = columnLetter(headers.length - 1);

  const data = rows.map((row) => ({
    range: `${sheetName}!A${row.rowNumber}:${lastColumn}${row.rowNumber}`,
    values: [
      headers.map((header, index) =>
        header in patch ? patch[header] : (row.values[index] ?? ""),
      ),
    ],
  }));

  await authorizedFetch("/values:batchUpdate", {
    method: "POST",
    body: JSON.stringify({ valueInputOption: "RAW", data }),
  });

  return rows.length;
}

/**
 * 조건에 맞는 행을 실제로 지운다. 지운 행 수를 돌려준다.
 *
 * 아래쪽 행부터 지운다. 위에서부터 지우면 행이 밀려 올라가 뒤에 지울 행의
 * 번호가 어긋난다.
 */
export async function deleteRowsWhere(sheetName: string, match: SheetRow): Promise<number> {
  const { rows } = await findRows(sheetName, match);

  if (rows.length === 0) {
    return 0;
  }

  const sheetId = await getSheetId(sheetName);
  const rowNumbers = rows.map((row) => row.rowNumber).sort((a, b) => b - a);

  await authorizedFetch(":batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      requests: rowNumbers.map((rowNumber) => ({
        deleteDimension: {
          range: {
            sheetId,
            dimension: "ROWS",
            // API 는 0부터 세므로 행 번호에서 1을 뺀다.
            startIndex: rowNumber - 1,
            endIndex: rowNumber,
          },
        },
      })),
    }),
  });

  return rows.length;
}

/**
 * column 값이 values 중 하나인 행을 한 번에 지운다. 지운 행 수를 돌려준다.
 *
 * also 를 주면 그 조건까지 맞는 행만 지운다. 다른 활동에 같은 ID 가 있어도
 * 엉뚱한 행을 지우지 않게 activity_id 를 함께 거는 데 쓴다.
 *
 * deleteRowsWhere 를 값마다 부르면 값마다 읽기·쓰기가 한 번씩 든다.
 * 여기서는 읽기 1회, 쓰기 1회다.
 */
export async function deleteRowsWhereIn(
  sheetName: string,
  column: string,
  values: string[],
  also: SheetRow = {},
): Promise<number> {
  if (values.length === 0) return 0;

  const { headers, rows } = await findRows(sheetName, also);
  if (rows.length === 0) return 0;

  const index = headers.indexOf(column);
  if (index < 0) {
    throw new Error(`${sheetName} 시트에 없는 컬럼입니다: ${column}`);
  }

  const wanted = new Set(values);
  const rowNumbers = rows
    .filter((row) => wanted.has(String(row.values[index] ?? "").trim()))
    .map((row) => row.rowNumber)
    // 아래쪽부터 지워야 위 행의 번호가 밀리지 않는다.
    .sort((a, b) => b - a);

  if (rowNumbers.length === 0) return 0;

  const sheetId = await getSheetId(sheetName);

  await authorizedFetch(":batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      requests: rowNumbers.map((rowNumber) => ({
        deleteDimension: {
          range: {
            sheetId,
            dimension: "ROWS",
            startIndex: rowNumber - 1,
            endIndex: rowNumber,
          },
        },
      })),
    }),
  });

  return rowNumbers.length;
}

/** 0 → A, 25 → Z, 26 → AA */
function columnLetter(index: number): string {
  let remaining = index + 1;
  let letter = "";

  while (remaining > 0) {
    const digit = (remaining - 1) % 26;
    letter = String.fromCharCode(65 + digit) + letter;
    remaining = Math.floor((remaining - 1) / 26);
  }

  return letter;
}
