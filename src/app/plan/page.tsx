import { ActivityPlanOverview } from "@/components/activity-plan-overview";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { getSessionRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "활동 계획 · 뉴비스쿨 2기 동문회",
  robots: { index: false, follow: false },
};

/**
 * 활동 계획 챕터.
 *
 * 메인 아래에 붙어 있던 계획표를 별도 화면으로 옮겼다. 메인은 성좌만 보여주고,
 * 계획을 보려는 사람은 스크롤 대신 탭으로 바로 온다.
 *
 * 개인정보가 없는 프로그램 안내이므로 로그인을 요구하지 않는다.
 */
export default async function PlanPage() {
  const [settings, role] = await Promise.all([getSettings(), getSessionRole()]);

  return (
    <>
      <SiteHeader settings={settings} />
      <SiteNav role={role} current="plan" />

      <main id="main" className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-12">
        <h1 className="sr-only">활동 계획</h1>
        <ActivityPlanOverview />
      </main>

      <SiteFooter settings={settings} />
    </>
  );
}
