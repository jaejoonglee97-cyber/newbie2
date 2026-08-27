import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getBudgetSummary, listActivities } from "@/lib/activity-logs";
import { getSessionRole } from "@/lib/auth";
import { formatDateShort, formatWon } from "@/lib/format";
import { isMockMode } from "@/lib/repo";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "활동 기록 · 뉴비스쿨 2기 동문회",
  robots: { index: false, follow: false },
};

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; photoFilesRemaining?: string }>;
}) {
  const role = await getSessionRole();
  if (!role) {
    redirect("/login?returnTo=%2Factivities");
  }

  const [settings, activities, budget, query] = await Promise.all([
    getSettings(),
    listActivities(),
    getBudgetSummary(),
    searchParams,
  ]);

  return (
    <>
      <SiteHeader settings={settings} />
      <SiteNav role={role} current="activities" />

      <main id="main" className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-navy sm:text-3xl">활동 기록</h1>
            <p className="mt-3 leading-relaxed text-ink-soft">
              회기별 활동일지를 작성하고 A4 형식으로 인쇄하거나 PDF 로 저장할 수 있습니다.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href="/activities/report"
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-line bg-surface px-6 py-3 text-sm font-bold text-ink-soft transition-colors hover:border-brand-blue/50"
            >
              결과보고서 보기/작성
            </Link>
            <Link
              href="/activities/new"
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-blue px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-blue-hover"
            >
              + 활동일지 작성
            </Link>
          </div>
        </div>

        {query.deleted ? (
          <p
            role="status"
            className="mt-6 rounded-[14px] border border-success/30 bg-success-soft px-5 py-4 text-sm leading-relaxed text-success"
          >
            <strong className="font-bold">삭제 완료</strong> · &ldquo;{query.deleted}&rdquo;
            활동일지를 지웠습니다.
            {query.photoFilesRemaining ? (
              <>
                {" "}
                다만 사진 파일 {query.photoFilesRemaining}개는 Drive 에서 지우지 못했습니다.
                활동 사진 폴더에서 직접 정리해 주세요.
              </>
            ) : null}
          </p>
        ) : null}

        {isMockMode() ? (
          <p
            role="status"
            className="mt-6 rounded-[14px] border border-warning/30 bg-warning-soft px-5 py-4 text-sm leading-relaxed text-warning"
          >
            <strong className="font-bold">검증 모드</strong> · 저장한 내용은 실제 스프레드시트에
            기록되지 않습니다.
          </p>
        ) : null}

        <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="총 지원금" value={formatWon(budget.totalBudget)} />
          <Stat label="완료 활동 사용액" value={formatWon(budget.confirmedSpent)} />
          <Stat label="승인 예정액" value={formatWon(budget.reserved)} />
          <Stat
            label="잔액"
            value={formatWon(budget.remaining)}
            detail={`가용 ${formatWon(budget.available)}`}
          />
        </dl>

        <h2 className="mt-12 text-lg font-bold text-navy">회기 목록</h2>

        {activities.length === 0 ? (
          <p className="mt-4 rounded-[14px] border border-line bg-surface px-6 py-12 text-center text-ink-muted">
            아직 기록된 활동이 없습니다. 첫 회기 활동일지를 작성해 보세요.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {activities.map((activity) => (
              <li
                key={activity.activityId}
                className="rounded-[14px] border border-line bg-surface p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-teal">
                      {activity.sessionNumber}회기 · {activity.status}
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-ink">{activity.topic}</h3>
                    <p className="mt-1 text-sm text-ink-soft">
                      {formatDateShort(activity.activityDate)} {activity.startTime}~
                      {activity.endTime} · {activity.location}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/activities/${activity.activityId}`}
                      className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:border-brand-blue/50"
                    >
                      상세
                    </Link>
                    <Link
                      href={`/activities/${activity.activityId}/print`}
                      target="_blank"
                      className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-hover"
                    >
                      인쇄
                    </Link>
                  </div>
                </div>

                <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4 text-sm">
                  <Meta label="작성자" value={activity.authorName || "-"} />
                  <Meta label="실제 참석" value={`${activity.attendedCount}명`} />
                  <Meta label="사용액" value={formatWon(activity.actualAmount)} />
                  <Meta label="사진" value={`${activity.photoCount}장`} />
                </dl>
              </li>
            ))}
          </ul>
        )}
      </main>

      <SiteFooter settings={settings} />
    </>
  );
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-[14px] border border-line bg-surface p-5">
      <dt className="text-sm font-medium text-ink-muted">{label}</dt>
      <dd className="mt-2 text-xl font-bold text-navy">{value}</dd>
      {detail ? <p className="mt-1.5 text-xs text-ink-muted">{detail}</p> : null}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}
