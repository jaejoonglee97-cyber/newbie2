import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "로그인 · 뉴비스쿨 2기 동문회",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const role = await getSessionRole();
  if (role) {
    redirect(role === "admin" ? "/admin" : "/cards");
  }

  const settings = await getSettings();
  const { returnTo } = await searchParams;

  return (
    <>
      <SiteHeader settings={settings} />

      <main id="main" className="mx-auto max-w-md px-5 py-12 sm:px-8">
        <h1 className="text-2xl font-bold text-navy">동문회 로그인</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          명함집과 활동 기록을 보려면 동문회 공통 비밀번호가 필요합니다.
        </p>

        <div className="mt-8 rounded-[14px] border border-line bg-surface p-6">
          <LoginForm returnTo={safeReturnTo(returnTo)} />
        </div>

        <p className="mt-6 text-center text-sm text-ink-soft">
          아직 신청하지 않으셨나요?{" "}
          <Link href="/" className="font-semibold text-brand-blue underline">
            동문회 안내 보기
          </Link>
        </p>
      </main>

      <SiteFooter settings={settings} />
    </>
  );
}

/**
 * 로그인 후 이동할 경로를 검증한다.
 *
 * 외부 주소나 프로토콜 상대 주소를 그대로 쓰면 다른 사이트로 보낼 수 있다.
 * 같은 사이트 안의 경로만 허용한다.
 */
function safeReturnTo(value?: string): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}
