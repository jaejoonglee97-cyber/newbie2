import { NextResponse } from "next/server";

import { saveActivityLog, validateActivityLog } from "@/lib/activity-logs";
import { getSessionRole } from "@/lib/auth";
import { parsePhotos, readJsonObject } from "@/lib/photo-payload";
import { isMockMode } from "@/lib/repo";

/** 활동일지 저장 */
export async function POST(request: Request) {
  /*
   * 활동일지는 운영자만 쓴다.
   *
   * 열람은 누구나 하지만 쓰기는 막는다. 로그인이 공유 비밀번호라 작성자 본인을
   * 구분할 방법이 없어, 아무나 쓰게 두면 누가 넣은 기록인지 확인할 수 없다.
   * 수정·삭제를 운영자로 제한한 것과 같은 이유다.
   */
  const role = await getSessionRole();

  if (!role) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  if (role !== "admin") {
    return NextResponse.json(
      { ok: false, message: "활동일지 작성은 운영자만 할 수 있습니다." },
      { status: 403 },
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
