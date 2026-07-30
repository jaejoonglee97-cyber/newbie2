import { NextResponse } from "next/server";

import { createApplication, validateApplication } from "@/lib/applicants";
import { MAX_CARD_BYTES, isAllowedCardMime } from "@/lib/card-storage";
import { isMockMode } from "@/lib/repo";
import { getRecruitmentStatus, getSettings } from "@/lib/settings";
import type { CardUpload } from "@/lib/types";

/** 참석 희망 신청 접수. (REC-03) */
export async function POST(request: Request) {
  let payload: Record<string, unknown>;

  try {
    const parsed = await request.json();
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("not an object");
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, message: "요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  // 사람에게는 보이지 않는 입력칸이 채워져 있으면 자동 프로그램으로 본다.
  const honeypot = payload.website;
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return NextResponse.json({ ok: false, message: "신청을 처리할 수 없습니다." }, { status: 400 });
  }

  // 모집 기간을 서버에서 다시 확인한다. 화면 상태만 믿지 않는다.
  const settings = await getSettings();
  const status = getRecruitmentStatus(settings);

  if (!status.acceptingApplications) {
    return NextResponse.json(
      { ok: false, message: `현재 ${status.label} 상태로 신청을 받지 않습니다.` },
      { status: 409 },
    );
  }

  const cardResult = parseCard(payload.businessCard);
  if (!cardResult.ok) {
    return NextResponse.json(
      { ok: false, errors: { businessCard: cardResult.error } },
      { status: 422 },
    );
  }

  const validated = validateApplication(payload, cardResult.card !== undefined);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, errors: validated.errors }, { status: 422 });
  }

  try {
    const receipt = await createApplication(validated.value, cardResult.card);
    return NextResponse.json({ ok: true, receipt, mock: isMockMode() }, { status: 201 });
  } catch (error) {
    // 서버 로그에만 원인을 남기고, 사용자에게는 개인정보나 내부 구조를 노출하지 않는다.
    console.error("[applications] 접수 실패", error);
    return NextResponse.json(
      {
        ok: false,
        message:
          "접수 처리 중 오류가 발생했습니다. 잠시 후 다시 시도하시거나 기장·부기장에게 연락해 주세요.",
      },
      { status: 500 },
    );
  }
}

type CardResult = { ok: true; card?: CardUpload } | { ok: false; error: string };

/**
 * 명함 첨부를 검증한다.
 *
 * 클라이언트에서 압축해 보내지만 그 값을 그대로 믿지 않는다.
 * 형식과 크기를 서버에서 다시 확인한다.
 */
function parseCard(raw: unknown): CardResult {
  if (raw === undefined || raw === null) {
    return { ok: true };
  }

  if (typeof raw !== "object") {
    return { ok: false, error: "명함 이미지 형식이 올바르지 않습니다." };
  }

  const card = raw as Record<string, unknown>;
  const mimeType = typeof card.mimeType === "string" ? card.mimeType : "";
  const dataBase64 = typeof card.dataBase64 === "string" ? card.dataBase64 : "";

  if (!dataBase64) {
    return { ok: true };
  }

  if (!isAllowedCardMime(mimeType)) {
    return { ok: false, error: "JPG, PNG, WEBP 형식만 올릴 수 있습니다." };
  }

  // base64 는 원본의 약 4/3 크기다.
  if ((dataBase64.length * 3) / 4 > MAX_CARD_BYTES) {
    return { ok: false, error: "이미지 용량이 너무 큽니다. 다른 사진으로 시도해 주세요." };
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(dataBase64)) {
    return { ok: false, error: "이미지 데이터가 손상되었습니다. 다시 첨부해 주세요." };
  }

  return { ok: true, card: { mimeType, dataBase64 } };
}
