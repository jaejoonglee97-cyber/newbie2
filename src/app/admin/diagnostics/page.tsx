import { redirect } from "next/navigation";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { getSessionRole } from "@/lib/auth";
import { runDiagnostics } from "@/lib/diagnostics";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "연결 점검 · 뉴비스쿨 2기 동문회",
  robots: { index: false, follow: false },
};

/**
 * 운영자 전용 연결 점검.
 *
 * 화면이 안 열린다는 얘기가 나올 때 여기부터 연다. 어느 시트가 없고 어느
 * 환경변수가 비었는지 바로 보이므로, 오류 번호만 들고 원인을 짐작하지 않아도 된다.
 *
 * 환경변수는 값을 보여주지 않는다. 설정됐는지 여부만 표시한다.
 */
export default async function DiagnosticsPage() {
  const role = await getSessionRole();
  if (role !== "admin") {
    redirect("/login?returnTo=%2Fadmin%2Fdiagnostics");
  }

  const [settings, report] = await Promise.all([getSettings(), runDiagnostics()]);

  const missingSheets = report.sheets.filter((sheet) => !sheet.exists);
  const brokenSheets = report.sheets.filter((sheet) => sheet.exists && !sheet.readable);
  const missingEnv = report.env.filter((item) => item.required && !item.present);

  const healthy =
    !report.spreadsheetError &&
    missingSheets.length === 0 &&
    brokenSheets.length === 0 &&
    missingEnv.length === 0;

  return (
    <>
      <SiteHeader settings={settings} />
      <SiteNav role={role} current="diagnostics" />

      <main id="main" className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-12">
        <h1 className="text-2xl font-bold text-navy sm:text-3xl">연결 점검</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          화면이 안 열리거나 저장이 안 될 때 여기서 원인을 확인합니다. 이 화면은 운영자만
          볼 수 있습니다.
        </p>

        <p
          role="status"
          className={`mt-8 rounded-[14px] border px-5 py-4 text-sm font-semibold leading-relaxed ${
            healthy
              ? "border-success/30 bg-success-soft text-success"
              : "border-warning/30 bg-warning-soft text-warning"
          }`}
        >
          {healthy
            ? "이상 없습니다. 필요한 시트와 설정이 모두 준비돼 있습니다."
            : "손볼 곳이 있습니다. 아래 목록을 확인해 주세요."}
        </p>

        {report.spreadsheetError ? (
          <section className="mt-8 rounded-[14px] border border-warning/30 bg-warning-soft p-5">
            <h2 className="font-bold text-warning">스프레드시트를 열지 못했습니다</h2>
            <p className="mt-2 break-all font-mono text-xs leading-relaxed text-warning">
              {report.spreadsheetError}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-warning">
              서비스 계정이 스프레드시트에 편집자로 공유돼 있는지, 환경변수의 개인키가 줄바꿈까지
              그대로 들어갔는지 확인해 주세요.
            </p>
          </section>
        ) : null}

        {missingSheets.length > 0 ? (
          <section className="mt-8 rounded-[14px] border border-warning/30 bg-warning-soft p-5">
            <h2 className="font-bold text-warning">아직 만들지 않은 시트가 있습니다</h2>
            <p className="mt-2 text-sm leading-relaxed text-warning">
              스프레드시트에서 <strong>확장 프로그램 &gt; Apps Script</strong> 를 열고{" "}
              <code className="font-mono">setupAll</code> 을 한 번 실행하면 아래 시트가
              만들어집니다. 기존 자료는 지워지지 않습니다.
            </p>
            <p className="mt-3 font-mono text-sm text-warning">
              {missingSheets.map((sheet) => sheet.name).join(", ")}
            </p>
          </section>
        ) : null}

        <h2 className="mt-12 text-lg font-bold text-navy">데이터 연결</h2>
        <p className="mt-2 text-sm text-ink-soft">
          현재 모드: <strong className="font-semibold">{report.dataSource}</strong>
          {report.dataSource === "mock"
            ? " · 가상 데이터입니다. 실제 시트에 저장되지 않습니다."
            : null}
        </p>

        <h2 className="mt-10 text-lg font-bold text-navy">환경변수</h2>
        <ul className="mt-4 divide-y divide-line rounded-[14px] border border-line bg-surface">
          {report.env.map((item) => (
            <li
              key={item.name}
              className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
            >
              <span className="font-mono text-sm text-ink-soft">{item.name}</span>
              <StatusPill
                ok={item.present}
                okLabel="설정됨"
                badLabel={item.required ? "없음 (필수)" : "없음 (선택)"}
                neutral={!item.required}
              />
            </li>
          ))}
        </ul>

        <h2 className="mt-10 text-lg font-bold text-navy">시트</h2>
        <ul className="mt-4 divide-y divide-line rounded-[14px] border border-line bg-surface">
          {report.sheets.map((sheet) => (
            <li key={sheet.name} className="px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-sm text-ink-soft">{sheet.name}</span>
                {sheet.readable ? (
                  <span className="text-sm text-ink-muted">{sheet.rowCount}행</span>
                ) : (
                  <StatusPill ok={false} okLabel="" badLabel={sheet.exists ? "읽기 실패" : "없음"} />
                )}
              </div>
              {sheet.note ? (
                <p className="mt-1 break-all text-xs leading-relaxed text-ink-muted">
                  {sheet.note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>

        <p className="mt-8 text-xs text-ink-muted">점검 시각 {report.checkedAt}</p>
      </main>

      <SiteFooter settings={settings} />
    </>
  );
}

function StatusPill({
  ok,
  okLabel,
  badLabel,
  neutral = false,
}: {
  ok: boolean;
  okLabel: string;
  badLabel: string;
  neutral?: boolean;
}) {
  const tone = ok
    ? "border-success/30 bg-success-soft text-success"
    : neutral
      ? "border-line bg-canvas text-ink-muted"
      : "border-warning/30 bg-warning-soft text-warning";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
      {ok ? okLabel : badLabel}
    </span>
  );
}
