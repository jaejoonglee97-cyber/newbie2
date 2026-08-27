import { NextResponse } from "next/server";

import {
  deleteActivityLog,
  getActivityEditValues,
  updateActivityLog,
  validateActivityLog,
} from "@/lib/activity-logs";
import { getSessionRole } from "@/lib/auth";
import { parsePhotos, readJsonObject } from "@/lib/photo-payload";
import { isMockMode } from "@/lib/repo";

/**
 * 활동일지 수정·삭제.
 *
 * 운영자만 할 수 있다. 로그인이 공유 비밀번호라서 작성자 본인을 구분할 방법이
 * 없으므로, 남의 기록을 고치거나 지우는 일을 막기 위해 운영자로 제한한다.
 */
async function requireAdmin(): Promise<NextResponse | null> {
  const role = await getSessionRole();

  if (!role) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  if (role !== "admin") {
    return NextResponse.json(
      { ok: false, message: "활동일지 수정·삭제는 운영자만 할 수 있습니다." },
      { status: 403 },
    );
  }

  return null;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ activityId: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { activityId } = await params;

  const existing = await getActivityEditValues(activityId);
  if (!existing) {
    return NextResponse.json(
      { ok: false, message: "활동일지를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const payload = await readJsonObject(request);
  if (!payload) {
    return NextResponse.json(
      { ok: false, message: "요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const photoResult = parsePhotos(payload.photos);
  if (!photoResult.ok) {
    return NextResponse.json({ ok: false, errors: { photos: photoResult.error } }, { status: 422 });
  }

  // 지울 사진은 이 활동에 등록된 것만 인정한다.
  const validPhotoIds = new Set(existing.existingPhotos.map((photo) => photo.photoId));
  const removedPhotoIds = Array.isArray(payload.removedPhotoIds)
    ? payload.removedPhotoIds
        .filter((id): id is string => typeof id === "string")
        .filter((id) => validPhotoIds.has(id))
    : [];

  /*
   * 사진 장수 검증은 "남는 장수 + 새로 올리는 장수"로 한다.
   * 새로 첨부하지 않아도 기존 사진이 남아 있으면 최소 1장 조건을 만족한다.
   */
  const keptCount = existing.existingPhotos.length - removedPhotoIds.length;
  const totalPhotoCount = keptCount + photoResult.photos.length;

  // 회기 번호는 활동 ID 에 들어 있어 바꿀 수 없다. 저장된 값을 그대로 쓴다.
  const validated = await validateActivityLog(
    { ...payload, sessionNumber: existing.sessionNumber },
    totalPhotoCount,
  );
  if (!validated.ok) {
    return NextResponse.json({ ok: false, errors: validated.errors }, { status: 422 });
  }

  try {
    const result = await updateActivityLog(
      activityId,
      validated.value,
      photoResult.photos,
      removedPhotoIds,
    );
    return NextResponse.json({ ok: true, ...result, mock: isMockMode() });
  } catch (error) {
    console.error("[activities] 수정 실패", error);
    return NextResponse.json(
      {
        ok: false,
        message:
          "수정 중 오류가 발생했습니다. 입력 내용을 복사해 두시고 잠시 후 다시 시도해 주세요.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ activityId: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { activityId } = await params;

  try {
    const result = await deleteActivityLog(activityId, "MEM-ADMIN");
    return NextResponse.json({ ok: true, ...result, mock: isMockMode() });
  } catch (error) {
    console.error("[activities] 삭제 실패", error);
    return NextResponse.json(
      { ok: false, message: "삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
