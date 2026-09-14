import { NextResponse } from "next/server";

import { getSessionRole } from "@/lib/auth";
import { deleteFeedback, saveFeedback, validateFeedback } from "@/lib/feedback-logs";
import { readJsonObject } from "@/lib/photo-payload";
import { isMockMode } from "@/lib/repo";

/**
 * 만족도 응답 남기기.
 *
 * 고민 나눔과 같이 로그인을 요구하지 않는다. 이름을 묻지 않아야 아쉬웠던 점을
 * 솔직히 쓸 수 있고, 로그인을 붙이면 서버가 누가 냈는지 알게 된다.
 */
export async function POST(request: Request) {
  const payload = await readJsonObject(request);
  if (!payload) {
    return NextResponse.json(
      { ok: false, message: "요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const honeypot = payload.website;
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return NextResponse.json({ ok: false, message: "등록할 수 없습니다." }, { status: 400 });
  }

  const validated = validateFeedback(payload);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, errors: validated.errors }, { status: 422 });
  }

  try {
    await saveFeedback(validated.value);
    return NextResponse.json({ ok: true, mock: isMockMode() }, { status: 201 });
  } catch (error) {
    console.error("[feedback] 저장 실패", error);
    return NextResponse.json(
      { ok: false, message: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}

/** 부적절한 응답을 지운다. 운영자만 할 수 있다. */
export async function DELETE(request: Request) {
  const role = await getSessionRole();
  if (role !== "admin") {
    return NextResponse.json(
      { ok: false, message: "삭제는 운영자만 할 수 있습니다." },
      { status: 403 },
    );
  }

  const payload = await readJsonObject(request);
  const feedbackId = typeof payload?.feedbackId === "string" ? payload.feedbackId : "";

  if (!feedbackId) {
    return NextResponse.json({ ok: false, message: "지울 응답을 찾을 수 없습니다." }, { status: 422 });
  }

  try {
    await deleteFeedback(feedbackId);
    return NextResponse.json({ ok: true, mock: isMockMode() });
  } catch (error) {
    console.error("[feedback] 삭제 실패", error);
    return NextResponse.json(
      { ok: false, message: "삭제 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
