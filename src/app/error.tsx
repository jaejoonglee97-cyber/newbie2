"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * 화면을 그리다 예상 못 한 오류가 났을 때 대신 나오는 화면.
 *
 * 기본 오류 화면은 영어이고 "Application error: a server-side exception..."
 * 처럼 보는 사람이 할 수 있는 일이 없는 문구만 나온다. 22명이 각자
 * 휴대폰으로 들어오는 사이트라 그 화면이 뜨면 모두가 멈춘다.
 * 여기서 받아 무엇을 하면 되는지 한국어로 알려 준다.
 *
 * digest 는 Vercel 로그에서 같은 오류를 찾는 열쇠다. 화면에 적어 두면
 * 사용자가 그대로 알려 줄 수 있어 원인을 훨씬 빨리 짚는다.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route error]", error);
  }, [error]);

  return (
    <main id="main" className="mx-auto max-w-xl px-5 py-20 sm:px-8">
      <h1 className="text-2xl font-bold text-navy">화면을 불러오지 못했습니다</h1>

      <p className="mt-4 leading-relaxed text-ink-soft">
        잠시 문제가 생겼습니다. 아래 버튼으로 다시 시도해 주세요. 남긴 내용이 사라지지는
        않습니다.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-brand-blue px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          다시 시도
        </button>
        <Link
          href="/"
          className="rounded-lg border border-line px-5 py-3 text-sm font-semibold text-ink-soft transition-colors hover:border-brand-blue/50 hover:text-brand-blue"
        >
          처음 화면으로
        </Link>
      </div>

      <p className="mt-10 text-xs leading-relaxed text-ink-muted">
        계속 같으면 운영자에게 알려 주세요.
        {error.digest ? (
          <>
            {" "}
            오류 번호 <code className="font-mono">{error.digest}</code>
          </>
        ) : null}
      </p>
    </main>
  );
}
