/** 익명 고민 항아리 관련 타입 */

/**
 * 보드 진행 단계.
 *
 * writing 고민을 항아리에 넣는 중. 남이 넣은 고민은 아무에게도 보이지 않는다.
 * drawing 진행자가 항아리에서 하나씩 뽑는다. 뽑힌 고민에만 답을 적는다.
 * sharing 항아리를 비우고 나온 고민과 답을 전부 함께 본다.
 * closed  마감. 읽기만 된다.
 */
export type WorryPhase = "writing" | "drawing" | "sharing" | "closed";

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
  createdAt: string;
  updatedAt: string;
};

/** worries 시트 한 행. 작성자를 알 수 있는 값은 담지 않는다. */
export type Worry = {
  worryId: string;
  boardId: string;
  category: WorryCategory;
  content: string;
  /**
   * 뽑힌 순서. 0 이면 아직 항아리 안에 있다.
   *
   * 뽑는 순서는 무작위라 작성 순서와 아무 관계가 없다. 그래서 이 값이
   * 누가 언제 썼는지를 알려 주지 않는다.
   */
  drawOrder: number;
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
  /** 지금 볼 수 있는 고민. 항아리에 남아 있는 것은 담지 않는다. */
  worries: WorryCard[];
  /** 방금 뽑혀 지금 이야기하고 있는 고민 */
  current: WorryCard | null;
  /** 항아리에 아직 남은 개수 */
  remaining: number;
  /** 전체 작성 건수 */
  totalWorries: number;
  /** 분류별 작성 건수 */
  countByCategory: Record<WorryCategory, number>;
};

/**
 * 폴링으로 주고받는 가벼운 상태.
 *
 * 진행자가 뽑으면 참여자 화면에도 같은 고민이 떠야 한다. 화면 전체를 다시
 * 받는 대신 바뀌는 값만 주고받아 시트 읽기를 줄인다.
 */
export type WorryPulse = {
  phase: WorryPhase;
  remaining: number;
  totalWorries: number;
  drawnCount: number;
  current: WorryCard | null;
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
