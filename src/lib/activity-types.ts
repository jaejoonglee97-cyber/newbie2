/** 활동 신청과 활동일지 관련 타입 */

export type ActivityStatus =
  | "임시저장"
  | "승인대기"
  | "반려"
  | "승인"
  | "활동예정"
  | "기록필요"
  | "기록검토중"
  | "완료"
  | "취소";

export type AttendanceStatus = "" | "참석" | "지각" | "조퇴" | "불참";

export const BUDGET_CATEGORIES = [
  "식비",
  "도서비",
  "강사비",
  "대관비",
  "교통비",
  "재료비",
  "기타",
] as const;

export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

/** 활동일지 작성 폼이 서버로 보내는 참여자 한 명 */
export type ParticipantInput = {
  memberId: string;
  /** 이 활동에 참여 예정이었는지 */
  planned: boolean;
  attendanceStatus: AttendanceStatus;
  absenceNote: string;
};

/** 예산 사용 내역 한 줄 */
export type BudgetItemInput = {
  category: BudgetCategory;
  itemName: string;
  calculationBasis: string;
  amount: number;
};

/** 활동 사진 한 장 */
export type PhotoInput = {
  mimeType: string;
  dataBase64: string;
  caption: string;
  isCover: boolean;
};

/** 활동일지 작성 폼 전체 */
export type ActivityLogInput = {
  sessionNumber: number;
  authorMemberId: string;
  topic: string;
  objective: string;
  expectedEffect: string;
  activityDate: string;
  startTime: string;
  endTime: string;
  location: string;
  content: string;
  evaluation: string;
  participants: ParticipantInput[];
  budgetItems: BudgetItemInput[];
};

export type ActivityLogFieldErrors = Partial<
  Record<
    | keyof Omit<ActivityLogInput, "participants" | "budgetItems">
    | "participants"
    | "budgetItems"
    | "photos",
    string
  >
>;

/** 목록 화면에 표시할 활동 요약 */
export type ActivitySummary = {
  activityId: string;
  sessionNumber: number;
  topic: string;
  activityDate: string;
  startTime: string;
  endTime: string;
  location: string;
  status: ActivityStatus;
  authorName: string;
  attendedCount: number;
  plannedCount: number;
  actualAmount: number;
  photoCount: number;
};

/** 인쇄 화면이 필요한 모든 값 */
export type ActivityDetail = {
  activityId: string;
  sessionNumber: number;
  topic: string;
  objective: string;
  expectedEffect: string;
  activityDate: string;
  startTime: string;
  endTime: string;
  location: string;
  status: ActivityStatus;
  authorName: string;
  content: string;
  evaluation: string;
  participants: Array<{
    name: string;
    organization: string;
    position: string;
    attendanceStatus: AttendanceStatus;
    absenceNote: string;
  }>;
  budgetItems: Array<{
    category: string;
    itemName: string;
    calculationBasis: string;
    amount: number;
  }>;
  actualTotal: number;
  photos: Array<{
    photoId: string;
    imagePath: string;
    caption: string;
    isCover: boolean;
  }>;
};

/** 활동일지 작성 화면에서 고를 수 있는 참여자 */
export type MemberOption = {
  memberId: string;
  name: string;
  organization: string;
  position: string;
};
