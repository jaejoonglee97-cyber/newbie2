import { NextResponse } from "next/server";

import { getSessionRole } from "@/lib/auth";
import { createPoll, listPolls, validateCreatePoll } from "@/lib/poll-logs";

export async function GET() {
  const role = await getSessionRole();
  if (!role) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const polls = await listPolls();
    return NextResponse.json({ ok: true, polls });
  } catch (error) {
    console.error("Failed to list polls:", error);
    return NextResponse.json({ ok: false, message: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const role = await getSessionRole();
  if (role !== "admin") {
    return NextResponse.json({ ok: false, message: "운영자만 투표를 만들 수 있습니다." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const result = validateCreatePoll(body);

    if (!result.ok) {
      return NextResponse.json({ ok: false, errors: result.errors });
    }

    const { pollId } = await createPoll(result.value);
    return NextResponse.json({ ok: true, pollId });
  } catch (error) {
    console.error("Failed to create poll:", error);
    return NextResponse.json({ ok: false, message: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
