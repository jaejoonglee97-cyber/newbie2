/** 날짜투표 / 참석투표 관련 타입 */

export type PollType = "date" | "attendance";
export type PollStatus = "open" | "closed" | "confirmed";
export type AttendanceChoice = "attend" | "absent" | "undecided";

/** polls 시트 한 행 */
export type Poll = {
  pollId: string;
  programId: string;
  pollType: PollType;
  title: string;
  description: string;
  status: PollStatus;
  /** 날짜투표 확정 후 선택된 최종 날짜 (YYYY-MM-DD) */
  confirmedDate: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

/** poll_options 시트 한 행 (날짜투표 후보) */
export type PollOption = {
  optionId: string;
  pollId: string;
  /** YYYY-MM-DD */
  optionDate: string;
  /** 표시용 레이블 (예: "10월 5일 (일) 14:00~17:00") */
  optionLabel: string;
  sortOrder: number;
};

/** poll_votes 시트 한 행 */
export type PollVote = {
  voteId: string;
  pollId: string;
  /** 투표자 이름 */
  voterName: string;
  /**
   * 날짜투표: 선택한 optionId들을 콤마 구분 (예: "OPT-01,OPT-03")
   * 참석투표: "attend" | "absent" | "undecided"
   */
  selectedOptions: string;
  votedAt: string;
};

/** 클라이언트에 전달할 투표 결과 (집계 포함) */
export type PollResult = {
  poll: Poll;
  /** 날짜투표일 때만 채워짐 */
  options: Array<PollOption & { voterNames: string[] }>;
  /** 전체 투표 원본 */
  votes: PollVote[];
  /** 참석투표일 때 집계 */
  attendanceSummary?: {
    attend: string[];
    absent: string[];
    undecided: string[];
  };
  /** 로그인한 사람의 현재 투표 */
  myVote?: PollVote;
};

/** 투표 생성 입력 */
export type CreatePollInput = {
  pollType: PollType;
  title: string;
  description: string;
  createdBy: string;
  /** 날짜투표일 때 후보 날짜 목록 */
  options?: Array<{ optionDate: string; optionLabel: string }>;
};

export type CreatePollErrors = Partial<
  Record<"pollType" | "title" | "createdBy" | "options", string>
>;

/** 투표하기 입력 */
export type CastVoteInput = {
  voterName: string;
  /** 날짜투표: optionId 배열, 참석투표: AttendanceChoice 하나 */
  selectedOptions: string[];
};
