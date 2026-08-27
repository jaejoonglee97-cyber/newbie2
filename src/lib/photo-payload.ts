import "server-only";

import type { PhotoInput } from "./activity-types";
import { MAX_CARD_BYTES, isAllowedCardMime } from "./card-storage";

/** 한 활동에 올릴 수 있는 사진 장수 상한 */
export const MAX_PHOTOS = 12;

export type PhotoParseResult = { ok: true; photos: PhotoInput[] } | { ok: false; error: string };

/**
 * 사진 배열을 검증한다.
 *
 * 클라이언트에서 압축해 보내지만 그 값을 그대로 믿지 않는다.
 * 형식·크기·장수를 서버에서 다시 확인한다.
 *
 * 작성과 수정 두 경로가 같은 규칙을 써야 하므로 여기 한 곳에 둔다.
 */
export function parsePhotos(raw: unknown): PhotoParseResult {
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

/** 요청 본문을 객체로 읽는다. 형식이 아니면 null 을 돌려준다. */
export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await request.json();
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
