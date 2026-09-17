import { redirect } from "next/navigation";

import { ActivityLogForm } from "@/components/activity-log-form";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getBudgetSummary, listActivities, listMemberOptions } from "@/lib/activity-logs";
import { getSessionRole } from "@/lib/auth";
import { listFeedbackSummaries } from "@/lib/feedback-logs";
import { loadOr } from "@/lib/load";
import { isMockMode } from "@/lib/repo";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "활동일지 작성 · 뉴비스쿨 2기 동문회",
  robots: { index: false, follow: false },
};

export default async function NewActivityPage() {
  const role = await getSessionRole();

  // 활동일지 작성은 운영자만 한다. API 에서도 같은 조건을 다시 확인한다.
  if (role !== "admin") {
    redirect("/login?returnTo=%2Factivities%2Fnew");
  }

  const [settings, members, activities, budget, feedback] = await Promise.all([
    getSettings(),
    listMemberOptions(),
    listActivities(),
    getBudgetSummary(),
    // 참고용이라 못 읽어도 작성은 막지 않는다.
    loadOr("만족도 집계", [], listFeedbackSummaries),
  ]);

  // 다음 회기 번호를 미리 채워 준다.
  const nextSessionNumber =
    activities.reduce((max, activity) => Math.max(max, activity.sessionNumber), 0) + 1;

  return (
    <>
      <SiteHeader settings={settings} />
      <SiteNav role={role} current="activities" />

      <main id="main" className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-12">
        <h1 className="text-2xl font-bold text-navy sm:text-3xl">활동일지 작성</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          동문회 활동일지 양식과 같은 항목을 입력합니다. 저장하면 A4 인쇄본을 바로 내려받을 수
          있습니다.
        </p>

        {isMockMode() ? (
          <p
            role="status"
            className="mt-6 rounded-[14px] border border-warning/30 bg-warning-soft px-5 py-4 text-sm leading-relaxed text-warning"
          >
            <strong className="font-bold">검증 모드</strong> · 실제 스프레드시트와 Drive 에
            저장되지 않습니다. 사진은 대체 이미지로 표시됩니다.
          </p>
        ) : null}

        <div className="mt-10">
          <ActivityLogForm
            members={members}
            minimumParticipants={settings.minimumParticipants}
            activityStartDate={settings.activityStartDate}
            activityEndDate={settings.activityEndDate}
            nextSessionNumber={nextSessionNumber}
            availableBudget={budget.available}
            feedbackSummaries={feedback.data}
          />
        </div>
      </main>

      <SiteFooter settings={settings} />
    </>
  );
}
