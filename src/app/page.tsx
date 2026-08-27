import Link from "next/link";

import { ConstellationIntro } from "@/components/constellation-intro";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { ActivityPlanOverview } from "@/components/activity-plan-overview";
import { listCardEntries } from "@/lib/applicants";
import { getSessionRole } from "@/lib/auth";
import { isMockMode } from "@/lib/repo";
import { getSettings } from "@/lib/settings";

// 참여자 명단을 매 요청마다 읽는다.
export const dynamic = "force-dynamic";

/**
 * 메인 화면.
 *
 * 모집이 끝났으므로 모집·운영 안내는 두지 않는다. 화면을 열면 참여자 이름이
 * 바로 보이는 것이 이 페이지의 목적이다.
 */
export default async function AlumniHomePage() {
  const [settings, role, entries] = await Promise.all([
    getSettings(),
    getSessionRole(),
    listCardEntries(),
  ]);

  /*
   * 성좌로 내려보낼 값을 여기서 걸러낸다.
   *
   * 이름은 누구에게나 보인다. 한 줄 소개는 동의 범위가 "로그인한 참여자에게
   * 공개"이므로 비로그인 방문자에게는 빈 문자열로 지운다. 화면에서 감추는 게
   * 아니라 서버에서 아예 지워 보내므로, 개발자도구로도 볼 수 없다.
   * 소속기관·직책·기대하는 점·연락처는 애초에 넘기지 않는다.
   */
  const canSeeIntroduction = role !== null;
  const stars = entries.map((entry) => ({
    name: entry.name,
    introduction: canSeeIntroduction ? entry.introduction : "",
  }));

  return (
    <>
      <SiteHeader settings={settings} />
      <SiteNav role={role} current="home" />

      <main id="main">
        <ConstellationIntro stars={stars} canSeeIntroduction={canSeeIntroduction} />

        <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-12">
          {isMockMode() ? <MockNotice /> : null}
          <MemberAreaGuide role={role} teamChatName={settings.teamChatName} />
          <ActivityPlanOverview />
        </div>
      </main>

      <SiteFooter settings={settings} />
    </>
  );
}

/**
 * 명함집·활동기록으로 가는 안내.
 *
 * 비밀번호는 화면에 적지 않는다. 기장·부기장이 채팅방으로 공유한다.
 */
function MemberAreaGuide({
  role,
  teamChatName,
}: {
  role: "member" | "admin" | null;
  teamChatName: string;
}) {
  return (
    <section aria-labelledby="member-area">
      <div className="rounded-[14px] border border-line bg-surface px-6 py-7 sm:px-8">
        <h2 id="member-area" className="text-lg font-bold text-navy">
          동문회 기록 보기
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          {role
            ? "로그인된 상태입니다. 아래에서 바로 이동하실 수 있습니다."
            : `동문회 공통 비밀번호를 입력하면 명함집과 활동 기록을 보실 수 있습니다. 비밀번호는 ${teamChatName}에서 안내드립니다.`}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link
            href="/cards"
            className="flex flex-col gap-1 rounded-lg border border-line px-5 py-4 transition-colors hover:border-brand-blue/60 hover:bg-canvas"
          >
            <span className="font-bold text-ink">명함집</span>
            <span className="text-xs leading-relaxed text-ink-muted">
              교육에서 명함을 나누지 못한 동문의 명함을 모았습니다.
            </span>
          </Link>

          <Link
            href="/activities"
            className="flex flex-col gap-1 rounded-lg border border-line px-5 py-4 transition-colors hover:border-brand-blue/60 hover:bg-canvas"
          >
            <span className="font-bold text-ink">활동 기록</span>
            <span className="text-xs leading-relaxed text-ink-muted">
              회기별 모임 내용, 예산 사용 내역, 사진을 확인합니다.
            </span>
          </Link>
        </div>

        {role ? null : (
          <p className="mt-4 text-sm text-ink-muted">
            운영자는 같은 화면에서 운영자 비밀번호를 입력하시면 신청자 명단까지 보실 수
            있습니다.
          </p>
        )}
      </div>
    </section>
  );
}

/** 실데이터 연결 전임을 화면에서 분명히 알린다. */
function MockNotice() {
  return (
    <p
      role="status"
      className="mb-8 rounded-[14px] border border-warning/30 bg-warning-soft px-5 py-4 text-sm leading-relaxed text-warning"
    >
      <strong className="font-bold">검증 모드</strong> · 지금 보이는 이름은 가상 인물입니다.
      Google Sheets 서비스 계정을 연결하면 실제 참여자 명단을 읽습니다.
    </p>
  );
}
