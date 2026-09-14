"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

/** 운영자가 고민 나눔 보드를 연다. 열면 바로 1단계(고민 적기)로 시작한다. */
export function CreateWorryBoardForm() {
  const router = useRouter();
  const formId = useId();

  const [title, setTitle] = useState("1회기 고민 나눔");
  const [description, setDescription] = useState(
    "개인 고민 1가지, 회사 고민 1가지를 익명으로 남겨 주세요.",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/worries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });

      const data = (await response.json()) as {
        ok: boolean;
        errors?: { title?: string; description?: string };
        message?: string;
      };

      if (data.ok) {
        router.refresh();
        return;
      }

      setError(data.errors?.title ?? data.errors?.description ?? data.message ?? "열지 못했습니다.");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="create-worry-board"
      className="rounded-[14px] border border-brand-blue/30 bg-brand-blue/5 p-6 sm:p-7"
    >
      <h2 id="create-worry-board" className="text-base font-bold text-navy">
        운영자 · 고민 나눔 열기
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        열면 바로 고민 적기 단계로 시작합니다. 참여자는 로그인 없이 이 주소로 들어와 적을 수
        있습니다.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor={`${formId}-title`} className="text-sm font-bold text-ink">
            제목
          </label>
          <input
            id={`${formId}-title`}
            type="text"
            maxLength={60}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 w-full rounded-lg border border-line bg-surface px-4 py-3 text-base text-ink hover:border-brand-blue/50"
          />
        </div>

        <div>
          <label htmlFor={`${formId}-description`} className="text-sm font-bold text-ink">
            안내 문구 <span className="font-medium text-ink-muted">(선택)</span>
          </label>
          <textarea
            id={`${formId}-description`}
            rows={2}
            maxLength={200}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-2 w-full resize-y rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink hover:border-brand-blue/50"
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || title.trim().length < 2}
          className="rounded-lg bg-brand-blue px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:bg-ink-muted"
        >
          {submitting ? "여는 중..." : "고민 나눔 열기"}
        </button>
      </form>
    </section>
  );
}
