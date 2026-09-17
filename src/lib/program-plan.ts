/**
 * 계획된 회기.
 *
 * 활동 계획 화면과 만족도 회차 목록이 같은 값을 본다. 계획 화면에만 적어 두면
 * 활동일지를 쓰기 전에는 만족도에서 회차를 고를 수 없다. 모임이 끝난 자리에서
 * 바로 만족도를 받으려면 기록보다 계획이 먼저 있어야 한다.
 *
 * 회기가 바뀌면 이 배열만 고친다.
 */
export type PlannedSession = {
  sessionNumber: number;
  month: string;
  title: string;
  subtitle: string;
  details: string;
};

export const PLANNED_SESSIONS: PlannedSession[] = [
  {
    sessionNumber: 1,
    month: "9월",
    title: "다시 만나 반가워요",
    subtitle: "관계형성과 동문회 방향 만들기",
    details: "오리엔테이션, 근황 나눔, 관계 형성 활동, 동문회 활동 기대사항 공유",
  },
  {
    sessionNumber: 2,
    month: "10월",
    title: "우리들의 현장 이야기",
    subtitle: "고민과 경험 나누기",
    details: "현장 고민 및 경험 나눔, 주제별 소그룹 대화, 서로의 실천방법·아이디어 공유",
  },
  {
    sessionNumber: 3,
    month: "11월",
    title: "서로에게 힘이되는 시간",
    subtitle: "사회복지사를 위한 쉼과 회복",
    details: "마음돌봄 프로그램 참여, 자기돌봄 활동, 활동 소감 및 서로의 마음 나눔",
  },
  {
    sessionNumber: 4,
    month: "12월",
    title: "중부재단 동문회 파티",
    subtitle: "연결을 넓히고 이어가기",
    details:
      "활동 사진·기록 돌아보기, 동문회 활동 소감 공유, 서로에게 전하는 메시지, 차년도 활동 의견 나눔",
  },
];
