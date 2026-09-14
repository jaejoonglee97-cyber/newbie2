import { NextResponse } from "next/server";

import { getSessionRole } from "@/lib/auth";
import { readJsonObject } from "@/lib/photo-payload";
import { isMockMode } from "@/lib/repo";
import {
  assignTeams,
  deleteReply,
  deleteWorry,
  getBoardView,
  setPhase,
} from "@/lib/worry-logs";
import type { WorryPhase } from "@/lib/worry-types";

const PHASES: WorryPhase[] = ["writing", "replying", "sharing", "closed"];

/**
 * 보드 운영. 단계 전환, 팀 배정, 글 삭제.
 *
 * 모두 운영자만 할 수 있다. 참여자가 단계를 바꾸면 아직 쓰는 중인 사람의
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

    if (action === "assignTeams") {
      const teamCount = Math.trunc(Number(payload.teamCount));
      if (!Number.isFinite(teamCount) || teamCount < 1 || teamCount > 10) {
        return NextResponse.json(
          { ok: false, message: "팀 수는 1에서 10 사이로 정해 주세요." },
          { status: 422 },
        );
      }

      const result = await assignTeams(boardId, teamCount);
      return NextResponse.json({ ok: true, ...result, teamCount, mock: isMockMode() });
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
