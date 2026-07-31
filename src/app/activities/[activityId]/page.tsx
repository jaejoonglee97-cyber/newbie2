import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getActivityDetail } from "@/lib/activity-logs";
import { getSessionRole } from "@/lib/auth";
import { formatDate, formatWon } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "활동 상세 · 뉴비스쿨 2기 동문회",
  robots: { index: false, follow: false },
};

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const role = await getSessionRole();
  const { activityId } = await params;

  if (!role) {
    redirect(`/login?returnTo=${encodeURIComponent(`/activities/${activityId}`)}`);
  }

  const [settings, detail] = await Promise.all([getSettings(), getActivityDetail(activityId)]);

  if (!detail) {
    notFound();
  }

  return (
    <>
      <SiteHeader settings={settings} />
      <SiteNav role={role} current="activities" />

      <main id="main" className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-12">
        <p className="text-sm font-semibold text-teal">
          {detail.sessionNumber}회기 · {detail.status}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-navy sm:text-3xl">{detail.topic}</h1>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/activities/${detail.activityId}/print`}
            target="_blank"
            className="inline-flex items-center justify-center rounded-lg bg-navy px-6 py-3 text-sm font-bold text-white hover:bg-navy-hover"
          >
            A4 인쇄 · PDF 저장
          </Link>
          <Link
            href="/activities"
            className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink-soft hover:border-brand-blue/50"
          >
            목록으로
          </Link>
        </div>

        <dl className="mt-10 divide-y divide-line rounded-[14px] border border-line bg-surface px-6">
          <Row label="작성자" value={detail.authorName || "-"} />
          <Row
            label="모임 일시"
            value={`${formatDate(detail.activityDate)} ${detail.startTime} ~ ${detail.endTime}`}
          />
          <Row label="모임 장소" value={detail.location} />
          <Row label="모임 목표" value={detail.objective} />
          <Row label="기대 효과" value={detail.expectedEffect} />
        </dl>

        <Block title="모임 내용">{detail.content}</Block>
        <Block title="모임 평가 및 소감">{detail.evaluation}</Block>

        <h2 className="mt-10 text-lg font-bold text-navy">
          참여자 ({detail.participants.length}명)
        </h2>
        <div className="mt-3 overflow-x-auto rounded-[14px] border border-line bg-surface">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas text-left">
                <th className="px-4 py-3 font-bold text-ink">소속기관</th>
                <th className="px-4 py-3 font-bold text-ink">성명</th>
                <th className="px-4 py-3 font-bold text-ink">출석</th>
                <th className="px-4 py-3 font-bold text-ink">비고</th>
              </tr>
            </thead>
            <tbody>
              {detail.participants.map((participant, index) => (
                <tr key={`${participant.name}-${index}`} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-ink-soft">{participant.organization}</td>
                  <td className="px-4 py-3 font-semibold text-ink">{participant.name}</td>
                  <td className="px-4 py-3 text-ink-soft">{participant.attendanceStatus || "-"}</td>
                  <td className="px-4 py-3 text-ink-muted">{participant.absenceNote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-10 text-lg font-bold text-navy">예산 사용내역</h2>
        <div className="mt-3 overflow-x-auto rounded-[14px] border border-line bg-surface">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas text-left">
                <th className="px-4 py-3 font-bold text-ink">분류</th>
                <th className="px-4 py-3 font-bold text-ink">항목명</th>
                <th className="px-4 py-3 font-bold text-ink">산출 근거</th>
                <th className="px-4 py-3 text-right font-bold text-ink">금액</th>
              </tr>
            </thead>
            <tbody>
              {detail.budgetItems.map((item, index) => (
                <tr key={`${item.itemName}-${index}`} className="border-b border-line">
                  <td className="px-4 py-3 text-ink-soft">{item.category}</td>
                  <td className="px-4 py-3 text-ink">{item.itemName}</td>
                  <td className="px-4 py-3 text-ink-soft">{item.calculationBasis}</td>
                  <td className="px-4 py-3 text-right text-ink">{formatWon(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-canvas">
                <td colSpan={3} className="px-4 py-3 text-right font-bold text-ink">
                  합계
                </td>
                <td className="px-4 py-3 text-right font-bold text-navy">
                  {formatWon(detail.actualTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <h2 className="mt-10 text-lg font-bold text-navy">
          모임 사진 ({detail.photos.length}장)
        </h2>
        {detail.photos.length === 0 ? (
          <p className="mt-3 rounded-[14px] border border-line bg-surface px-6 py-10 text-center text-ink-muted">
            등록된 사진이 없습니다.
          </p>
        ) : (
          <ul className="mt-3 grid gap-4 sm:grid-cols-2">
            {detail.photos.map((photo) => (
              <li
                key={photo.photoId}
                className="overflow-hidden rounded-[14px] border border-line bg-surface"
              >
                <img
                  src={photo.imagePath}
                  alt={photo.caption || "활동 사진"}
                  className="aspect-[4/3] w-full bg-canvas object-contain"
                  loading="lazy"
                />
                <div className="border-t border-line px-4 py-3">
                  {photo.isCover ? (
                    <span className="mr-2 rounded-full bg-teal/15 px-2 py-0.5 text-xs font-semibold text-teal">
                      대표
                    </span>
                  ) : null}
                  <span className="text-sm text-ink-soft">{photo.caption || "설명 없음"}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <SiteFooter settings={settings} />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
      <dt className="w-24 shrink-0 text-sm font-medium text-ink-muted">{label}</dt>
      <dd className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{value || "-"}</dd>
    </div>
  );
}

function Block({ title, children }: { title: string; children: string }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold text-navy">{title}</h2>
      <div className="mt-3 whitespace-pre-wrap rounded-[14px] border border-line bg-surface p-6 leading-relaxed text-ink-soft">
        {children || "-"}
      </div>
    </section>
  );
}
