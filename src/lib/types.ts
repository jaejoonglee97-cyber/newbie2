/** 화면과 서버가 공유하는 값 타입. */

export type RecruitmentPhase = "before" | "open" | "closed";

export type ProgramSettings = {
  programId: string;
  programName: string;
  cohort: string;
  organizationName: string;
  recruitmentStartAt: string;
  recruitmentEndAt: string;
  activityStartDate: string;
  activityEndDate: string;
  totalBudget: number;
  minimumParticipants: number;
  /** 기장 성명 */
  leaderName: string;
  /** 부기장 성명 */
  viceLeaderName: string;
  contactEmail: string;
  /** 팀 채팅방 초대 링크. 공개 페이지에는 노출하지 않는다. */
  teamChatUrl: string;
  teamChatName: string;
  privacyRetentionPeriod: string;
  recruitmentNoticeUrl: string;
};

export type RecruitmentStatus = {
  phase: RecruitmentPhase;
  label: string;
  /** 신청 폼을 열어도 되는지 */
  acceptingApplications: boolean;
};

/**
 * 신청 폼이 서버로 보내는 값.
 *
 * 이메일과 참석 의사는 받지 않는다. 소통은 팀 채팅방으로 하고
 * 이메일은 명함으로 공유되므로 별도 수집하지 않는다.
 */
export type ApplicationInput = {
  name: string;
  organization: string;
  position: string;
  phone: string;
  privacyConsent: boolean;
  /** 명함을 첨부한 경우에만 필요한 공개 동의 */
  cardShareConsent: boolean;
};

/** 명함 이미지 첨부 정보 */
export type CardUpload = {
  mimeType: string;
  dataBase64: string;
};

/** 접수 성공 시 화면에 보여줄 값. 개인정보는 이름만 돌려준다. */
export type ApplicationReceipt = {
  applicationId: string;
  appliedAt: string;
  name: string;
  /** 같은 연락처로 이미 접수된 이력이 있는지 */
  possibleDuplicate: boolean;
  /** 명함이 정상적으로 저장되었는지 */
  cardUploaded: boolean;
  /** 명함 첨부는 했으나 저장에 실패한 경우 */
  cardFailed: boolean;
};

export type FieldErrors = Partial<Record<keyof ApplicationInput | "businessCard", string>>;

/** 명함집에 표시할 한 사람. 전화번호는 담지 않는다. */
export type CardEntry = {
  applicationId: string;
  name: string;
  organization: string;
  position: string;
  /** 명함 이미지가 있는 경우 프록시 경로 */
  cardImagePath: string | null;
};

/** 운영자 명단에 표시할 한 사람. 연락처를 포함한다. */
export type ApplicantRecord = {
  applicationId: string;
  appliedAt: string;
  name: string;
  organization: string;
  position: string;
  phone: string;
  applicationStatus: string;
  adminNote: string;
  hasCard: boolean;
  cardImagePath: string | null;
};
