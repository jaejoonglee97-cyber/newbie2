import { CreatePollForm } from "@/components/create-poll-form";
import { PollCard } from "@/components/poll-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { LoadFailureNotice } from "@/components/load-failure-notice";
import { listCardEntries } from "@/lib/applicants";
import { getSessionRole } from "@/lib/auth";
import { loadOr } from "@/lib/load";
import { listPolls } from "@/lib/poll-logs";
import { isMockMode } from "@/lib/repo";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "동문회 투표 · 뉴비스쿨 2기 동문회",
  robots: { index: false, follow: false },
};

/**
 * 동문회 투표.
 *
 * 로그인 없이 보고 투표할 수 있다. 투표를 만들고 마감·확정하는 것만
 * 운영자가 한다.
 */
export default async function PollsPage() {
  const role = await getSessionRole();

  const [settings, entries, loaded] = await Promise.all([
    getSettings(),
    loadOr("참여자 명단", [], listCardEntries),
    loadOr("투표", [], listPolls),
  ]);

  const memberNames = entries.data.map((e) => e.name).filter(Boolean);
  const polls = loaded.data;
  const activePolls = polls.filter((p) => p.poll.status !== "closed");
  const closedPolls = polls.filter((p) => p.poll.status === "closed");

  return (
    <>
      <SiteHeader settings={settings} />
      <SiteNav role={role} current="polls" />

      <main id="main" className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-12 space-y-10">
        <div>
          <h1 className="text-2xl font-bold text-navy sm:text-3xl">🗳️ 동문회 투표</h1>
          <p className="mt-3 leading-relaxed text-ink-soft">
            모임 일정을 같이 정하거나 모임 참석 여부를 투표할 수 있습니다.
          </p>
        </div>

        {isMockMode() ? (
          <p
            role="status"
            className="rounded-[14px] border border-warning/30 bg-warning-soft px-5 py-4 text-sm leading-relaxed text-warning"
          >
            <strong className="font-bold">검증 모드</strong> · 가상 데이터입니다.
          </p>
        ) : null}

        {/* 운영자 전용: 투표 생성 폼 */}
        {role === "admin" ? (
          <section aria-labelledby="create-poll-heading" className="space-y-3">
            <h2 id="create-poll-heading" className="text-lg font-bold text-navy">
              ⚙️ [운영자] 새 투표 만들기
            </h2>
            <CreatePollForm memberNames={memberNames} />
          </section>
        ) : null}

        {/* 진행 중 / 확정된 투표 */}
        <section aria-labelledby="active-polls-heading" className="space-y-4">
          <h2 id="active-polls-heading" className="text-lg font-bold text-navy">
            📌 진행 중인 투표 ({activePolls.length})
          </h2>

          {loaded.failed ? (
            <LoadFailureNotice what="투표" />
          ) : activePolls.length === 0 ? (
            <div className="rounded-[14px] border border-line bg-surface p-8 text-center text-ink-muted">
              현재 진행 중인 투표가 없습니다.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {activePolls.map((pollResult) => (
                <PollCard
                  key={pollResult.poll.pollId}
                  result={pollResult}
                  memberNames={memberNames}
                  isAdmin={role === "admin"}
                />
              ))}
            </div>
          )}
        </section>

        {/* 마감된 투표 목록 */}
        {closedPolls.length > 0 ? (
          <section aria-labelledby="closed-polls-heading" className="space-y-4 pt-6 border-t border-line">
            <h2 id="closed-polls-heading" className="text-lg font-bold text-ink-muted">
              📁 마감된 투표 목록 ({closedPolls.length})
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {closedPolls.map((pollResult) => (
                <PollCard
                  key={pollResult.poll.pollId}
                  result={pollResult}
                  memberNames={memberNames}
                  isAdmin={role === "admin"}
                />
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <SiteFooter settings={settings} />
    </>
  );
}
