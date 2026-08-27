import { NextResponse } from "next/server";

import { getSessionRole } from "@/lib/auth";
import { castVote, getPollById } from "@/lib/poll-logs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ pollId: string }> },
) {
  const role = await getSessionRole();
  if (!role) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

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
