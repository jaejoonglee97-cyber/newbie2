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
          <ProgramCard 
            month="9월"
            title="다시 만나 반가워요"
            subtitle="관계형성과 동문회 방향 만들기"
            details="오리엔테이션, 근황 나눔, 관계 형성 활동, 동문회 활동 기대사항 공유"
          />
          <ProgramCard 
            month="10월"
            title="우리들의 현장 이야기"
            subtitle="고민과 경험 나누기"
            details="현장 고민 및 경험 나눔, 주제별 소그룹 대화, 서로의 실천방법·아이디어 공유"
          />
          <ProgramCard 
            month="11월"
            title="서로에게 힘이되는 시간"
            subtitle="사회복지사를 위한 쉼과 회복"
            details="마음돌봄 프로그램 참여, 자기돌봄 활동, 활동 소감 및 서로의 마음 나눔"
          />
          <ProgramCard 
            month="12월"
            title="중부재단 동문회 파티"
            subtitle="연결을 넓히고 이어가기"
            details="활동 사진·기록 돌아보기, 동문회 활동 소감 공유, 서로에게 전하는 메시지, 차년도 활동 의견 나눔"
          />
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

function ProgramCard({
  month,
  title,
  subtitle,
  details,
}: {
  month: string;
  title: string;
  subtitle: string;
  details: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 p-5 rounded-xl border border-line bg-canvas transition-colors hover:border-brand-blue/30 hover:shadow-sm">
      <div className="flex-shrink-0 flex items-center sm:items-start sm:w-20">
        <span className="inline-block rounded-full bg-brand-blue/10 px-3 py-1 text-sm font-bold text-brand-blue">
          {month}
        </span>
      </div>
      <div>
        <h4 className="text-base font-bold text-ink">{title}</h4>
        <p className="mt-1 text-sm font-semibold text-ink-soft">{subtitle}</p>
        <p className="mt-2 text-sm text-ink-muted leading-relaxed">{details}</p>
      </div>
    </div>
  );
}
