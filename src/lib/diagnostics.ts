import "server-only";

import { getDataSource, getUploadConfig } from "./config";
import { isMockMode, readSheet } from "./repo";
import { listSheetTitles } from "./sheets";

/**
 * 운영 점검용 진단.
 *
 * 화면이 안 열릴 때 오류 번호만 들고 원인을 추측하지 않기 위해 만들었다.
 * 어느 시트가 없고 어느 환경변수가 비었는지 한 화면에서 본다.
 * 운영자만 열 수 있고, 시트의 내용은 읽지 않고 읽히는지 여부와 행 수만 본다.
 */

/** 이 사이트가 쓰는 시트 전체. setup/sheets-setup.gs 의 목록과 맞춰 둔다. */
export const REQUIRED_SHEETS = [
  "settings",
  "applicants",
  "members",
  "activities",
  "activity_participants",
  "budget_items",
  "activity_logs",
  "photos",
  "audit_logs",
  "reports",
  "polls",
  "poll_options",
  "poll_votes",
  "worry_boards",
  "worries",
  "worry_replies",
  "feedback",
] as const;

export type SheetCheck = {
  name: string;
  /** 스프레드시트에 그 시트가 있는지 */
  exists: boolean;
  /** 읽기 자체가 되는지 */
  readable: boolean;
  /** 헤더를 뺀 자료 행 수 */
  rowCount: number;
  note: string;
};

export type Diagnostics = {
  dataSource: string;
  /** 시트 목록 자체를 못 읽었을 때의 사유. 없으면 빈 문자열 */
  spreadsheetError: string;
  env: { name: string; present: boolean; required: boolean }[];
  sheets: SheetCheck[];
  checkedAt: string;
};

export async function runDiagnostics(): Promise<Diagnostics> {
  let titles: Set<string> | null = null;
  let spreadsheetError = "";

  if (!isMockMode()) {
    try {
      titles = new Set(await listSheetTitles());
    } catch (error) {
      spreadsheetError =
        error instanceof Error ? error.message.slice(0, 300) : "스프레드시트를 열지 못했습니다.";
    }
  }

  const sheets = await Promise.all(REQUIRED_SHEETS.map((name) => checkSheet(name, titles)));

  return {
    dataSource: getDataSource(),
    spreadsheetError,
    env: [
      envRow("GOOGLE_SERVICE_ACCOUNT_EMAIL", true),
      envRow("GOOGLE_PRIVATE_KEY", true),
      envRow("SHEETS_SPREADSHEET_ID", true),
      envRow("SESSION_SECRET", true),
      envRow("ALUMNI_PASSWORD", true),
      envRow("ADMIN_PASSWORD", true),
      { name: "APPS_SCRIPT_UPLOAD_URL", present: getUploadConfig() !== null, required: false },
      { name: "APPS_SCRIPT_UPLOAD_SECRET", present: getUploadConfig() !== null, required: false },
    ],
    sheets,
    checkedAt: new Date().toISOString(),
  };
}

async function checkSheet(name: string, titles: Set<string> | null): Promise<SheetCheck> {
  const exists = titles === null ? true : titles.has(name);

  if (!exists) {
    return {
      name,
      exists: false,
      readable: false,
      rowCount: 0,
      note: "시트가 없습니다. Apps Script 의 setupAll 을 실행하세요.",
    };
  }

  try {
    const rows = await readSheet(name);
    return { name, exists: true, readable: true, rowCount: rows.length, note: "" };
  } catch (error) {
    return {
      name,
      exists: true,
      readable: false,
      rowCount: 0,
      note: error instanceof Error ? error.message.slice(0, 200) : "알 수 없는 오류",
    };
  }
}

function envRow(name: string, required: boolean) {
  return { name, present: Boolean(process.env[name]?.trim()), required };
}
