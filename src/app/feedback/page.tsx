import { FeedbackForm } from "@/components/feedback-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { LoadFailureNotice } from "@/components/load-failure-notice";
import { getSessionRole } from "@/lib/auth";
import { getFeedbackView } from "@/lib/feedback-logs";
import { loadOr } from "@/lib/load";
import { SCORE_LABELS, type SatisfactionScore, type SessionFeedback } from "@/lib/feedback-types";
import { isMockMode } from "@/lib/repo";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "회차 만족도 · 뉴비스쿨 2기 동문회",
  robots: { index: false, follow: false },
};

/**
 * 회차별 만족도 조사.
 *
 * 응답은 로그인 없이 누구나 남긴다. 집계는 운영자만 본다.
 * 응답이 적을 때 모두에게 공개하면 누가 어떤 점수를 줬는지 서로 짐작하게 된다.
 */
export default async function FeedbackPage() {
  const [settings, role] = await Promise.all([getSettings(), getSessionRole()]);
  const isAdmin = role === "admin";

  /*
   * 회차 목록을 못 읽어도 폼은 띄운다. 회차를 못 고르는 것뿐이고,
   * 만족도 화면 자체가 안 열릴 이유는 없다.
   */
  const loaded = await loadOr(
    "만족도 응답",
    { sessions: [], suggestedSessionNumber: 0, summaries: [], totalCount: 0 },
    () => getFeedbackView(isAdmin),
  );
  const view = loaded.data;

  return (
    <>
      <SiteHeader settings={settings} />
      <SiteNav role={role} current="feedback" />

      <main id="main" className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-12">
        <h1 className="text-2xl font-bold text-navy sm:text-3xl">회차 만족도</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          이번 회차가 어떠셨는지 짧게 남겨 주세요. 1분이면 됩니다. 이름을 묻지 않고 누가
          남겼는지 기록하지 않습니다.
        </p>

        {isMockMode() ? (
          <p
            role="status"
            className="mt-6 rounded-[14px] border border-warning/30 bg-warning-soft px-5 py-4 text-sm leading-relaxed text-warning"
          >
            <strong className="font-bold">검증 모드</strong> · 실제 스프레드시트에 저장되지
            않습니다.
          </p>
        ) : null}

        {loaded.failed ? (
          <div className="mt-6">
            <LoadFailureNotice what="지난 회차 목록" />
          </div>
        ) : null}

        <div className="mt-8">
          <FeedbackForm
            sessions={view.sessions}
            suggestedSessionNumber={view.suggestedSessionNumber}
          />
        </div>

        {isAdmin ? <AdminSummary summaries={view.summaries} total={view.totalCount} /> : null}
      </main>

      <SiteFooter settings={settings} />
    </>
  );
}

/** 운영자에게만 보이는 집계 */
function AdminSummary({
  summaries,
  total,
}: {
  summaries: SessionFeedback[];
  total: number;
}) {
  return (
    <section
      aria-labelledby="feedback-summary"
      className="mt-12 rounded-[14px] border border-brand-blue/30 bg-brand-blue/5 p-6 sm:p-7"
    >
      <h2 id="feedback-summary" className="text-base font-bold text-navy">
        운영자 · 응답 모아보기 (전체 {total}건)
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        참여자에게는 이 칸이 보이지 않습니다. 응답이 적을 때 모두에게 공개하면 누가 어떤
        점수를 줬는지 서로 짐작하게 되어 솔직히 쓰기 어려워집니다.
      </p>

      {summaries.length === 0 ? (
        <p className="mt-6 rounded-lg bg-surface px-5 py-8 text-center text-sm text-ink-muted">
          아직 모인 응답이 없습니다.
        </p>
      ) : (
        <ul className="mt-6 space-y-5">
          {summaries.map((summary) => (
            <li key={summary.sessionNumber} className="rounded-[14px] bg-surface p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-bold text-ink">
                  {summary.sessionNumber}회기
                  {summary.topic ? (
                    <span className="ml-2 font-medium text-ink-muted">{summary.topic}</span>
                  ) : null}
                </h3>
                <p className="text-sm font-semibold text-brand-blue">
                  평균 {summary.averageScore}점 · {summary.count}명 응답
                </p>
              </div>

              <ul className="mt-3 space-y-1">
                {([5, 4, 3, 2, 1] as SatisfactionScore[]).map((score) => {
                  const count = summary.scoreCounts[score];
                  const ratio = summary.count > 0 ? (count / summary.count) * 100 : 0;

                  return (
                    <li key={score} className="flex items-center gap-3 text-xs">
                      <span className="w-24 shrink-0 text-ink-muted">
                        {score} {SCORE_LABELS[score]}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
                        <span
                          className="block h-full rounded-full bg-brand-blue"
                          style={{ width: `${ratio}%` }}
                        />
                      </span>
                      <span className="w-8 shrink-0 text-right font-semibold text-ink-soft">
                        {count}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <TextList title="좋았던 점" items={summary.bestParts} />
              <TextList title="다음 회차 희망 활동" items={summary.nextWishes} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TextList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="text-sm font-bold text-ink-soft">
        {title} ({items.length})
      </p>
      <ul className="mt-2 space-y-2">
        {items.map((item, index) => (
          <li
            key={`${title}-${index}`}
            className="rounded-lg bg-canvas px-4 py-2.5 text-sm leading-relaxed text-ink-soft"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
