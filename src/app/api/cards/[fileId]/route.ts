import { NextResponse } from "next/server";

import { fetchCardImage } from "@/lib/card-storage";
import { getSessionRole } from "@/lib/auth";
import { readSheet } from "@/lib/repo";

/**
 * 명함 이미지 프록시.
 *
 * Drive 파일을 공개로 바꾸지 않고 여기서만 내보낸다.
 * 두 단계로 확인한다.
 *   1. 로그인 여부. 참여자 또는 운영자만 통과한다.
 *   2. 요청한 파일 ID 가 실제로 명함으로 등록된 것인지.
 *      확인하지 않으면 로그인한 사람이 임의의 Drive 파일 ID를 넣어
 *      서비스 계정이 읽을 수 있는 다른 파일까지 꺼내볼 수 있다.
 *
 * 참여자에게는 공개 동의를 받은 명함만 내보낸다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    return await serve(params);
  } catch (error) {
    console.error("[명함 이미지] 전달 실패:", error);
    return NextResponse.json(
      { ok: false, message: "이미지를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

async function serve(params: Promise<{ fileId: string }>) {
  const role = await getSessionRole();
  if (!role) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { fileId } = await params;
  if (!fileId) {
    return NextResponse.json({ ok: false, message: "잘못된 요청입니다." }, { status: 400 });
  }

  const rows = await readSheet("applicants");
  const match = rows.find((row) => (row.business_card_file_id ?? "") === fileId);

  if (!match) {
    return NextResponse.json({ ok: false, message: "찾을 수 없습니다." }, { status: 404 });
  }

  if (role !== "admin" && match.card_share_consent !== "TRUE") {
    return NextResponse.json({ ok: false, message: "찾을 수 없습니다." }, { status: 404 });
  }

  const image = await fetchCardImage(fileId);
  if (!image) {
    return NextResponse.json({ ok: false, message: "이미지를 불러오지 못했습니다." }, { status: 502 });
  }

  return new NextResponse(image.body, {
    status: 200,
    headers: {
      "Content-Type": image.contentType,
      // 개인정보가 담긴 이미지이므로 공용 캐시에 남기지 않는다.
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Disposition": "inline",
    },
  });
}
