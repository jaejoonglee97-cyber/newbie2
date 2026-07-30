import { NextResponse } from "next/server";

import { saveActivityLog, validateActivityLog } from "@/lib/activity-logs";
import type { PhotoInput } from "@/lib/activity-types";
import { getSessionRole } from "@/lib/auth";
import { MAX_CARD_BYTES, isAllowedCardMime } from "@/lib/card-storage";
import { isMockMode } from "@/lib/repo";

/** 한 활동에 올릴 수 있는 사진 장수 상한 */
const MAX_PHOTOS = 12;

/** 활동일지 저장 */
export async function POST(request: Request) {
  // 활동일지는 로그인한 사람만 작성할 수 있다.
  const role = await getSessionRole();
  if (!role) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

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

  const photoResult = parsePhotos(payload.photos);
  if (!photoResult.ok) {
    return NextResponse.json({ ok: false, errors: { photos: photoResult.error } }, { status: 422 });
  }

  const validated = await validateActivityLog(payload, photoResult.photos.length);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, errors: validated.errors }, { status: 422 });
  }

  try {
    const result = await saveActivityLog(validated.value, photoResult.photos);
    return NextResponse.json({ ok: true, ...result, mock: isMockMode() }, { status: 201 });
  } catch (error) {
    console.error("[activities] 저장 실패", error);
    return NextResponse.json(
      {
        ok: false,
        message:
          "저장 중 오류가 발생했습니다. 입력 내용을 복사해 두시고 잠시 후 다시 시도해 주세요.",
      },
      { status: 500 },
    );
  }
}

type PhotoResult = { ok: true; photos: PhotoInput[] } | { ok: false; error: string };

/**
 * 사진 배열을 검증한다.
 *
 * 클라이언트에서 압축해 보내지만 그 값을 그대로 믿지 않는다.
 * 형식·크기·장수를 서버에서 다시 확인한다.
 */
function parsePhotos(raw: unknown): PhotoResult {
  if (raw === undefined || raw === null) {
    return { ok: true, photos: [] };
  }

  if (!Array.isArray(raw)) {
    return { ok: false, error: "사진 형식이 올바르지 않습니다." };
  }

  if (raw.length > MAX_PHOTOS) {
    return { ok: false, error: `사진은 최대 ${MAX_PHOTOS}장까지 올릴 수 있습니다.` };
  }

  const photos: PhotoInput[] = [];

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) {
      return { ok: false, error: "사진 형식이 올바르지 않습니다." };
    }

    const record = entry as Record<string, unknown>;
    const mimeType = typeof record.mimeType === "string" ? record.mimeType : "";
    const dataBase64 = typeof record.dataBase64 === "string" ? record.dataBase64 : "";

    if (!dataBase64) continue;

    if (!isAllowedCardMime(mimeType)) {
      return { ok: false, error: "JPG, PNG, WEBP 형식만 올릴 수 있습니다." };
    }

    if ((dataBase64.length * 3) / 4 > MAX_CARD_BYTES) {
      return { ok: false, error: "사진 용량이 너무 큽니다. 장수를 줄이거나 다시 첨부해 주세요." };
    }

    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(dataBase64)) {
      return { ok: false, error: "사진 데이터가 손상되었습니다. 다시 첨부해 주세요." };
    }

    photos.push({
      mimeType,
      dataBase64,
      caption: typeof record.caption === "string" ? record.caption.trim().slice(0, 200) : "",
      isCover: record.isCover === true,
    });
  }

  return { ok: true, photos };
}
