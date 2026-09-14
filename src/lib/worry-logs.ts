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
  WorryReply,
} from "./worry-types";
import { REPLY_MAX_LENGTH, WORRY_CATEGORIES, WORRY_MAX_LENGTH } from "./worry-types";

/**
 * 익명 고민 나눔 보드.
 *
 * 로그인 없이 누구나 참여한다. 그래서 개인정보를 아예 수집하지 않는다.
 * 이름, 접속 정보, 세션 식별자 어느 것도 저장하지 않으므로 서버가 누가 썼는지
 * 알 방법이 없다.
 *
 * 다만 완전한 익명은 아니다. 시트는 append 로 쌓이므로 행 순서가 곧 작성
 * 순서다. 같은 자리에서 동시에 작성하면 순서만으로 짐작할 여지가 있다.
 * 그래서 두 가지를 더 한다.
 *   - 작성 시각을 날짜까지만 남긴다. 분·초가 있으면 짐작이 쉬워진다.
 *   - ID 를 순번이 아니라 무작위로 만든다. ID 로도 순서를 알 수 없게 한다.
 * 화면에서는 고민 ID 를 섞어 정렬해 행 순서가 그대로 드러나지 않게 한다.
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
 * 가리지 않는다. 작성 단계에서는 남의 고민이 응답에 아예 담기지 않는다.
 *
 * teamNumber 를 주면 그 팀에 배정된 고민만 담는다. 답변 단계에서 쓴다.
 */
export async function getActiveBoardView(
  teamNumber?: number,
): Promise<WorryBoardView | null> {
  const boards = await listBoards();
  const active = boards.find((board) => board.phase !== "closed") ?? boards[0];

  if (!active) return null;

  return getBoardView(active.boardId, teamNumber);
}

export async function getBoardView(
  boardId: string,
  teamNumber?: number,
): Promise<WorryBoardView | null> {
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

  // 작성 단계에서는 건수만 알리고 내용은 내려보내지 않는다.
  if (board.phase === "writing") {
    return { board, worries: [], totalWorries: all.length, countByCategory };
  }

  const repliesByWorry = new Map<string, WorryReply[]>();
  for (const row of replyRows) {
    const reply = toReply(row);
    const list = repliesByWorry.get(reply.worryId);
    if (list) list.push(reply);
    else repliesByWorry.set(reply.worryId, [reply]);
  }

  // 답변 단계에서는 자기 팀 고민만 본다. 팀을 고르지 않았으면 아직 보여주지 않는다.
  const replying = board.phase === "replying";
  const visible = replying
    ? teamNumber && teamNumber > 0
      ? all.filter((worry) => worry.teamNumber === teamNumber)
      : []
    : all;

  /*
   * 답변 단계에서는 남이 붙인 포스트잇을 아직 내려보내지 않는다.
   * 다른 사람의 답변을 보고 쓰면 3단계에서 함께 볼 때 재미가 줄고,
   * 화면에서 가리기만 하면 개발자도구로 볼 수 있다.
   */
  const worries: WorryCard[] = visible
    .map((worry) => ({
      ...worry,
      replies: replying ? [] : (repliesByWorry.get(worry.worryId) ?? []),
    }))
    .sort(byShuffledId);

  return { board, worries, totalWorries: all.length, countByCategory };
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
  if (title.length < 2) errors.title = "보드 제목을 입력해 주세요.";
  else if (title.length > 60) errors.title = "제목이 너무 깁니다.";

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
  if (!worryId) errors.worryId = "어떤 고민에 다는 답변인지 알 수 없습니다.";

  const content = str(input.content);
  if (content.length < 2) errors.content = "답변을 두 자 이상 적어 주세요.";
  else if (content.length > REPLY_MAX_LENGTH) {
    errors.content = `답변은 ${REPLY_MAX_LENGTH}자 이내로 적어 주세요.`;
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
    team_count: "0",
    created_at: now,
    updated_at: now,
  });

  return { boardId };
}

/**
 * 고민 한 건을 남긴다.
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
    team_number: "0",
    created_on: today(),
  });
}

export async function addReply(input: AddReplyInput): Promise<void> {
  await appendRow(REPLIES, {
    reply_id: `WRP-${randomId(8)}`,
    worry_id: input.worryId,
    content: input.content,
    created_on: today(),
  });
}

export async function setPhase(boardId: string, phase: WorryPhase): Promise<void> {
  await patchRowsWhere(BOARDS, { board_id: boardId }, { phase, updated_at: nowKstIso() });
}

/**
 * 고민을 팀에 나눠 배정한다.
 *
 * 무작위로 섞어 고르게 나눈다. 분류(개인·회사)를 섞어 한 팀에 한쪽만
 * 몰리지 않게 각 분류를 따로 섞은 뒤 번갈아 배정한다.
 */
export async function assignTeams(
  boardId: string,
  teamCount: number,
): Promise<{ assigned: number }> {
  const rows = await readSheet(WORRIES);
  const worries = rows.filter((row) => row.board_id === boardId).map(toWorry);

  if (worries.length === 0 || teamCount < 1) {
    await patchRowsWhere(
      BOARDS,
      { board_id: boardId },
      { team_count: String(Math.max(teamCount, 0)), updated_at: nowKstIso() },
    );
    return { assigned: 0 };
  }

  const personal = shuffle(worries.filter((worry) => worry.category === "개인"));
  const company = shuffle(worries.filter((worry) => worry.category === "회사"));

  // 두 분류를 번갈아 뽑아 한 줄로 세운 뒤 앞에서부터 팀을 돌려 가며 배정한다.
  const ordered: Worry[] = [];
  for (let i = 0; i < Math.max(personal.length, company.length); i += 1) {
    if (personal[i]) ordered.push(personal[i]);
    if (company[i]) ordered.push(company[i]);
  }

  for (let i = 0; i < ordered.length; i += 1) {
    const teamNumber = (i % teamCount) + 1;
    await patchRowsWhere(
      WORRIES,
      { worry_id: ordered[i].worryId },
      { team_number: String(teamNumber) },
    );
  }

  await patchRowsWhere(
    BOARDS,
    { board_id: boardId },
    { team_count: String(teamCount), updated_at: nowKstIso() },
  );

  return { assigned: ordered.length };
}

/** 운영자가 부적절한 글을 지운다. 공개 화면이라 지울 수단이 필요하다. */
export async function deleteWorry(worryId: string): Promise<void> {
  await deleteRowsWhere(REPLIES, { worry_id: worryId });
  await deleteRowsWhere(WORRIES, { worry_id: worryId });
}

export async function deleteReply(replyId: string): Promise<void> {
  await deleteRowsWhere(REPLIES, { reply_id: replyId });
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
    phase: (row.phase || "writing") as WorryPhase,
    teamCount: Math.trunc(parseNumber(row.team_count ?? "", 0)),
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

function toWorry(row: Record<string, string>): Worry {
  return {
    worryId: row.worry_id ?? "",
    boardId: row.board_id ?? "",
    category: (row.category || "개인") as WorryCategory,
    content: row.content ?? "",
    teamNumber: Math.trunc(parseNumber(row.team_number ?? "", 0)),
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

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
