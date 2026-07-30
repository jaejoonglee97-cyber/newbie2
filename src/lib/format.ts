/** 화면 표시용 포맷 함수. 모든 날짜는 한국 시간 기준으로 보여준다. (PRD 15) */

const KST = "Asia/Seoul";

/** "1,000,000원" */
export function formatWon(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

/** 쉼표나 원 표기가 섞인 시트 값을 숫자로 만든다. */
export function parseNumber(value: string, fallback = 0): number {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  if (!cleaned) return fallback;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** "2026년 8월 1일" */
export function formatDate(isoDate: string): string {
  const date = toDate(isoDate);
  if (!date) return isoDate;

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** "2026. 8. 1." */
export function formatDateShort(isoDate: string): string {
  const date = toDate(isoDate);
  if (!date) return isoDate;

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

/** "2026년 8월 14일 오후 6:00" */
export function formatDateTime(isoDateTime: string): string {
  const date = toDate(isoDateTime);
  if (!date) return isoDateTime;

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** 현재 시각을 한국 시간 오프셋이 붙은 ISO 8601 문자열로 만든다. */
export function nowKstIso(): string {
  return toKstIso(new Date());
}

export function toKstIso(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}+09:00`;
}

/** 한국 시간 기준 yyyyMMdd. 신청 ID 생성에 쓴다. */
export function kstDateStamp(date = new Date()): string {
  return toKstIso(date).slice(0, 10).replace(/-/g, "");
}

function toDate(value: string): Date | null {
  if (!value) return null;

  // 날짜만 있는 값은 한국 시간 자정으로 해석한다.
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+09:00` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}
