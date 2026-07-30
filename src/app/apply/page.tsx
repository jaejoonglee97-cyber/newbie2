import Link from "next/link";

import { ApplyForm } from "@/components/apply-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { isCardUploadEnabled } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { isMockMode } from "@/lib/repo";
import { getRecruitmentStatus, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "참석 희망 신청 · 뉴비스쿨 2기 동문회",
  robots: { index: false, follow: false },
};

export default async function ApplyPage() {
  const settings = await getSettings();
  const status = getRecruitmentStatus(settings);

  return (
    <>
      <SiteHeader settings={settings} status={status} />

      <main id="main" className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-12">
        <h1 className="text-2xl font-bold text-navy sm:text-3xl">참석 희망 신청</h1>
        {!status.acceptingApplications ? (
          <p className="mt-3 leading-relaxed text-ink-soft">현재는 신청을 받지 않습니다.</p>
        ) : null}

        {isMockMode() && status.acceptingApplications ? (
          <p
            role="status"
            className="mt-6 rounded-[14px] border border-warning/30 bg-warning-soft px-5 py-4 text-sm leading-relaxed text-warning"
          >
            <strong className="font-bold">검증 모드</strong> · 실제 스프레드시트에 연결되지
            않았습니다. 여기서 제출한 내용은 저장되지 않으므로 실제 개인정보를 입력하지
            마세요.
          </p>
        ) : null}

        <div className="mt-8">
          {status.acceptingApplications ? (
            <ApplyForm
              retentionPeriod={settings.privacyRetentionPeriod}
              leaderName={settings.leaderName}
              viceLeaderName={settings.viceLeaderName}
              teamChatName={settings.teamChatName}
              cardUploadEnabled={isCardUploadEnabled()}
            />
          ) : (
            <ClosedNotice
              statusLabel={status.label}
              recruitmentStartAt={settings.recruitmentStartAt}
              recruitmentEndAt={settings.recruitmentEndAt}
            />
          )}
        </div>
      </main>

      <SiteFooter settings={settings} />
    </>
  );
}

function ClosedNotice({
  statusLabel,
  recruitmentStartAt,
  recruitmentEndAt,
}: {
  statusLabel: string;
  recruitmentStartAt: string;
  recruitmentEndAt: string;
}) {
  return (
    <div className="rounded-[14px] border border-line bg-surface px-6 py-10 text-center">
      <h2 className="text-lg font-bold text-navy">{statusLabel}</h2>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
        {statusLabel === "모집 예정" && recruitmentStartAt
          ? `${formatDateTime(recruitmentStartAt)}부터 신청을 받습니다.`
          : statusLabel === "모집 마감" && recruitmentEndAt
            ? `${formatDateTime(recruitmentEndAt)}에 모집이 마감되었습니다. 참여를 원하시면 문의처로 연락해 주세요.`
            : "모집 일정이 확정되면 안내 페이지에 게시합니다."}
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center justify-center rounded-lg border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink-soft hover:border-brand-blue/50"
      >
        안내 페이지로 돌아가기
      </Link>
    </div>
  );
}
