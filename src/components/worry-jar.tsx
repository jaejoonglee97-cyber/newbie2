"use client";

/**
 * 고민 항아리.
 *
 * 적은 고민이 항아리로 들어가고, 진행자가 흔들어 하나를 꺼낸다.
 * 몇 개가 들어 있는지 눈으로 보이는 것이 이 그림의 목적이다.
 *
 * 쪽지 위치는 번호에서 계산한다. 그릴 때마다 난수를 쓰면 서버에서 그린 것과
 * 브라우저에서 그린 것이 달라져 React 가 경고를 낸다. 같은 번호는 늘 같은
 * 자리에 오게 한다.
 */

export type JarMotion = "idle" | "filling" | "shaking";

/** 항아리 안에 그릴 쪽지 최대 개수. 이보다 많으면 숫자로만 알린다. */
const MAX_NOTES = 24;

const NOTE_COLORS = ["#FFE08A", "#FFC9C9", "#C7E9FF", "#D7F3D2", "#E7D9FF"];

export function WorryJar({
  count,
  motion = "idle",
  label,
}: {
  count: number;
  motion?: JarMotion;
  label?: string;
}) {
  const notes = Array.from({ length: Math.min(count, MAX_NOTES) }, (_, index) => index);

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 200 224"
        className={`w-44 max-w-full sm:w-52 ${motionClass(motion)}`}
        role="img"
        aria-label={`고민 항아리. ${count}개 들어 있습니다.`}
      >
        <defs>
          {/* 쪽지가 항아리 밖으로 삐져나오지 않게 몸통 모양으로 자른다. */}
          <clipPath id="jar-inside">
            <path d={JAR_BODY} />
          </clipPath>

          <linearGradient id="jar-clay" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8C6B4F" />
            <stop offset="45%" stopColor="#6F5340" />
            <stop offset="100%" stopColor="#4E3A2D" />
          </linearGradient>
        </defs>

        {/* 몸통 */}
        <path d={JAR_BODY} fill="url(#jar-clay)" />

        {/* 안에 쌓인 쪽지 */}
        <g clipPath="url(#jar-inside)">
          {notes.map((index) => {
            const spot = notePosition(index);

            return (
              <rect
                key={index}
                x={spot.x}
                y={spot.y}
                width="26"
                height="20"
                rx="3"
                fill={NOTE_COLORS[index % NOTE_COLORS.length]}
                opacity="0.95"
                transform={`rotate(${spot.angle} ${spot.x + 13} ${spot.y + 10})`}
              />
            );
          })}

          {/* 안쪽 그늘. 쪽지가 항아리 속에 있는 느낌을 준다. */}
          <ellipse cx="100" cy="70" rx="80" ry="40" fill="#2A1F18" opacity="0.35" />
        </g>

        {/* 주둥이 */}
        <ellipse cx="100" cy="56" rx="46" ry="12" fill="#7A5B45" />
        <ellipse cx="100" cy="56" rx="37" ry="8.5" fill="#2A1F18" />

        {/* 넣는 중인 쪽지 하나 */}
        {motion === "filling" ? (
          <rect
            className="jar-drop"
            x="87"
            y="0"
            width="26"
            height="20"
            rx="3"
            fill="#FFE08A"
          />
        ) : null}
      </svg>

      <p className="mt-3 text-center text-sm font-semibold text-ink-soft">
        {label ?? `항아리에 ${count}개`}
      </p>

      <style>{`
        /*
         * 움직임을 줄이도록 설정한 사람에게는 흔들지 않는다.
         * 어지럼을 느끼는 사람이 있다.
         */
        @media (prefers-reduced-motion: no-preference) {
          .jar-shake { animation: jar-shake 0.5s ease-in-out infinite; transform-origin: 100px 210px; }
          .jar-drop { animation: jar-drop 0.7s cubic-bezier(0.5, 0, 0.75, 0) forwards; }
        }

        @keyframes jar-shake {
          0%, 100% { transform: rotate(-3.5deg); }
          50% { transform: rotate(3.5deg); }
        }

        @keyframes jar-drop {
          0% { transform: translateY(-30px) rotate(-18deg); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translateY(40px) rotate(12deg) scale(0.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function motionClass(motion: JarMotion): string {
  return motion === "shaking" ? "jar-shake" : "";
}

/**
 * 번호로 쪽지 자리를 정한다.
 *
 * 같은 번호는 늘 같은 자리다. 아래쪽부터 층층이 채워 쌓인 것처럼 보이게 한다.
 */
function notePosition(index: number): { x: number; y: number; angle: number } {
  const perRow = 4;
  const row = Math.floor(index / perRow);
  const column = index % perRow;

  // 홀수 줄은 반 칸씩 밀어 격자처럼 보이지 않게 한다.
  const offset = row % 2 === 0 ? 0 : 13;
  const jitter = pseudoRandom(index);

  return {
    x: Math.round(46 + column * 26 + offset + jitter * 5),
    y: Math.round(168 - row * 15 - jitter * 3),
    angle: Math.round(-20 + pseudoRandom(index + 97) * 40),
  };
}

/**
 * 번호 하나에서 0 이상 1 미만의 값을 만든다. 같은 번호는 늘 같은 값이다.
 *
 * 정수 연산만 쓴다. Math.sin 같은 실수 함수는 엔진마다 마지막 자리가 달라
 * 서버에서 그린 값과 브라우저에서 그린 값이 어긋나고, React 가 하이드레이션
 * 경고를 낸다.
 */
function pseudoRandom(seed: number): number {
  let x = Math.imul(seed + 1, 2654435761) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0;
  x = (x ^ (x >>> 13)) >>> 0;
  return (x % 1000) / 1000;
}

/** 항아리 몸통 윤곽. 주둥이 아래부터 바닥까지. */
const JAR_BODY =
  "M 56 56 C 30 82, 22 124, 32 154 C 42 188, 68 208, 100 208 C 132 208, 158 188, 168 154 C 178 124, 170 82, 144 56 Z";
