import { NextResponse } from "next/server";

import { getSessionRole } from "@/lib/auth";
import { setupHint } from "@/lib/load";
import { readJsonObject } from "@/lib/photo-payload";
import { isMockMode } from "@/lib/repo";
import { createBoard, validateCreateBoard } from "@/lib/worry-logs";

/**
 * 고민 나눔 보드 만들기.
 *
 * 참여는 로그인 없이 누구나 하지만, 보드를 만드는 것은 운영자만 한다.
 * 누구나 보드를 만들 수 있으면 활동 중에 엉뚱한 보드가 생길 수 있다.
 */
export async function POST(request: Request) {
  const role = await getSessionRole();
  if (role !== "admin") {
    return NextResponse.json(
      { ok: false, message: "보드 만들기는 운영자만 할 수 있습니다." },
      { status: 403 },
    );
  }

  const payload = await readJsonObject(request);
  if (!payload) {
    return NextResponse.json(
      { ok: false, message: "요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const validated = validateCreateBoard(payload);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, errors: validated.errors }, { status: 422 });
  }

  try {
    const result = await createBoard(validated.value);
    return NextResponse.json({ ok: true, ...result, mock: isMockMode() }, { status: 201 });
  } catch (error) {
    console.error("[worries] 보드 생성 실패", error);
    return NextResponse.json(
      {
        ok: false,
        message: setupHint(error) ?? "보드를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 500 },
    );
  }
}
