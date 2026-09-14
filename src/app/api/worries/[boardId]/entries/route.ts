import { NextResponse } from "next/server";

import { readJsonObject } from "@/lib/photo-payload";
import { isMockMode } from "@/lib/repo";
import { addReply, addWorry, getBoardView, validateAddReply, validateAddWorry } from "@/lib/worry-logs";

/**
 * 익명으로 고민 또는 포스트잇 답변을 남긴다.
 *
 * 로그인을 요구하지 않는다. 이 활동은 링크를 받은 사람 누구나 참여하는 것이
 * 목적이고, 로그인을 붙이면 누가 썼는지 서버가 알게 되어 익명이 아니게 된다.
 *
 * 대신 세 가지로 막는다.
 *   - 사람에게 보이지 않는 입력칸이 채워져 있으면 자동 프로그램으로 본다.
 *   - 보드 단계가 맞지 않으면 받지 않는다. 마감한 보드에는 쓸 수 없다.
 *   - 글자 수를 서버에서 다시 확인한다.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;

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

  const view = await getBoardView(boardId);
  if (!view) {
    return NextResponse.json({ ok: false, message: "보드를 찾을 수 없습니다." }, { status: 404 });
  }

  const kind = payload.kind === "reply" ? "reply" : "worry";
  const phase = view.board.phase;

  if (kind === "worry" && phase !== "writing") {
    return NextResponse.json(
      { ok: false, message: "지금은 고민을 받는 단계가 아닙니다." },
      { status: 409 },
    );
  }

  if (kind === "reply" && phase !== "replying" && phase !== "sharing") {
    return NextResponse.json(
      { ok: false, message: "지금은 답변을 받는 단계가 아닙니다." },
      { status: 409 },
    );
  }

  try {
    if (kind === "worry") {
      const validated = validateAddWorry(payload);
      if (!validated.ok) {
        return NextResponse.json({ ok: false, errors: validated.errors }, { status: 422 });
      }

      await addWorry(boardId, validated.value);
      return NextResponse.json({ ok: true, mock: isMockMode() }, { status: 201 });
    }

    const validated = validateAddReply(payload);
    if (!validated.ok) {
      return NextResponse.json({ ok: false, errors: validated.errors }, { status: 422 });
    }

    await addReply(validated.value);
    return NextResponse.json({ ok: true, mock: isMockMode() }, { status: 201 });
  } catch (error) {
    console.error("[worries] 등록 실패", error);
    return NextResponse.json(
      { ok: false, message: "등록 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
