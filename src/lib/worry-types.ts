/** 익명 고민 나눔 보드 관련 타입 */

/**
 * 보드 진행 단계.
 *
 * writing  고민 작성 중. 남이 쓴 고민은 아직 아무에게도 보이지 않는다.
 * replying 팀 배정 완료. 자기 팀에 배정된 고민에만 포스트잇 답변을 단다.
 * sharing  모든 고민과 답변을 함께 본다.
 * closed   마감. 읽기만 된다.
 */
export type WorryPhase = "writing" | "replying" | "sharing" | "closed";

/** 고민 분류. 활동 설명의 "개인 고민 1가지, 회사 고민 1가지" 에 맞춘다. */
export type WorryCategory = "개인" | "회사";

export const WORRY_CATEGORIES: WorryCategory[] = ["개인", "회사"];

/** worry_boards 시트 한 행 */
export type WorryBoard = {
  boardId: string;
  programId: string;
  title: string;
  description: string;
  phase: WorryPhase;
  teamCount: number;
  createdAt: string;
  updatedAt: string;
};

/** worries 시트 한 행. 작성자를 알 수 있는 값은 담지 않는다. */
export type Worry = {
  worryId: string;
  boardId: string;
  category: WorryCategory;
  content: string;
  /** 팀 배정 전에는 0 */
  teamNumber: number;
  /** 날짜만 저장한다. 이유는 worry-logs.ts 주석 참고 */
  createdOn: string;
};

/** worry_replies 시트 한 행. 역시 작성자를 담지 않는다. */
export type WorryReply = {
  replyId: string;
  worryId: string;
  content: string;
  createdOn: string;
};

/** 화면에 내려보내는 고민 한 건 */
export type WorryCard = Worry & {
  replies: WorryReply[];
};

/**
 * 화면에 내려보내는 보드 전체.
 *
 * 단계에 따라 서버에서 보여줄 것만 골라 담는다.
 * 감출 내용을 내려보낸 뒤 화면에서 가리지 않는다.
 */
export type WorryBoardView = {
  board: WorryBoard;
  /** 지금 단계에서 볼 수 있는 고민만 */
  worries: WorryCard[];
  /** 전체 작성 건수. 작성 단계에서 진행 상황을 보여주는 데 쓴다. */
  totalWorries: number;
  /** 분류별 작성 건수 */
  countByCategory: Record<WorryCategory, number>;
};

export type CreateBoardInput = {
  title: string;
  description: string;
};

export type CreateBoardErrors = Partial<Record<"title" | "description", string>>;

export type AddWorryInput = {
  category: WorryCategory;
  content: string;
};

export type AddWorryErrors = Partial<Record<"category" | "content", string>>;

export type AddReplyInput = {
  worryId: string;
  content: string;
};

export type AddReplyErrors = Partial<Record<"worryId" | "content", string>>;

/** 고민 글자 수 상한 */
export const WORRY_MAX_LENGTH = 500;
/** 포스트잇 답변 글자 수 상한 */
export const REPLY_MAX_LENGTH = 300;
