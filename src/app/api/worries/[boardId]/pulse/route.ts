import { NextResponse } from "next/server";

import { getPulse } from "@/lib/worry-logs";

/**
 * 지금 뽑혀 있는 고민이 무엇인지만 알려 준다.
 *
 * 진행자가 뽑으면 참여자 화면에도 같은 고민이 떠야 한다. 22명이 몇 초에 한
 * 번씩 물어보므로 화면 전체를 다시 그리는 대신 바뀌는 값만 돌려준다.
 * 응답이 바뀐 것을 본 화면만 전체를 다시 받는다.
 *
 * 로그인을 요구하지 않는다. 뽑힌 고민은 어차피 그 자리의 모두가 함께 보는
 * 것이고, 항아리에 남은 고민은 여기에 담기지 않는다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;

  try {
    const pulse = await getPulse(boardId);

    if (!pulse) {
      return NextResponse.json({ ok: false, message: "항아리를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json(pulse, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[worries] 상태 조회 실패", error);
    return NextResponse.json(
      { ok: false, message: "상태를 읽지 못했습니다." },
      { status: 500 },
    );
  }
}
