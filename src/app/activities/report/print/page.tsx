import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import "../../[activityId]/print/print.css";
import { PrintToolbar } from "@/components/print-toolbar";
import { getActivityDetail, getBudgetSummary, listActivities } from "@/lib/activity-logs";
import { getSessionRole } from "@/lib/auth";
import { formatDateShort, formatWon } from "@/lib/format";
import { getLogo } from "@/lib/logo";
import { getLatestReportId, getReportDetail } from "@/lib/report-logs";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "결과보고서 인쇄",
  robots: { index: false, follow: false },
};

const PHOTOS_PER_PAGE = 6;

/**
 * 아직 아무것도 없을 때만 빈 줄을 채운다.
 *
 * 양식은 빈 서식이라 칸이 여러 줄 비어 있다. 하지만 값이 이미 있는 제출용
 * 문서에 빈 줄을 덧붙이면 미완성처럼 보이고 지면만 차지한다. 표가 머리행만
 * 남아 허전해 보이는 경우에만 채운다.
 */
const EMPTY_TABLE_ROWS = 4;

/**
 * 참여인원이 이 수를 넘으면 명단을 2열로 나눈다.
 *
 * 22명을 한 줄씩 쌓으면 1~3절이 A4 한 장을 크게 넘어 양식의 페이지 구성이
 * 무너진다. 2열로 나누면 절 순서를 유지한 채 한 장에 담을 수 있다.
 */
const TWO_COLUMN_THRESHOLD = 12;

/**
 * 결과보고서 A4 인쇄.
 *
 * 배포된 한글 양식 "뉴비스쿨 동문회 활동결과보고서"의 절 번호와 순서를
 * 그대로 따른다. 4~9 절은 양식에 있는 파란 안내 문구까지 함께 싣는다.
 */
export default async function ReportPrintPage() {
  const role = await getSessionRole();
  if (!role) {
    redirect(`/login?returnTo=${encodeURIComponent("/activities/report/print")}`);
  }

  const [settings, latestReportId, activitiesSummary, budget] = await Promise.all([
    getSettings(),
    getLatestReportId(),
    listActivities(),
    getBudgetSummary(),
  ]);

  if (!latestReportId) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <div className="rounded-lg border border-line bg-surface p-8 text-center shadow-sm">
          <p className="text-lg font-medium text-ink">작성된 결과보고서가 없습니다.</p>
          <Link
            href="/activities/report"
            className="mt-4 inline-block rounded-md bg-brand-blue px-4 py-2 text-white hover:bg-brand-blue-hover"
          >
            결과보고서 작성하기
          </Link>
        </div>
      </div>
    );
  }

  const report = await getReportDetail(latestReportId);
  if (!report) notFound();

  const logo = getLogo();

  // 회기별 진행사항과 참여자 명단을 만들려면 각 활동의 전체 값이 필요하다.
  const activityDetails = await Promise.all(
    activitiesSummary.map((activity) => getActivityDetail(activity.activityId)),
  );

  const activities = activityDetails
    .filter((activity): activity is NonNullable<typeof activity> => activity !== null)
    .sort((a, b) => a.sessionNumber - b.sessionNumber);

  const totalSessions = activities.length;

  /*
   * 실제 참여인원 명단.
   * 계획과 별도로 실제 참석한 사람만 모으고, 몇 회기에 나왔는지 함께 적는다.
   */
  const participantMap = new Map<
    string,
    { organization: string; attendedSessions: number[] }
  >();

  for (const activity of activities) {
    for (const participant of activity.participants) {
      if (!["참석", "지각", "조퇴"].includes(participant.attendanceStatus)) continue;

      const existing = participantMap.get(participant.name) ?? {
        organization: participant.organization,
        attendedSessions: [],
      };
      existing.attendedSessions.push(activity.sessionNumber);
      participantMap.set(participant.name, existing);
    }
  }

  const participants = Array.from(participantMap.entries())
    .map(([name, data]) => ({
      name,
      organization: data.organization,
      // 모든 회기에 나온 사람은 양식 예시대로 '전회기' 로 적는다.
      sessions:
        totalSessions > 0 && data.attendedSessions.length === totalSessions
          ? "전회기"
          : `${data.attendedSessions.sort((a, b) => a - b).join(", ")}회기`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const executionRate =
    budget.totalBudget > 0 ? Math.round((budget.confirmedSpent / budget.totalBudget) * 100) : 0;

  const allPhotos = activities.flatMap((activity) => activity.photos);
  const photoPages = chunk(allPhotos, PHOTOS_PER_PAGE);

  return (
    <div className="paper-bg">
      <PrintToolbar backHref="/activities/report" backLabel="← 결과보고서로" />

      {/* 1페이지: 1~3절 */}
      <article className="sheet print-page">
        {logo ? <img src={logo.src} alt={settings.organizationName} className="doc-logo" /> : null}

        <h1 className="doc-title">
          신입사회복지사 역량강화교육 &lt;뉴비스쿨&gt; {settings.cohort}기
          <br />
          동문회 활동 결과보고서
        </h1>

        <h2 className="numbered-title">1. 활동 개요</h2>
        <table className="form-table avoid-break">
          <colgroup>
            <col style={{ width: "24mm" }} />
            <col style={{ width: "26mm" }} />
            <col style={{ width: "24mm" }} />
            <col />
            <col style={{ width: "18mm" }} />
            <col style={{ width: "26mm" }} />
          </colgroup>
          <tbody>
            <tr>
              <th>작성자</th>
              <td className="value" colSpan={5}>
                {report.authorName}
              </td>
            </tr>
            <tr>
              <th>모임주제</th>
              <td className="value" colSpan={5}>
                {report.topic}
              </td>
            </tr>
            <tr>
              <th>참여인원수</th>
              <td className="center">총 {participants.length} 명</td>
              <th>모임진행횟수</th>
              <td className="center" colSpan={3}>
                총 {totalSessions} 회
              </td>
            </tr>
            <tr>
              <th>주요내용</th>
              <td className="value" colSpan={5}>
                {report.mainContent}
              </td>
            </tr>
            <tr>
              <th>활동지역</th>
              <td className="value" colSpan={5}>
                {report.activityArea}
              </td>
            </tr>
            {/* 양식과 같이 지원금·집행액·잔액을 한 줄에 나란히 둔다. */}
            <tr>
              <th>지원금</th>
              <td className="num">{budget.totalBudget.toLocaleString("ko-KR")}원</td>
              <th>집행액</th>
              <td className="num">
                {budget.confirmedSpent.toLocaleString("ko-KR")}원 ({executionRate}%)
              </td>
              <th>잔액</th>
              <td className="num">{budget.remaining.toLocaleString("ko-KR")}원</td>
            </tr>
          </tbody>
        </table>

        <h2 className="numbered-title">2. 회기별 진행사항</h2>
        <table className="form-table avoid-break">
          <colgroup>
            <col style={{ width: "12mm" }} />
            <col style={{ width: "24mm" }} />
            <col style={{ width: "16mm" }} />
            <col />
            <col style={{ width: "30mm" }} />
            <col style={{ width: "18mm" }} />
          </colgroup>
          <thead>
            <tr>
              <th>회기</th>
              <th>일시</th>
              <th>
                참여
                <br />
                인원
              </th>
              <th>내용</th>
              <th>장소</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((activity) => {
              const attended = activity.participants.filter((participant) =>
                ["참석", "지각", "조퇴"].includes(participant.attendanceStatus),
              ).length;

              return (
                <tr key={activity.activityId}>
                  <td className="center">{activity.sessionNumber}</td>
                  <td className="center">{formatDateShort(activity.activityDate)}</td>
                  <td className="center">{attended}명</td>
                  <td>{activity.topic}</td>
                  <td>{activity.location}</td>
                  <td />
                </tr>
              );
            })}
            {activities.length === 0 ? blankRows(EMPTY_TABLE_ROWS, 6, "session") : null}
          </tbody>
        </table>

        <h2 className="numbered-title">
          3. 실제 참여인원 명단
          <span className="title-hint" style={{ display: "inline", paddingLeft: "2mm" }}>
            (계획과 별도로, 실제 모임에 참여한 구성원들의 정보를 기입)
          </span>
        </h2>
        <ParticipantRoster participants={participants} />
      </article>

      {/* 2페이지: 4~8절 */}
      <article className="sheet print-page">
        <h2 className="numbered-title">4. 활동 목표 대비 달성정도 및 성과</h2>
        <p className="title-hint">
          (활동신청서에 작성한 내용(예: 모임목표, 기대효과 등을) 중심으로 작성)
        </p>
        <div className="answer-box">{report.goalAchievement}</div>

        <h2 className="numbered-title">5. 동문회 활동으로 유익했던 점</h2>
        <div className="answer-box">{report.benefits}</div>

        <h2 className="numbered-title">6. 동문회 활동에서 아쉬웠던 점 및 개선방안</h2>
        <div className="answer-box">{report.regrets}</div>
      </article>

      <article className="sheet print-page">
        <h2 className="numbered-title">7. 추후 계획</h2>
        <p className="title-hint">(향후 모임계획, 유지 여부, 기타 계획 등)</p>
        <div className="answer-box">{report.futurePlans}</div>

        <h2 className="numbered-title">8. 구성원의 소감 한마디</h2>
        <p className="title-hint">
          (모든 구성원 소감을 다 넣어주시면 좋겠습니다. 다만, 상황이 여의치 않을 경우,
          전반적으로 써 주셔도 됩니다.)
        </p>
        <div className="answer-box" style={{ minHeight: "70mm" }}>
          {report.impressions}
        </div>
      </article>

      {/* 9. 진행사진 */}
      {photoPages.map((page, pageIndex) => (
        <article key={pageIndex} className="sheet print-page">
          <h2 className="numbered-title">
            9. 진행사진
            {photoPages.length > 1 ? ` (${pageIndex + 1}/${photoPages.length})` : ""}
          </h2>
          <p className="title-hint">(모임진행사진 등)</p>

          <div className="photo-grid">
            {page.map((photo) => (
              <figure key={photo.photoId} className="photo-item">
                <img src={photo.imagePath} alt={photo.caption || "활동 사진"} loading="eager" />
                {photo.caption ? (
                  <figcaption className="photo-caption">{photo.caption}</figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        </article>
      ))}

      {allPhotos.length === 0 ? (
        <article className="sheet print-page">
          <h2 className="numbered-title">9. 진행사진</h2>
          <p className="title-hint">(모임진행사진 등)</p>
          <p className="empty-note">등록된 활동 사진이 없습니다.</p>
        </article>
      ) : null}
    </div>
  );
}

type RosterEntry = { name: string; organization: string; sessions: string };

/**
 * 3. 실제 참여인원 명단.
 *
 * 인원이 적으면 양식처럼 한 줄씩 쌓고, 많으면 2열로 나눈다.
 * 2열에서는 열 폭이 좁아 축약 서식(.compact)을 쓴다.
 */
function ParticipantRoster({ participants }: { participants: RosterEntry[] }) {
  if (participants.length <= TWO_COLUMN_THRESHOLD) {
    return (
      <table className="form-table avoid-break">
        <colgroup>
          <col style={{ width: "16mm" }} />
          <col style={{ width: "34mm" }} />
          <col />
          <col style={{ width: "44mm" }} />
        </colgroup>
        <thead>
          <tr>
            <th>구분</th>
            <th>성명</th>
            <th>소속</th>
            <th>참여 회기</th>
          </tr>
        </thead>
        <tbody>
          {participants.map((participant, index) => (
            <tr key={participant.name}>
              <td className="center">{index + 1}</td>
              <td className="center">{participant.name}</td>
              <td>{participant.organization}</td>
              <td className="center">{participant.sessions}</td>
            </tr>
          ))}
          {participants.length === 0 ? blankRows(EMPTY_TABLE_ROWS, 4, "participant") : null}
        </tbody>
      </table>
    );
  }

  const half = Math.ceil(participants.length / 2);
  const columns = [participants.slice(0, half), participants.slice(half)];

  return (
    <div className="two-column-list avoid-break">
      {columns.map((column, columnIndex) => (
        <table key={columnIndex} className="inner-table compact">
          <thead>
            <tr>
              <th style={{ width: "6mm" }}>구분</th>
              <th style={{ width: "14mm" }}>성명</th>
              <th>소속</th>
              <th style={{ width: "15mm" }}>참여 회기</th>
            </tr>
          </thead>
          <tbody>
            {column.map((participant, index) => (
              <tr key={participant.name}>
                <td className="center">{columnIndex * half + index + 1}</td>
                <td className="center">{participant.name}</td>
                <td>{participant.organization}</td>
                <td className="center">{participant.sessions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}

/** 양식처럼 표의 빈 줄을 유지한다. 값이 적어도 칸이 보인다. */
function blankRows(count: number, columns: number, keyPrefix: string) {
  if (count <= 0) return null;

  return Array.from({ length: count }, (_, index) => (
    <tr key={`${keyPrefix}-blank-${index}`}>
      {Array.from({ length: columns }, (__, column) => (
        <td key={column}>&nbsp;</td>
      ))}
    </tr>
  ));
}

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}
