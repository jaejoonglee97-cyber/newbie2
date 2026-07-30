"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Role } from "@/lib/auth";

export type NavTab = "cards" | "activities" | "admin";

/** 로그인 후 화면 상단 이동 막대 */
export function MemberNav({ role, current }: { role: Role; current: NavTab }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await fetch("/api/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  const linkClass = (active: boolean) =>
    `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
      active ? "bg-brand-blue/10 text-brand-blue" : "text-ink-soft hover:bg-canvas"
    }`;

  return (
    <nav
      aria-label="동문회 메뉴"
      className="border-b border-line bg-surface"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-5 py-3 sm:px-8">
        <Link href="/cards" className={linkClass(current === "cards")}>
          명함집
        </Link>

        <Link href="/activities" className={linkClass(current === "activities")}>
          활동 기록
        </Link>

        {role === "admin" ? (
          <Link href="/admin" className={linkClass(current === "admin")}>
            신청자 명단
          </Link>
        ) : null}

        <span className="ml-auto flex items-center gap-3">
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
        </span>
      </div>
    </nav>
  );
}
