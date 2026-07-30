import { NextResponse } from "next/server";

import { fetchCardImage } from "@/lib/card-storage";
import { getSessionRole } from "@/lib/auth";
import { readSheet } from "@/lib/repo";

/**
 * 활동 사진 프록시.
 *
 * 명함 프록시와 같은 방식이다. Drive 파일을 공개로 바꾸지 않고 여기서만 내보낸다.
 * 활동 사진에는 참여자 얼굴이 담기므로 로그인한 사용자에게만 전달하고,
 * 요청한 파일 ID 가 photos 시트에 실제로 등록된 것인지 확인한다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const role = await getSessionRole();
  if (!role) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { fileId } = await params;
  if (!fileId) {
    return NextResponse.json({ ok: false, message: "잘못된 요청입니다." }, { status: 400 });
  }

  const rows = await readSheet("photos");
  const registered = rows.some((row) => (row.drive_file_id ?? "") === fileId);

  if (!registered) {
    return NextResponse.json({ ok: false, message: "찾을 수 없습니다." }, { status: 404 });
  }

  const image = await fetchCardImage(fileId);
  if (!image) {
    return NextResponse.json(
      { ok: false, message: "이미지를 불러오지 못했습니다." },
      { status: 502 },
    );
  }

  return new NextResponse(image.body, {
    status: 200,
    headers: {
      "Content-Type": image.contentType,
      // 참여자 얼굴이 담긴 이미지이므로 공용 캐시에 남기지 않는다.
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Disposition": "inline",
    },
  });
}
