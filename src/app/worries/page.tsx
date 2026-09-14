import { CreateWorryBoardForm } from "@/components/create-worry-board-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { WorryBoard } from "@/components/worry-board";
import { LoadFailureNotice } from "@/components/load-failure-notice";
import { getSessionRole } from "@/lib/auth";
import { loadOr } from "@/lib/load";
import { isMockMode } from "@/lib/repo";
import { getSettings } from "@/lib/settings";
import { getActiveBoardView } from "@/lib/worry-logs";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "고민 나눔 · 뉴비스쿨 2기 동문회",
  robots: { index: false, follow: false },
};

/**
 * 익명 고민 나눔 보드.
 *
 * 로그인을 요구하지 않는다. 링크를 받은 사람 누구나 참여하는 활동이고,
 * 로그인을 붙이면 서버가 누가 썼는지 알게 되어 익명이 아니게 된다.
 * 보드를 만들고 단계를 바꾸는 것만 운영자가 한다.
 *
 * 팀 번호는 주소의 team 값으로 받는다. 서버는 이 값을 저장하지 않고
 * 이번 화면에 무엇을 보여줄지 고르는 데만 쓴다.
 */
export default async function WorriesPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const [settings, role, query] = await Promise.all([
    getSettings(),
    getSessionRole(),
    searchParams,
  ]);

  const selectedTeam = Math.max(0, Math.trunc(Number(query.team) || 0));
  const board = await loadOr("고민 나눔", null, () => getActiveBoardView(selectedTeam));
  const isAdmin = role === "admin";

  return (
    <>
      <SiteHeader settings={settings} />
      <SiteNav role={role} current="worries" />

      <main id="main" className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-12">
        {isMockMode() ? (
          <p
            role="status"
            className="mb-8 rounded-[14px] border border-warning/30 bg-warning-soft px-5 py-4 text-sm leading-relaxed text-warning"
          >
            <strong className="font-bold">검증 모드</strong> · 적은 내용이 실제 스프레드시트에
            저장되지 않습니다.
          </p>
        ) : null}

        {board.failed ? (
          <LoadFailureNotice what="고민 나눔" />
        ) : board.data ? (
          <WorryBoard view={board.data} isAdmin={isAdmin} selectedTeam={selectedTeam} />
        ) : (
          <EmptyState isAdmin={isAdmin} />
        )}
      </main>

      <SiteFooter settings={settings} />
    </>
  );
}

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="space-y-6">
      <div className="rounded-[14px] border border-line bg-surface px-6 py-12 text-center">
        <h1 className="text-xl font-bold text-navy">아직 열린 고민 나눔이 없습니다</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
          모임 시간에 운영자가 보드를 열면 이 화면에서 바로 참여할 수 있습니다. 로그인은
          필요 없습니다.
        </p>
      </div>

      {isAdmin ? <CreateWorryBoardForm /> : null}
    </div>
  );
}
