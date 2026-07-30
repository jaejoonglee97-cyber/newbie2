import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { SheetRow } from "./sheets";

/**
 * 서비스 계정 설정 전에 화면과 접수 흐름을 검증하기 위한 가상 저장소.
 *
 * readSheet / appendRow 와 같은 형태를 제공하므로 repo 계층 코드는
 * mock 과 sheets 를 구분하지 않는다.
 *
 * 파일로 저장하는 이유
 *   Next.js 개발 서버는 Route Handler(app-route)와 서버 컴포넌트(app-page)를
 *   서로 다른 컴파일 레이어로 번들링한다. 같은 Node 프로세스 안에서 실행되어도
 *   모듈 최상단의 배열 같은 인메모리 상태는 레이어마다 따로 생성되어 공유되지
 *   않는다. 그 결과 /api/applications 로 접수해도 /cards, /admin 페이지에는
 *   보이지 않는 문제가 있었다. OS 임시 폴더의 파일로 상태를 옮겨 이 문제를 없앤다.
 *
 * 여전히 검증 전용이다. 서버를 배포할 때마다(=새 컨테이너) 초기화되고,
 * 여러 서버리스 인스턴스 사이에서 공유되지 않는다. 실제 운영에는 Sheets 모드를 쓴다.
 * 여기 들어 있는 값은 전부 가상 인물이며 실제 개인정보가 아니다.
 */

const STORE_PATH = join(tmpdir(), "newbie-alumni-mock-store.json");

type Store = Record<string, SheetRow[]>;

function seedStore(): Store {
  const settings: SheetRow[] = [
    row("program_id", "NEWBIE-2026-02", "text"),
    row("program_name", "뉴비스쿨 2기 동문회", "text"),
    row("cohort", "2", "number"),
    row("organization_name", "중부재단", "text"),
    row("recruitment_start_at", "2026-07-30T09:00:00+09:00", "datetime"),
    row("recruitment_end_at", "2026-08-04T18:00:00+09:00", "datetime"),
    row("activity_start_date", "2026-08-01", "date"),
    row("activity_end_date", "2026-12-31", "date"),
    row("total_budget", "1000000", "number"),
    row("minimum_participants", "7", "number"),
    row("contact_leader_name", "서울특별시사회복지사협회 이재중", "text"),
    row("contact_vice_leader_name", "방화11종합사회복지관 맹예림", "text"),
    row("contact_email", "client_first@sasw.or.kr", "text"),
    row("team_chat_url", "https://example.invalid/chat", "url"),
    row("team_chat_name", "카카오톡 오픈채팅", "text"),
    row("privacy_retention_period", "동문회 활동 종료 후 3년", "text"),
    row("recruitment_notice_url", "", "url"),
    row("card_folder_id", "1o2wNpl_fKi2OxQLnYP0SkTbE2ytRZu5s", "text"),
  ];

  const applicants: SheetRow[] = [
    applicant("APP-20260730-0001", "가나다", "테스트종합사회복지관", "사회복지사", "0001", true),
    applicant("APP-20260730-0002", "라마바", "샘플노인복지관", "선임사회복지사", "0002", true),
    applicant("APP-20260730-0003", "사아자", "예시장애인복지관", "사례관리자", "0003", false),
  ];

  return {
    settings,
    applicants,
    members: [],
    activities: [],
    activity_participants: [],
    budget_items: [],
    activity_logs: [],
    photos: [],
    audit_logs: [],
  };
}

function row(key: string, value: string, valueType: string): SheetRow {
  return {
    key,
    value,
    value_type: valueType,
    description: "",
    updated_at: "2026-07-30T09:00:00+09:00",
  };
}

function applicant(
  applicationId: string,
  name: string,
  organization: string,
  position: string,
  phoneSuffix: string,
  withCard: boolean,
): SheetRow {
  const now = "2026-07-30T10:00:00+09:00";

  return {
    application_id: applicationId,
    program_id: "NEWBIE-2026-02",
    applied_at: now,
    name,
    organization,
    position,
    phone: `010-0000-${phoneSuffix}`,
    attendance_intent: "참석희망",
    privacy_consent: "TRUE",
    privacy_consent_at: now,
    card_share_consent: withCard ? "TRUE" : "FALSE",
    business_card_file_id: withCard ? `mock-${applicationId}` : "",
    business_card_url: "",
    application_status: "검토중",
    admin_note: "더미 데이터",
    updated_at: now,
  };
}

function load(): Store {
  if (!existsSync(STORE_PATH)) {
    const initial = seedStore();
    save(initial);
    return initial;
  }

  try {
    const raw = readFileSync(STORE_PATH, "utf-8");
    return JSON.parse(raw) as Store;
  } catch (error) {
    console.error("[mock-store] 저장 파일을 읽지 못해 초기값으로 되돌립니다.", error);
    const initial = seedStore();
    save(initial);
    return initial;
  }
}

function save(store: Store): void {
  mkdirSync(tmpdir(), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(store), "utf-8");
}

export async function readSheet(sheetName: string): Promise<SheetRow[]> {
  const store = load();
  const table = store[sheetName];
  if (!table) {
    throw new Error(`mock 저장소에 없는 시트입니다: ${sheetName}`);
  }
  return table;
}

export async function appendRow(sheetName: string, values: SheetRow): Promise<void> {
  const store = load();
  const table = store[sheetName];
  if (!table) {
    throw new Error(`mock 저장소에 없는 시트입니다: ${sheetName}`);
  }
  table.push({ ...values });
  save(store);
}

/** 검증 중 초기 상태로 되돌리고 싶을 때 사용한다. 코드에서는 호출하지 않는다. */
export function resetMockStore(): void {
  save(seedStore());
}
