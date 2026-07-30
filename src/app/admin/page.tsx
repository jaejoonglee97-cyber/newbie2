import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { MemberNav } from "@/components/member-nav";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { listApplicantRecords } from "@/lib/applicants";
import { getSessionRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { isMockMode } from "@/lib/repo";
import { getRecruitmentStatus, getSettings } from "@/lib/settings";
import type { ApplicantRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "신청자 명단 · 뉴비스쿨 2기 동문회",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const role = await getSessionRole();
  if (!role) {
    redirect("/login?returnTo=%2Fadmin");
  }
  if (role !== "admin") {
    redirect("/cards");
  }

  const [settings, records] = await Promise.all([getSettings(), listApplicantRecords()]);
  const status = getRecruitmentStatus(settings);

  const confirmed = records.filter((record) => record.applicationStatus === "참여확정").length;
  const reviewing = records.filter((record) => record.applicationStatus === "검토중").length;
  const cards = records.filter((record) => record.hasCard).length;

  return (
    <>
      <SiteHeader settings={settings} status={status} />
      <MemberNav role={role} current="admin" />

      <main id="main" className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
        <h1 className="text-2xl font-bold text-navy sm:text-3xl">신청자 명단</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          휴대전화 번호가 포함된 화면입니다. 화면 공유나 갈무리에 주의해 주세요.
        </p>

        {isMockMode() ? (
          <p
            role="status"
            className="mt-6 rounded-[14px] border border-warning/30 bg-warning-soft px-5 py-4 text-sm leading-relaxed text-warning"
          >
            <strong className="font-bold">검증 모드</strong> · 가상 인물 데이터입니다.
          </p>
        ) : null}

        <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="전체 신청" value={`${records.length}명`} />
          <Stat label="검토 중" value={`${reviewing}명`} />
          <Stat
            label="참여 확정"
            value={`${confirmed}명`}
            detail={
              confirmed < settings.minimumParticipants
                ? `최소 ${settings.minimumParticipants}명까지 ${settings.minimumParticipants - confirmed}명 부족`
                : "최소 인원 충족"
            }
            warn={confirmed < settings.minimumParticipants}
          />
          <Stat label="명함 등록" value={`${cards}건`} />
        </dl>

        <div className="mt-10 overflow-x-auto rounded-[14px] border border-line bg-surface">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <caption className="sr-only">신청자 명단</caption>
            <thead>
              <tr className="border-b border-line bg-canvas text-left">
                <Th>성명</Th>
                <Th>소속기관</Th>
                <Th>직책</Th>
                <Th>휴대전화</Th>
                <Th>명함</Th>
                <Th>상태</Th>
                <Th>신청 일시</Th>
                <Th>메모</Th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-ink-muted">
                    아직 접수된 신청이 없습니다.
                  </td>
                </tr>
              ) : (
                records.map((record) => <Row key={record.applicationId} record={record} />)
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-ink-muted">
          상태 변경과 명단 내보내기는 아직 이 화면에서 할 수 없습니다. 지금은 스프레드시트의{" "}
          <code className="rounded bg-canvas px-1.5 py-0.5 text-xs">applicants</code> 시트에서
          <code className="rounded bg-canvas px-1.5 py-0.5 text-xs">application_status</code> 를
          직접 바꿔 주세요.
        </p>
      </main>

      <SiteFooter settings={settings} />
    </>
  );
}

function Row({ record }: { record: ApplicantRecord }) {
  return (
    <tr className="border-b border-line last:border-0">
      <Td>
        <span className="font-semibold text-ink">{record.name}</span>
      </Td>
      <Td>{record.organization}</Td>
      <Td>{record.position}</Td>
      <Td>
        <a href={`tel:${record.phone}`} className="underline hover:text-brand-blue">
          {record.phone}
        </a>
      </Td>
      <Td>
        {record.cardImagePath ? (
          <a
            href={record.cardImagePath}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand-blue underline"
          >
            보기
          </a>
        ) : (
          <span className="text-ink-muted">없음</span>
        )}
      </Td>
      <Td>
        <StatusChip status={record.applicationStatus} />
      </Td>
      <Td>
        <span className="text-ink-muted">{formatDateTime(record.appliedAt)}</span>
      </Td>
      <Td>
        <span className="text-ink-muted">{record.adminNote}</span>
      </Td>
    </tr>
  );
}

function StatusChip({ status }: { status: string }) {
  const style =
    status === "참여확정"
      ? "bg-success-soft text-success"
      : status === "불참"
        ? "bg-canvas text-ink-muted"
        : status === "대기"
          ? "bg-warning-soft text-warning"
          : "bg-brand-blue/10 text-brand-blue";

  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>
      {status}
    </span>
  );
}

function Stat({
  label,
  value,
  detail,
  warn,
}: {
  label: string;
  value: string;
  detail?: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-line bg-surface p-5">
      <dt className="text-sm font-medium text-ink-muted">{label}</dt>
      <dd className="mt-2 text-2xl font-bold text-navy">{value}</dd>
      {detail ? (
        <p className={`mt-1.5 text-xs ${warn ? "font-semibold text-warning" : "text-ink-muted"}`}>
          {warn ? "⚠ " : ""}
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3 font-bold text-ink">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="whitespace-nowrap px-4 py-3.5 text-ink-soft">{children}</td>;
}
