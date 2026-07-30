import type { ProgramSettings } from "@/lib/types";

/**
 * PRD 10.1 하단: 문의처, 개인정보 처리 안내
 *
 * 기장·부기장의 개인 휴대번호와 팀 채팅방 초대 링크는 여기에 두지 않는다.
 * 공개 페이지에 두면 누구나 접근할 수 있어, 이름과 역할만 표시한다.
 */
export function SiteFooter({ settings }: { settings: ProgramSettings }) {
  const officers = [
    { role: "기장", name: settings.leaderName },
    { role: "부기장", name: settings.viceLeaderName },
  ].filter((officer) => officer.name);

  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-10 sm:grid-cols-2 sm:px-8">
        <section>
          <h2 className="text-sm font-bold text-ink">문의처</h2>

          {officers.length > 0 ? (
            <dl className="mt-3 space-y-1.5 text-sm text-ink-soft">
              {officers.map((officer) => (
                <div key={officer.role} className="flex gap-2">
                  <dt className="w-16 shrink-0 text-ink-muted">{officer.role}</dt>
                  <dd>{officer.name}</dd>
                </div>
              ))}
              {settings.contactEmail ? (
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-ink-muted">이메일</dt>
                  <dd>
                    <a
                      className="underline hover:text-brand-blue"
                      href={`mailto:${settings.contactEmail}`}
                    >
                      {settings.contactEmail}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">문의처 정보를 준비 중입니다.</p>
          )}

          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            동문회 소통은 {settings.teamChatName}에서 진행합니다. 참여가 확정되면 기장·부기장이
            초대해 드립니다.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-bold text-ink">개인정보 처리 안내</h2>
          <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-ink-soft">
            <li>수집 항목: 성명, 소속기관, 직책, 휴대전화</li>
            <li>선택 항목: 명함 이미지</li>
            <li>이용 목적: 동문회 참여자 확정, 활동 안내 및 연락, 동문 명함집 제작</li>
            <li>보유 기간: {settings.privacyRetentionPeriod}</li>
            <li>동의를 거부하실 수 있으나, 이 경우 참여 신청이 어렵습니다.</li>
            <li>휴대전화 번호는 운영자만 확인하며 다른 참여자에게 공개하지 않습니다.</li>
            <li>명함 이미지는 동의하신 경우에만 동문회 참여자에게 공개됩니다.</li>
          </ul>
        </section>
      </div>

      <div className="border-t border-line">
        <p className="mx-auto max-w-5xl px-5 py-5 text-xs text-ink-muted sm:px-8">
          © {settings.organizationName} · {settings.programName}
        </p>
      </div>
    </footer>
  );
}
