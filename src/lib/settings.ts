import "server-only";

import { cache } from "react";

import { parseNumber } from "./format";
import { readSheet } from "./repo";
import type { ProgramSettings, RecruitmentStatus } from "./types";

const DEFAULTS: ProgramSettings = {
  programId: "NEWBIE-2026-02",
  programName: "뉴비스쿨 2기 동문회",
  cohort: "2",
  organizationName: "중부재단",
  recruitmentStartAt: "",
  recruitmentEndAt: "",
  activityStartDate: "2026-08-01",
  activityEndDate: "2026-12-31",
  totalBudget: 1_000_000,
  minimumParticipants: 7,
  leaderName: "",
  viceLeaderName: "",
  contactEmail: "",
  teamChatUrl: "",
  teamChatName: "팀 채팅방",
  privacyRetentionPeriod: "동문회 활동 종료 후 3년",
  recruitmentNoticeUrl: "",
};

/**
 * settings 시트를 읽어 프로그램 설정을 만든다.
 *
 * 시트에 키가 없거나 값이 비어 있으면 기본값을 쓴다.
 * 기수·연도가 바뀌어도 코드를 고치지 않도록 화면 문구는 이 값을 참조한다. (PRD 3)
 *
 * cache 로 감싸 한 요청 안에서는 시트를 한 번만 읽는다.
 * 레이아웃과 페이지가 각각 호출해도 Sheets 호출은 1회다.
 */
export const getSettings = cache(loadSettings);

async function loadSettings(): Promise<ProgramSettings> {
  /*
   * 설정을 못 읽어도 기본값으로 화면을 띄운다.
   *
   * 이 값은 머리말·꼬리말이 쓰므로 모든 화면이 부른다. 여기서 예외가 나면
   * 시트와 상관없는 화면까지 전부 막힌다. 기수·연락처가 잠깐 기본값으로
   * 나오는 편이 사이트 전체가 안 열리는 것보다 낫다.
   */
  let rows;
  try {
    rows = await readSheet("settings");
  } catch (error) {
    console.error("[settings] 설정을 읽지 못해 기본값을 사용합니다:", error);
    return { ...DEFAULTS };
  }

  const map = new Map<string, string>();
  for (const row of rows) {
    const key = row.key?.trim();
    if (key) {
      map.set(key, row.value?.trim() ?? "");
    }
  }

  const text = (key: string, fallback: string) => map.get(key) || fallback;
  const num = (key: string, fallback: number) => {
    const raw = map.get(key);
    return raw ? parseNumber(raw, fallback) : fallback;
  };

  return {
    programId: text("program_id", DEFAULTS.programId),
    programName: text("program_name", DEFAULTS.programName),
    cohort: text("cohort", DEFAULTS.cohort),
    organizationName: text("organization_name", DEFAULTS.organizationName),
    recruitmentStartAt: text("recruitment_start_at", DEFAULTS.recruitmentStartAt),
    recruitmentEndAt: text("recruitment_end_at", DEFAULTS.recruitmentEndAt),
    activityStartDate: text("activity_start_date", DEFAULTS.activityStartDate),
    activityEndDate: text("activity_end_date", DEFAULTS.activityEndDate),
    totalBudget: num("total_budget", DEFAULTS.totalBudget),
    minimumParticipants: num("minimum_participants", DEFAULTS.minimumParticipants),
    leaderName: text("contact_leader_name", DEFAULTS.leaderName),
    viceLeaderName: text("contact_vice_leader_name", DEFAULTS.viceLeaderName),
    contactEmail: text("contact_email", DEFAULTS.contactEmail),
    teamChatUrl: text("team_chat_url", DEFAULTS.teamChatUrl),
    teamChatName: text("team_chat_name", DEFAULTS.teamChatName),
    privacyRetentionPeriod: text("privacy_retention_period", DEFAULTS.privacyRetentionPeriod),
    recruitmentNoticeUrl: text("recruitment_notice_url", DEFAULTS.recruitmentNoticeUrl),
  };
}

/**
 * 모집 기간과 현재 시각을 비교해 모집 상태를 판정한다. (REC-02)
 *
 * 모집 기간이 설정되지 않은 경우에는 신청을 받지 않는다.
 * 운영자가 기간을 넣기 전에 폼이 열려버리는 상황을 막는다.
 */
export function getRecruitmentStatus(
  settings: ProgramSettings,
  now: Date = new Date(),
): RecruitmentStatus {
  const start = parseInstant(settings.recruitmentStartAt);
  const end = parseInstant(settings.recruitmentEndAt);

  if (!start || !end) {
    return { phase: "before", label: "모집 준비 중", acceptingApplications: false };
  }

  if (now < start) {
    return { phase: "before", label: "모집 예정", acceptingApplications: false };
  }

  if (now > end) {
    return { phase: "closed", label: "모집 마감", acceptingApplications: false };
  }

  return { phase: "open", label: "모집 중", acceptingApplications: true };
}

function parseInstant(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
