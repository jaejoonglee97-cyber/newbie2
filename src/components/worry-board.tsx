"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";

import {
  REPLY_MAX_LENGTH,
  WORRY_CATEGORIES,
  WORRY_MAX_LENGTH,
  type WorryBoardView,
  type WorryCategory,
  type WorryPhase,
} from "@/lib/worry-types";

/**
 * 익명 고민 나눔 보드.
 *
 * 로그인 없이 참여한다. 이름을 묻지 않고 브라우저에도 누구인지 남기지 않는다.
 * 저장하는 값은 팀 번호뿐이고, 그마저도 서버가 아니라 이 브라우저에만 둔다.
 * 답변 단계에서 자기 팀 고민만 보여주기 위한 화면 설정일 뿐이다.
 */

const TEAM_STORAGE_KEY = "newbie-worry-team";

const PHASE_LABEL: Record<WorryPhase, string> = {
  writing: "1단계 · 고민 적기",
  replying: "2단계 · 답변 적어주기",
  sharing: "3단계 · 함께 보기",
  closed: "마감",
};

/** 포스트잇 색. 내용이 아니라 순서로 돌려 쓴다. */
const NOTE_COLORS = [
  "bg-[#fff9c4] border-[#f0e6a0]",
  "bg-[#dcf3e4] border-[#bcdfc8]",
  "bg-[#ffe3e3] border-[#f3c7c7]",
  "bg-[#dbeafe] border-[#bfd6f5]",
  "bg-[#f3e4ff] border-[#dfc8f0]",
];

export function WorryBoard({
  view,
  isAdmin,
  selectedTeam,
}: {
  view: WorryBoardView;
  isAdmin: boolean;
  /** 서버가 이번 렌더에 쓴 팀 번호. 주소의 team 값이다. */
  selectedTeam: number;
}) {
  const router = useRouter();
  const { board } = view;

  /*
   * 지난번에 고른 팀을 이 브라우저에서 기억한다.
   * 주소에 팀이 없을 때만 되살려 자동으로 옮겨 준다.
   */
  useEffect(() => {
    if (board.phase !== "replying" || selectedTeam > 0) return;

    const stored = Number(window.localStorage.getItem(TEAM_STORAGE_KEY));
    if (Number.isFinite(stored) && stored >= 1 && stored <= board.teamCount) {
      router.replace(`/worries?team=${stored}`);
    }
  }, [board.phase, board.teamCount, selectedTeam, router]);

  function chooseTeam(teamNumber: number) {
    window.localStorage.setItem(TEAM_STORAGE_KEY, String(teamNumber));
    router.replace(`/worries?team=${teamNumber}`);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <header className="rounded-[14px] border border-line bg-surface p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-brand-blue/10 px-3 py-1 text-sm font-bold text-brand-blue">
            {PHASE_LABEL[board.phase]}
          </span>
          {board.phase === "writing" ? (
            <span className="text-sm text-ink-muted">
              지금까지 {view.totalWorries}개 · 개인 {view.countByCategory.개인} · 회사{" "}
              {view.countByCategory.회사}
            </span>
          ) : null}
        </div>

        <h1 className="mt-4 text-2xl font-bold text-navy sm:text-3xl">{board.title}</h1>
        {board.description ? (
          <p className="mt-3 leading-relaxed text-ink-soft">{board.description}</p>
        ) : null}

        <ol className="mt-5 space-y-1.5 text-sm text-ink-soft">
          <li>1. 개인 고민 1가지, 회사 고민 1가지를 익명으로 적습니다.</li>
          <li>2. 팀별로 나눈 고민에 포스트잇으로 생각이나 답변을 적어 줍니다.</li>
          <li>3. 팀 안에서 포스트잇에 적힌 의견을 함께 보며 이야기 나눕니다.</li>
        </ol>
      </header>

      {isAdmin ? <AdminPanel view={view} /> : null}

      {board.phase === "writing" ? <WriteStep boardId={board.boardId} /> : null}

      {board.phase === "replying" ? (
        <ReplyStep
          view={view}
          selectedTeam={selectedTeam}
          onChooseTeam={chooseTeam}
          isAdmin={isAdmin}
        />
      ) : null}

      {board.phase === "sharing" || board.phase === "closed" ? (
        <ShareStep view={view} isAdmin={isAdmin} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1단계 · 고민 적기
// ---------------------------------------------------------------------------

function WriteStep({ boardId }: { boardId: string }) {
  const router = useRouter();
  const formId = useId();

  const [category, setCategory] = useState<WorryCategory>("개인");
  const [content, setContent] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [writtenCount, setWrittenCount] = useState(0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/worries/${encodeURIComponent(boardId)}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "worry", category, content, website: honeypot }),
      });

      const data = (await response.json()) as {
        ok: boolean;
        errors?: { category?: string; content?: string };
        message?: string;
      };

      if (data.ok) {
        setContent("");
        setWrittenCount((count) => count + 1);
        setMessage(`${category} 고민을 익명으로 남겼습니다.`);
        // 상단의 작성 건수를 새로 받아온다.
        router.refresh();
        return;
      }

      setError(data.errors?.content ?? data.errors?.category ?? data.message ?? "남기지 못했습니다.");
    } catch {
      setError("네트워크 오류가 발생했습니다. 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="write-step" className="rounded-[14px] border border-line bg-surface p-6 sm:p-7">
      <h2 id="write-step" className="text-lg font-bold text-navy">
        고민 적기
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        이름을 묻지 않습니다. 누가 썼는지 저장하지 않으니 편하게 적어 주세요. 개인 고민과 회사
        고민을 하나씩 남기면 됩니다.
      </p>

      <p className="mt-4 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm leading-relaxed text-warning">
        <strong className="font-bold">한 가지만 부탁드립니다.</strong> 이용자나 사례의 실명,
        기관명, 특정할 수 있는 상황은 적지 말아 주세요. 고민의 내용만 적어 주시면 됩니다.
      </p>

      {writtenCount > 0 ? (
        <p role="status" className="mt-4 text-sm font-semibold text-success">
          지금까지 {writtenCount}개를 남기셨습니다.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <fieldset>
          <legend className="text-sm font-bold text-ink">어떤 고민인가요?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {WORRY_CATEGORIES.map((option) => (
              <label
                key={option}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  category === option
                    ? "border-brand-blue bg-brand-blue/5"
                    : "border-line bg-surface hover:border-brand-blue/50"
                }`}
              >
                <input
                  type="radio"
                  name={`${formId}-category`}
                  checked={category === option}
                  onChange={() => setCategory(option)}
                  className="h-4 w-4 accent-[#1267AA]"
                />
                <span className="font-semibold text-ink">{option} 고민</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor={`${formId}-content`} className="text-sm font-bold text-ink">
            고민 내용
          </label>
          <textarea
            id={`${formId}-content`}
            rows={5}
            maxLength={WORRY_MAX_LENGTH}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="예: 선배에게 물어보고 싶은데 바빠 보여서 말을 못 꺼내겠어요."
            className="mt-2 w-full resize-y rounded-lg border border-line bg-surface px-4 py-3 text-base text-ink hover:border-brand-blue/50"
          />
          <p className="mt-1 text-right text-xs text-ink-muted">
            {content.length} / {WORRY_MAX_LENGTH}자
          </p>
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

        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="text-sm font-medium text-success">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || content.trim().length < 5}
          className="w-full rounded-lg bg-brand-blue px-8 py-3.5 text-base font-bold text-white transition-colors hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:bg-ink-muted"
        >
          {submitting ? "남기는 중..." : "익명으로 남기기"}
        </button>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2단계 · 답변 적어주기
// ---------------------------------------------------------------------------

function ReplyStep({
  view,
  selectedTeam,
  onChooseTeam,
  isAdmin,
}: {
  view: WorryBoardView;
  selectedTeam: number;
  onChooseTeam: (teamNumber: number) => void;
  isAdmin: boolean;
}) {
  const { board, worries } = view;

  if (board.teamCount < 1) {
    return (
      <p className="rounded-[14px] border border-line bg-surface px-6 py-12 text-center text-ink-muted">
        운영자가 팀을 나누는 중입니다. 잠시만 기다려 주세요.
      </p>
    );
  }

  if (selectedTeam < 1) {
    return (
      <section className="rounded-[14px] border border-line bg-surface p-6 text-center sm:p-7">
        <h2 className="text-lg font-bold text-navy">우리 팀을 골라 주세요</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          고른 팀에 배정된 고민만 보입니다. 팀 번호는 이 기기에만 저장되고 서버로 보내지
          않습니다.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {Array.from({ length: board.teamCount }, (_, index) => index + 1).map((teamNumber) => (
            <button
              key={teamNumber}
              type="button"
              onClick={() => onChooseTeam(teamNumber)}
              className="rounded-lg border border-line px-6 py-3 text-base font-bold text-ink-soft transition-colors hover:border-brand-blue hover:text-brand-blue"
            >
              {teamNumber}팀
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="reply-step" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="reply-step" className="text-lg font-bold text-navy">
          {selectedTeam}팀에 배정된 고민 ({worries.length}개)
        </h2>
        <button
          type="button"
          onClick={() => onChooseTeam(0)}
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:border-brand-blue/50"
        >
          팀 다시 고르기
        </button>
      </div>

      <p className="rounded-[14px] border border-line bg-surface px-5 py-4 text-sm leading-relaxed text-ink-soft">
        고민마다 생각이나 답변을 포스트잇으로 붙여 주세요. 답변도 익명입니다. 다른 사람이 붙인
        포스트잇은 3단계에서 함께 봅니다.
      </p>

      {worries.length === 0 ? (
        <p className="rounded-[14px] border border-line bg-surface px-6 py-12 text-center text-ink-muted">
          이 팀에 배정된 고민이 없습니다. 팀 번호를 다시 확인해 주세요.
        </p>
      ) : (
        <ul className="space-y-5">
          {worries.map((worry) => (
            <li key={worry.worryId}>
              <WorryCardView
                worry={worry}
                boardId={board.boardId}
                canReply
                showReplies={false}
                isAdmin={isAdmin}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3단계 · 함께 보기
// ---------------------------------------------------------------------------

function ShareStep({ view, isAdmin }: { view: WorryBoardView; isAdmin: boolean }) {
  const { board, worries } = view;
  const [team, setTeam] = useState(0);

  const shown = team > 0 ? worries.filter((worry) => worry.teamNumber === team) : worries;
  const replyCount = shown.reduce((sum, worry) => sum + worry.replies.length, 0);

  return (
    <section aria-labelledby="share-step" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="share-step" className="text-lg font-bold text-navy">
          고민 {shown.length}개 · 포스트잇 {replyCount}장
        </h2>

        {board.teamCount > 0 ? (
          <div className="flex flex-wrap gap-2">
            <FilterButton active={team === 0} onClick={() => setTeam(0)}>
              전체
            </FilterButton>
            {Array.from({ length: board.teamCount }, (_, index) => index + 1).map((teamNumber) => (
              <FilterButton
                key={teamNumber}
                active={team === teamNumber}
                onClick={() => setTeam(teamNumber)}
              >
                {teamNumber}팀
              </FilterButton>
            ))}
          </div>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-[14px] border border-line bg-surface px-6 py-12 text-center text-ink-muted">
          표시할 고민이 없습니다.
        </p>
      ) : (
        <ul className="space-y-5">
          {shown.map((worry) => (
            <li key={worry.worryId}>
              <WorryCardView
                worry={worry}
                boardId={board.boardId}
                canReply={board.phase === "sharing"}
                showReplies
                isAdmin={isAdmin}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? "bg-brand-blue text-white"
          : "border border-line text-ink-soft hover:border-brand-blue/50"
      }`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// 고민 한 건
// ---------------------------------------------------------------------------

function WorryCardView({
  worry,
  boardId,
  canReply,
  showReplies,
  isAdmin,
}: {
  worry: WorryBoardView["worries"][number];
  boardId: string;
  canReply: boolean;
  showReplies: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();

  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/worries/${encodeURIComponent(boardId)}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "reply", worryId: worry.worryId, content }),
      });

      const data = (await response.json()) as {
        ok: boolean;
        errors?: { content?: string };
        message?: string;
      };

      if (data.ok) {
        setContent("");
        setDone(true);
        router.refresh();
        return;
      }

      setError(data.errors?.content ?? data.message ?? "남기지 못했습니다.");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(action: "deleteWorry" | "deleteReply", id: string) {
    await fetch(`/api/worries/${encodeURIComponent(boardId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "deleteWorry" ? { action, worryId: id } : { action, replyId: id },
      ),
    });
    router.refresh();
  }

  return (
    <article className="rounded-[14px] border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            worry.category === "개인"
              ? "bg-teal/15 text-teal"
              : "bg-indigo/15 text-indigo"
          }`}
        >
          {worry.category} 고민
        </span>
        {worry.teamNumber > 0 ? (
          <span className="text-xs font-semibold text-ink-muted">{worry.teamNumber}팀</span>
        ) : null}

        {isAdmin ? (
          <button
            type="button"
            onClick={() => remove("deleteWorry", worry.worryId)}
            className="ml-auto rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-muted hover:border-danger/50 hover:text-danger"
          >
            고민 지우기
          </button>
        ) : null}
      </div>

      <p className="mt-3 whitespace-pre-wrap leading-relaxed text-ink">{worry.content}</p>

      {showReplies ? (
        <div className="mt-5">
          <p className="text-sm font-bold text-ink-soft">
            포스트잇 {worry.replies.length}장
          </p>

          {worry.replies.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">아직 붙은 포스트잇이 없습니다.</p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {worry.replies.map((reply, index) => (
                <li
                  key={reply.replyId}
                  className={`relative rounded-sm border p-4 text-sm leading-relaxed text-ink shadow-sm ${
                    NOTE_COLORS[index % NOTE_COLORS.length]
                  }`}
                >
                  <p className="whitespace-pre-wrap">{reply.content}</p>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => remove("deleteReply", reply.replyId)}
                      className="mt-2 text-xs font-semibold text-ink-muted underline hover:text-danger"
                    >
                      지우기
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {canReply ? (
        <form onSubmit={submitReply} className="mt-5 border-t border-line pt-4">
          {done ? (
            <p role="status" className="mb-2 text-sm font-semibold text-success">
              포스트잇을 붙였습니다. 더 적어도 됩니다.
            </p>
          ) : null}

          <textarea
            rows={2}
            maxLength={REPLY_MAX_LENGTH}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="생각이나 답변을 적어 주세요."
            className="w-full resize-y rounded-lg border border-line bg-canvas px-4 py-3 text-sm text-ink hover:border-brand-blue/50"
          />

          {error ? (
            <p role="alert" className="mt-2 text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}

          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-ink-muted">
              {content.length} / {REPLY_MAX_LENGTH}자 · 익명
            </span>
            <button
              type="submit"
              disabled={submitting || content.trim().length < 2}
              className="rounded-lg bg-brand-blue px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:bg-ink-muted"
            >
              {submitting ? "붙이는 중..." : "포스트잇 붙이기"}
            </button>
          </div>
        </form>
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------------------
// 운영자 조작
// ---------------------------------------------------------------------------

function AdminPanel({ view }: { view: WorryBoardView }) {
  const router = useRouter();
  const { board } = view;

  const [teamCount, setTeamCount] = useState(String(board.teamCount || 4));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function send(body: Record<string, unknown>, successMessage: string) {
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/worries/${encodeURIComponent(board.boardId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { ok: boolean; message?: string; assigned?: number };

      setMessage(
        data.ok
          ? data.assigned !== undefined
            ? `${successMessage} (${data.assigned}개 배정)`
            : successMessage
          : (data.message ?? "처리하지 못했습니다."),
      );

      if (data.ok) router.refresh();
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const phases: { value: WorryPhase; label: string }[] = [
    { value: "writing", label: "1단계 고민 적기" },
    { value: "replying", label: "2단계 답변 적어주기" },
    { value: "sharing", label: "3단계 함께 보기" },
    { value: "closed", label: "마감" },
  ];

  return (
    <section
      aria-labelledby="worry-admin"
      className="rounded-[14px] border border-brand-blue/30 bg-brand-blue/5 p-6 sm:p-7"
    >
      <h2 id="worry-admin" className="text-base font-bold text-navy">
        운영자 조작
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        참여자에게는 이 칸이 보이지 않습니다. 모두 작성을 마치면 팀을 나눈 뒤 2단계로
        넘기세요.
      </p>

      <div className="mt-5">
        <p className="text-sm font-bold text-ink">단계 바꾸기</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {phases.map((phase) => (
            <button
              key={phase.value}
              type="button"
              disabled={busy || board.phase === phase.value}
              onClick={() => send({ action: "setPhase", phase: phase.value }, `${phase.label}로 바꿨습니다.`)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                board.phase === phase.value
                  ? "bg-brand-blue text-white"
                  : "border border-line bg-surface text-ink-soft hover:border-brand-blue/60"
              }`}
            >
              {phase.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-bold text-ink">팀 나누기</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          지금까지 모인 고민 {view.totalWorries}개를 무작위로 고르게 나눕니다. 개인 고민과 회사
          고민이 한 팀에 몰리지 않게 섞습니다. 다시 누르면 다시 나눕니다.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            max={10}
            value={teamCount}
            onChange={(event) => setTeamCount(event.target.value)}
            className="w-24 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            aria-label="팀 수"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              send({ action: "assignTeams", teamCount: Number(teamCount) }, "팀을 나눴습니다.")
            }
            className="rounded-lg border border-line bg-surface px-5 py-2 text-sm font-bold text-brand-blue hover:border-brand-blue/60 disabled:opacity-60"
          >
            팀 나누기
          </button>
        </div>
      </div>

      {message ? (
        <p role="status" className="mt-4 text-sm font-semibold text-ink-soft">
          {message}
        </p>
      ) : null}
    </section>
  );
}
