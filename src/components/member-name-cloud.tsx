import type { CSSProperties } from "react";

/**
 * 뉴비스쿨 2기로 모인 사람들의 이름 클라우드.
 *
 * 이름만 받는다. 소속기관·직책·한 줄 소개·기대하는 점은 이 컴포넌트의
 * props 에 아예 없다. 메인 페이지는 로그인 없이 누구나 볼 수 있으므로,
 * 동의 범위가 "로그인한 참여자에게 공개"인 항목은 여기로 내려보내지 않는다.
 * 나중에 실수로 더 넘기려 해도 타입에서 막힌다.
 *
 * 클릭 동작이 없어 button 이 아니라 목록 항목으로 둔다.
 * 스크린리더에는 평범한 이름 목록으로 읽힌다.
 */

/** 글로우 색을 순환시켜 이름마다 조금씩 다른 빛을 준다. */
const GLOW = [
  "rgb(44 162 176 / 0.55)", // teal
  "rgb(18 103 170 / 0.55)", // brand-blue
  "rgb(62 74 148 / 0.55)", // indigo
];

export function MemberNameCloud({ names }: { names: string[] }) {
  if (names.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="members" className="mt-6">
      <div className="night-sky overflow-hidden rounded-[14px] px-6 py-10 text-white sm:px-8 sm:py-14">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
            Newbie School 2nd
          </p>
          <h2 id="members" className="mt-3 text-xl font-bold sm:text-2xl">
            뉴비스쿨 2기, 우리 {names.length}명
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/70">
            같은 시기에 현장에 들어와, 하나의 기수로 모였습니다.
          </p>
        </div>

        <ul className="mt-10 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          {names.map((name, index) => (
            <li
              key={`${name}-${index}`}
              className="name-pill rounded-full border border-white/15 bg-white/[0.07] px-4 py-2 text-sm font-semibold text-white/90 transition-colors duration-300 hover:border-white/40 hover:bg-white/20 hover:text-white sm:px-5 sm:text-base"
              style={pillStyle(index)}
            >
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * 인덱스만으로 리듬을 흩는다.
 *
 * 난수를 쓰면 서버와 클라이언트가 다른 값을 만들어 하이드레이션이 어긋나므로,
 * 순전히 인덱스에서 계산한다. 서로 나누어떨어지지 않는 주기(5, 7)를 섞어
 * 22개가 눈에 띄는 반복 없이 각자 움직이게 한다.
 */
function pillStyle(index: number): CSSProperties {
  const duration = 4.2 + (index % 5) * 0.6;
  const delay = -((index % 7) * 0.9 + (index % 3) * 0.3);
  const amplitude = 5 + (index % 4);

  return {
    "--float-duration": `${duration}s`,
    "--float-delay": `${delay}s`,
    "--float-amplitude": `${amplitude}px`,
    boxShadow: `0 0 18px -6px ${GLOW[index % GLOW.length]}`,
  } as CSSProperties;
}
