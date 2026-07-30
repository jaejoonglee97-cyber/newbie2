import { notFound, redirect } from "next/navigation";

import "./print.css";
import { PrintToolbar } from "@/components/print-toolbar";
import { getActivityDetail } from "@/lib/activity-logs";
import { getSessionRole } from "@/lib/auth";
import { formatDate, formatWon } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import type { ActivityDetail } from "@/lib/activity-types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "활동일지 인쇄",
  robots: { index: false, follow: false },
};

/** 한 페이지에 넣을 사진 수. 2열 3행이 A4 한 장에 적당하다. */
const PHOTOS_PER_PAGE = 6;

export default async function ActivityPrintPage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const role = await getSessionRole();
  const { activityId } = await params;

  if (!role) {
    redirect(`/login?returnTo=${encodeURIComponent(`/activities/${activityId}/print`)}`);
  }

  const [settings, detail] = await Promise.all([getSettings(), getActivityDetail(activityId)]);

  if (!detail) {
    notFound();
  }

  const photoPages = chunk(detail.photos, PHOTOS_PER_PAGE);

  return (
    <div className="paper-bg">
      <PrintToolbar activityId={detail.activityId} />

      {/* 1페이지 */}
      <article className="sheet print-page">
        <h1 className="doc-title">
          {settings.programName} {detail.sessionNumber}회기 활동일지
        </h1>

        <table className="grid-table avoid-break">
          <tbody>
            <tr>
              <th style={{ width: "24mm" }}>작성자</th>
              <td>{detail.authorName || "-"}</td>
              <th style={{ width: "24mm" }}>모임 장소</th>
              <td>{detail.location || "-"}</td>
            </tr>
            <tr>
              <th>모임 일시</th>
              <td colSpan={3}>
                {formatDate(detail.activityDate)} {detail.startTime} ~ {detail.endTime}
              </td>
            </tr>
            <tr>
              <th>모임 주제</th>
              <td colSpan={3}>{detail.topic}</td>
            </tr>
            <tr>
              <th>모임 목표</th>
              <td colSpan={3}>{detail.objective}</td>
            </tr>
            <tr>
              <th>기대 효과</th>
              <td colSpan={3}>{detail.expectedEffect}</td>
            </tr>
          </tbody>
        </table>

        <h2 className="section-title">모임 내용</h2>
        <div className="prose-box">{detail.content}</div>

        <h2 className="section-title">모임 평가 및 소감</h2>
        <div className="prose-box">{detail.evaluation}</div>

        <h2 className="section-title">참여자 명단</h2>
        <ParticipantTable detail={detail} />

        <h2 className="section-title">예산 사용내역</h2>
        <BudgetTable detail={detail} />
      </article>

      {/* 2페이지 이후: 사진 */}
      {photoPages.map((page, pageIndex) => (
        <article key={pageIndex} className="sheet print-page">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            모임 사진
            {photoPages.length > 1 ? ` (${pageIndex + 1}/${photoPages.length})` : ""}
          </h2>

          <div className="photo-grid">
            {page.map((photo) => (
              <figure key={photo.photoId} className="photo-item avoid-break">
                {/*
                  인쇄 시점에 이미지가 이미 받아져 있어야 종이에 찍힌다.
                  loading="eager" 로 두어 지연 로딩을 끈다.
                */}
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

      {detail.photos.length === 0 ? (
        <article className="sheet print-page">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            모임 사진
          </h2>
          <p style={{ padding: "10mm 0", textAlign: "center", color: "#6b7280" }}>
            등록된 사진이 없습니다.
          </p>
        </article>
      ) : null}
    </div>
  );
}

function ParticipantTable({ detail }: { detail: ActivityDetail }) {
  const attended = detail.participants.filter((p) =>
    ["참석", "지각", "조퇴"].includes(p.attendanceStatus),
  ).length;

  return (
    <table className="grid-table">
      <thead>
        <tr>
          <th style={{ width: "12mm" }}>번호</th>
          <th>소속기관</th>
          <th style={{ width: "28mm" }}>성명</th>
          <th style={{ width: "20mm" }}>출석</th>
          <th style={{ width: "34mm" }}>비고</th>
        </tr>
      </thead>
      <tbody>
        {detail.participants.map((participant, index) => (
          <tr key={`${participant.name}-${index}`}>
            <td className="num">{index + 1}</td>
            <td>{participant.organization}</td>
            <td>{participant.name}</td>
            <td>{participant.attendanceStatus || "-"}</td>
            <td>{participant.absenceNote}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={3} style={{ textAlign: "right" }}>
            실제 참석 인원
          </td>
          <td colSpan={2}>{attended}명</td>
        </tr>
      </tfoot>
    </table>
  );
}

function BudgetTable({ detail }: { detail: ActivityDetail }) {
  return (
    <table className="grid-table">
      <thead>
        <tr>
          <th style={{ width: "12mm" }}>번호</th>
          <th style={{ width: "22mm" }}>분류</th>
          <th>항목명</th>
          <th>산출 근거</th>
          <th style={{ width: "26mm" }}>금액</th>
        </tr>
      </thead>
      <tbody>
        {detail.budgetItems.map((item, index) => (
          <tr key={`${item.itemName}-${index}`}>
            <td className="num">{index + 1}</td>
            <td>{item.category}</td>
            <td>{item.itemName}</td>
            <td>{item.calculationBasis}</td>
            <td className="num">{item.amount.toLocaleString("ko-KR")}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={4} style={{ textAlign: "right" }}>
            합계
          </td>
          <td className="num">{formatWon(detail.actualTotal)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}
