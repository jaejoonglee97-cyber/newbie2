import { NextResponse } from "next/server";

import { getSessionRole } from "@/lib/auth";
import { readJsonObject } from "@/lib/photo-payload";
import { isMockMode } from "@/lib/repo";
import {
  deleteReply,
  deleteWorry,
  drawWorry,
  getBoardView,
  setPhase,
  undoDraw,
} from "@/lib/worry-logs";
import type { WorryPhase } from "@/lib/worry-types";

const PHASES: WorryPhase[] = ["writing", "drawing", "sharing", "closed"];

/**
 * 보드 운영. 단계 전환, 고민 뽑기, 글 삭제.
 *
 * 모두 운영자만 할 수 있다. 참여자가 마음대로 뽑으면 사람마다 다른 고민이
 * 떠서 다 같이 이야기할 수가 없고, 단계를 바꾸면 아직 쓰는 중인 사람의
 * 고민이 공개되어 버린다.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const role = await getSessionRole();
  if (role !== "admin") {
    return NextResponse.json(
      { ok: false, message: "보드 운영은 운영자만 할 수 있습니다." },
      { status: 403 },
    );
  }

  const { boardId } = await params;

  const board = await getBoardView(boardId);
  if (!board) {
    return NextResponse.json({ ok: false, message: "보드를 찾을 수 없습니다." }, { status: 404 });
  }

  const payload = await readJsonObject(request);
  if (!payload) {
    return NextResponse.json(
      { ok: false, message: "요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const action = typeof payload.action === "string" ? payload.action : "";

  try {
    if (action === "setPhase") {
      const phase = typeof payload.phase === "string" ? payload.phase : "";
      if (!PHASES.includes(phase as WorryPhase)) {
        return NextResponse.json({ ok: false, message: "알 수 없는 단계입니다." }, { status: 422 });
      }

      await setPhase(boardId, phase as WorryPhase);
      return NextResponse.json({ ok: true, phase, mock: isMockMode() });
    }

    if (action === "draw") {
      if (board.board.phase !== "drawing") {
        return NextResponse.json(
          { ok: false, message: "뽑기 단계에서만 뽑을 수 있습니다." },
          { status: 409 },
        );
      }

      const result = await drawWorry(boardId);
      if (!result.drawn) {
        return NextResponse.json({ ok: false, message: "항아리가 비었습니다." });
      }

      return NextResponse.json({ ok: true, remaining: result.remaining, mock: isMockMode() });
    }

    if (action === "undoDraw") {
      const result = await undoDraw(boardId);
      if (!result.undone) {
        return NextResponse.json({ ok: false, message: "되돌릴 것이 없습니다." });
      }

      return NextResponse.json({ ok: true, mock: isMockMode() });
    }

    if (action === "deleteWorry") {
      const worryId = typeof payload.worryId === "string" ? payload.worryId : "";
      if (!worryId) {
        return NextResponse.json({ ok: false, message: "지울 고민을 찾을 수 없습니다." }, { status: 422 });
      }

      await deleteWorry(worryId);
      return NextResponse.json({ ok: true, mock: isMockMode() });
    }

    if (action === "deleteReply") {
      const replyId = typeof payload.replyId === "string" ? payload.replyId : "";
      if (!replyId) {
        return NextResponse.json({ ok: false, message: "지울 답변을 찾을 수 없습니다." }, { status: 422 });
      }

      await deleteReply(replyId);
      return NextResponse.json({ ok: true, mock: isMockMode() });
    }

    return NextResponse.json({ ok: false, message: "알 수 없는 요청입니다." }, { status: 422 });
  } catch (error) {
    console.error("[worries] 보드 운영 실패", error);
    return NextResponse.json(
      { ok: false, message: "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
