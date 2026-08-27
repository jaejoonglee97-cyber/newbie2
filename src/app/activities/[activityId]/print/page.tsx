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

/**
 * 활동일지 A4 인쇄.
 *
 * 배포된 한글 양식 "동문회 활동 일지"의 구성을 그대로 따른다.
 *   제목    2026년 뉴비 (N)기 동문회 (M)회기 진행일지
 *   우상단  작성자
 *   본문    모임일시 / 모임장소 / 모임주제 / 모임내용 / 모임평가 및 소감 /
 *           참여자 명단 / 예산 사용내역 을 항목 열이 있는 하나의 표로
 *   2페이지 모임사진 (항목 이름은 세로쓰기)
 *
 * 양식에 없는 항목(모임 목표, 기대 효과)은 넣지 않는다. 그 값은 활동 상세
 * 화면에서 볼 수 있고, 인쇄물은 제출용이라 양식과 같아야 한다.
 */
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
      <PrintToolbar backHref={`/activities/${detail.activityId}`} backLabel="← 상세로" />

      {/* 1페이지 */}
      <article className="sheet print-page">
        <h1 className="doc-title">
          {settings.activityEndDate.slice(0, 4)}년 뉴비 {settings.cohort}기 동문회{" "}
          {detail.sessionNumber}회기 진행일지
        </h1>

        <div className="author-line">
          <table>
            <tbody>
              <tr>
                <th>작성자</th>
                <td>{detail.authorName || ""}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <table className="form-table">
          <colgroup>
            <col style={{ width: "24mm" }} />
            <col />
            <col style={{ width: "24mm" }} />
            <col style={{ width: "46mm" }} />
          </colgroup>
          <tbody>
            <tr>
              <th>모임일시</th>
              <td className="value">
                {formatDate(detail.activityDate)} {detail.startTime}~{detail.endTime}
              </td>
              <th>모임장소</th>
              <td className="value">{detail.location}</td>
            </tr>
            <tr>
              <th>모임주제</th>
              <td className="value" colSpan={3}>
                {detail.topic}
              </td>
            </tr>
            <tr>
              <th>모임내용</th>
              <td className="value cell-lg" colSpan={3}>
                {detail.content}
              </td>
            </tr>
            <tr>
              <th>
                모임평가
                <br />및 소감
              </th>
              <td className="value cell-md" colSpan={3}>
                {detail.evaluation}
              </td>
            </tr>
            <tr>
              <th>
                참여자
                <br />
                명단
              </th>
              <td colSpan={3}>
                <ParticipantTable detail={detail} />
              </td>
            </tr>
            <tr>
              <th>
                예산
                <br />
                사용내역
              </th>
              <td colSpan={3}>
                <BudgetTable detail={detail} />
              </td>
            </tr>
          </tbody>
        </table>
      </article>

      {/* 2페이지 이후: 모임사진 */}
      {photoPages.map((page, pageIndex) => (
        <article key={pageIndex} className="sheet print-page">
          <table className="form-table">
            <colgroup>
              <col style={{ width: "14mm" }} />
              <col />
            </colgroup>
            <tbody>
              <tr>
                <th className="vertical-label">
                  {/* 양식처럼 한 글자씩 세로로 쌓는다. */}
                  모
                  <br />
                  임
                  <br />
                  사
                  <br />진
                  {photoPages.length > 1 ? (
                    <>
                      <br />
                      <span style={{ fontSize: "8.5pt", fontWeight: 400 }}>
                        {pageIndex + 1}/{photoPages.length}
                      </span>
                    </>
                  ) : null}
                </th>
                <td>
                  <div className="photo-grid">
                    {page.map((photo) => (
                      <figure key={photo.photoId} className="photo-item">
                        {/*
                          인쇄 시점에 이미지가 이미 받아져 있어야 종이에 찍힌다.
                          loading="eager" 로 두어 지연 로딩을 끈다.
                        */}
                        <img
                          src={photo.imagePath}
                          alt={photo.caption || "활동 사진"}
                          loading="eager"
                        />
                        {photo.caption ? (
                          <figcaption className="photo-caption">{photo.caption}</figcaption>
                        ) : null}
                      </figure>
                    ))}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </article>
      ))}

      {detail.photos.length === 0 ? (
        <article className="sheet print-page">
          <table className="form-table">
            <colgroup>
              <col style={{ width: "14mm" }} />
              <col />
            </colgroup>
            <tbody>
              <tr>
                <th className="vertical-label">
                  모
                  <br />
                  임
                  <br />
                  사
                  <br />진
                </th>
                <td className="cell-lg">
                  <p className="empty-note">등록된 사진이 없습니다.</p>
                </td>
              </tr>
            </tbody>
          </table>
        </article>
      ) : null}
    </div>
  );
}

/**
 * 참여자가 이 수를 넘으면 명단을 2열로 나눈다.
 *
 * 22명을 한 줄씩 쌓으면 1페이지가 A4 를 넘어 양식의 페이지 구성이 깨진다.
 * 양식의 참여자 명단은 큰 빈 칸 하나이므로, 그 칸 안에서 2열로 나누는 것은
 * 양식을 벗어나지 않으면서 한 장에 담는 방법이다.
 */
const TWO_COLUMN_THRESHOLD = 12;

/**
 * 참여자 명단.
 *
 * 양식은 빈 칸 하나지만, 제출물에서 소속과 성명을 알아볼 수 있어야 하므로
 * 그 칸 안에 작은 표로 넣는다.
 */
function ParticipantTable({ detail }: { detail: ActivityDetail }) {
  const participants = detail.participants;

  if (participants.length === 0) {
    return <p className="empty-note">기록된 참여자가 없습니다.</p>;
  }

  const attended = participants.filter((participant) =>
    ["참석", "지각", "조퇴"].includes(participant.attendanceStatus),
  ).length;

  const summary = (
    <p className="list-summary">
      실제 참석 인원 {attended}명 / 기록된 참여자 {participants.length}명
    </p>
  );

  if (participants.length <= TWO_COLUMN_THRESHOLD) {
    return (
      <>
        <table className="inner-table">
          <thead>
            <tr>
              <th style={{ width: "10mm" }}>번호</th>
              <th>소속기관</th>
              <th style={{ width: "26mm" }}>성명</th>
              <th style={{ width: "18mm" }}>출석</th>
              <th style={{ width: "30mm" }}>비고</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((participant, index) => (
              <tr key={`${participant.name}-${index}`}>
                <td className="center">{index + 1}</td>
                <td>{participant.organization}</td>
                <td className="center">{participant.name}</td>
                <td className="center">{participant.attendanceStatus || "-"}</td>
                <td>{participant.absenceNote}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {summary}
      </>
    );
  }

  // 2열로 나눈다. 왼쪽 열을 먼저 채워 번호가 위에서 아래로 이어지게 한다.
  const half = Math.ceil(participants.length / 2);
  const columns = [participants.slice(0, half), participants.slice(half)];

  return (
    <>
      <div className="two-column-list">
        {columns.map((column, columnIndex) => (
          <table key={columnIndex} className="inner-table compact">
            <thead>
              <tr>
                <th style={{ width: "6mm" }}>번호</th>
                <th>소속기관</th>
                <th style={{ width: "14mm" }}>성명</th>
                <th style={{ width: "11mm" }}>출석</th>
              </tr>
            </thead>
            <tbody>
              {column.map((participant, index) => {
                const number = columnIndex * half + index + 1;
                const status = participant.attendanceStatus || "-";

                return (
                  <tr key={`${participant.name}-${number}`}>
                    <td className="center">{number}</td>
                    <td>{participant.organization}</td>
                    <td className="center">{participant.name}</td>
                    {/* 열이 좁아 비고 칸을 따로 두지 않고 출석 칸에 붙인다. */}
                    <td className="center">
                      {participant.absenceNote ? `${status} · ${participant.absenceNote}` : status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
      </div>
      {summary}
    </>
  );
}

function BudgetTable({ detail }: { detail: ActivityDetail }) {
  if (detail.budgetItems.length === 0) {
    return <p className="empty-note">기록된 예산 사용내역이 없습니다.</p>;
  }

  return (
    <table className="inner-table">
      <thead>
        <tr>
          <th style={{ width: "10mm" }}>번호</th>
          <th style={{ width: "20mm" }}>분류</th>
          <th>항목명</th>
          <th>산출 근거</th>
          <th style={{ width: "24mm" }}>금액</th>
        </tr>
      </thead>
      <tbody>
        {detail.budgetItems.map((item, index) => (
          <tr key={`${item.itemName}-${index}`}>
            <td className="center">{index + 1}</td>
            <td className="center">{item.category}</td>
            <td>{item.itemName}</td>
            <td>{item.calculationBasis}</td>
            <td className="num">{item.amount.toLocaleString("ko-KR")}원</td>
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
