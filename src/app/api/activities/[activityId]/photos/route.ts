import { NextResponse } from "next/server";

import { addActivityPhoto } from "@/lib/activity-logs";
import { getSessionRole } from "@/lib/auth";
import { setupHint } from "@/lib/load";
import { parsePhotos, readJsonObject } from "@/lib/photo-payload";
import { isMockMode } from "@/lib/repo";

/**
 * 저장된 활동일지에 사진 한 장을 더한다.
 *
 * 활동일지를 저장할 때 사진을 전부 한 요청에 담으면 Vercel 의 요청 크기
 * 한도(4.5MB)를 넘는다. 그때는 우리 코드가 돌기도 전에 막혀 JSON 이 아닌
 * 오류 화면이 돌아오고, 화면에는 원인 없이 "오류"만 뜬다.
 * 그래서 첫 장만 저장 요청에 싣고, 나머지는 한 장씩 여기로 보낸다.
 *
 * 수정·삭제와 같이 운영자만 할 수 있다.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ activityId: string }> },
) {
  const role = await getSessionRole();

  if (!role) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  if (role !== "admin") {
    return NextResponse.json(
      { ok: false, message: "사진 추가는 운영자만 할 수 있습니다." },
      { status: 403 },
    );
  }

  const { activityId } = await params;

  const payload = await readJsonObject(request);
  if (!payload) {
    return NextResponse.json(
      { ok: false, message: "요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  // 한 장만 받는다. 여러 장을 실으면 다시 크기 한도에 걸린다.
  const parsed = parsePhotos([payload]);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, message: parsed.error }, { status: 422 });
  }

  const photo = parsed.photos[0];
  if (!photo) {
    return NextResponse.json({ ok: false, message: "사진이 비어 있습니다." }, { status: 422 });
  }

  try {
    const result = await addActivityPhoto(activityId, photo, "MEM-ADMIN");

    if (!result.added) {
      return NextResponse.json(
        { ok: false, message: "사진을 Drive 에 올리지 못했습니다." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, mock: isMockMode() }, { status: 201 });
  } catch (error) {
    console.error("[activities] 사진 추가 실패", error);
    return NextResponse.json(
      { ok: false, message: setupHint(error) ?? "사진을 추가하지 못했습니다." },
      { status: 500 },
    );
  }
}
