import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ActivityLogForm } from "@/components/activity-log-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { getActivityEditValues, getBudgetSummary, listMemberOptions } from "@/lib/activity-logs";
import { getSessionRole } from "@/lib/auth";
import { listFeedbackSummaries } from "@/lib/feedback-logs";
import { loadOr } from "@/lib/load";
import { isMockMode } from "@/lib/repo";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "활동일지 수정 · 뉴비스쿨 2기 동문회",
  robots: { index: false, follow: false },
};

/**
 * 활동일지 수정 화면.
 *
 * 운영자만 들어올 수 있다. 로그인이 공유 비밀번호라서 작성자 본인을 구분할
 * 방법이 없으므로, 남의 기록을 고치는 일을 막기 위해 운영자로 제한한다.
 * API 에서도 같은 조건을 다시 확인한다. 화면만 막으면 우회할 수 있다.
 */
export default async function EditActivityPage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const role = await getSessionRole();
  const { activityId } = await params;

  if (!role) {
    redirect(`/login?returnTo=${encodeURIComponent(`/activities/${activityId}/edit`)}`);
  }

  const [settings, initial, members, budget, feedback] = await Promise.all([
    getSettings(),
    getActivityEditValues(activityId),
    listMemberOptions(),
    getBudgetSummary(),
    // 참고용이라 못 읽어도 수정은 막지 않는다.
    loadOr("만족도 집계", [], listFeedbackSummaries),
  ]);

  if (!initial) {
    notFound();
  }

  if (role !== "admin") {
    return (
      <>
        <SiteHeader settings={settings} />
        <SiteNav role={role} current="activities" />

        <main id="main" className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-8">
          <h1 className="text-xl font-bold text-navy">운영자만 수정할 수 있습니다</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            고쳐야 할 내용이 있으면 기장·부기장에게 알려 주세요.
          </p>
          <Link
            href={`/activities/${activityId}`}
            className="mt-8 inline-flex items-center justify-center rounded-lg border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink-soft hover:border-brand-blue/50"
          >
            활동 상세로 돌아가기
          </Link>
        </main>

        <SiteFooter settings={settings} />
      </>
    );
  }

  return (
    <>
      <SiteHeader settings={settings} />
      <SiteNav role={role} current="activities" />

      <main id="main" className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-12">
        <p className="text-sm font-semibold text-teal">{initial.sessionNumber}회기</p>
        <h1 className="mt-2 text-2xl font-bold text-navy sm:text-3xl">활동일지 수정</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          저장하면 기존 기록을 덮어씁니다. 참여자와 예산 내역은 입력한 내용으로 교체됩니다.
        </p>

        {isMockMode() ? (
          <p
            role="status"
            className="mt-6 rounded-[14px] border border-warning/30 bg-warning-soft px-5 py-4 text-sm leading-relaxed text-warning"
          >
            <strong className="font-bold">검증 모드</strong> · 실제 스프레드시트와 Drive 에
            저장되지 않습니다.
          </p>
        ) : null}

        <div className="mt-10">
          <ActivityLogForm
            members={members}
            minimumParticipants={settings.minimumParticipants}
            activityStartDate={settings.activityStartDate}
            activityEndDate={settings.activityEndDate}
            nextSessionNumber={initial.sessionNumber}
            availableBudget={budget.available}
            feedbackSummaries={feedback.data}
            initial={initial}
          />
        </div>
      </main>

      <SiteFooter settings={settings} />
    </>
  );
}
