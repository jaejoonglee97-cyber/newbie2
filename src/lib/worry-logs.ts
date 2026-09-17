import "server-only";

import { nowKstIso, parseNumber } from "./format";
import { appendRow, deleteRowsWhere, patchRowsWhere, readSheet } from "./repo";
import { getSettings } from "./settings";
import type {
  AddReplyErrors,
  AddReplyInput,
  AddWorryErrors,
  AddWorryInput,
  CreateBoardErrors,
  CreateBoardInput,
  Worry,
  WorryBoard,
  WorryBoardView,
  WorryCard,
  WorryCategory,
  WorryPhase,
  WorryPulse,
  WorryReply,
} from "./worry-types";
import { REPLY_MAX_LENGTH, WORRY_CATEGORIES, WORRY_MAX_LENGTH } from "./worry-types";

/**
 * 익명 고민 항아리.
 *
 * 적은 고민을 항아리에 넣어 두고, 진행자가 하나씩 무작위로 뽑는다. 뽑힌
 * 고민을 놓고 다 같이 이야기하고, 거기에 익명 포스트잇을 붙인다.
 * 한 번 뽑힌 고민은 항아리로 돌아가지 않으므로 모든 고민이 한 번씩 다뤄진다.
 *
 * 로그인 없이 누구나 참여한다. 그래서 개인정보를 아예 수집하지 않는다.
 * 이름, 접속 정보, 세션 식별자 어느 것도 저장하지 않으므로 서버가 누가 썼는지
 * 알 방법이 없다.
 *
 * 다만 완전한 익명은 아니다. 시트는 append 로 쌓이므로 행 순서가 곧 작성
 * 순서다. 같은 자리에서 동시에 작성하면 순서만으로 짐작할 여지가 있다.
 * 그래서 세 가지를 더 한다.
 *   - 작성 시각을 날짜까지만 남긴다. 분·초가 있으면 짐작이 쉬워진다.
 *   - ID 를 순번이 아니라 무작위로 만든다. ID 로도 순서를 알 수 없게 한다.
 *   - 뽑는 순서를 무작위로 해 화면에 나오는 순서가 작성 순서와 무관하게 한다.
 */

const BOARDS = "worry_boards";
const WORRIES = "worries";
const REPLIES = "worry_replies";

// ---------------------------------------------------------------------------
// 조회
// ---------------------------------------------------------------------------

/**
 * 지금 쓰는 보드 하나를 가져온다.
 *
 * 단계에 따라 볼 수 있는 것만 담아 돌려준다. 감출 내용을 내려보낸 뒤 화면에서
 * 가리지 않는다. 항아리에 아직 남아 있는 고민은 응답에 아예 담기지 않는다.
 */
export async function getActiveBoardView(): Promise<WorryBoardView | null> {
  const boards = await listBoards();
  const active = boards.find((board) => board.phase !== "closed") ?? boards[0];

  if (!active) return null;

  return getBoardView(active.boardId);
}

export async function getBoardView(boardId: string): Promise<WorryBoardView | null> {
  const [boardRows, worryRows, replyRows] = await Promise.all([
    readSheet(BOARDS),
    readSheet(WORRIES),
    readSheet(REPLIES),
  ]);

  const boardRow = boardRows.find((row) => row.board_id === boardId);
  if (!boardRow) return null;

  const board = toBoard(boardRow);
  const all = worryRows.filter((row) => row.board_id === boardId).map(toWorry);

  const countByCategory = { 개인: 0, 회사: 0 } as Record<WorryCategory, number>;
  for (const worry of all) {
    countByCategory[worry.category] += 1;
  }

  const inJar = all.filter((worry) => worry.drawOrder <= 0);

  /*
   * 항아리를 채우는 동안에는 개수만 알린다.
   *
   * 내용을 내려보내고 화면에서 가리기만 하면 개발자도구로 볼 수 있다.
   * 자기가 쓴 고민이 남에게 보일까 걱정하면 솔직하게 못 쓴다.
   */
  if (board.phase === "writing") {
    return {
      board,
      worries: [],
      current: null,
      remaining: all.length,
      totalWorries: all.length,
      countByCategory,
    };
  }

  const repliesByWorry = new Map<string, WorryReply[]>();
  for (const row of replyRows) {
    const reply = toReply(row);
    const list = repliesByWorry.get(reply.worryId);
    if (list) list.push(reply);
    else repliesByWorry.set(reply.worryId, [reply]);
  }

  const withReplies = (worry: Worry): WorryCard => ({
    ...worry,
    replies: repliesByWorry.get(worry.worryId) ?? [],
  });

  /*
   * 뽑기 단계에서는 뽑힌 고민만 내려보낸다. 항아리에 남은 것은 담지 않는다.
   * 다 같이 보는 단계부터는 남은 것까지 전부 펼친다.
   */
  const opened = board.phase === "drawing";
  const visible = opened ? all.filter((worry) => worry.drawOrder > 0) : all;

  // 나중에 뽑힌 것이 위로 온다. 지금 이야기하는 고민이 항상 맨 앞이다.
  const worries = visible
    .map(withReplies)
    .sort((a, b) => b.drawOrder - a.drawOrder || byShuffledId(a, b));

  const current = opened ? (worries[0] ?? null) : null;

  return {
    board,
    worries,
    current,
    remaining: inJar.length,
    totalWorries: all.length,
    countByCategory,
  };
}

/**
 * 폴링용 가벼운 상태.
 *
 * 진행자가 뽑으면 참여자 화면에도 같은 고민이 떠야 한다. 22명이 각자 몇 초에
 * 한 번씩 물어보므로 시트 읽기가 금방 늘어난다. 그래서 boards·worries 두
 * 시트만 읽고, 답변은 담지 않는다. (답변은 자기가 쓴 직후에만 새로 받으면 된다.)
 */
export async function getPulse(boardId: string): Promise<WorryPulse | null> {
  const cached = readCache(boardId);
  if (cached) return cached;

  const [boardRows, worryRows] = await Promise.all([readSheet(BOARDS), readSheet(WORRIES)]);

  const boardRow = boardRows.find((row) => row.board_id === boardId);
  if (!boardRow) return null;

  const board = toBoard(boardRow);
  const all = worryRows.filter((row) => row.board_id === boardId).map(toWorry);
  const drawn = all.filter((worry) => worry.drawOrder > 0);

  const latest = drawn.reduce<Worry | null>(
    (best, worry) => (best === null || worry.drawOrder > best.drawOrder ? worry : best),
    null,
  );

  const pulse: WorryPulse = {
    phase: board.phase,
    remaining: all.length - drawn.length,
    totalWorries: all.length,
    drawnCount: drawn.length,
    // 뽑기 단계에서만 내용을 내려보낸다. 다른 단계에서는 화면이 통째로 다시 그려진다.
    current:
      board.phase === "drawing" && latest ? { ...latest, replies: [] } : null,
  };

  writeCache(boardId, pulse);
  return pulse;
}

/**
 * 폴링 응답을 잠깐 모아 둔다.
 *
 * 22명이 동시에 물어봐도 이 시간 동안은 시트를 한 번만 읽는다. 서버가 여러
 * 대로 나뉘면 대수만큼 읽지만, 그래도 사람 수만큼 읽는 것보다 훨씬 적다.
 * 진행자가 뽑은 뒤 참여자 화면에 뜨기까지 이 시간만큼 더 걸릴 수 있다.
 */
const PULSE_CACHE_MS = 3000;
let pulseCache: { boardId: string; at: number; value: WorryPulse } | null = null;

function readCache(boardId: string): WorryPulse | null {
  if (!pulseCache || pulseCache.boardId !== boardId) return null;
  return Date.now() - pulseCache.at < PULSE_CACHE_MS ? pulseCache.value : null;
}

function writeCache(boardId: string, value: WorryPulse): void {
  pulseCache = { boardId, at: Date.now(), value };
}

/** 방금 쓴 사람이 기다리지 않게, 글을 남긴 직후에는 모아 둔 값을 버린다. */
function clearCache(): void {
  pulseCache = null;
}

export async function listBoards(): Promise<WorryBoard[]> {
  const rows = await readSheet(BOARDS);
  // 최근에 만든 보드가 앞에 오게 한다.
  return rows.map(toBoard).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * 행 순서가 드러나지 않도록 ID 를 섞어 정렬한다.
 *
 * 무작위 정렬을 쓰면 새로고침할 때마다 순서가 바뀌어 함께 보며 이야기하기
 * 어렵다. ID 에서 만든 값으로 정렬해 순서를 고정한다.
 */
function byShuffledId(a: { worryId: string }, b: { worryId: string }): number {
  return hashString(a.worryId) - hashString(b.worryId);
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(i)) | 0;
  }
  return hash;
}

// ---------------------------------------------------------------------------
// 검증
// ---------------------------------------------------------------------------

export function validateCreateBoard(
  raw: unknown,
): { ok: true; value: CreateBoardInput } | { ok: false; errors: CreateBoardErrors } {
  const input = (raw ?? {}) as Record<string, unknown>;
  const errors: CreateBoardErrors = {};

  const title = str(input.title);
  if (title.length < 2) errors.title = "항아리 이름을 입력해 주세요.";
  else if (title.length > 60) errors.title = "이름이 너무 깁니다.";

  const description = str(input.description);
  if (description.length > 200) errors.description = "설명은 200자 이내로 써 주세요.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { title, description } };
}

export function validateAddWorry(
  raw: unknown,
): { ok: true; value: AddWorryInput } | { ok: false; errors: AddWorryErrors } {
  const input = (raw ?? {}) as Record<string, unknown>;
  const errors: AddWorryErrors = {};

  const categoryRaw = str(input.category);
  const category = WORRY_CATEGORIES.includes(categoryRaw as WorryCategory)
    ? (categoryRaw as WorryCategory)
    : null;
  if (!category) errors.category = "개인 고민인지 회사 고민인지 골라 주세요.";

  const content = str(input.content);
  if (content.length < 5) errors.content = "고민을 다섯 자 이상 적어 주세요.";
  else if (content.length > WORRY_MAX_LENGTH) {
    errors.content = `고민은 ${WORRY_MAX_LENGTH}자 이내로 적어 주세요.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { category: category as WorryCategory, content } };
}

export function validateAddReply(
  raw: unknown,
): { ok: true; value: AddReplyInput } | { ok: false; errors: AddReplyErrors } {
  const input = (raw ?? {}) as Record<string, unknown>;
  const errors: AddReplyErrors = {};

  const worryId = str(input.worryId);
  if (!worryId) errors.worryId = "어떤 고민에 붙이는 포스트잇인지 알 수 없습니다.";

  const content = str(input.content);
  if (content.length < 2) errors.content = "두 자 이상 적어 주세요.";
  else if (content.length > REPLY_MAX_LENGTH) {
    errors.content = `포스트잇은 ${REPLY_MAX_LENGTH}자 이내로 적어 주세요.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { worryId, content } };
}

// ---------------------------------------------------------------------------
// 쓰기
// ---------------------------------------------------------------------------

export async function createBoard(input: CreateBoardInput): Promise<{ boardId: string }> {
  const settings = await getSettings();
  const now = nowKstIso();
  const boardId = `WBD-${randomId(6)}`;

  await appendRow(BOARDS, {
    board_id: boardId,
    program_id: settings.programId,
    title: input.title,
    description: input.description,
    phase: "writing",
    created_at: now,
    updated_at: now,
  });

  clearCache();
  return { boardId };
}

/**
 * 고민 한 건을 항아리에 넣는다.
 *
 * 작성자를 알 수 있는 값은 넘기지도 받지도 않는다.
 * 작성 시각은 날짜까지만 남긴다.
 */
export async function addWorry(boardId: string, input: AddWorryInput): Promise<void> {
  await appendRow(WORRIES, {
    worry_id: `WRY-${randomId(8)}`,
    board_id: boardId,
    category: input.category,
    content: input.content,
    draw_order: "0",
    created_on: today(),
  });

  clearCache();
}

export async function addReply(input: AddReplyInput): Promise<void> {
  await appendRow(REPLIES, {
    reply_id: `WRP-${randomId(8)}`,
    worry_id: input.worryId,
    content: input.content,
    created_on: today(),
  });

  clearCache();
}

export async function setPhase(boardId: string, phase: WorryPhase): Promise<void> {
  await patchRowsWhere(BOARDS, { board_id: boardId }, { phase, updated_at: nowKstIso() });
  clearCache();
}

/**
 * 항아리에서 고민 하나를 무작위로 뽑는다.
 *
 * 뽑힌 고민은 항아리로 돌아가지 않는다. 뽑은 순서를 매겨 두면 남은 것만
 * 다음 대상이 되므로 모든 고민이 정확히 한 번씩 다뤄진다.
 *
 * 항아리가 비어 있으면 아무것도 하지 않고 알린다.
 */
export async function drawWorry(
  boardId: string,
): Promise<{ drawn: Worry | null; remaining: number }> {
  const rows = await readSheet(WORRIES);
  const all = rows.filter((row) => row.board_id === boardId).map(toWorry);
  const inJar = all.filter((worry) => worry.drawOrder <= 0);

  if (inJar.length === 0) {
    return { drawn: null, remaining: 0 };
  }

  const picked = inJar[Math.floor(Math.random() * inJar.length)];
  const nextOrder = all.reduce((max, worry) => Math.max(max, worry.drawOrder), 0) + 1;

  await patchRowsWhere(
    WORRIES,
    { worry_id: picked.worryId },
    { draw_order: String(nextOrder) },
  );

  clearCache();
  return { drawn: { ...picked, drawOrder: nextOrder }, remaining: inJar.length - 1 };
}

/**
 * 마지막으로 뽑은 고민을 항아리에 되돌린다.
 *
 * 진행자가 실수로 눌렀을 때 쓴다. 되돌리면 그 고민은 다시 뽑기 대상이 된다.
 * 이미 붙은 포스트잇은 그대로 둔다. 되돌린 뒤 다시 뽑히면 이어서 붙는다.
 */
export async function undoDraw(boardId: string): Promise<{ undone: boolean }> {
  const rows = await readSheet(WORRIES);
  const all = rows.filter((row) => row.board_id === boardId).map(toWorry);

  const latest = all.reduce<Worry | null>(
    (best, worry) =>
      worry.drawOrder > 0 && (best === null || worry.drawOrder > best.drawOrder) ? worry : best,
    null,
  );

  if (!latest) return { undone: false };

  await patchRowsWhere(WORRIES, { worry_id: latest.worryId }, { draw_order: "0" });

  clearCache();
  return { undone: true };
}

/** 운영자가 부적절한 글을 지운다. 공개 화면이라 지울 수단이 필요하다. */
export async function deleteWorry(worryId: string): Promise<void> {
  await deleteRowsWhere(REPLIES, { worry_id: worryId });
  await deleteRowsWhere(WORRIES, { worry_id: worryId });
  clearCache();
}

export async function deleteReply(replyId: string): Promise<void> {
  await deleteRowsWhere(REPLIES, { reply_id: replyId });
  clearCache();
}

// ---------------------------------------------------------------------------
// 변환과 유틸
// ---------------------------------------------------------------------------

function toBoard(row: Record<string, string>): WorryBoard {
  return {
    boardId: row.board_id ?? "",
    programId: row.program_id ?? "",
    title: row.title ?? "",
    description: row.description ?? "",
    phase: normalizePhase(row.phase),
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

/** 예전 단계 이름(replying)이 시트에 남아 있어도 읽을 수 있게 한다. */
function normalizePhase(raw: string | undefined): WorryPhase {
  const value = (raw ?? "").trim();
  if (value === "replying") return "drawing";
  if (value === "drawing" || value === "sharing" || value === "closed") return value;
  return "writing";
}

function toWorry(row: Record<string, string>): Worry {
  return {
    worryId: row.worry_id ?? "",
    boardId: row.board_id ?? "",
    category: (row.category || "개인") as WorryCategory,
    content: row.content ?? "",
    drawOrder: Math.trunc(parseNumber(row.draw_order ?? "", 0)),
    createdOn: row.created_on ?? "",
  };
}

function toReply(row: Record<string, string>): WorryReply {
  return {
    replyId: row.reply_id ?? "",
    worryId: row.worry_id ?? "",
    content: row.content ?? "",
    createdOn: row.created_on ?? "",
  };
}

/** 순번이 아니라 무작위로 ID 를 만든다. ID 로 작성 순서를 알 수 없게 한다. */
function randomId(length: number): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let id = "";
  for (let i = 0; i < length; i += 1) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return id;
}

/** 한국 시간 기준 날짜. 분·초는 남기지 않는다. */
function today(): string {
  return nowKstIso().slice(0, 10);
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
