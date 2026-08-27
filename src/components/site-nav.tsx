"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Role } from "@/lib/auth";

export type NavTab = "home" | "apply" | "cards" | "activities" | "polls" | "admin";

/**
 * 사이트 전체 공통 이동 막대.
 *
 * 로그인 여부와 무관하게 모든 화면에 같은 자리에 나온다.
 * 링크를 화면마다 따로 찾아 들어가지 않아도 되게 한 곳에 모았다.
 *
 * role 이 null 이면 로그인하지 않은 상태다. 이때도 명함집·활동기록 링크는
 * 보여 준다. 눌러도 개인정보가 노출되지 않고 /login 으로 안내되며,
 * "무엇이 있는지"는 알려 주는 편이 안내에 유리하다.
 */
export function SiteNav({ role, current }: { role: Role | null; current?: NavTab }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await fetch("/api/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  const linkClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
      active ? "bg-brand-blue/10 text-brand-blue" : "text-ink-soft hover:bg-canvas"
    }`;

  return (
    <nav aria-label="동문회 메뉴" className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-5 py-3 sm:gap-2 sm:px-8">
        <Link href="/" className={linkClass(current === "home")}>
          동문회 안내
        </Link>

        <Link href="/cards" className={linkClass(current === "cards")}>
          명함집
          {role ? null : <LockMark />}
        </Link>

        <Link href="/activities" className={linkClass(current === "activities")}>
          활동 기록
          {role ? null : <LockMark />}
        </Link>

        <Link href="/polls" className={linkClass(current === "polls")}>
          투표
          {role ? null : <LockMark />}
        </Link>

        {role === "admin" ? (
          <Link href="/admin" className={linkClass(current === "admin")}>
            신청자 명단
          </Link>
        ) : null}

        <span className="ml-auto flex items-center gap-2 sm:gap-3">
          {role ? (
            <>
              <span className="text-xs font-medium text-ink-muted">
                {role === "admin" ? "운영자" : "참여자"}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:border-brand-blue/50 disabled:opacity-60"
              >
                {signingOut ? "로그아웃 중..." : "로그아웃"}
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:border-brand-blue/50 hover:text-brand-blue"
            >
              로그인
            </Link>
          )}
        </span>
      </div>
    </nav>
  );
}

/** 로그인이 필요한 메뉴임을 색상 외의 방법으로도 알린다. (PRD 13.1) */
function LockMark() {
  return (
    <>
      <span aria-hidden="true" className="text-xs text-ink-muted">
        🔒
      </span>
      <span className="sr-only">로그인 필요</span>
    </>
  );
}
