"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import {
  BEST_PART_MAX_LENGTH,
  NEXT_WISH_MAX_LENGTH,
  SATISFACTION_SCORES,
  SCORE_LABELS,
  type FeedbackErrors,
  type SatisfactionScore,
} from "@/lib/feedback-types";

/**
 * 회차별 만족도 조사 폼.
 *
 * 이름을 묻지 않는다. 짧게 끝나야 실제로 응답이 모이므로 회차·만족도·
 * 좋았던 점·다음 희망 활동 네 가지만 받는다.
 */
export function FeedbackForm({
  sessions,
}: {
  sessions: Array<{ sessionNumber: number; topic: string }>;
}) {
  const router = useRouter();
  const formId = useId();

  // 가장 최근 회차를 기본으로 둔다. 대개 방금 끝난 회차에 응답한다.
  const [sessionNumber, setSessionNumber] = useState(
    sessions.length > 0 ? String(sessions[sessions.length - 1].sessionNumber) : "",
  );
  const [score, setScore] = useState<SatisfactionScore | null>(null);
  const [bestPart, setBestPart] = useState("");
  const [nextWish, setNextWish] = useState("");
  const [honeypot, setHoneypot] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FeedbackErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setMessage(null);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionNumber: Number(sessionNumber),
          score,
          bestPart,
          nextWish,
          website: honeypot,
        }),
      });

      const data = (await response.json()) as {
        ok: boolean;
        errors?: FeedbackErrors;
        message?: string;
      };

      if (data.ok) {
        setDone(true);
        router.refresh();
        return;
      }

      if (data.errors) {
        setErrors(data.errors);
        setMessage("입력값을 확인해 주세요.");
        return;
      }

      setMessage(data.message ?? "남기지 못했습니다.");
    } catch {
      setMessage("네트워크 오류가 발생했습니다. 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sessions.length === 0) {
    return (
      <p className="rounded-[14px] border border-line bg-surface px-6 py-12 text-center text-ink-muted">
        아직 기록된 회차가 없습니다. 활동일지가 등록되면 그 회차에 응답할 수 있습니다.
      </p>
    );
  }

  if (done) {
    return (
      <div
        role="status"
        className="rounded-[14px] border border-success/30 bg-success-soft px-6 py-10 text-center"
      >
        <p aria-hidden="true" className="text-3xl text-success">
          ✓
        </p>
        <h2 className="mt-3 text-lg font-bold text-ink">응답해 주셔서 고맙습니다</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          누가 남겼는지는 기록되지 않습니다. 남겨 주신 내용은 다음 회차를 준비하는 데
          씁니다.
        </p>
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setScore(null);
            setBestPart("");
            setNextWish("");
          }}
          className="mt-6 rounded-lg border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink-soft hover:border-brand-blue/50"
        >
          다른 회차도 응답하기
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-7 rounded-[14px] border border-line bg-surface p-6 sm:p-7"
    >
      <div>
        <label htmlFor={`${formId}-session`} className="text-sm font-bold text-ink">
          어떤 회차인가요?
        </label>
        <select
          id={`${formId}-session`}
          value={sessionNumber}
          onChange={(event) => setSessionNumber(event.target.value)}
          className="mt-2 w-full rounded-lg border border-line bg-surface px-4 py-3 text-base text-ink hover:border-brand-blue/50"
        >
          {sessions.map((session) => (
            <option key={session.sessionNumber} value={session.sessionNumber}>
              {session.sessionNumber}회기{session.topic ? ` · ${session.topic}` : ""}
            </option>
          ))}
        </select>
        {errors.sessionNumber ? (
          <p role="alert" className="mt-2 text-sm font-medium text-danger">
            {errors.sessionNumber}
          </p>
        ) : null}
      </div>

      <fieldset>
        <legend className="text-sm font-bold text-ink">이번 회차는 어떠셨나요?</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          {SATISFACTION_SCORES.map((value) => (
            <label
              key={value}
              className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-3 py-3 text-center transition-colors ${
                score === value
                  ? "border-brand-blue bg-brand-blue/5"
                  : "border-line bg-surface hover:border-brand-blue/50"
              }`}
            >
              <input
                type="radio"
                name={`${formId}-score`}
                checked={score === value}
                onChange={() => setScore(value)}
                className="sr-only"
              />
              <span aria-hidden="true" className="text-lg font-bold text-brand-blue">
                {value}
              </span>
              <span className="text-xs leading-snug text-ink-soft">{SCORE_LABELS[value]}</span>
            </label>
          ))}
        </div>
        {errors.score ? (
          <p role="alert" className="mt-2 text-sm font-medium text-danger">
            {errors.score}
          </p>
        ) : null}
      </fieldset>

      <div>
        <label htmlFor={`${formId}-best`} className="text-sm font-bold text-ink">
          좋았던 점
        </label>
        <textarea
          id={`${formId}-best`}
          rows={3}
          maxLength={BEST_PART_MAX_LENGTH}
          value={bestPart}
          onChange={(event) => setBestPart(event.target.value)}
          placeholder="예: 비슷한 고민을 하는 사람이 많다는 걸 알게 되어 마음이 놓였습니다."
          className="mt-2 w-full resize-y rounded-lg border border-line bg-surface px-4 py-3 text-base text-ink hover:border-brand-blue/50"
        />
        <p className="mt-1 text-right text-xs text-ink-muted">
          {bestPart.length} / {BEST_PART_MAX_LENGTH}자
        </p>
        {errors.bestPart ? (
          <p role="alert" className="mt-1 text-sm font-medium text-danger">
            {errors.bestPart}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={`${formId}-wish`} className="text-sm font-bold text-ink">
          다음 회차에 하고 싶은 활동
        </label>
        <textarea
          id={`${formId}-wish`}
          rows={3}
          maxLength={NEXT_WISH_MAX_LENGTH}
          value={nextWish}
          onChange={(event) => setNextWish(event.target.value)}
          placeholder="예: 다른 기관은 사례관리를 어떻게 하는지 들어보고 싶습니다."
          className="mt-2 w-full resize-y rounded-lg border border-line bg-surface px-4 py-3 text-base text-ink hover:border-brand-blue/50"
        />
        <p className="mt-1 text-right text-xs text-ink-muted">
          {nextWish.length} / {NEXT_WISH_MAX_LENGTH}자
        </p>
        {errors.nextWish ? (
          <p role="alert" className="mt-1 text-sm font-medium text-danger">
            {errors.nextWish}
          </p>
        ) : null}
      </div>

      {/* 자동 프로그램 차단용. 사람에게는 보이지 않는다. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={`${formId}-website`}>웹사이트</label>
        <input
          id={`${formId}-website`}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

      {message ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting || score === null}
        className="w-full rounded-lg bg-brand-blue px-8 py-3.5 text-base font-bold text-white transition-colors hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:bg-ink-muted"
      >
        {submitting ? "남기는 중..." : "익명으로 남기기"}
      </button>
    </form>
  );
}
