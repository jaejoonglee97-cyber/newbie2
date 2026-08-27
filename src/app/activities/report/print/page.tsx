import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import "../../[activityId]/print/print.css";
import { getLatestReportId, getReportDetail } from "@/lib/report-logs";
import { getActivityDetail, getBudgetSummary, listActivities } from "@/lib/activity-logs";
import { getSessionRole } from "@/lib/auth";
import { formatDate, formatDateShort, formatWon } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "결과보고서 인쇄",
  robots: { index: false, follow: false },
};

const PHOTOS_PER_PAGE = 6;

export default async function ReportPrintPage() {
  const role = await getSessionRole();
  if (!role) {
    redirect(`/login?returnTo=${encodeURIComponent(`/activities/report/print`)}`);
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
          <Link href="/activities/report" className="mt-4 inline-block rounded-md bg-brand-blue px-4 py-2 text-white hover:bg-brand-blue-hover">
            결과보고서 작성하기
          </Link>
        </div>
      </div>
    );
  }

  const report = await getReportDetail(latestReportId);
  if (!report) notFound();

  // Load all activity details to construct the session list, participant list, and photos
  const activityDetails = await Promise.all(
    activitiesSummary.map(a => getActivityDetail(a.activityId))
  );

  const validActivities = activityDetails.filter(a => a !== null);
  const totalSessions = validActivities.length;
  
  // Aggregate unique participants and count their attendances
  const participantMap = new Map<string, { organization: string; attendedSessions: number[] }>();
  
  validActivities.forEach((act) => {
    act.participants.forEach(p => {
      if (["참석", "지각", "조퇴"].includes(p.attendanceStatus)) {
        const existing = participantMap.get(p.name) || { organization: p.organization, attendedSessions: [] };
        existing.attendedSessions.push(act.sessionNumber);
        participantMap.set(p.name, existing);
      }
    });
  });

  const participantList = Array.from(participantMap.entries()).map(([name, data]) => ({
    name,
    organization: data.organization,
    sessions: data.attendedSessions.sort((a, b) => a - b).join(", "),
  }));
  const totalParticipants = participantList.length;

  const allPhotos = validActivities.flatMap(act => act.photos);
  const photoPages = chunk(allPhotos, PHOTOS_PER_PAGE);

  return (
    <div className="paper-bg">
      <div className="print-toolbar no-print">
        <div className="print-toolbar-inner">
          <p className="print-toolbar-text">결과보고서 인쇄 미리보기</p>
          <div className="print-toolbar-actions">
            <Link href="/activities/report" className="btn-secondary">
              수정
            </Link>
            <button type="button" onClick={() => window.print()} className="btn-primary">
              인쇄 (PDF 저장)
            </button>
          </div>
        </div>
      </div>

      <article className="sheet print-page">
        <h1 className="doc-title" style={{ fontSize: "1.4rem" }}>
          신입사회복지사 역량강화교육 &lt;뉴비스쿨&gt; {settings.cohort}기
          <br />
          동문회 활동 결과보고서
        </h1>

        <h2 className="section-title">1. 활동 개요</h2>
        <table className="grid-table avoid-break">
          <tbody>
            <tr>
              <th style={{ width: "24mm" }}>작성자</th>
              <td colSpan={3}>{report.authorName}</td>
            </tr>
            <tr>
              <th>모임주제</th>
              <td colSpan={3}>{report.topic}</td>
            </tr>
            <tr>
              <th>참여인원수</th>
              <td style={{ width: "35%" }}>총 {totalParticipants} 명</td>
              <th style={{ width: "24mm" }}>모임진행횟수</th>
              <td>총 {totalSessions} 회</td>
            </tr>
            <tr>
              <th>주요내용</th>
              <td colSpan={3} style={{ whiteSpace: "pre-wrap" }}>{report.mainContent}</td>
            </tr>
            <tr>
              <th>활동지역</th>
              <td colSpan={3}>{report.activityArea}</td>
            </tr>
            <tr>
              <th>지원금</th>
              <td>{formatWon(budget.totalBudget)}</td>
              <th>집행액</th>
              <td>{formatWon(budget.confirmedSpent)} <span className="text-xs text-ink-muted ml-2">(잔액 {formatWon(budget.remaining)})</span></td>
            </tr>
          </tbody>
        </table>

        <h2 className="section-title">2. 회기별 진행사항</h2>
        <table className="grid-table avoid-break">
          <thead>
            <tr>
              <th style={{ width: "12mm" }}>회기</th>
              <th style={{ width: "26mm" }}>일시</th>
              <th style={{ width: "16mm" }}>참여인원</th>
              <th>내용</th>
              <th style={{ width: "30mm" }}>장소</th>
              <th style={{ width: "20mm" }}>비고</th>
            </tr>
          </thead>
          <tbody>
            {validActivities.sort((a, b) => a.sessionNumber - b.sessionNumber).map(act => {
              const attendedCount = act.participants.filter(p => ["참석", "지각", "조퇴"].includes(p.attendanceStatus)).length;
              return (
                <tr key={act.activityId}>
                  <td className="num">{act.sessionNumber}</td>
                  <td>{formatDateShort(act.activityDate)}</td>
                  <td className="num">{attendedCount}명</td>
                  <td>{act.topic}</td>
                  <td>{act.location}</td>
                  <td>-</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h2 className="section-title">3. 실제 참여인원 명단</h2>
        <table className="grid-table avoid-break">
          <thead>
            <tr>
              <th style={{ width: "12mm" }}>구분</th>
              <th style={{ width: "30mm" }}>성명</th>
              <th>소속</th>
              <th style={{ width: "40mm" }}>참여 회기</th>
            </tr>
          </thead>
          <tbody>
            {participantList.map((p, i) => (
              <tr key={p.name}>
                <td className="num">{i + 1}</td>
                <td style={{ textAlign: "center" }}>{p.name}</td>
                <td>{p.organization}</td>
                <td style={{ textAlign: "center" }}>{p.sessions}회기</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="sheet print-page">
        <h2 className="section-title" style={{ marginTop: 0 }}>4. 활동 목표 대비 달성정도 및 성과</h2>
        <div className="prose-box">{report.goalAchievement}</div>

        <h2 className="section-title">5. 동문회 활동으로 유익했던 점</h2>
        <div className="prose-box">{report.benefits}</div>

        <h2 className="section-title">6. 동문회 활동에서 아쉬웠던 점 및 개선방안</h2>
        <div className="prose-box">{report.regrets}</div>

        <h2 className="section-title">7. 추후 계획</h2>
        <div className="prose-box">{report.futurePlans}</div>

        <h2 className="section-title">8. 구성원의 소감 한마디</h2>
        <div className="prose-box">{report.impressions}</div>
      </article>

      {/* 9. 진행사진 */}
      {photoPages.map((page, pageIndex) => (
        <article key={pageIndex} className="sheet print-page">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            9. 진행사진
            {photoPages.length > 1 ? ` (${pageIndex + 1}/${photoPages.length})` : ""}
          </h2>

          <div className="photo-grid">
            {page.map((photo) => (
              <figure key={photo.photoId} className="photo-item avoid-break">
                <img
                  src={photo.imagePath}
                  alt={photo.caption || "활동 사진"}
                  loading="eager"
                />
                <figcaption className="photo-caption">
                  {photo.caption || " "}
                </figcaption>
              </figure>
            ))}
          </div>
        </article>
      ))}

      {allPhotos.length === 0 ? (
        <article className="sheet print-page">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            9. 진행사진
          </h2>
          <p style={{ padding: "10mm 0", textAlign: "center", color: "#6b7280" }}>
            등록된 활동 사진이 없습니다.
          </p>
        </article>
      ) : null}
    </div>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}
