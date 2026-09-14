/**
 * 랜덤 조 편성.
 *
 * 서버에 아무것도 저장하지 않는다. 뽑기 결과는 그 자리에서 보고 끝나는
 * 것이고, 남겨 두면 "누가 누구와 같은 조였는지"가 계속 쌓인다.
 *
 * 이 파일은 순수 계산만 한다. 화면과 떼어 놓아야 같은 인원·같은 조건에서
 * 인원이 고르게 나뉘는지 따로 확인할 수 있다.
 */

export type DrawMode = "groupCount" | "groupSize";

/**
 * 조별 인원 수를 정한다.
 *
 * 나머지는 앞 조부터 한 명씩 더 넣어 최대 1명 차이로 맞춘다.
 * 22명을 4개 조로 나누면 6, 6, 5, 5 가 된다. 5, 5, 5, 7 처럼
 * 한 조만 몰리지 않게 한다.
 */
export function planGroupSizes(total: number, mode: DrawMode, value: number): number[] {
  if (total <= 0 || value <= 0) {
    return [];
  }

  // 조당 인원으로 지정하면 몇 개 조가 필요한지부터 구한다.
  const groupCount =
    mode === "groupCount" ? Math.min(value, total) : Math.max(1, Math.ceil(total / value));

  const base = Math.floor(total / groupCount);
  const remainder = total % groupCount;

  return Array.from({ length: groupCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

/** "6명 2개 조, 5명 2개 조" 처럼 사람이 읽는 문구로 바꾼다. */
export function describeGroupSizes(sizes: number[]): string {
  if (sizes.length === 0) return "";

  const counts = new Map<number, number>();
  for (const size of sizes) {
    counts.set(size, (counts.get(size) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([size, count]) => `${size}명 ${count}개 조`)
    .join(", ");
}

/**
 * 이름을 섞어 조에 나눠 담는다.
 *
 * random 은 0 이상 1 미만의 값을 주는 함수다. 기본은 암호학적 난수를 쓰고,
 * 시험할 때만 정해진 값을 넣는다.
 */
export function drawTeams(
  names: string[],
  sizes: number[],
  random: () => number = secureRandom,
): string[][] {
  const shuffled = shuffle(names, random);
  const teams: string[][] = [];
  let cursor = 0;

  for (const size of sizes) {
    teams.push(shuffled.slice(cursor, cursor + size));
    cursor += size;
  }

  // 크기 계산과 인원이 어긋나면 남은 사람을 마지막 조에 넣는다. 아무도 빠지지 않게.
  if (cursor < shuffled.length && teams.length > 0) {
    teams[teams.length - 1].push(...shuffled.slice(cursor));
  }

  return teams;
}

/**
 * 피셔-예이츠 섞기.
 *
 * sort(() => Math.random() - 0.5) 는 고르게 섞이지 않는다. 매번 같은 사람이
 * 앞쪽에 오는 편향이 생기므로 쓰지 않는다.
 */
export function shuffle<T>(items: readonly T[], random: () => number = secureRandom): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/** 브라우저의 암호학적 난수. 없으면 Math.random 으로 물러선다. */
function secureRandom(): number {
  const crypto = globalThis.crypto;

  if (crypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0] / 2 ** 32;
  }

  return Math.random();
}
