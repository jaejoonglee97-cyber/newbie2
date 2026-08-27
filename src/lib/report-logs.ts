import "server-only";

import { nowKstIso } from "./format";
import { appendRow, readSheet } from "./repo";
import { getSettings } from "./settings";
import type { ReportDetail, ReportFieldErrors, ReportInput } from "./report-types";

export type ReportValidationResult =
  | { ok: true; value: ReportInput }
  | { ok: false; errors: ReportFieldErrors };

export async function validateReport(raw: unknown): Promise<ReportValidationResult> {
  const input = (raw ?? {}) as Record<string, unknown>;
  const errors: ReportFieldErrors = {};

  const authorMemberId = str(input.authorMemberId);
  if (!authorMemberId) errors.authorMemberId = "작성자를 선택해 주세요.";

  const topic = str(input.topic);
  if (topic.length < 2) errors.topic = "모임 주제를 입력해 주세요.";

  const mainContent = str(input.mainContent);
  if (mainContent.length < 5) errors.mainContent = "주요 내용을 입력해 주세요.";

  const activityArea = str(input.activityArea);
  if (activityArea.length < 2) errors.activityArea = "활동 지역을 입력해 주세요.";

  const goalAchievement = str(input.goalAchievement);
  if (goalAchievement.length < 5) errors.goalAchievement = "목표 대비 달성정도를 입력해 주세요.";

  const benefits = str(input.benefits);
  if (benefits.length < 5) errors.benefits = "유익했던 점을 입력해 주세요.";

  const regrets = str(input.regrets);
  if (regrets.length < 5) errors.regrets = "아쉬웠던 점 및 개선방안을 입력해 주세요.";

  const futurePlans = str(input.futurePlans);
  if (futurePlans.length < 5) errors.futurePlans = "추후 계획을 입력해 주세요.";

  const impressions = str(input.impressions);
  if (impressions.length < 5) errors.impressions = "소감을 입력해 주세요.";

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      authorMemberId,
      topic,
      mainContent,
      activityArea,
      goalAchievement,
      benefits,
      regrets,
      futurePlans,
      impressions,
    },
  };
}

export async function saveReport(input: ReportInput): Promise<{ reportId: string }> {
  const settings = await getSettings();
  const now = nowKstIso();
  const existing = await readSheet("reports");

  const reportId = `REP-${settings.programId}-${String(existing.length + 1).padStart(2, "0")}`;

  await appendRow("reports", {
    report_id: reportId,
    program_id: settings.programId,
    author_member_id: input.authorMemberId,
    topic: input.topic,
    main_content: input.mainContent,
    activity_area: input.activityArea,
    goal_achievement: input.goalAchievement,
    benefits: input.benefits,
    regrets: input.regrets,
    future_plans: input.futurePlans,
    impressions: input.impressions,
    created_at: now,
    updated_at: now,
  });

  const auditSeed = (await readSheet("audit_logs")).length;
  await appendRow("audit_logs", {
    audit_id: `AUD-${String(auditSeed + 1).padStart(6, "0")}`,
    actor_member_id: input.authorMemberId,
    entity_type: "report",
    entity_id: reportId,
    action: "created",
    before_value: "",
    after_value: "생성",
    note: "결과보고서 등록",
    created_at: now,
  });

  return { reportId };
}

export async function getReportDetail(reportId: string): Promise<ReportDetail | null> {
  const [reports, members] = await Promise.all([
    readSheet("reports"),
    readSheet("applicants"),
  ]);

  const report = reports.find((row) => row.report_id === reportId);
  if (!report) return null;

  const author = members.find((row) => row.application_id === report.author_member_id);

  return {
    reportId,
    authorMemberId: report.author_member_id ?? "",
    authorName: author?.name ?? "",
    topic: report.topic ?? "",
    mainContent: report.main_content ?? "",
    activityArea: report.activity_area ?? "",
    goalAchievement: report.goal_achievement ?? "",
    benefits: report.benefits ?? "",
    regrets: report.regrets ?? "",
    futurePlans: report.future_plans ?? "",
    impressions: report.impressions ?? "",
    createdAt: report.created_at ?? "",
  };
}

export async function getLatestReportId(): Promise<string | null> {
  const reports = await readSheet("reports");
  if (reports.length === 0) return null;
  return reports[reports.length - 1].report_id ?? null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
