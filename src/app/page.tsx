import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatDate, formatDateShort, formatDateTime, formatWon } from "@/lib/format";
import { isMockMode } from "@/lib/repo";
import { getRecruitmentStatus, getSettings } from "@/lib/settings";

// 모집 상태가 현재 시각에 따라 달라지므로 매 요청마다 계산한다.
export const dynamic = "force-dynamic";

const PROCESS_STEPS = [
  { title: "주제 설정", detail: "회기별로 모임 주제를 자율적으로 정합니다." },
  { title: "활동 신청", detail: "주제·일시·예산·참여 예정자를 담아 신청합니다." },
  { title: "활동 진행", detail: "승인된 일정에 따라 모임을 진행합니다." },
  { title: "활동 기록 제출", detail: "내용·출석·예산·사진을 활동일지로 남깁니다." },
];

const NOTICES = [
  "활동 주제는 자율입니다. 추천 도서 토론, 기관 방문, 슈퍼바이저 초빙 등으로 운영할 수 있습니다.",
  "한 회기를 진행하려면 뉴비 7명 이상이 참여해야 합니다.",
  "지원금은 회기별 활동 신청과 활동일지의 예산 내역으로 정산합니다.",
  "활동 종료 후에는 활동일지와 사진을 제출해 주셔야 합니다.",
];

export default async function RecruitmentPage() {
  const settings = await getSettings();
  const status = getRecruitmentStatus(settings);

  const cards = [
    {
      label: "모집 기간",
      value:
        settings.recruitmentStartAt && settings.recruitmentEndAt
          ? `${formatDateShort(settings.recruitmentStartAt)} ~ ${formatDateShort(settings.recruitmentEndAt)}`
          : "준비 중",
      detail:
        settings.recruitmentEndAt && status.phase === "open"
          ? `${formatDateTime(settings.recruitmentEndAt)} 마감`
          : undefined,
    },
    {
      label: "활동 기간",
      value: `${formatDateShort(settings.activityStartDate)} ~ ${formatDateShort(settings.activityEndDate)}`,
      detail: `${formatDate(settings.activityStartDate)}부터 시작`,
    },
    {
      label: "총 지원금",
      value: formatWon(settings.totalBudget),
      detail: "동문회 전체 활동에 사용",
    },
    {
      label: "참여 조건",
      value: `${settings.minimumParticipants}명 이상`,
      detail: `뉴비스쿨 ${settings.cohort}기 수료자 대상`,
    },
  ];

  return (
    <>
      <SiteHeader settings={settings} status={status} />

      <main id="main" className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-12">
        {isMockMode() ? <MockNotice /> : null}

        <section aria-labelledby="summary" className="mb-12">
          <h2 id="summary" className="sr-only">
            운영 개요
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <div
                key={card.label}
                className="rounded-[14px] border border-line bg-surface p-5 shadow-sm"
              >
                <dt className="text-sm font-medium text-ink-muted">{card.label}</dt>
                <dd className="mt-2 text-lg font-bold leading-snug text-navy">
                  {card.value}
                </dd>
                {card.detail ? (
                  <p className="mt-1.5 text-xs text-ink-muted">{card.detail}</p>
                ) : null}
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="purpose" className="mb-12">
          <h2 id="purpose" className="text-xl font-bold text-navy sm:text-2xl">
            활동 취지
          </h2>
          <div className="mt-4 space-y-4 rounded-[14px] border border-line bg-surface p-6 text-ink-soft sm:p-7">
            <p>
              첫 현장에서 마주하는 고민은 혼자 풀기 어렵습니다. 뉴비스쿨 {settings.cohort}기
              동문회는 교육에서 만난 동료들과 계속 이어지며, 서로의 경험을 나누고 실천을
              점검하는 자리를 만듭니다.
            </p>
            <p>
              회기별 주제는 참여자가 직접 정합니다. 함께 읽고 싶은 책, 궁금했던 기관, 만나고
              싶은 슈퍼바이저 무엇이든 가능합니다. 중부재단은 활동에 필요한 비용을 지원하고,
              기록이 남도록 돕습니다.
            </p>
          </div>
        </section>

        <section aria-labelledby="process" className="mb-12">
          <h2 id="process" className="text-xl font-bold text-navy sm:text-2xl">
            운영 절차
          </h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROCESS_STEPS.map((step, index) => (
              <li
                key={step.title}
                className="rounded-[14px] border border-line bg-surface p-5"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-teal/15 text-sm font-bold text-teal">
                  {index + 1}
                </span>
                <h3 className="mt-3 font-bold text-ink">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{step.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="notice" className="mb-12">
          <h2 id="notice" className="text-xl font-bold text-navy sm:text-2xl">
            유의사항
          </h2>
          <ul className="mt-4 space-y-3 rounded-[14px] border border-line bg-surface p-6 sm:p-7">
            {NOTICES.map((notice) => (
              <li key={notice} className="flex gap-3 text-ink-soft">
                <span aria-hidden="true" className="mt-0.5 shrink-0 text-brand-blue">
                  ·
                </span>
                <span className="leading-relaxed">{notice}</span>
              </li>
            ))}
          </ul>

          {settings.recruitmentNoticeUrl ? (
            <p className="mt-4">
              <a
                href={settings.recruitmentNoticeUrl}
                className="text-sm font-semibold text-brand-blue underline hover:text-brand-blue-hover"
                target="_blank"
                rel="noreferrer"
              >
                모집 안내문 전문 보기
              </a>
            </p>
          ) : null}
        </section>

        <ApplyCallToAction
          accepting={status.acceptingApplications}
          statusLabel={status.label}
          recruitmentStartAt={settings.recruitmentStartAt}
        />
      </main>

      <SiteFooter settings={settings} />
    </>
  );
}

function ApplyCallToAction({
  accepting,
  statusLabel,
  recruitmentStartAt,
}: {
  accepting: boolean;
  statusLabel: string;
  recruitmentStartAt: string;
}) {
  if (accepting) {
    return (
      <section className="rounded-[14px] bg-navy px-6 py-9 text-center text-white sm:px-8">
        <h2 className="text-xl font-bold sm:text-2xl">함께하시겠습니까?</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/85">
          3분 이내로 신청할 수 있습니다. 성명, 소속기관, 직책, 휴대전화만 확인하며, 명함
          이미지는 선택적으로 첨부하실 수 있습니다.
        </p>
        <Link
          href="/apply"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand-blue px-8 py-3.5 text-base font-bold text-white transition-colors hover:bg-brand-blue-hover"
        >
          참석 희망 신청하기
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-[14px] border border-line bg-surface px-6 py-9 text-center sm:px-8">
      <h2 className="text-xl font-bold text-navy sm:text-2xl">{statusLabel}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
        {recruitmentStartAt
          ? `${formatDateTime(recruitmentStartAt)}부터 신청을 받습니다.`
          : "모집 일정이 확정되면 이 페이지에 안내합니다."}
      </p>
      <p className="mt-4 text-sm text-ink-muted">문의는 하단 연락처로 부탁드립니다.</p>
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
      <strong className="font-bold">검증 모드</strong> · 지금 보이는 값은 가상 데이터입니다.
      Google Sheets 서비스 계정을 연결하면 실제 설정값을 읽습니다. 이 화면에서 접수한
      신청은 저장되지 않습니다.
    </p>
  );
}
