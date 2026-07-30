"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

export function LoginForm({ returnTo }: { returnTo?: string }) {
  const router = useRouter();
  const inputId = useId();

  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = (await response.json()) as {
        ok: boolean;
        redirectTo?: string;
        message?: string;
      };

      if (data.ok) {
        // 서버 컴포넌트가 새 쿠키로 다시 렌더되도록 새로고침한다.
        router.replace(returnTo ?? data.redirectTo ?? "/cards");
        router.refresh();
        return;
      }

      setMessage(data.message ?? "로그인에 실패했습니다.");
      setPassword("");
    } catch {
      setMessage("네트워크 오류가 발생했습니다. 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {message ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
        >
          {message}
        </p>
      ) : null}

      <div>
        <label htmlFor={inputId} className="text-sm font-bold text-ink">
          비밀번호
        </label>
        <input
          id={inputId}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-lg border border-line bg-surface px-4 py-3 text-base text-ink transition-colors hover:border-brand-blue/50"
          placeholder="동문회 공통 비밀번호"
        />
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          비밀번호는 기장·부기장이 팀 채팅방으로 안내합니다.
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting || !password}
        className="w-full rounded-lg bg-brand-blue px-8 py-3.5 text-base font-bold text-white transition-colors hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:bg-ink-muted"
      >
        {submitting ? "확인 중..." : "로그인"}
      </button>
    </form>
  );
}
