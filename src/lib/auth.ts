import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { getAuthConfig } from "./config";

/**
 * 공동 비밀번호 기반 2단 권한.
 *
 * 20명 규모에 계정 시스템을 만드는 것은 과투자이므로 공유 비밀번호를 쓴다.
 * 대신 아래를 지킨다.
 *   - 비밀번호는 환경변수로만 관리하고 코드와 시트에 두지 않는다.
 *   - 쿠키에는 권한과 만료만 담고 HMAC 으로 서명한다. 위조하면 무효가 된다.
 *   - httpOnly 로 두어 스크립트가 쿠키를 읽지 못하게 한다.
 *   - 비밀번호 비교는 시간 차이를 줄인 방식으로 한다.
 *
 * 공유 비밀번호는 유출되면 누구나 들어올 수 있다는 한계가 있다.
 * 그래서 명함집에도 전화번호를 따로 표시하지 않고, 검색엔진 수집을 막는다.
 */

export type Role = "member" | "admin";

export const SESSION_COOKIE = "newbie_session";

/** 로그인 유지 기간. 동문회 운영 기간을 고려해 30일로 둔다. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type LoginResult = { ok: true; role: Role } | { ok: false; reason: string };

/**
 * 비밀번호를 확인해 권한을 판정한다.
 *
 * 운영자 비밀번호를 먼저 확인한다. 두 비밀번호가 같게 설정된 경우
 * 더 높은 권한으로 처리하는 것이 운영자 입장에서 안전하다.
 */
export function resolveRole(password: string): LoginResult {
  const { memberPassword, adminPassword, sessionSecret } = getAuthConfig();

  if (!sessionSecret) {
    return { ok: false, reason: "로그인이 설정되지 않았습니다. 운영자에게 문의해 주세요." };
  }

  if (!memberPassword && !adminPassword) {
    return { ok: false, reason: "로그인이 설정되지 않았습니다. 운영자에게 문의해 주세요." };
  }

  if (adminPassword && safeEquals(password, adminPassword)) {
    return { ok: true, role: "admin" };
  }

  if (memberPassword && safeEquals(password, memberPassword)) {
    return { ok: true, role: "member" };
  }

  return { ok: false, reason: "비밀번호가 올바르지 않습니다." };
}

/** 로그인 성공 시 서명된 세션 쿠키를 심는다. */
export async function createSession(role: Role): Promise<void> {
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${role}.${expiresAt}`;
  const value = `${payload}.${sign(payload)}`;

  const store = await cookies();
  store.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** 현재 요청의 권한을 확인한다. 로그인하지 않았거나 위조·만료된 경우 null */
export async function getSessionRole(): Promise<Role | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const parts = raw.split(".");
  if (parts.length !== 3) return null;

  const [role, expiresAt, signature] = parts;
  const payload = `${role}.${expiresAt}`;

  if (!safeEquals(signature, sign(payload))) {
    return null;
  }

  const expiry = Number.parseInt(expiresAt, 10);
  if (!Number.isFinite(expiry) || expiry < Date.now()) {
    return null;
  }

  return role === "admin" || role === "member" ? role : null;
}

/** 참여자 이상 권한이 필요한 화면에서 사용한다. */
export async function hasMemberAccess(): Promise<boolean> {
  const role = await getSessionRole();
  return role === "member" || role === "admin";
}

/** 운영자 전용 화면에서 사용한다. */
export async function hasAdminAccess(): Promise<boolean> {
  return (await getSessionRole()) === "admin";
}

function sign(payload: string): string {
  const { sessionSecret } = getAuthConfig();
  return createHmac("sha256", sessionSecret).update(payload).digest("base64url");
}

/** 길이가 달라도 예외를 던지지 않고 false 를 돌려준다. */
function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
