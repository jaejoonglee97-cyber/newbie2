import { NextResponse } from "next/server";

import { getSessionRole } from "@/lib/auth";
import { closePoll, confirmPollDate, getPollById } from "@/lib/poll-logs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ pollId: string }> },
) {
  const role = await getSessionRole();
  if (role !== "admin") {
    return NextResponse.json({ ok: false, message: "운영자만 확정할 수 있습니다." }, { status: 403 });
  }

  const { pollId } = await params;

  try {
    const body = await request.json();
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "close") {
      await closePoll(pollId);
      return NextResponse.json({ ok: true });
    }

    // action === "confirm"
    const confirmedDate = typeof body.confirmedDate === "string" ? body.confirmedDate : "";
    if (!confirmedDate) {
      return NextResponse.json({ ok: false, message: "확정 날짜를 지정해 주세요." });
    }

    const poll = await getPollById(pollId);
    if (!poll) {
      return NextResponse.json({ ok: false, message: "투표를 찾을 수 없습니다." }, { status: 404 });
    }

    await confirmPollDate(pollId, confirmedDate);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to confirm poll:", error);
    return NextResponse.json({ ok: false, message: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
