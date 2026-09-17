"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";

import { WorryJar, type JarMotion } from "./worry-jar";
import {
  REPLY_MAX_LENGTH,
  WORRY_CATEGORIES,
  WORRY_MAX_LENGTH,
  type AddWorryErrors,
  type WorryBoardView,
  type WorryCard,
  type WorryCategory,
  type WorryPhase,
  type WorryPulse,
} from "@/lib/worry-types";

/** 참여자 화면이 진행자의 뽑기를 따라잡는 간격. */
const PULSE_INTERVAL_MS = 5000;

/**
 * 익명 고민 항아리.
 *
 * 고민을 적어 항아리에 넣고, 진행자가 하나씩 뽑고, 뽑힌 고민을 놓고
 * 이야기하며 익명 포스트잇을 붙인다.
 *
 * 진행자가 뽑으면 참여자 화면에도 같은 고민이 떠야 한다. 몇 초에 한 번씩
 * 가벼운 상태만 물어보고, 실제로 바뀌었을 때만 화면을 다시 받는다.
 */
export function WorryBoard({ view, isAdmin }: { view: WorryBoardView; isAdmin: boolean }) {
  const { board } = view;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold text-teal">익명 고민 항아리</p>
        <h1 className="mt-1 text-2xl font-bold text-navy sm:text-3xl">{board.title}</h1>
        {board.description ? (
          <p className="mt-3 leading-relaxed text-ink-soft">{board.description}</p>
        ) : null}
      </header>

      <PhaseSteps phase={board.phase} />

      {board.phase === "writing" ? <WritingPhase view={view} /> : null}
      {board.phase === "drawing" ? <DrawingPhase view={view} isAdmin={isAdmin} /> : null}
      {board.phase === "sharing" || board.phase === "closed" ? (
        <OpenPhase view={view} isAdmin={isAdmin} />
      ) : null}

      {isAdmin ? <AdminBar view={view} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1단계 · 항아리 채우기
// ---------------------------------------------------------------------------

function WritingPhase({ view }: { view: WorryBoardView }) {
  const [motion, setMotion] = useState<JarMotion>("idle");

  return (
    <div className="space-y-8">
      <section className="rounded-[14px] border border-line bg-surface px-6 py-8">
        <WorryJar
          count={view.totalWorries}
          motion={motion}
          label={
            view.totalWorries === 0
              ? "아직 비어 있습니다"
              : `항아리에 ${view.totalWorries}개 · 개인 ${view.countByCategory.개인} · 회사 ${view.countByCategory.회사}`
          }
        />

        <p className="mx-auto mt-6 max-w-md text-center text-sm leading-relaxed text-ink-soft">
          적은 고민은 곧바로 항아리로 들어갑니다. 진행자가 뽑기 전까지는 누구에게도 보이지
          않고, 뽑힌 뒤에도 누가 썼는지는 아무도 알 수 없습니다.
        </p>
      </section>

      <WorryForm boardId={view.board.boardId} onSubmitted={() => setMotion("filling")} />
    </div>
  );
}

function WorryForm({
  boardId,
  onSubmitted,
}: {
  boardId: string;
  onSubmitted: () => void;
}) {
  const router = useRouter();
  const formId = useId();

  const [category, setCategory] = useState<WorryCategory | null>(null);
  const [content, setContent] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<AddWorryErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setErrors({});

    try {
      const response = await fetch(`/api/worries/${boardId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "worry", category, content, website: honeypot }),
      });

      const data = (await response.json()) as {
        ok: boolean;
        errors?: AddWorryErrors;
        message?: string;
      };

      if (data.ok) {
        onSubmitted();
        setDone(true);
        setContent("");
        setCategory(null);
        router.refresh();
        return;
      }

      if (data.errors) {
        setErrors(data.errors);
        setMessage("입력을 확인해 주세요.");
        return;
      }

      setMessage(data.message ?? "넣지 못했습니다.");
    } catch {
      setMessage("연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <section className="rounded-[14px] border border-success/30 bg-success-soft px-6 py-10 text-center">
        <p className="text-lg font-bold text-success">항아리에 넣었습니다</p>
        <p className="mt-2 text-sm leading-relaxed text-success">
          더 넣고 싶은 고민이 있으면 계속 적어도 됩니다.
        </p>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="mt-6 rounded-lg bg-success px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          하나 더 넣기
        </button>
      </section>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-[14px] border border-line bg-surface p-5 sm:p-6"
    >
      <h2 className="text-base font-bold text-navy">고민 적기</h2>

      <fieldset>
        <legend className="text-sm font-bold text-ink">
          어떤 고민인가요{" "}
          <span className="text-danger">
            <span aria-hidden="true">*</span>
            <span className="sr-only">필수</span>
          </span>
        </legend>

        <div className="mt-3 flex flex-wrap gap-2">
          {WORRY_CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setCategory(item);
                setErrors((prev) => ({ ...prev, category: undefined }));
              }}
              aria-pressed={category === item}
              className={`rounded-lg border px-5 py-2.5 text-sm font-semibold transition-colors ${
                category === item
                  ? "border-brand-blue bg-brand-blue text-white"
                  : "border-line bg-canvas text-ink-muted hover:border-brand-blue/50"
              }`}
            >
              {item} 고민
            </button>
          ))}
        </div>

        {errors.category ? (
          <p role="alert" className="mt-2 text-sm font-medium text-danger">
            {errors.category}
          </p>
        ) : null}
      </fieldset>

      <div>
        <label htmlFor={`${formId}-content`} className="text-sm font-bold text-ink">
          고민 내용{" "}
          <span className="text-danger">
            <span aria-hidden="true">*</span>
            <span className="sr-only">필수</span>
          </span>
        </label>
        <p className="mt-1 text-xs text-ink-muted">
          이름을 묻지 않습니다. 기관 이름처럼 누구인지 알 수 있는 말은 빼고 적어 주세요.
        </p>
        <textarea
          id={`${formId}-content`}
          rows={5}
          value={content}
          maxLength={WORRY_MAX_LENGTH}
          onChange={(event) => {
            setContent(event.target.value);
            setErrors((prev) => ({ ...prev, content: undefined }));
          }}
          placeholder="요즘 어떤 게 제일 어려우신가요?"
          className={`mt-2 w-full rounded-lg border bg-canvas px-4 py-3 text-base text-ink outline-none transition-colors placeholder:text-ink-muted/70 ${
            errors.content ? "border-danger" : "border-line focus:border-brand-blue"
          }`}
        />
        <p className="mt-1 text-right text-xs text-ink-muted">
          {content.length} / {WORRY_MAX_LENGTH}자
        </p>
        {errors.content ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {errors.content}
          </p>
        ) : null}
      </div>

      <Honeypot value={honeypot} onChange={setHoneypot} idPrefix={formId} />

      {message ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-brand-blue px-6 py-4 text-base font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? "넣는 중..." : "항아리에 넣기"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// 2단계 · 뽑기
// ---------------------------------------------------------------------------

function DrawingPhase({ view, isAdmin }: { view: WorryBoardView; isAdmin: boolean }) {
  const router = useRouter();
  const [drawing, setDrawing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const current = view.current;
  const past = view.worries.filter((worry) => worry.worryId !== current?.worryId);

  useWorryPulse({
    boardId: view.board.boardId,
    // 진행자 화면은 자기가 눌러서 바뀌므로 따라잡을 필요가 없다.
    enabled: !isAdmin,
    currentWorryId: current?.worryId ?? "",
    phase: view.board.phase,
  });

  async function run(action: "draw" | "undoDraw") {
    setDrawing(action === "draw");
    setMessage(null);

    try {
      const response = await fetch(`/api/worries/${view.board.boardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = (await response.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setMessage(data.message ?? "처리하지 못했습니다.");
        return;
      }

      router.refresh();
    } catch {
      setMessage("연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      // 흔들림을 잠깐 보여 준 뒤 결과를 띄운다.
      setTimeout(() => setDrawing(false), 700);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[14px] border border-line bg-surface px-6 py-8">
        <WorryJar
          count={view.remaining}
          motion={drawing ? "shaking" : "idle"}
          label={
            view.remaining === 0
              ? "항아리를 다 비웠습니다"
              : `항아리에 ${view.remaining}개 남음 · ${view.totalWorries - view.remaining}개 뽑음`
          }
        />

        {isAdmin ? (
          <div className="mx-auto mt-6 flex max-w-md flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => run("draw")}
              disabled={drawing || view.remaining === 0}
              className="w-full rounded-lg bg-brand-blue px-6 py-4 text-base font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {drawing
                ? "항아리를 흔드는 중..."
                : view.remaining === 0
                  ? "더 뽑을 고민이 없습니다"
                  : "고민 뽑기"}
            </button>

            {current ? (
              <button
                type="button"
                onClick={() => run("undoDraw")}
                className="text-xs font-semibold text-ink-muted underline hover:text-brand-blue"
              >
                방금 뽑은 것 되돌리기
              </button>
            ) : null}
          </div>
        ) : (
          <p className="mx-auto mt-6 max-w-md text-center text-sm leading-relaxed text-ink-soft">
            진행자가 항아리에서 하나씩 뽑습니다. 뽑힌 고민이 아래에 나오면 함께 이야기하고
            포스트잇을 붙여 주세요.
          </p>
        )}

        {message ? (
          <p role="alert" className="mt-4 text-center text-sm font-medium text-danger">
            {message}
          </p>
        ) : null}
      </section>

      {current ? (
        <section aria-labelledby="current-worry" className="space-y-5">
          <h2 id="current-worry" className="text-lg font-bold text-navy">
            지금 이야기 중
          </h2>
          <WorryCardView
            boardId={view.board.boardId}
            worry={current}
            isAdmin={isAdmin}
            canReply
            highlighted
          />
        </section>
      ) : (
        <p className="rounded-[14px] border border-line bg-surface px-6 py-12 text-center text-ink-muted">
          아직 뽑은 고민이 없습니다. 진행자가 첫 고민을 뽑으면 여기에 나옵니다.
        </p>
      )}

      {past.length > 0 ? (
        <details className="rounded-[14px] border border-line bg-surface p-5">
          <summary className="cursor-pointer text-sm font-bold text-navy">
            앞서 다룬 고민 {past.length}개
          </summary>
          <div className="mt-5 space-y-5">
            {past.map((worry) => (
              <WorryCardView
                key={worry.worryId}
                boardId={view.board.boardId}
                worry={worry}
                isAdmin={isAdmin}
                canReply
              />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

/**
 * 진행자가 뽑은 고민을 참여자 화면이 따라잡게 한다.
 *
 * 가벼운 상태만 물어보고, 실제로 바뀌었을 때만 화면 전체를 다시 받는다.
 * 화면이 안 보일 때는 쉰다. 주머니 속 휴대폰이 계속 서버를 두드릴 이유가 없다.
 */
function useWorryPulse({
  boardId,
  enabled,
  currentWorryId,
  phase,
}: {
  boardId: string;
  enabled: boolean;
  currentWorryId: string;
  phase: WorryPhase;
}) {
  const router = useRouter();

  // 최신 값을 타이머 안에서 보기 위해 담아 둔다. 타이머를 다시 만들지 않아도 된다.
  const latest = useRef({ currentWorryId, phase });
  latest.current = { currentWorryId, phase };

  useEffect(() => {
    if (!enabled) return;

    let stopped = false;

    async function check() {
      if (stopped || document.visibilityState !== "visible") return;

      try {
        const response = await fetch(`/api/worries/${boardId}/pulse`, { cache: "no-store" });
        if (!response.ok) return;

        const pulse = (await response.json()) as WorryPulse;
        const changed =
          pulse.phase !== latest.current.phase ||
          (pulse.current?.worryId ?? "") !== latest.current.currentWorryId;

        if (changed) router.refresh();
      } catch {
        // 잠깐 끊긴 것뿐이다. 다음 차례에 다시 물어본다.
      }
    }

    const timer = setInterval(check, PULSE_INTERVAL_MS);
    document.addEventListener("visibilitychange", check);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [boardId, enabled, router]);
}

// ---------------------------------------------------------------------------
// 3단계 · 다 같이 보기 / 마감
// ---------------------------------------------------------------------------

function OpenPhase({ view, isAdmin }: { view: WorryBoardView; isAdmin: boolean }) {
  const closed = view.board.phase === "closed";

  return (
    <div className="space-y-6">
      <section className="rounded-[14px] border border-line bg-surface px-6 py-6 text-center">
        <p className="text-sm leading-relaxed text-ink-soft">
          {closed
            ? "마감했습니다. 오늘 나온 고민과 포스트잇을 읽을 수 있습니다."
            : `오늘 나온 고민 ${view.totalWorries}개를 모두 펼쳤습니다. 포스트잇은 계속 붙일 수 있습니다.`}
        </p>
      </section>

      {view.worries.length === 0 ? (
        <p className="rounded-[14px] border border-line bg-surface px-6 py-12 text-center text-ink-muted">
          아직 적힌 고민이 없습니다.
        </p>
      ) : (
        <div className="space-y-5">
          {view.worries.map((worry) => (
            <WorryCardView
              key={worry.worryId}
              boardId={view.board.boardId}
              worry={worry}
              isAdmin={isAdmin}
              canReply={!closed}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 고민 한 건과 포스트잇 벽
// ---------------------------------------------------------------------------

function WorryCardView({
  boardId,
  worry,
  isAdmin,
  canReply,
  highlighted = false,
}: {
  boardId: string;
  worry: WorryCard;
  isAdmin: boolean;
  canReply: boolean;
  highlighted?: boolean;
}) {
  return (
    <article
      className={`rounded-[14px] border p-5 sm:p-6 ${
        highlighted ? "border-brand-blue/40 bg-brand-blue/5" : "border-line bg-surface"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-bold text-teal">
          {worry.category} 고민
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-muted">{worry.drawOrder}번째로 뽑힘</span>
          {isAdmin ? (
            <DeleteButton
              boardId={boardId}
              action="deleteWorry"
              id={worry.worryId}
              label="고민 지우기"
            />
          ) : null}
        </div>
      </div>

      <p
        className={`mt-4 whitespace-pre-wrap break-keep leading-relaxed text-ink ${
          highlighted ? "text-lg sm:text-xl" : ""
        }`}
      >
        {worry.content}
      </p>

      <div className="mt-6 border-t border-line pt-5">
        <h3 className="text-sm font-bold text-navy">
          포스트잇 {worry.replies.length > 0 ? `${worry.replies.length}장` : ""}
        </h3>

        {worry.replies.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-3">
            {worry.replies.map((reply, index) => (
              <li
                key={reply.replyId}
                className="w-full max-w-[15rem] rounded-sm p-4 text-sm leading-relaxed text-ink shadow-sm sm:w-auto sm:min-w-[11rem]"
                style={{
                  background: POSTIT_COLORS[index % POSTIT_COLORS.length],
                  transform: `rotate(${(index % 2 === 0 ? -1 : 1) * (0.6 + (index % 3) * 0.5)}deg)`,
                }}
              >
                <p className="whitespace-pre-wrap break-keep">{reply.content}</p>
                {isAdmin ? (
                  <div className="mt-2 text-right">
                    <DeleteButton
                      boardId={boardId}
                      action="deleteReply"
                      id={reply.replyId}
                      label="지우기"
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">아직 붙은 포스트잇이 없습니다.</p>
        )}

        {canReply ? <ReplyForm boardId={boardId} worryId={worry.worryId} /> : null}
      </div>
    </article>
  );
}

const POSTIT_COLORS = ["#FFF3B0", "#FFD9D9", "#D6ECFF", "#DCF5D6", "#EADCFF"];

/**
 * 뽑힌 고민에 익명 포스트잇을 붙인다.
 *
 * 이름을 묻지 않는다. 대신 "좋은말 이쁜말만 하기" 를 붙이는 자리 바로 위에
 * 띄운다. 익명이라서 더 함부로 쓰기 쉬우니, 쓰기 직전에 한 번 더 보이게 한다.
 */
function ReplyForm({ boardId, worryId }: { boardId: string; worryId: string }) {
  const router = useRouter();
  const formId = useId();

  const [content, setContent] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/worries/${boardId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "reply", worryId, content, website: honeypot }),
      });

      const data = (await response.json()) as {
        ok: boolean;
        errors?: { content?: string; worryId?: string };
        message?: string;
      };

      if (data.ok) {
        setContent("");
        router.refresh();
        return;
      }

      setMessage(data.errors?.content ?? data.message ?? "붙이지 못했습니다.");
    } catch {
      setMessage("연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <NiceWordsBubble />

      <label htmlFor={`${formId}-reply`} className="sr-only">
        포스트잇 내용
      </label>
      <textarea
        id={`${formId}-reply`}
        rows={3}
        value={content}
        maxLength={REPLY_MAX_LENGTH}
        onChange={(event) => setContent(event.target.value)}
        placeholder="이 고민에 해주고 싶은 말을 적어 주세요."
        className="mt-3 w-full rounded-lg border border-line bg-canvas px-4 py-3 text-base text-ink outline-none transition-colors placeholder:text-ink-muted/70 focus:border-brand-blue"
      />

      <Honeypot value={honeypot} onChange={setHoneypot} idPrefix={formId} />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-ink-muted">
          {content.length} / {REPLY_MAX_LENGTH}자
        </span>
        <button
          type="submit"
          disabled={submitting || content.trim().length < 2}
          className="rounded-lg bg-teal px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "붙이는 중..." : "포스트잇 붙이기"}
        </button>
      </div>

      {message ? (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {message}
        </p>
      ) : null}
    </form>
  );
}

/** 포스트잇을 쓰기 직전에 한 번 보이는 말풍선. */
function NiceWordsBubble() {
  return (
    <p className="relative inline-block rounded-2xl bg-warning-soft px-4 py-2 text-sm font-bold text-warning">
      좋은말 이쁜말만 하기~
      <span
        aria-hidden="true"
        className="absolute left-6 top-full block h-0 w-0 border-x-8 border-t-8 border-x-transparent border-t-warning-soft"
      />
    </p>
  );
}

// ---------------------------------------------------------------------------
// 운영자
// ---------------------------------------------------------------------------

function AdminBar({ view }: { view: WorryBoardView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function setPhase(phase: WorryPhase) {
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/worries/${view.board.boardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setPhase", phase }),
      });

      const data = (await response.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setMessage(data.message ?? "단계를 바꾸지 못했습니다.");
        return;
      }

      router.refresh();
    } catch {
      setMessage("연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  const phase = view.board.phase;

  return (
    <section
      aria-labelledby="worry-admin"
      className="rounded-[14px] border border-brand-blue/30 bg-brand-blue/5 p-5"
    >
      <h2 id="worry-admin" className="text-sm font-bold text-navy">
        ⚙️ 진행자
      </h2>

      <div className="mt-4 flex flex-wrap gap-2">
        {phase === "writing" ? (
          <PhaseButton
            busy={busy}
            onClick={() => setPhase("drawing")}
            disabled={view.totalWorries === 0}
          >
            뽑기 시작
          </PhaseButton>
        ) : null}

        {phase === "drawing" ? (
          <>
            <PhaseButton busy={busy} onClick={() => setPhase("writing")} tone="quiet">
              고민 더 받기
            </PhaseButton>
            <PhaseButton busy={busy} onClick={() => setPhase("sharing")}>
              다 같이 보기
            </PhaseButton>
          </>
        ) : null}

        {phase === "sharing" ? (
          <>
            <PhaseButton busy={busy} onClick={() => setPhase("drawing")} tone="quiet">
              뽑기로 돌아가기
            </PhaseButton>
            <PhaseButton busy={busy} onClick={() => setPhase("closed")}>
              마감
            </PhaseButton>
          </>
        ) : null}

        {phase === "closed" ? (
          <PhaseButton busy={busy} onClick={() => setPhase("sharing")} tone="quiet">
            다시 열기
          </PhaseButton>
        ) : null}
      </div>

      {message ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function PhaseButton({
  busy,
  onClick,
  disabled = false,
  tone = "strong",
  children,
}: {
  busy: boolean;
  onClick: () => void;
  disabled?: boolean;
  tone?: "strong" | "quiet";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={`rounded-lg px-5 py-2.5 text-sm font-bold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "strong"
          ? "bg-brand-blue text-white"
          : "border border-line bg-surface text-ink-soft"
      }`}
    >
      {children}
    </button>
  );
}

function DeleteButton({
  boardId,
  action,
  id,
  label,
}: {
  boardId: string;
  action: "deleteWorry" | "deleteReply";
  id: string;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (!window.confirm(`${label}. 되돌릴 수 없습니다. 진행할까요?`)) return;

    setBusy(true);
    try {
      await fetch(`/api/worries/${boardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "deleteWorry" ? { action, worryId: id } : { action, replyId: id },
        ),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="text-xs font-semibold text-danger underline hover:opacity-80 disabled:opacity-50"
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// 공통
// ---------------------------------------------------------------------------

function PhaseSteps({ phase }: { phase: WorryPhase }) {
  const steps: Array<{ key: WorryPhase; label: string }> = [
    { key: "writing", label: "항아리 채우기" },
    { key: "drawing", label: "뽑아서 이야기" },
    { key: "sharing", label: "다 같이 보기" },
  ];

  const activeIndex = steps.findIndex((step) => step.key === phase);

  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {steps.map((step, index) => {
        const state = phase === "closed" ? "done" : index < activeIndex ? "done" : index === activeIndex ? "now" : "next";

        return (
          <li
            key={step.key}
            aria-current={state === "now" ? "step" : undefined}
            className={`rounded-full px-4 py-1.5 font-semibold ${
              state === "now"
                ? "bg-brand-blue text-white"
                : state === "done"
                  ? "bg-teal/10 text-teal"
                  : "bg-canvas text-ink-muted"
            }`}
          >
            {index + 1}. {step.label}
          </li>
        );
      })}
      {phase === "closed" ? (
        <li className="rounded-full bg-canvas px-4 py-1.5 font-semibold text-ink-muted">마감</li>
      ) : null}
    </ol>
  );
}

/**
 * 사람에게는 보이지 않는 입력칸.
 *
 * 자동 프로그램은 화면에 보이는지와 상관없이 모든 칸을 채우는 경우가 많다.
 * 여기에 값이 들어오면 사람이 쓴 것이 아니라고 본다. 로그인 없이 받는
 * 화면이라 이 정도 장치는 필요하다.
 */
function Honeypot({
  value,
  onChange,
  idPrefix,
}: {
  value: string;
  onChange: (next: string) => void;
  idPrefix: string;
}) {
  return (
    <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden">
      <label htmlFor={`${idPrefix}-website`}>웹사이트</label>
      <input
        id={`${idPrefix}-website`}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
