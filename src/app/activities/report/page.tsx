import { redirect } from "next/navigation";

import { ReportForm } from "@/components/report-form";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getLatestReportId, getReportDetail } from "@/lib/report-logs";
import { listMemberOptions } from "@/lib/activity-logs";
import { getSessionRole } from "@/lib/auth";
import { isMockMode } from "@/lib/repo";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "결과보고서 작성 · 뉴비스쿨 2기 동문회",
  robots: { index: false, follow: false },
};

export default async function ReportPage() {
  const role = await getSessionRole();
  if (!role) {
    redirect("/login?returnTo=%2Factivities%2Freport");
  }

  const [settings, members, latestReportId] = await Promise.all([
    getSettings(),
    listMemberOptions(),
    getLatestReportId(),
  ]);

  const existingReport = latestReportId ? await getReportDetail(latestReportId) : null;

  return (
    <>
      <SiteHeader settings={settings} />
      <SiteNav role={role} current="activities" />

      <main id="main" className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-12">
        <h1 className="text-2xl font-bold text-navy sm:text-3xl">결과보고서 작성</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          동문회 전체 활동을 종합하여 결과보고서를 작성합니다. 저장하면 인쇄본을 바로 내려받을 수 있습니다.
        </p>

        {isMockMode() ? (
          <p
            role="status"
            className="mt-6 rounded-[14px] border border-warning/30 bg-warning-soft px-5 py-4 text-sm leading-relaxed text-warning"
          >
            <strong className="font-bold">검증 모드</strong> · 실제 스프레드시트와 Drive 에 저장되지 않습니다.
          </p>
        ) : null}

        <div className="mt-10">
          <ReportForm members={members} existingReport={existingReport} />
        </div>
      </main>

      <SiteFooter settings={settings} />
    </>
  );
}
