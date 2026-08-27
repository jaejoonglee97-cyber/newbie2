import "server-only";

import { getDataSource } from "./config";
import * as mock from "./mock-store";
import * as sheets from "./sheets";
import type { SheetRow } from "./sheets";

/**
 * 데이터 접근 단일 창구.
 *
 * 실제 시트와 가상 저장소를 여기서만 갈아끼운다.
 * 상위 코드(페이지, API)는 어느 쪽인지 알 필요가 없다.
 */

export function isMockMode(): boolean {
  return getDataSource() === "mock";
}

export async function readSheet(sheetName: string): Promise<SheetRow[]> {
  return isMockMode() ? mock.readSheet(sheetName) : sheets.readSheet(sheetName);
}

export async function appendRow(sheetName: string, values: SheetRow): Promise<void> {
  return isMockMode() ? mock.appendRow(sheetName, values) : sheets.appendRow(sheetName, values);
}

/**
 * 조건에 맞는 행의 일부 컬럼만 고친다. 고친 행 수를 돌려준다.
 * match 의 모든 컬럼이 일치하는 행만 대상이다.
 */
export async function patchRowsWhere(
  sheetName: string,
  match: SheetRow,
  patch: SheetRow,
): Promise<number> {
  return isMockMode()
    ? mock.patchRowsWhere(sheetName, match, patch)
    : sheets.patchRowsWhere(sheetName, match, patch);
}

/** 조건에 맞는 행을 지운다. 지운 행 수를 돌려준다. */
export async function deleteRowsWhere(sheetName: string, match: SheetRow): Promise<number> {
  return isMockMode()
    ? mock.deleteRowsWhere(sheetName, match)
    : sheets.deleteRowsWhere(sheetName, match);
}

export type { SheetRow };
