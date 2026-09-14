"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  describeGroupSizes,
  drawTeams,
  planGroupSizes,
  shuffle,
  type DrawMode,
} from "@/lib/team-draw";

/** 섞이는 모습을 보여주는 시간. 너무 길면 기다리게 되고 짧으면 뽑는 맛이 없다. */
const ROLL_MS = 1100;
const ROLL_TICK_MS = 70;
/** 조를 하나씩 펼치는 간격 */
const REVEAL_STEP_MS = 320;

/**
 * 랜덤 조 편성.
 *
 * 이름 고르기 → 조 나누기 → 결과 펼치기 까지 전부 브라우저 안에서 끝난다.
 * 서버로 이름을 보내지 않고 결과도 저장하지 않는다. 그 자리에서 보고
 * 채팅방에 붙여넣으면 되는 일이라 남길 이유가 없다.
 */
export function TeamDraw({ memberNames }: { memberNames: string[] }) {
  const [pool, setPool] = useState<string[]>(memberNames);
  const [selected, setSelected] = useState<string[]>(memberNames);
  const [mode, setMode] = useState<DrawMode>("groupCount");
  const [count, setCount] = useState(4);
  const [size, setSize] = useState(5);
  const [typed, setTyped] = useState("");

  const [teams, setTeams] = useState<string[][] | null>(null);
  const [rolling, setRolling] = useState(false);
  const [rollPreview, setRollPreview] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [copied, setCopied] = useState(false);

  // 화면을 떠나도 타이머가 계속 돌지 않게 모아 두고 한 번에 정리한다.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const current = timers.current;
    return () => current.forEach(clearTimeout);
  }, []);

  const value = mode === "groupCount" ? count : size;
  const sizes = planGroupSizes(selected.length, mode, value);
  const canDraw = selected.length >= 2 && sizes.length >= 1 && !rolling;

  function toggle(name: string) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name],
    );
  }

  function addTyped() {
    // 쉼표나 줄바꿈으로 여러 명을 한 번에 넣을 수 있게 한다.
    const names = typed
      .split(/[,\n]/)
      .map((name) => name.trim())
      .filter(Boolean);

    if (names.length === 0) return;

    const fresh = names.filter((name) => !pool.includes(name));
    setPool((prev) => [...prev, ...fresh]);
    setSelected((prev) => [...new Set([...prev, ...names])]);
    setTyped("");
  }

  function handleDraw() {
    if (!canDraw) return;

    const result = drawTeams(selected, sizes);
    setCopied(false);

    // 움직임을 줄이도록 설정한 사람에게는 곧바로 결과를 보여 준다.
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      setTeams(result);
      setRevealed(result.length);
      return;
    }

    setTeams(null);
    setRevealed(0);
    setRolling(true);

    const spin = setInterval(() => setRollPreview(shuffle(selected).slice(0, 12)), ROLL_TICK_MS);

    const stop = setTimeout(() => {
      clearInterval(spin);
      setRolling(false);
      setTeams(result);

      result.forEach((_, index) => {
        const reveal = setTimeout(() => setRevealed(index + 1), index * REVEAL_STEP_MS);
        timers.current.push(reveal);
      });
    }, ROLL_MS);

    timers.current.push(stop);
  }

  async function handleCopy() {
    if (!teams) return;

    const text = teams
      .map((team, index) => `${index + 1}조 (${team.length}명)\n${team.join(", ")}`)
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // 클립보드를 막아 둔 브라우저가 있다. 그럴 땐 직접 긁어 복사하면 된다.
      setCopied(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* 1. 누가 참여하는지 */}
      <section
        aria-labelledby="draw-people"
        className="rounded-[14px] border border-line bg-surface p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="draw-people" className="text-base font-bold text-navy">
            1. 참여할 사람 고르기
          </h2>
          <p className="text-sm font-semibold text-brand-blue">{selected.length}명 선택</p>
        </div>

        {pool.length > 0 ? (
          <>
            <ul className="mt-4 flex flex-wrap gap-2">
              {pool.map((name) => {
                const on = selected.includes(name);

                return (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => toggle(name)}
                      aria-pressed={on}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                        on
                          ? "border-brand-blue bg-brand-blue text-white"
                          : "border-line bg-canvas text-ink-muted hover:border-brand-blue/50"
                      }`}
                    >
                      {name}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelected(pool)}
                className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink-soft transition-colors hover:border-brand-blue/50"
              >
                전체 선택
              </button>
              <button
                type="button"
                onClick={() => setSelected([])}
                className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink-soft transition-colors hover:border-brand-blue/50"
              >
                전체 해제
              </button>
            </div>
          </>
        ) : (
          <p className="mt-4 rounded-lg bg-canvas px-5 py-6 text-center text-sm text-ink-muted">
            참여자 명단을 불러오지 못했습니다. 아래에 이름을 직접 넣어 주세요.
          </p>
        )}

        <div className="mt-5 border-t border-line pt-5">
          <label htmlFor="typed-names" className="text-sm font-semibold text-ink-soft">
            명단에 없는 사람 추가
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id="typed-names"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTyped();
                }
              }}
              placeholder="이름 (쉼표로 여러 명)"
              className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-4 py-2.5 text-sm outline-none focus:border-brand-blue"
            />
            <button
              type="button"
              onClick={addTyped}
              className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:border-brand-blue/50"
            >
              추가
            </button>
          </div>
        </div>
      </section>

      {/* 2. 어떻게 나눌지 */}
      <section
        aria-labelledby="draw-shape"
        className="rounded-[14px] border border-line bg-surface p-5 sm:p-6"
      >
        <h2 id="draw-shape" className="text-base font-bold text-navy">
          2. 어떻게 나눌까요
        </h2>

        <div className="mt-4 flex flex-wrap gap-2">
          <ModeButton on={mode === "groupCount"} onClick={() => setMode("groupCount")}>
            조 개수로
          </ModeButton>
          <ModeButton on={mode === "groupSize"} onClick={() => setMode("groupSize")}>
            조당 인원으로
          </ModeButton>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label htmlFor="draw-value" className="text-sm text-ink-soft">
            {mode === "groupCount" ? "조 개수" : "조당 인원"}
          </label>
          <input
            id="draw-value"
            type="number"
            min={1}
            max={Math.max(1, selected.length)}
            value={value}
            onChange={(event) => {
              const next = Math.max(1, Math.trunc(Number(event.target.value) || 1));
              if (mode === "groupCount") setCount(next);
              else setSize(next);
            }}
            className="w-24 rounded-lg border border-line bg-canvas px-4 py-2.5 text-sm outline-none focus:border-brand-blue"
          />
          <span className="text-sm text-ink-muted">
            {mode === "groupCount" ? "개 조" : "명씩"}
          </span>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          {sizes.length > 0 ? (
            <>
              <strong className="font-semibold text-navy">{describeGroupSizes(sizes)}</strong> 로
              나뉩니다. 인원이 딱 안 맞으면 한 명 차이까지만 벌어지게 고르게 나눕니다.
            </>
          ) : (
            "두 명 이상 골라 주세요."
          )}
        </p>

        <button
          type="button"
          onClick={handleDraw}
          disabled={!canDraw}
          className="mt-6 w-full rounded-lg bg-brand-blue px-6 py-4 text-base font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {rolling ? "섞는 중..." : teams ? "다시 뽑기" : "조 뽑기"}
        </button>
      </section>

      {/* 3. 결과 */}
      {rolling ? (
        <section
          aria-live="polite"
          className="rounded-[14px] border border-brand-blue/30 bg-brand-blue/5 px-6 py-12 text-center"
        >
          <p className="text-sm font-semibold text-brand-blue">섞는 중</p>
          <p className="mt-4 break-keep text-lg font-bold leading-relaxed text-navy">
            {rollPreview.join(" · ")}
          </p>
        </section>
      ) : null}

      {teams && !rolling ? (
        <section aria-labelledby="draw-result" aria-live="polite" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="draw-result" className="text-base font-bold text-navy">
              3. 결과
            </h2>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft transition-colors hover:border-brand-blue/50"
            >
              {copied ? "복사했습니다" : "결과 복사"}
            </button>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {teams.map((team, index) => (
              <li
                key={index}
                className={`rounded-[14px] border border-line bg-surface p-5 transition-all duration-300 ${
                  index < revealed ? "opacity-100" : "translate-y-2 opacity-0"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-lg font-bold text-navy">{index + 1}조</h3>
                  <span className="text-sm text-ink-muted">{team.length}명</span>
                </div>
                <p className="mt-3 break-keep leading-relaxed text-ink">{team.join(", ")}</p>
              </li>
            ))}
          </ul>

          <p className="text-xs leading-relaxed text-ink-muted">
            이 결과는 저장되지 않습니다. 화면을 새로고침하면 사라지니 필요하면 복사해 두세요.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function ModeButton({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
        on
          ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
          : "border-line bg-canvas text-ink-muted hover:border-brand-blue/50"
      }`}
    >
      {children}
    </button>
  );
}
