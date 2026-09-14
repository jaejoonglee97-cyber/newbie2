import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { TeamDraw } from "@/components/team-draw";
import { listCardEntries } from "@/lib/applicants";
import { getSessionRole } from "@/lib/auth";
import { loadOr } from "@/lib/load";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "조 편성 · 뉴비스쿨 2기 동문회",
  robots: { index: false, follow: false },
};

/**
 * 랜덤 조 편성.
 *
 * 모임 자리에서 바로 쓰는 도구라 로그인을 요구하지 않는다. 이름은 메인
 * 화면에서도 보이는 값이고, 여기서 더 넘기는 개인정보는 없다.
 *
 * 뽑기와 결과는 전부 브라우저에서 처리한다. 서버는 이름 목록을 내려보내기만
 * 하고 누가 몇 조가 됐는지는 받지도, 남기지도 않는다.
 */
export default async function TeamsPage() {
  const [settings, role, entries] = await Promise.all([
    getSettings(),
    getSessionRole(),
    loadOr("참여자 명단", [], listCardEntries),
  ]);

  const memberNames = entries.data.map((entry) => entry.name).filter(Boolean);

  return (
    <>
      <SiteHeader settings={settings} />
      <SiteNav role={role} current="teams" />

      <main id="main" className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-12">
        <h1 className="text-2xl font-bold text-navy sm:text-3xl">조 편성</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          참여할 사람을 고르고 조 개수나 조당 인원만 정하면 무작위로 나눕니다. 결과는 저장하지
          않으니 필요하면 복사해서 채팅방에 올려 주세요.
        </p>

        <div className="mt-8">
          <TeamDraw memberNames={memberNames} />
        </div>
      </main>

      <SiteFooter settings={settings} />
    </>
  );
}
