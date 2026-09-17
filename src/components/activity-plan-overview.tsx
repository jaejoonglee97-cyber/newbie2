import { PLANNED_SESSIONS, type PlannedSession } from "@/lib/program-plan";

export function ActivityPlanOverview() {
  return (
    <section aria-labelledby="activity-plan" className="rounded-[14px] border border-line bg-surface overflow-hidden">
      <div className="bg-navy px-6 py-8 sm:px-8 text-center text-white">
        <h2 id="activity-plan" className="text-xl sm:text-2xl font-bold">
          뉴비스쿨 2기 동문회 활동 계획
        </h2>
        <p className="mt-3 text-white/80 font-medium max-w-2xl mx-auto">
          뉴비스쿨 2기 동문 간 관계 형성 및 상호성장을 위한 네트워크 활동
        </p>
        <p className="mt-2 text-sm text-white/70 max-w-2xl mx-auto">
          뉴비스쿨 2기 교육 수료 이후에도 참여자 간 지속적인 교류를 이어가며 동료 네트워크를 형성하고자 합니다.
        </p>
      </div>

      <div className="px-6 py-8 sm:px-8">
        <h3 className="text-lg font-bold text-navy mb-6">월별 세부 프로그램</h3>
        
        <div className="space-y-6">
          {PLANNED_SESSIONS.map((session) => (
            <ProgramCard key={session.sessionNumber} session={session} />
          ))}
        </div>
      </div>

      <div className="bg-canvas/50 px-6 py-8 sm:px-8 border-t border-line">
        <h3 className="text-lg font-bold text-navy mb-4">우리의 활동이 기대하는 변화</h3>
        <ul className="space-y-3 text-sm leading-relaxed text-ink-soft">
          <li className="flex gap-2">
            <span className="text-brand-blue font-bold">✓</span>
            지속적인 교류를 통해 사회복지 현장에서 서로 지지하고 협력할 수 있는 동료 네트워크 구축
          </li>
          <li className="flex gap-2">
            <span className="text-brand-blue font-bold">✓</span>
            경험과 정보 공유로 실천 현장에 대한 시야를 넓히고, 실무 고민에 대한 상호 지지 및 역량 향상
          </li>
          <li className="flex gap-2">
            <span className="text-brand-blue font-bold">✓</span>
            참여자 중심의 기획과 운영으로 주도성과 소속감을 높이고, 지속적인 동문회 활동 기반 마련
          </li>
        </ul>
      </div>
    </section>
  );
}

function ProgramCard({ session }: { session: PlannedSession }) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 p-5 rounded-xl border border-line bg-canvas transition-colors hover:border-brand-blue/30 hover:shadow-sm">
      <div className="flex-shrink-0 flex items-center sm:items-start sm:w-28">
        <span className="inline-block rounded-full bg-brand-blue/10 px-3 py-1 text-sm font-bold text-brand-blue">
          {session.sessionNumber}회기 · {session.month}
        </span>
      </div>
      <div>
        <h4 className="text-base font-bold text-ink">{session.title}</h4>
        <p className="mt-1 text-sm font-semibold text-ink-soft">{session.subtitle}</p>
        <p className="mt-2 text-sm text-ink-muted leading-relaxed">{session.details}</p>
      </div>
    </div>
  );
}
