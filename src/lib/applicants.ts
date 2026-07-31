import "server-only";

import { uploadCard } from "./card-storage";
import { kstDateStamp, nowKstIso } from "./format";
import { appendRow, readSheet } from "./repo";
import { getSettings } from "./settings";
import type {
  ApplicantRecord,
  ApplicationInput,
  ApplicationReceipt,
  CardEntry,
  CardUpload,
  FieldErrors,
} from "./types";

const SHEET = "applicants";

export type ValidationResult =
  | { ok: true; value: ApplicationInput }
  | { ok: false; errors: FieldErrors };

/**
 * 신청 입력값을 서버에서 검증한다.
 *
 * 브라우저 검증은 우회할 수 있으므로 저장 직전에 반드시 다시 확인한다.
 * 반환값의 phone 은 010-0000-0000 형태로 정규화된다.
 *
 * hasCard 가 true 이면 명함 공개 동의를 필수로 확인한다.
 */
export function validateApplication(raw: unknown, hasCard: boolean): ValidationResult {
  const input = (raw ?? {}) as Record<string, unknown>;
  const errors: FieldErrors = {};

  const name = str(input.name);
  if (name.length < 2) {
    errors.name = "성명을 2자 이상 입력해 주세요.";
  } else if (name.length > 30) {
    errors.name = "성명이 너무 깁니다.";
  }

  const organization = str(input.organization);
  if (organization.length < 2) {
    errors.organization = "소속기관을 입력해 주세요.";
  } else if (organization.length > 60) {
    errors.organization = "소속기관명이 너무 깁니다.";
  }

  const position = str(input.position);
  if (position.length < 1) {
    errors.position = "직책을 입력해 주세요.";
  } else if (position.length > 40) {
    errors.position = "직책이 너무 깁니다.";
  }

  const phoneDigits = str(input.phone).replace(/\D/g, "");
  let phone = "";
  if (!phoneDigits) {
    errors.phone = "휴대전화 번호를 입력해 주세요.";
  } else if (!/^01[016789]\d{7,8}$/.test(phoneDigits)) {
    errors.phone = "휴대전화 번호 형식을 확인해 주세요. 예: 010-1234-5678";
  } else {
    phone = formatPhone(phoneDigits);
  }

  const privacyConsent = isTrue(input.privacyConsent);
  if (!privacyConsent) {
    errors.privacyConsent = "개인정보 수집·이용에 동의하셔야 신청할 수 있습니다.";
  }

  const cardShareConsent = isTrue(input.cardShareConsent);
  if (hasCard && !cardShareConsent) {
    errors.cardShareConsent =
      "명함을 첨부하셨습니다. 다른 참여자에게 공개되는 것에 동의해 주세요.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name,
      organization,
      position,
      phone,
      privacyConsent,
      // 명함을 첨부하지 않았으면 공개 동의는 기록하지 않는다.
      cardShareConsent: hasCard ? cardShareConsent : false,
    },
  };
}

/**
 * 신청을 applicants 시트에 저장한다.
 *
 * 중복 신청은 막지 않는다. PRD REC-04 에 따라 운영자가 판단할 수 있도록
 * 중복 가능성만 표시하고 접수는 정상 처리한다.
 *
 * 명함 업로드가 실패해도 접수는 진행한다. 명함은 선택 항목이므로
 * 저장 실패 때문에 신청이 사라지는 편이 더 나쁘다.
 */
export async function createApplication(
  input: ApplicationInput,
  card?: CardUpload,
): Promise<ApplicationReceipt> {
  const settings = await getSettings();
  const existing = await readSheet(SHEET);

  const duplicateOf = findDuplicate(existing, input);
  const applicationId = nextApplicationId(existing);
  const now = nowKstIso();

  const uploaded = card ? await uploadCard(applicationId, input.name, card) : null;

  const notes: string[] = [];
  if (duplicateOf) notes.push(`중복 신청 가능성. 기존 ${duplicateOf}`);
  if (card && !uploaded) notes.push("명함 업로드 실패. 별도 수집 필요");

  await appendRow(SHEET, {
    application_id: applicationId,
    program_id: settings.programId,
    applied_at: now,
    name: input.name,
    organization: input.organization,
    position: input.position,
    phone: input.phone,
    // 폼에서는 묻지 않는다. 신청 자체가 참석 희망 표명이다.
    attendance_intent: "참석희망",
    privacy_consent: "TRUE",
    privacy_consent_at: now,
    card_share_consent: uploaded && input.cardShareConsent ? "TRUE" : "FALSE",
    business_card_file_id: uploaded?.fileId ?? "",
    business_card_url: uploaded?.fileUrl ?? "",
    // 별도 승인 절차가 없다. 신청 즉시 참여가 확정되고, 중복·취소 등 예외만
    // 운영자가 시트에서 '대기' 또는 '불참'으로 수동 변경한다.
    application_status: "참여확정",
    admin_note: notes.join(" / "),
    updated_at: now,
  });

  return {
    applicationId,
    appliedAt: now,
    name: input.name,
    possibleDuplicate: duplicateOf !== null,
    cardUploaded: uploaded !== null,
    cardFailed: card !== undefined && uploaded === null,
  };
}

/**
 * 명함집에 표시할 목록.
 *
 * 전화번호는 담지 않는다. 명함 이미지 자체에 연락처가 있으므로
 * 별도로 화면에 옮겨 적지 않는다.
 * 불참 처리된 신청자는 제외한다.
 */
export async function listCardEntries(): Promise<CardEntry[]> {
  const rows = await readSheet(SHEET);

  return rows
    .filter((row) => row.application_status !== "불참")
    .map((row) => {
      const fileId = row.business_card_file_id ?? "";
      const shared = row.card_share_consent === "TRUE";

      return {
        applicationId: row.application_id ?? "",
        name: row.name ?? "",
        organization: row.organization ?? "",
        position: row.position ?? "",
        // 공개 동의가 없으면 이미지를 내보내지 않는다.
        cardImagePath: fileId && shared ? `/api/cards/${encodeURIComponent(fileId)}` : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

/** 운영자 명단. 연락처를 포함하므로 운영자 권한에서만 호출한다. */
export async function listApplicantRecords(): Promise<ApplicantRecord[]> {
  const rows = await readSheet(SHEET);

  return rows
    .map((row) => {
      const fileId = row.business_card_file_id ?? "";

      return {
        applicationId: row.application_id ?? "",
        appliedAt: row.applied_at ?? "",
        name: row.name ?? "",
        organization: row.organization ?? "",
        position: row.position ?? "",
        phone: row.phone ?? "",
        applicationStatus: normalizeStatus(row.application_status),
        adminNote: row.admin_note ?? "",
        hasCard: fileId !== "",
        cardImagePath: fileId ? `/api/cards/${encodeURIComponent(fileId)}` : null,
      };
    })
    .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
}

/**
 * 저장된 상태값을 화면 표시용으로 정리한다.
 *
 * 승인 절차가 없으므로 '검토중'은 의미가 없다. 초기 버전에서 그렇게 저장된
 * 행이 승인을 기다리는 것처럼 보이지 않도록 '참여확정'으로 표시한다.
 * 시트 값 자체를 바꾸려면 Apps Script 의 confirmPendingApplicants 를 실행한다.
 *
 * '대기'와 '불참'은 운영자가 의도적으로 지정한 값이므로 그대로 둔다.
 */
function normalizeStatus(stored: string | undefined): string {
  const value = (stored ?? "").trim();
  return value === "" || value === "검토중" ? "참여확정" : value;
}

/**
 * 연락처가 같은 기존 신청의 ID를 찾는다. (REC-04)
 *
 * 이메일을 수집하지 않으므로 휴대전화만으로 판단한다.
 */
function findDuplicate(
  existing: Awaited<ReturnType<typeof readSheet>>,
  input: ApplicationInput,
): string | null {
  const phoneKey = input.phone.replace(/\D/g, "");

  for (const row of existing) {
    if ((row.phone ?? "").replace(/\D/g, "") === phoneKey) {
      return row.application_id || "확인 필요";
    }
  }

  return null;
}

/**
 * APP-YYYYMMDD-NNNN 형식의 신청 ID를 만든다. (스키마 8장)
 *
 * 같은 날 접수된 최대 일련번호에 1을 더한다.
 * 동시 접수가 겹치면 같은 번호가 나올 수 있으나, 하루 수십 건 규모에서는
 * 실제로 발생하기 어렵고 운영자가 시트에서 바로 확인할 수 있다.
 */
function nextApplicationId(existing: Awaited<ReturnType<typeof readSheet>>): string {
  const stamp = kstDateStamp();
  const prefix = `APP-${stamp}-`;

  let max = 0;
  for (const row of existing) {
    const id = row.application_id ?? "";
    if (!id.startsWith(prefix)) continue;

    const sequence = Number.parseInt(id.slice(prefix.length), 10);
    if (Number.isFinite(sequence) && sequence > max) {
      max = sequence;
    }
  }

  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function formatPhone(digits: string): string {
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

function isTrue(value: unknown): boolean {
  return value === true || value === "true" || value === "TRUE" || value === "on";
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
