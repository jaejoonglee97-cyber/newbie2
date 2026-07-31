import { redirect } from "next/navigation";

import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { listCardEntries } from "@/lib/applicants";
import { getSessionRole } from "@/lib/auth";
import { isMockMode } from "@/lib/repo";
import { getSettings } from "@/lib/settings";
import type { CardEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "명함집 · 뉴비스쿨 2기 동문회",
  robots: { index: false, follow: false },
};

export default async function CardsPage() {
  const role = await getSessionRole();
  if (!role) {
    redirect("/login?returnTo=%2Fcards");
  }

  const [settings, entries] = await Promise.all([getSettings(), listCardEntries()]);
  const withCard = entries.filter((entry) => entry.cardImagePath);

  return (
    <>
      <SiteHeader settings={settings} />
      <SiteNav role={role} current="cards" />

      <main id="main" className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-12">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-navy sm:text-3xl">
              뉴비스쿨 {settings.cohort}기 명함집
            </h1>
            <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">
              교육에서 명함을 나누지 못한 분들을 위해 모았습니다. 총 {entries.length}명, 명함
              등록 {withCard.length}건입니다.
            </p>
          </div>
        </div>

        {isMockMode() ? (
          <p
            role="status"
            className="mt-6 rounded-[14px] border border-warning/30 bg-warning-soft px-5 py-4 text-sm leading-relaxed text-warning"
          >
            <strong className="font-bold">검증 모드</strong> · 가상 인물과 대체 이미지입니다.
          </p>
        ) : null}

        <p className="mt-6 rounded-[14px] border border-line bg-surface px-5 py-4 text-sm leading-relaxed text-ink-soft">
          명함에 적힌 연락처는 동문회 안에서만 사용해 주세요. 화면을 갈무리해 외부에 공유하지
          않으시기를 부탁드립니다. 휴대전화 번호는 운영자만 확인할 수 있어 여기에 표시하지
          않습니다.
        </p>

        {entries.length === 0 ? (
          <p className="mt-10 rounded-[14px] border border-line bg-surface px-6 py-12 text-center text-ink-muted">
            아직 등록된 참여자가 없습니다.
          </p>
        ) : (
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry) => (
              <CardItem key={entry.applicationId} entry={entry} />
            ))}
          </ul>
        )}

        {settings.teamChatUrl ? (
          <section className="mt-12 rounded-[14px] bg-navy px-6 py-8 text-white sm:px-8">
            <h2 className="text-lg font-bold">{settings.teamChatName}</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/85">
              회기 일정과 활동 논의는 채팅방에서 진행합니다.
            </p>
            <a
              href={settings.teamChatUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center justify-center rounded-lg bg-brand-blue px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-blue-hover"
            >
              채팅방 열기
            </a>
          </section>
        ) : null}
      </main>

      <SiteFooter settings={settings} />
    </>
  );
}

function CardItem({ entry }: { entry: CardEntry }) {
  return (
    <li className="overflow-hidden rounded-[14px] border border-line bg-surface">
      {entry.cardImagePath ? (
        <img
          src={entry.cardImagePath}
          alt={`${entry.name} 명함`}
          width={500}
          height={300}
          className="aspect-[5/3] w-full bg-canvas object-contain"
          loading="lazy"
        />
      ) : (
        <div className="flex aspect-[5/3] w-full items-center justify-center bg-canvas">
          <span className="text-sm text-ink-muted">명함 미등록</span>
        </div>
      )}

      <div className="border-t border-line p-4">
        <p className="font-bold text-ink">{entry.name}</p>
        <p className="mt-1 text-sm text-ink-soft">{entry.organization}</p>
        {entry.position ? (
          <p className="mt-0.5 text-sm text-ink-muted">{entry.position}</p>
        ) : null}
      </div>
    </li>
  );
}
