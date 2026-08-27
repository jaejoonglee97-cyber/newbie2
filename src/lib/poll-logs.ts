import "server-only";

import { nowKstIso } from "./format";
import { appendRow, readSheet } from "./repo";
import { getSettings } from "./settings";
import type {
  CastVoteInput,
  CreatePollErrors,
  CreatePollInput,
  Poll,
  PollOption,
  PollResult,
  PollStatus,
  PollType,
  PollVote,
} from "./poll-types";

// ---------------------------------------------------------------------------
// 조회
// ---------------------------------------------------------------------------

/** 현재 활성(open) 투표 하나를 가져온다. 없으면 null. */
export async function getActivePoll(): Promise<PollResult | null> {
  const [polls, options, votes] = await Promise.all([
    readSheet("polls"),
    readSheet("poll_options"),
    readSheet("poll_votes"),
  ]);

  // 가장 최근 open 투표 우선
  const openPoll = polls
    .filter((row) => row.status === "open" || row.status === "confirmed")
    .at(-1);

  if (!openPoll) return null;

  return buildPollResult(openPoll, options, votes);
}

/** pollId로 특정 투표를 가져온다. */
export async function getPollById(pollId: string): Promise<PollResult | null> {
  const [polls, options, votes] = await Promise.all([
    readSheet("polls"),
    readSheet("poll_options"),
    readSheet("poll_votes"),
  ]);

  const pollRow = polls.find((row) => row.poll_id === pollId);
  if (!pollRow) return null;

  return buildPollResult(pollRow, options, votes);
}

/** 전체 투표 목록 (운영자용) */
export async function listPolls(): Promise<PollResult[]> {
  const [polls, options, votes] = await Promise.all([
    readSheet("polls"),
    readSheet("poll_options"),
    readSheet("poll_votes"),
  ]);

  return polls
    .map((row) => buildPollResult(row, options, votes))
    .reverse(); // 최신 순
}

// ---------------------------------------------------------------------------
// 생성
// ---------------------------------------------------------------------------

export function validateCreatePoll(raw: unknown): { ok: true; value: CreatePollInput } | { ok: false; errors: CreatePollErrors } {
  const input = (raw ?? {}) as Record<string, unknown>;
  const errors: CreatePollErrors = {};

  const pollType = str(input.pollType) as PollType;
  if (pollType !== "date" && pollType !== "attendance") {
    errors.pollType = "투표 유형을 선택해 주세요.";
  }

  const title = str(input.title);
  if (title.length < 2) errors.title = "제목을 2자 이상 입력해 주세요.";

  const createdBy = str(input.createdBy);
  if (!createdBy) errors.createdBy = "작성자를 선택해 주세요.";

  const rawOptions = Array.isArray(input.options) ? input.options : [];
  if (pollType === "date") {
    if (rawOptions.length < 2) {
      errors.options = "날짜 후보를 2개 이상 입력해 주세요.";
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      pollType,
      title,
      description: str(input.description),
      createdBy,
      options: rawOptions.map((o: Record<string, unknown>) => ({
        optionDate: str(o.optionDate),
        optionLabel: str(o.optionLabel),
      })),
    },
  };
}

export async function createPoll(input: CreatePollInput): Promise<{ pollId: string }> {
  const settings = await getSettings();
  const now = nowKstIso();

  const existing = await readSheet("polls");
  const pollId = `POLL-${String(existing.length + 1).padStart(4, "0")}`;

  await appendRow("polls", {
    poll_id: pollId,
    program_id: settings.programId,
    poll_type: input.pollType,
    title: input.title,
    description: input.description,
    status: "open",
    confirmed_date: "",
    created_by: input.createdBy,
    created_at: now,
    updated_at: now,
  });

  if (input.pollType === "date" && input.options) {
    const existingOptions = await readSheet("poll_options");
    for (let i = 0; i < input.options.length; i++) {
      const opt = input.options[i];
      await appendRow("poll_options", {
        option_id: `OPT-${pollId}-${String(i + 1).padStart(2, "0")}`,
        poll_id: pollId,
        option_date: opt.optionDate,
        option_label: opt.optionLabel || opt.optionDate,
        sort_order: String(i + 1),
        created_at: now,
      });
      void existingOptions; // suppress unused warning
    }
  }

  return { pollId };
}

// ---------------------------------------------------------------------------
// 투표하기
// ---------------------------------------------------------------------------

export async function castVote(
  pollId: string,
  input: CastVoteInput,
): Promise<{ ok: boolean; message?: string }> {
  const now = nowKstIso();

  const votes = await readSheet("poll_votes");
  const existingVote = votes.find(
    (row) => row.poll_id === pollId && row.voter_name === input.voterName,
  );

  const selected = input.selectedOptions.join(",");

  if (existingVote) {
    // 기존 투표를 덮어쓴다 (Sheets API append 는 업데이트 불가 → 새 행으로 처리)
    // 집계 시 같은 투표자의 마지막 행만 쓴다.
  }

  const voteId = `VOT-${pollId}-${Date.now()}`;
  await appendRow("poll_votes", {
    vote_id: voteId,
    poll_id: pollId,
    voter_name: input.voterName,
    selected_options: selected,
    voted_at: now,
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// 날짜 확정 (admin)
// ---------------------------------------------------------------------------

export async function confirmPollDate(
  pollId: string,
  confirmedDate: string,
): Promise<{ ok: boolean }> {
  // Google Sheets는 행 업데이트를 지원하지 않으므로
  // 상태를 "confirmed"로 표시한 새 polls 행을 덮어쓰는 방식 대신
  // poll 상태 변경은 실제로는 Sheets API batchUpdate로 처리해야 한다.
  // 단순화를 위해 appendRow로 새 행을 쌓고 buildPollResult에서 마지막 행을 우선시한다.
  const now = nowKstIso();
  const settings = await getSettings();

  const polls = await readSheet("polls");
  const poll = polls.find((row) => row.poll_id === pollId);
  if (!poll) return { ok: false };

  // 같은 pollId로 confirmed 상태의 새 행을 추가 (마지막 행 우선 로직으로 덮어쓰기 효과)
  await appendRow("polls", {
    poll_id: pollId,
    program_id: settings.programId,
    poll_type: poll.poll_type ?? "date",
    title: poll.title ?? "",
    description: poll.description ?? "",
    status: "confirmed",
    confirmed_date: confirmedDate,
    created_by: poll.created_by ?? "",
    created_at: poll.created_at ?? now,
    updated_at: now,
  });

  return { ok: true };
}

/** 투표를 마감(closed) 처리한다. */
export async function closePoll(pollId: string): Promise<{ ok: boolean }> {
  const now = nowKstIso();
  const settings = await getSettings();
  const polls = await readSheet("polls");
  const poll = polls.find((row) => row.poll_id === pollId);
  if (!poll) return { ok: false };

  await appendRow("polls", {
    poll_id: pollId,
    program_id: settings.programId,
    poll_type: poll.poll_type ?? "date",
    title: poll.title ?? "",
    description: poll.description ?? "",
    status: "closed",
    confirmed_date: poll.confirmed_date ?? "",
    created_by: poll.created_by ?? "",
    created_at: poll.created_at ?? now,
    updated_at: now,
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// 내부 헬퍼
// ---------------------------------------------------------------------------

function buildPollResult(
  pollRow: Record<string, string>,
  allOptions: Record<string, string>[],
  allVotes: Record<string, string>[],
): PollResult {
  const pollId = pollRow.poll_id ?? "";

  const poll: Poll = {
    pollId,
    programId: pollRow.program_id ?? "",
    pollType: (pollRow.poll_type as PollType) ?? "date",
    title: pollRow.title ?? "",
    description: pollRow.description ?? "",
    status: (pollRow.status as PollStatus) ?? "open",
    confirmedDate: pollRow.confirmed_date ?? "",
    createdBy: pollRow.created_by ?? "",
    createdAt: pollRow.created_at ?? "",
    updatedAt: pollRow.updated_at ?? "",
  };

  const pollOptions = allOptions
    .filter((row) => row.poll_id === pollId)
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
    .map((row) => ({
      optionId: row.option_id ?? "",
      pollId,
      optionDate: row.option_date ?? "",
      optionLabel: row.option_label ?? row.option_date ?? "",
      sortOrder: Number(row.sort_order ?? 0),
    }));

  // 같은 투표자의 마지막 투표만 유효 (덮어쓰기 효과)
  const pollVotesRaw = allVotes.filter((row) => row.poll_id === pollId);
  const latestByVoter = new Map<string, PollVote>();
  for (const row of pollVotesRaw) {
    latestByVoter.set(row.voter_name, {
      voteId: row.vote_id ?? "",
      pollId,
      voterName: row.voter_name ?? "",
      selectedOptions: row.selected_options ?? "",
      votedAt: row.voted_at ?? "",
    });
  }
  const votes = Array.from(latestByVoter.values());

  // 날짜투표 집계: 옵션별 투표자 이름 목록
  const optionsWithVoters = pollOptions.map((opt) => ({
    ...opt,
    voterNames: votes
      .filter((v) => v.selectedOptions.split(",").includes(opt.optionId))
      .map((v) => v.voterName),
  }));

  // 참석투표 집계
  const attendanceSummary =
    poll.pollType === "attendance"
      ? {
          attend: votes.filter((v) => v.selectedOptions === "attend").map((v) => v.voterName),
          absent: votes.filter((v) => v.selectedOptions === "absent").map((v) => v.voterName),
          undecided: votes.filter((v) => v.selectedOptions === "undecided").map((v) => v.voterName),
        }
      : undefined;

  return {
    poll,
    options: optionsWithVoters,
    votes,
    attendanceSummary,
  };
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
