import "server-only";

import { SetupRequiredError } from "./sheets";

/**
 * 화면 한 조각의 자료를 읽어 온 결과.
 *
 * failed 가 true 면 자료를 못 읽은 것이고, data 에는 빈 값이 들어 있다.
 * "자료가 없다"와 "못 읽었다"를 화면에서 구분해 안내하기 위해 나눠 둔다.
 */
export type Loaded<T> = { data: T; failed: boolean };

/**
 * 자료를 읽되, 실패해도 화면 전체를 죽이지 않는다.
 *
 * 22명이 동시에 쓰는 사이트라 한 군데가 잠깐 안 읽힌다고 페이지 전체가
 * 500 으로 막히면 안 된다. 구글 시트 장애나 일시적인 네트워크 오류는
 * 대부분 새로고침으로 지나가므로, 그 자리만 안내 문구로 바꾸고 나머지는
 * 그대로 보여 준다.
 *
 * 원인은 서버 로그에 남긴다. 화면에는 내부 오류 내용을 내보내지 않는다.
 */
export async function loadOr<T>(
  label: string,
  fallback: T,
  load: () => Promise<T>,
): Promise<Loaded<T>> {
  try {
    return { data: await load(), failed: false };
  } catch (error) {
    console.error(`[load] ${label} 불러오기 실패:`, error);
    return { data: fallback, failed: true };
  }
}

/**
 * 운영자에게 그대로 보여 줘도 되는 안내인지 가려낸다.
 *
 * 시트를 아직 안 만들어 저장이 안 되는 경우가 그렇다. 무엇을 해야 하는지
 * 적혀 있으므로 감추면 오히려 원인을 못 찾는다. 그 밖의 오류는 내부 사정이라
 * null 을 돌려주고 화면에는 일반 문구만 내보낸다.
 */
export function setupHint(error: unknown): string | null {
  return error instanceof SetupRequiredError ? error.message : null;
}
