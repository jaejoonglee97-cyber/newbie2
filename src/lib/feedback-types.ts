/** 회차별 만족도 조사 관련 타입 */

/** 만족도 5점 척도 */
export type SatisfactionScore = 1 | 2 | 3 | 4 | 5;

export const SATISFACTION_SCORES: SatisfactionScore[] = [1, 2, 3, 4, 5];

/** 점수마다 붙는 말. 숫자만 두면 무엇이 좋은 쪽인지 헷갈린다. */
export const SCORE_LABELS: Record<SatisfactionScore, string> = {
  1: "아쉬웠어요",
  2: "그저 그랬어요",
  3: "괜찮았어요",
  4: "좋았어요",
  5: "아주 좋았어요",
};

/**
 * feedback 시트 한 행.
 *
 * 작성자를 알 수 있는 값은 담지 않는다. 만족도 조사에 이름을 붙이면
 * 아쉬웠던 점을 솔직히 쓰기 어렵다.
 */
export type Feedback = {
  feedbackId: string;
  programId: string;
  sessionNumber: number;
  score: SatisfactionScore;
  bestPart: string;
  nextWish: string;
  /** 날짜만 저장한다. 분·초가 있으면 누가 언제 냈는지 짐작할 수 있다. */
  createdOn: string;
};

/** 한 회차의 집계 */
export type SessionFeedback = {
  sessionNumber: number;
  /** 활동 기록에 있는 회차면 그 주제를 함께 보여준다. */
  topic: string;
  count: number;
  /** 응답이 없으면 0 */
  averageScore: number;
  /** 점수별 응답 수 */
  scoreCounts: Record<SatisfactionScore, number>;
  bestParts: string[];
  nextWishes: string[];
};

/** 화면에 내려보내는 전체 */
export type FeedbackView = {
  /** 고를 수 있는 회차. 계획된 회기 + 활동 기록이 있는 회차 + 이미 응답이 있는 회차 */
  sessions: Array<{ sessionNumber: number; topic: string }>;
  /** 폼에서 미리 골라 둘 회차. 방금 끝났을 가능성이 가장 큰 회차다. */
  suggestedSessionNumber: number;
  /** 집계. 운영자에게만 내려보낸다. */
  summaries: SessionFeedback[];
  totalCount: number;
};

export type FeedbackInput = {
  sessionNumber: number;
  score: SatisfactionScore;
  bestPart: string;
  nextWish: string;
};

export type FeedbackErrors = Partial<
  Record<"sessionNumber" | "score" | "bestPart" | "nextWish", string>
>;

export const BEST_PART_MAX_LENGTH = 300;
export const NEXT_WISH_MAX_LENGTH = 300;
