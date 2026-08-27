/** 결과보고서 관련 타입 */

export type ReportInput = {
  authorMemberId: string;
  topic: string;
  mainContent: string;
  activityArea: string;
  goalAchievement: string;
  benefits: string;
  regrets: string;
  futurePlans: string;
  impressions: string;
};

export type ReportFieldErrors = Partial<Record<keyof ReportInput, string>>;

export type ReportDetail = ReportInput & {
  reportId: string;
  authorName: string;
  createdAt: string;
};
