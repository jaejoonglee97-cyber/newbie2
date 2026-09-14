import { NextResponse } from "next/server";

import { castVote, getPollById } from "@/lib/poll-logs";

/**
 * 투표하기.
 *
 * 로그인을 요구하지 않는다. 모임 자리에서 링크만 받아 바로 참여할 수 있어야
 * 한다는 판단이다. 투표를 만들고 마감·확정하는 것은 운영자만 한다.
 *
 * 다만 이름을 골라 투표하는 구조라, 링크가 외부로 새면 남의 이름으로 투표할
 * 수 있다. 이름이 함께 보이므로 잘못 찍힌 표는 눈에 띄고, 운영자가 투표를
 * 다시 열거나 마감해 정리할 수 있다.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ pollId: string }> },
) {
  const { pollId } = await params;

  try {
    const pollResult = await getPollById(pollId);
    if (!pollResult) {
      return NextResponse.json({ ok: false, message: "투표를 찾을 수 없습니다." }, { status: 404 });
    }
    if (pollResult.poll.status === "closed") {
      return NextResponse.json({ ok: false, message: "마감된 투표입니다." });
    }

    const body = await request.json();
    const voterName = typeof body.voterName === "string" ? body.voterName.trim() : "";
    const selectedOptions: string[] = Array.isArray(body.selectedOptions)
      ? body.selectedOptions.map(String)
      : [];

    if (!voterName) {
      return NextResponse.json({ ok: false, message: "이름을 선택해 주세요." });
    }
    if (selectedOptions.length === 0) {
      return NextResponse.json({ ok: false, message: "선택 항목이 없습니다." });
    }

    await castVote(pollId, { voterName, selectedOptions });

    // 최신 결과 반환
    const updated = await getPollById(pollId);
    return NextResponse.json({ ok: true, result: updated });
  } catch (error) {
    console.error("Failed to cast vote:", error);
    return NextResponse.json({ ok: false, message: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
