"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { buildConstellation } from "@/lib/constellation";

/**
 * 뉴비스쿨 2기 성좌.
 *
 * 받는 값은 이름과 한 줄 소개뿐이다. 소속기관·직책·기대하는 점·연락처는 이
 * 컴포넌트의 타입에 없다. 한 줄 소개는 동의 범위가 "로그인한 참여자에게 공개"
 * 이므로, 서버에서 비로그인 방문자에게는 빈 문자열로 지워서 넘긴다.
 * 즉 로그인하지 않은 사람의 브라우저에는 소개 문구가 아예 도달하지 않는다.
 *
 * 움직임은 CSS 다. 성좌 전체가 천천히 돌고, 이름표는 같은 주기로 반대로 돌아
 * 글자가 늘 수평을 유지한다. 별과 선이 같은 요소 안에서 함께 회전하므로 선
 * 끝이 별에서 떨어지지 않는다.
 *
 * 이름을 누르면 회전이 멈추고 성좌 아래에 소개가 펼쳐진다. 움직이는 별에
 * 말풍선을 붙이면 읽는 동안 글자가 따라 움직여 읽기 어렵기 때문에, 설명은
 * 고정된 자리에 둔다.
 */

export type Star = {
  name: string;
  /** 비로그인 방문자에게는 서버에서 빈 문자열로 지워 보낸다. */
  introduction: string;
};

/** 별빛 색. 이름마다 조금씩 다른 색을 준다. */
const STAR_COLORS = [
  "rgb(125 211 220)", // teal 계열 밝게
  "rgb(147 197 235)", // brand-blue 계열 밝게
  "rgb(165 175 225)", // indigo 계열 밝게
  "rgb(255 255 255)",
];

/** 한 바퀴 도는 데 걸리는 시간. 이름표 역회전도 같은 값을 쓴다. */
const SPIN_DURATION = "108s";


export function ConstellationIntro({
  stars,
  canSeeIntroduction,
}: {
  stars: Star[];
  canSeeIntroduction: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  // 배치는 개수만 바뀌지 않으면 다시 계산할 필요가 없다.
  const { points, edges } = useMemo(() => buildConstellation(stars.length), [stars.length]);

  useEffect(() => {
    if (selected === null) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null);
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [selected]);

  if (stars.length === 0) {
    return null;
  }

  const active = selected === null ? null : stars[selected];

  return (
    <section aria-labelledby="constellation" className="night-sky relative overflow-hidden">
      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-5 py-14 sm:px-8 sm:py-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/50">
          Newbie School 2nd
        </p>
        {/* 페이지의 h1 은 SiteHeader 의 프로그램명이므로 여기서는 h2 를 쓴다. */}
        <h2
          id="constellation"
          className="mt-4 text-center text-2xl font-bold text-white sm:text-3xl"
        >
          뉴비스쿨 2기를 소개합니다
        </h2>
        <p className="mt-3 text-center text-sm text-white/55">
          이름을 누르면 소개를 볼 수 있습니다.
        </p>

        <div
          className={`constellation mt-10 sm:mt-14 ${selected === null ? "" : "is-paused"}`}
          style={{ "--spin": SPIN_DURATION } as CSSProperties}
        >
          <div className="constellation-field">
            {/*
              선은 장식이므로 보조기술에 읽히지 않게 한다.
              viewBox 를 0 0 100 100 으로 두어 좌표를 백분율처럼 그대로 쓴다.
            */}
            <svg
              aria-hidden="true"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
            >
              {edges.map((edge) => {
                const from = points[edge.from];
                const to = points[edge.to];
                const touchesSelected = selected === edge.from || selected === edge.to;

                return (
                  <line
                    key={`${edge.from}-${edge.to}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={
                      touchesSelected ? "rgb(125 211 220 / 0.75)" : "rgb(255 255 255 / 0.16)"
                    }
                    strokeWidth={touchesSelected ? "0.28" : "0.15"}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>

            <ul className="absolute inset-0" aria-label="뉴비스쿨 2기 참여자">
              {stars.map((star, index) => (
                <li
                  key={`${star.name}-${index}`}
                  className="absolute h-0 w-0"
                  style={{ left: `${points[index].x}%`, top: `${points[index].y}%` }}
                >
                  <span
                    className={`constellation-node ${selected === index ? "is-selected" : ""}`}
                    style={nodeStyle(index)}
                  >
                    <span aria-hidden="true" className="star-dot" />
                    <button
                      type="button"
                      aria-pressed={selected === index}
                      onClick={() => setSelected(selected === index ? null : index)}
                      className="star-name"
                    >
                      {star.name}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/*
          선택한 사람의 소개가 나오는 자리.
          비어 있을 때도 높이를 잡아 두어 눌렀을 때 화면이 튀지 않게 한다.
        */}
        <div
          aria-live="polite"
          className="mt-10 flex min-h-[104px] w-full max-w-xl flex-col items-center justify-center sm:mt-14"
        >
          {active ? (
            <div className="w-full rounded-[14px] border border-white/15 bg-white/[0.07] px-6 py-5 text-center">
              <p className="text-base font-bold text-white">{active.name}</p>

              {canSeeIntroduction ? (
                active.introduction ? (
                  <p className="mt-2 text-sm leading-relaxed text-white/80">
                    {active.introduction}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-white/50">한 줄 소개를 남기지 않았습니다.</p>
                )
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  한 줄 소개는 동문회 참여자에게만 공개됩니다.{" "}
                  <Link href="/login" className="font-semibold text-white underline">
                    로그인하기
                  </Link>
                </p>
              )}

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="mt-4 rounded-lg border border-white/20 px-4 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:border-white/50 hover:text-white"
              >
                닫기
              </button>
            </div>
          ) : (
            /*
              아무도 고르지 않았을 때는 비워 둔다.
              안내는 성좌 위에 이미 있고, 여기에 문장을 하나 더 두면 군더더기다.
              높이는 유지해 이름을 눌렀을 때 화면이 밀리지 않게 한다.
            */
            null
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * 인덱스만으로 별마다 다른 반짝임을 만든다.
 *
 * 난수를 쓰면 서버와 클라이언트가 다른 값을 만들어 하이드레이션이 어긋난다.
 * 서로 나누어떨어지지 않는 주기를 섞어 눈에 띄는 반복을 없앤다.
 */
function nodeStyle(index: number): CSSProperties {
  const color = STAR_COLORS[index % STAR_COLORS.length];
  const twinkleDuration = 3.4 + (index % 5) * 0.7;
  const twinkleDelay = -((index % 7) * 0.8 + (index % 3) * 0.35);
  const size = index % 4 === 0 ? 7 : index % 3 === 0 ? 5 : 4;

  return {
    "--star-color": color,
    "--star-size": `${size}px`,
    "--twinkle-duration": `${twinkleDuration}s`,
    "--twinkle-delay": `${twinkleDelay}s`,
  } as CSSProperties;
}
