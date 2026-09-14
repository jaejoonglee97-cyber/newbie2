/**
 * 한글 받침 여부에 따라 조사를 붙인다.
 *
 * "명함집을", "활동 기록을", "투표를" 처럼 앞말에 따라 달라지는 조사를
 * 문장마다 손으로 고르지 않기 위해 한 곳에 모아 둔다.
 */
export function withObjectParticle(word: string): string {
  return `${word}${hasFinalConsonant(word) ? "을" : "를"}`;
}

export function withSubjectParticle(word: string): string {
  return `${word}${hasFinalConsonant(word) ? "이" : "가"}`;
}

/** 마지막 글자에 받침이 있는지. 한글이 아니면 받침이 없는 것으로 본다. */
function hasFinalConsonant(word: string): boolean {
  const last = word.trim().at(-1);
  if (!last) return false;

  const code = last.charCodeAt(0);
  // 한글 음절 영역(가 ~ 힣). 28로 나눈 나머지가 0이면 받침이 없다.
  if (code < 0xac00 || code > 0xd7a3) return false;

  return (code - 0xac00) % 28 !== 0;
}
