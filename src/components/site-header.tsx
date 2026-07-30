import { RecruitmentBadge } from "./recruitment-badge";
import { getLogo } from "@/lib/logo";
import type { ProgramSettings, RecruitmentStatus } from "@/lib/types";

export function SiteHeader({
  settings,
  status,
}: {
  settings: ProgramSettings;
  status?: RecruitmentStatus;
}) {
  const logo = getLogo();

  return (
    <header className="bg-navy text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-7 sm:px-8 sm:py-9">
        {logo ? (
          <div
            className={
              logo.needsBackdrop
                ? "inline-flex w-fit items-center rounded-md bg-white px-3 py-2"
                : "inline-flex w-fit items-center"
            }
          >
            <img
              src={logo.src}
              alt={settings.organizationName}
              className="h-8 w-auto sm:h-9"
            />
          </div>
        ) : (
          <p className="text-sm font-medium tracking-wide text-white/75">
            {settings.organizationName}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold leading-snug sm:text-3xl">
            {settings.programName}
          </h1>
          {status ? <RecruitmentBadge status={status} /> : null}
        </div>

        <p className="max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
          2026년 신입사회복지사 역량강화교육 뉴비스쿨 {settings.cohort}기 수료자가 함께
          만드는 동료 지지 모임입니다.
        </p>
      </div>
    </header>
  );
}
