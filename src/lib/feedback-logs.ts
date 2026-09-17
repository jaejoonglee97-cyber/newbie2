import "server-only";

import { listActivities } from "./activity-logs";
import { nowKstIso, parseNumber } from "./format";
import { PLANNED_SESSIONS } from "./program-plan";
import { appendRow, deleteRowsWhere, readSheet } from "./repo";
import { getSettings } from "./settings";
import type {
  Feedback,
  FeedbackErrors,
  FeedbackInput,
  FeedbackView,
  SatisfactionScore,
  SessionFeedback,
} from "./feedback-types";
import {
  BEST_PART_MAX_LENGTH,
  NEXT_WISH_MAX_LENGTH,
  SATISFACTION_SCORES,
} from "./feedback-types";

/**
 * 회차별 만족도 조사.
 *
 * 고민 나눔과 같은 이유로 익명이다. 이름을 붙이면 아쉬웠던 점을 솔직히 쓰기
 * 어렵다. 작성자를 알 수 있는 값을 저장하지 않고, 작성 시각도 날짜까지만
 * 남긴다.
 *
 * 집계는 운영자에게만 내려보낸다. 응답이 적을 때 모두에게 공개하면 누가 어떤
 * 점수를 줬는지 서로 짐작하게 된다.
 */

const SHEET = "feedback";

// ---------------------------------------------------------------------------
// 조회
// ---------------------------------------------------------------------------

/**
 * 화면에 필요한 값을 모은다.
 *
 * includeSummaries 가 false 면 집계를 담지 않는다. 화면에서 가리는 것이 아니라
 * 응답에 아예 담지 않아 개발자도구로도 볼 수 없다.
 */
export async function getFeedbackView(includeSummaries: boolean): Promise<FeedbackView> {
  const [rows, activities] = await Promise.all([readSheet(SHEET), listActivities()]);
  const feedbacks = rows.map(toFeedback);

  /*
   * 회차 이름은 활동일지가 있으면 거기 적힌 주제를, 없으면 계획에 적힌 제목을 쓴다.
   * 만족도는 모임이 끝난 자리에서 바로 받고 활동일지는 나중에 쓰므로,
   * 기록이 생기기 전에도 회차 이름이 제대로 보여야 한다.
   */
  const topicBySession = new Map<number, string>(
    PLANNED_SESSIONS.map((session) => [session.sessionNumber, session.title]),
  );
  for (const activity of activities) {
    if (activity.topic) {
      topicBySession.set(activity.sessionNumber, activity.topic);
    }
  }

  /*
   * 고를 수 있는 회차: 계획된 회기 + 기록된 활동 + 이미 응답이 있는 회차.
   *
   * 계획을 넣지 않으면 활동일지를 쓰기 전까지 고를 회차가 하나도 없어
   * 만족도를 미리 받을 수 없다.
   */
  const sessionNumbers = new Set<number>([
    ...PLANNED_SESSIONS.map((session) => session.sessionNumber),
    ...activities.map((activity) => activity.sessionNumber),
    ...feedbacks.map((feedback) => feedback.sessionNumber),
  ]);

  const sessions = [...sessionNumbers]
    .filter((sessionNumber) => sessionNumber > 0)
    .sort((a, b) => a - b)
    .map((sessionNumber) => ({
      sessionNumber,
      topic: topicBySession.get(sessionNumber) ?? "",
    }));

  /*
   * 미리 골라 둘 회차: 아직 활동일지가 없는 첫 회차.
   *
   * 만족도는 모임이 끝난 자리에서 받고 활동일지는 그 뒤에 쓴다. 그래서
   * "기록이 아직 없는 첫 회차"가 방금 끝난 회차일 가능성이 가장 크다.
   * 전부 기록이 있으면 마지막 회차로 둔다.
   */
  const recorded = new Set(activities.map((activity) => activity.sessionNumber));
  const suggestedSessionNumber =
    sessions.find((session) => !recorded.has(session.sessionNumber))?.sessionNumber ??
    sessions.at(-1)?.sessionNumber ??
    0;

  if (!includeSummaries) {
    return { sessions, suggestedSessionNumber, summaries: [], totalCount: feedbacks.length };
  }

  const summaries = sessions
    .map((session) => summarize(session.sessionNumber, session.topic, feedbacks))
    .filter((summary) => summary.count > 0)
    .sort((a, b) => b.sessionNumber - a.sessionNumber);

  return { sessions, suggestedSessionNumber, summaries, totalCount: feedbacks.length };
}

/**
 * 회차별 집계만 뽑는다.
 *
 * 활동일지를 쓸 때 그 회차의 만족도를 옆에 놓고 평가를 적을 수 있게
 * 하기 위한 값이다. 운영자 화면에서만 쓴다.
 */
export async function listFeedbackSummaries(): Promise<SessionFeedback[]> {
  const view = await getFeedbackView(true);
  return view.summaries;
}

function summarize(
  sessionNumber: number,
  topic: string,
  feedbacks: Feedback[],
): SessionFeedback {
  const mine = feedbacks.filter((feedback) => feedback.sessionNumber === sessionNumber);

  const scoreCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<SatisfactionScore, number>;
  let total = 0;

  for (const feedback of mine) {
    scoreCounts[feedback.score] += 1;
    total += feedback.score;
  }

  return {
    sessionNumber,
    topic,
    count: mine.length,
    averageScore: mine.length > 0 ? Math.round((total / mine.length) * 10) / 10 : 0,
    scoreCounts,
    // 적은 순서가 곧 응답 순서라 그대로 두면 누가 썼는지 짐작할 수 있다. 섞는다.
    bestParts: shuffleStable(mine.filter((f) => f.bestPart).map((f) => f.bestPart)),
    nextWishes: shuffleStable(mine.filter((f) => f.nextWish).map((f) => f.nextWish)),
  };
}

/**
 * 글자에서 만든 값으로 정렬한다.
 *
 * 무작위로 섞으면 새로고침할 때마다 순서가 바뀌어 읽기 어렵다.
 * 내용에서 만든 값으로 정렬하면 순서가 고정되면서 작성 순서는 드러나지 않는다.
 */
function shuffleStable(items: string[]): string[] {
  return [...items].sort((a, b) => hashString(a) - hashString(b));
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(i)) | 0;
  }
  return hash;
}

// ---------------------------------------------------------------------------
// 검증과 저장
// ---------------------------------------------------------------------------

export function validateFeedback(
  raw: unknown,
): { ok: true; value: FeedbackInput } | { ok: false; errors: FeedbackErrors } {
  const input = (raw ?? {}) as Record<string, unknown>;
  const errors: FeedbackErrors = {};

  const sessionNumber = Math.trunc(parseNumber(String(input.sessionNumber ?? ""), 0));
  if (sessionNumber < 1 || sessionNumber > 99) {
    errors.sessionNumber = "회차를 골라 주세요.";
  }

  const scoreValue = Math.trunc(parseNumber(String(input.score ?? ""), 0));
  const score = SATISFACTION_SCORES.includes(scoreValue as SatisfactionScore)
    ? (scoreValue as SatisfactionScore)
    : null;
  if (!score) errors.score = "만족도를 골라 주세요.";

  const bestPart = str(input.bestPart);
  if (bestPart.length > BEST_PART_MAX_LENGTH) {
    errors.bestPart = `좋았던 점은 ${BEST_PART_MAX_LENGTH}자 이내로 써 주세요.`;
  }

  const nextWish = str(input.nextWish);
  if (nextWish.length > NEXT_WISH_MAX_LENGTH) {
    errors.nextWish = `희망 활동은 ${NEXT_WISH_MAX_LENGTH}자 이내로 써 주세요.`;
  }

  // 점수만 누르고 넘어가도 되지만, 둘 다 비면 남길 내용이 없다.
  if (!errors.bestPart && !errors.nextWish && !bestPart && !nextWish) {
    errors.bestPart = "좋았던 점이나 희망 활동 중 하나는 적어 주세요.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: { sessionNumber, score: score as SatisfactionScore, bestPart, nextWish },
  };
}

export async function saveFeedback(input: FeedbackInput): Promise<void> {
  const settings = await getSettings();

  await appendRow(SHEET, {
    feedback_id: `FBK-${randomId(8)}`,
    program_id: settings.programId,
    session_number: String(input.sessionNumber),
    score: String(input.score),
    best_part: input.bestPart,
    next_wish: input.nextWish,
    created_on: nowKstIso().slice(0, 10),
  });
}

/** 운영자가 부적절한 응답을 지운다. */
export async function deleteFeedback(feedbackId: string): Promise<void> {
  await deleteRowsWhere(SHEET, { feedback_id: feedbackId });
}

// ---------------------------------------------------------------------------
// 유틸
// ---------------------------------------------------------------------------

function toFeedback(row: Record<string, string>): Feedback {
  const score = Math.trunc(parseNumber(row.score ?? "", 3));

  return {
    feedbackId: row.feedback_id ?? "",
    programId: row.program_id ?? "",
    sessionNumber: Math.trunc(parseNumber(row.session_number ?? "", 0)),
    score: (SATISFACTION_SCORES.includes(score as SatisfactionScore)
      ? score
      : 3) as SatisfactionScore,
    bestPart: row.best_part ?? "",
    nextWish: row.next_wish ?? "",
    createdOn: row.created_on ?? "",
  };
}

/** 순번이 아니라 무작위로 만든다. ID 로 응답 순서를 알 수 없게 한다. */
function randomId(length: number): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let id = "";
  for (let i = 0; i < length; i += 1) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return id;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
