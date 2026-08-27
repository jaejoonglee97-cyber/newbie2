import "server-only";

import { deleteImages, uploadImage } from "./card-storage";
import { nowKstIso, parseNumber } from "./format";
import { appendRow, deleteRowsWhere, patchRowsWhere, readSheet } from "./repo";
import { getSettings } from "./settings";
import type {
  ActivityDetail,
  ActivityLogFieldErrors,
  ActivityLogInput,
  ActivityStatus,
  ActivitySummary,
  AttendanceStatus,
  BudgetCategory,
  MemberOption,
  PhotoInput,
} from "./activity-types";
import { BUDGET_CATEGORIES } from "./activity-types";

/**
 * 활동일지 저장·조회.
 *
 * 한 번 저장할 때 5개 시트가 함께 갱신된다. (스키마 문서 5장)
 *   activities             기본 활동 정보
 *   activity_participants  출석
 *   budget_items           실제 사용 예산
 *   activity_logs          내용과 평가
 *   photos                 사진
 *   audit_logs             상태 변경 이력
 *
 * Google Sheets 에는 트랜잭션이 없다. 중간에 실패하면 일부만 기록된 상태가 될 수
 * 있으므로, 되돌리기 어려운 순서를 먼저 처리하고(사진 업로드) 실패 시 무엇이
 * 남았는지 audit_logs 로 확인할 수 있게 한다.
 */

const ATTENDED: AttendanceStatus[] = ["참석", "지각", "조퇴"];

export type ActivityValidationResult =
  | { ok: true; value: ActivityLogInput }
  | { ok: false; errors: ActivityLogFieldErrors };

/**
 * 활동일지 입력값을 서버에서 검증한다. (PRD 12)
 *
 * 사진은 별도로 검증한다. 최소 1장이 필요하다.
 */
export async function validateActivityLog(
  raw: unknown,
  photoCount: number,
): Promise<ActivityValidationResult> {
  const input = (raw ?? {}) as Record<string, unknown>;
  const errors: ActivityLogFieldErrors = {};
  const settings = await getSettings();

  const sessionNumber = Math.trunc(parseNumber(String(input.sessionNumber ?? ""), 0));
  if (sessionNumber < 1 || sessionNumber > 99) {
    errors.sessionNumber = "회기를 1 이상으로 입력해 주세요.";
  }

  const authorMemberId = str(input.authorMemberId);
  if (!authorMemberId) {
    errors.authorMemberId = "작성자를 선택해 주세요.";
  }

  const topic = str(input.topic);
  if (topic.length < 2) errors.topic = "모임 주제를 입력해 주세요.";
  else if (topic.length > 100) errors.topic = "모임 주제가 너무 깁니다.";

  const objective = str(input.objective);
  if (objective.length < 2) errors.objective = "모임 목표를 입력해 주세요.";

  const expectedEffect = str(input.expectedEffect);
  if (expectedEffect.length < 2) errors.expectedEffect = "기대 효과를 입력해 주세요.";

  const activityDate = str(input.activityDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(activityDate)) {
    errors.activityDate = "모임 날짜를 선택해 주세요.";
  } else if (
    activityDate < settings.activityStartDate ||
    activityDate > settings.activityEndDate
  ) {
    // 활동 기간을 벗어난 날짜는 지원금 정산 대상이 아니다.
    errors.activityDate = `활동 기간(${settings.activityStartDate} ~ ${settings.activityEndDate}) 안의 날짜여야 합니다.`;
  }

  const startTime = str(input.startTime);
  const endTime = str(input.endTime);
  if (!/^\d{2}:\d{2}$/.test(startTime)) errors.startTime = "시작 시각을 입력해 주세요.";
  if (!/^\d{2}:\d{2}$/.test(endTime)) errors.endTime = "종료 시각을 입력해 주세요.";
  if (!errors.startTime && !errors.endTime && endTime <= startTime) {
    errors.endTime = "종료 시각이 시작 시각보다 늦어야 합니다.";
  }

  const location = str(input.location);
  if (location.length < 2) errors.location = "모임 장소를 입력해 주세요.";

  const content = str(input.content);
  if (content.length < 10) errors.content = "모임 내용을 10자 이상 입력해 주세요.";

  const evaluation = str(input.evaluation);
  if (evaluation.length < 10) errors.evaluation = "모임 평가 및 소감을 10자 이상 입력해 주세요.";

  // 참여자
  const participants = parseParticipants(input.participants);
  const attendedCount = participants.filter((p) =>
    ATTENDED.includes(p.attendanceStatus),
  ).length;

  if (participants.length === 0) {
    errors.participants = "참여자를 선택해 주세요.";
  } else if (attendedCount === 0) {
    errors.participants = "실제 참석자를 한 명 이상 체크해 주세요.";
  } else if (attendedCount < settings.minimumParticipants) {
    errors.participants = `실제 참석자가 ${settings.minimumParticipants}명 이상이어야 합니다. 현재 ${attendedCount}명입니다.`;
  }

  // 예산
  const budgetItems = parseBudgetItems(input.budgetItems);
  if (budgetItems.length === 0) {
    errors.budgetItems = "예산 사용내역을 한 줄 이상 입력해 주세요.";
  } else if (budgetItems.some((item) => !item.itemName || !item.calculationBasis)) {
    errors.budgetItems = "모든 예산 항목에 항목명과 산출 근거를 입력해 주세요.";
  } else if (budgetItems.some((item) => item.amount <= 0)) {
    errors.budgetItems = "예산 금액은 0원보다 커야 합니다.";
  }

  if (photoCount === 0) {
    errors.photos = "모임 사진을 한 장 이상 첨부해 주세요.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      sessionNumber,
      authorMemberId,
      topic,
      objective,
      expectedEffect,
      activityDate,
      startTime,
      endTime,
      location,
      content,
      evaluation,
      participants,
      budgetItems,
    },
  };
}

export type SaveResult = {
  activityId: string;
  photosUploaded: number;
  photosFailed: number;
};

/** 활동일지를 저장한다. 저장 즉시 완료 상태로 기록한다. */
export async function saveActivityLog(
  input: ActivityLogInput,
  photos: PhotoInput[],
): Promise<SaveResult> {
  const settings = await getSettings();
  const now = nowKstIso();

  const existingActivities = await readSheet("activities");
  const activityId = nextActivityId(existingActivities, input.activityDate, input.sessionNumber);
  const logId = activityId.replace("ACT-", "LOG-");

  // 사진을 먼저 올린다. 여기서 실패하면 시트에는 아무것도 쓰지 않은 상태다.
  const uploads = await Promise.all(
    photos.map(async (photo, index) => {
      const result = await uploadImage(
        "photo",
        activityId,
        `${index + 1}`,
        { mimeType: photo.mimeType, dataBase64: photo.dataBase64 },
      );
      return { photo, result, index };
    }),
  );

  const succeeded = uploads.filter((entry) => entry.result !== null);
  const failed = uploads.length - succeeded.length;

  await appendRow("activities", {
    activity_id: activityId,
    program_id: settings.programId,
    session_number: String(input.sessionNumber),
    owner_member_id: input.authorMemberId,
    topic: input.topic,
    objective: input.objective,
    expected_effect: input.expectedEffect,
    activity_date: input.activityDate,
    start_time: input.startTime,
    end_time: input.endTime,
    location: input.location,
    status: "완료",
    submitted_at: now,
    approved_at: "",
    approved_by: "",
    rejection_reason: "",
    created_at: now,
    updated_at: now,
  });

  const participantSeed = (await readSheet("activity_participants")).length;
  for (let i = 0; i < input.participants.length; i += 1) {
    const participant = input.participants[i];
    await appendRow("activity_participants", {
      activity_participant_id: `ATP-${pad(participantSeed + i + 1, 6)}`,
      activity_id: activityId,
      member_id: participant.memberId,
      planned: participant.planned ? "TRUE" : "FALSE",
      attendance_status: participant.attendanceStatus,
      absence_note: participant.absenceNote,
      checked_at: now,
      updated_at: now,
    });
  }

  const budgetSeed = (await readSheet("budget_items")).length;
  for (let i = 0; i < input.budgetItems.length; i += 1) {
    const item = input.budgetItems[i];
    await appendRow("budget_items", {
      budget_item_id: `BUD-${pad(budgetSeed + i + 1, 6)}`,
      activity_id: activityId,
      // 활동일지에서 입력하는 값은 모두 실제 사용액이다.
      budget_type: "actual",
      category: item.category,
      item_name: item.itemName,
      calculation_basis: item.calculationBasis,
      quantity: "",
      unit_price: "",
      amount: String(item.amount),
      evidence_file_url: "",
      memo: "",
      created_at: now,
      updated_at: now,
    });
  }

  await appendRow("activity_logs", {
    activity_log_id: logId,
    activity_id: activityId,
    author_member_id: input.authorMemberId,
    content: input.content,
    evaluation: input.evaluation,
    review_status: "완료",
    review_note: "",
    submitted_at: now,
    completed_at: now,
    completed_by: input.authorMemberId,
    created_at: now,
    updated_at: now,
  });

  const photoSeed = (await readSheet("photos")).length;
  // 대표 사진이 지정되지 않았거나 업로드에 실패했으면 첫 장을 대표로 쓴다.
  const coverIndex = succeeded.findIndex((entry) => entry.photo.isCover);
  const effectiveCover = coverIndex >= 0 ? coverIndex : 0;

  for (let i = 0; i < succeeded.length; i += 1) {
    const entry = succeeded[i];
    await appendRow("photos", {
      photo_id: `PHT-${pad(photoSeed + i + 1, 6)}`,
      activity_id: activityId,
      drive_file_id: entry.result!.fileId,
      file_url: entry.result!.fileUrl,
      caption: entry.photo.caption,
      is_cover: i === effectiveCover ? "TRUE" : "FALSE",
      sort_order: String(i + 1),
      uploaded_by: input.authorMemberId,
      uploaded_at: now,
    });
  }

  const auditSeed = (await readSheet("audit_logs")).length;
  await appendRow("audit_logs", {
    audit_id: `AUD-${pad(auditSeed + 1, 6)}`,
    actor_member_id: input.authorMemberId,
    entity_type: "activity_log",
    entity_id: activityId,
    action: "created",
    before_value: "",
    after_value: "완료",
    note:
      failed > 0
        ? `활동일지 등록. 사진 ${succeeded.length}장 저장, ${failed}장 실패`
        : `활동일지 등록. 사진 ${succeeded.length}장 저장`,
    created_at: now,
  });

  return { activityId, photosUploaded: succeeded.length, photosFailed: failed };
}

export type UpdateResult = SaveResult & { photosRemoved: number };

/**
 * 이미 저장된 활동일지를 고친다.
 *
 * 활동 ID 와 회기 번호는 바꾸지 않는다. ID 를 바꾸면 사진 파일 이름과
 * 인쇄 링크가 어긋나고, 회기 번호는 ID 에 들어 있어 함께 바뀌어야 한다.
 *
 * 참여자와 예산은 줄이 늘거나 줄 수 있어 한 줄씩 맞춰 고치기 어렵다.
 * 해당 활동의 기존 줄을 지우고 새로 넣는다. 사진은 지울 것만 지우고
 * 새로 첨부한 것만 더한다. 이미 있는 사진을 건드리지 않는다.
 */
export async function updateActivityLog(
  activityId: string,
  input: ActivityLogInput,
  newPhotos: PhotoInput[],
  removedPhotoIds: string[],
): Promise<UpdateResult> {
  const now = nowKstIso();

  const activities = await readSheet("activities");
  const target = activities.find((row) => row.activity_id === activityId);

  if (!target) {
    throw new Error(`활동을 찾지 못했습니다: ${activityId}`);
  }

  // 지울 사진을 먼저 확인한다. 시트에 등록된 것만 지울 수 있다.
  const photoRows = await readSheet("photos");
  const removable = photoRows.filter(
    (row) => row.activity_id === activityId && removedPhotoIds.includes(row.photo_id),
  );

  // 새 사진을 먼저 올린다. 여기서 실패하면 시트는 아직 그대로다.
  const uploads = await Promise.all(
    newPhotos.map(async (photo, index) => {
      const result = await uploadImage("photo", activityId, `add-${index + 1}`, {
        mimeType: photo.mimeType,
        dataBase64: photo.dataBase64,
      });
      return { photo, result };
    }),
  );

  const succeeded = uploads.filter((entry) => entry.result !== null);
  const failed = uploads.length - succeeded.length;

  await patchRowsWhere(
    "activities",
    { activity_id: activityId },
    {
      owner_member_id: input.authorMemberId,
      topic: input.topic,
      objective: input.objective,
      expected_effect: input.expectedEffect,
      activity_date: input.activityDate,
      start_time: input.startTime,
      end_time: input.endTime,
      location: input.location,
      updated_at: now,
    },
  );

  await patchRowsWhere(
    "activity_logs",
    { activity_id: activityId },
    {
      author_member_id: input.authorMemberId,
      content: input.content,
      evaluation: input.evaluation,
      updated_at: now,
    },
  );

  // 참여자 교체
  await deleteRowsWhere("activity_participants", { activity_id: activityId });
  const participantSeed = (await readSheet("activity_participants")).length;
  for (let i = 0; i < input.participants.length; i += 1) {
    const participant = input.participants[i];
    await appendRow("activity_participants", {
      activity_participant_id: `ATP-${pad(participantSeed + i + 1, 6)}`,
      activity_id: activityId,
      member_id: participant.memberId,
      planned: participant.planned ? "TRUE" : "FALSE",
      attendance_status: participant.attendanceStatus,
      absence_note: participant.absenceNote,
      checked_at: now,
      updated_at: now,
    });
  }

  // 실제 사용액 교체. 신청 예산(planned)은 건드리지 않는다.
  await deleteRowsWhere("budget_items", { activity_id: activityId, budget_type: "actual" });
  const budgetSeed = (await readSheet("budget_items")).length;
  for (let i = 0; i < input.budgetItems.length; i += 1) {
    const item = input.budgetItems[i];
    await appendRow("budget_items", {
      budget_item_id: `BUD-${pad(budgetSeed + i + 1, 6)}`,
      activity_id: activityId,
      budget_type: "actual",
      category: item.category,
      item_name: item.itemName,
      calculation_basis: item.calculationBasis,
      quantity: "",
      unit_price: "",
      amount: String(item.amount),
      evidence_file_url: "",
      memo: "",
      created_at: now,
      updated_at: now,
    });
  }

  // 사진: 지울 것 지우고 새로 올린 것 추가
  for (const row of removable) {
    await deleteRowsWhere("photos", { photo_id: row.photo_id });
  }
  const driveCleanup = await deleteImages(removable.map((row) => row.drive_file_id));

  const photoSeed = (await readSheet("photos")).length;
  for (let i = 0; i < succeeded.length; i += 1) {
    const entry = succeeded[i];
    await appendRow("photos", {
      photo_id: `PHT-${pad(photoSeed + i + 1, 6)}`,
      activity_id: activityId,
      drive_file_id: entry.result!.fileId,
      file_url: entry.result!.fileUrl,
      caption: entry.photo.caption,
      is_cover: "FALSE",
      sort_order: String(photoSeed + i + 1),
      uploaded_by: input.authorMemberId,
      uploaded_at: now,
    });
  }

  // 대표 사진이 사라졌으면 남은 사진 중 첫 장을 대표로 올린다.
  const remaining = (await readSheet("photos")).filter(
    (row) => row.activity_id === activityId,
  );
  if (remaining.length > 0 && !remaining.some((row) => row.is_cover === "TRUE")) {
    await patchRowsWhere("photos", { photo_id: remaining[0].photo_id }, { is_cover: "TRUE" });
  }

  const auditSeed = (await readSheet("audit_logs")).length;
  await appendRow("audit_logs", {
    audit_id: `AUD-${pad(auditSeed + 1, 6)}`,
    actor_member_id: input.authorMemberId,
    entity_type: "activity_log",
    entity_id: activityId,
    action: "updated",
    before_value: target.updated_at ?? "",
    after_value: now,
    note: buildUpdateNote(succeeded.length, failed, removable.length, driveCleanup.failed),
    created_at: now,
  });

  return {
    activityId,
    photosUploaded: succeeded.length,
    photosFailed: failed,
    photosRemoved: removable.length,
  };
}

function buildUpdateNote(
  added: number,
  addFailed: number,
  removed: number,
  driveFailed: number,
): string {
  const parts = ["활동일지 수정"];
  if (added > 0) parts.push(`사진 ${added}장 추가`);
  if (addFailed > 0) parts.push(`사진 ${addFailed}장 추가 실패`);
  if (removed > 0) parts.push(`사진 ${removed}장 삭제`);
  if (driveFailed > 0) parts.push(`Drive 파일 ${driveFailed}개 정리 필요`);
  return parts.join(". ");
}

export type DeleteResult = {
  activityId: string;
  photosDeleted: number;
  /** Drive 에서 지우지 못해 남은 사진 파일 수 */
  photoFilesRemaining: number;
};

/**
 * 활동일지를 지운다. 딸린 줄을 모두 지운다.
 *
 * 자식 줄부터 지우고 활동 줄을 마지막에 지운다. 중간에 실패해도 부모 없는
 * 자식 줄이 남지 않는다. 되돌릴 수 없으므로 호출하는 쪽에서 확인을 받는다.
 *
 * audit_logs 는 지우지 않는다. 무엇이 언제 지워졌는지가 유일하게 남는 기록이다.
 */
export async function deleteActivityLog(
  activityId: string,
  actorMemberId: string,
): Promise<DeleteResult> {
  const activities = await readSheet("activities");
  const target = activities.find((row) => row.activity_id === activityId);

  if (!target) {
    throw new Error(`활동을 찾지 못했습니다: ${activityId}`);
  }

  const photoRows = (await readSheet("photos")).filter(
    (row) => row.activity_id === activityId,
  );

  await deleteRowsWhere("photos", { activity_id: activityId });
  await deleteRowsWhere("budget_items", { activity_id: activityId });
  await deleteRowsWhere("activity_participants", { activity_id: activityId });
  await deleteRowsWhere("activity_logs", { activity_id: activityId });
  await deleteRowsWhere("activities", { activity_id: activityId });

  const driveCleanup = await deleteImages(photoRows.map((row) => row.drive_file_id));

  const now = nowKstIso();
  const auditSeed = (await readSheet("audit_logs")).length;
  await appendRow("audit_logs", {
    audit_id: `AUD-${pad(auditSeed + 1, 6)}`,
    actor_member_id: actorMemberId,
    entity_type: "activity_log",
    entity_id: activityId,
    action: "deleted",
    before_value: `${target.session_number ?? ""}회기 ${target.topic ?? ""}`.trim(),
    after_value: "",
    note:
      driveCleanup.failed > 0
        ? `활동일지 삭제. 사진 파일 ${driveCleanup.failed}개는 Drive 에서 직접 정리 필요`
        : `활동일지 삭제. 사진 파일 ${driveCleanup.deleted}개 정리`,
    created_at: now,
  });

  return {
    activityId,
    photosDeleted: photoRows.length,
    photoFilesRemaining: driveCleanup.failed,
  };
}

/** 목록 화면용 요약 */
export async function listActivities(): Promise<ActivitySummary[]> {
  const [activities, participants, budgets, photos, memberNames] = await Promise.all([
    readSheet("activities"),
    readSheet("activity_participants"),
    readSheet("budget_items"),
    readSheet("photos"),
    getMemberNameMap(),
  ]);

  return activities
    .map((row) => {
      const activityId = row.activity_id ?? "";
      const mine = participants.filter((p) => p.activity_id === activityId);

      return {
        activityId,
        sessionNumber: Math.trunc(parseNumber(row.session_number ?? "", 0)),
        topic: row.topic ?? "",
        activityDate: row.activity_date ?? "",
        startTime: row.start_time ?? "",
        endTime: row.end_time ?? "",
        location: row.location ?? "",
        status: (row.status || "완료") as ActivityStatus,
        authorName: memberNames.get(row.owner_member_id ?? "") ?? "",
        plannedCount: mine.filter((p) => p.planned === "TRUE").length,
        attendedCount: mine.filter((p) =>
          ATTENDED.includes((p.attendance_status ?? "") as AttendanceStatus),
        ).length,
        actualAmount: budgets
          .filter((b) => b.activity_id === activityId && b.budget_type === "actual")
          .reduce((sum, b) => sum + parseNumber(b.amount ?? "", 0), 0),
        photoCount: photos.filter((p) => p.activity_id === activityId).length,
      };
    })
    .sort((a, b) => b.sessionNumber - a.sessionNumber);
}

/** 인쇄 화면과 상세 화면용 전체 데이터 (스키마 문서 5장) */
export async function getActivityDetail(activityId: string): Promise<ActivityDetail | null> {
  const [activities, logs, participants, budgets, photos, members] = await Promise.all([
    readSheet("activities"),
    readSheet("activity_logs"),
    readSheet("activity_participants"),
    readSheet("budget_items"),
    readSheet("photos"),
    readSheet("applicants"),
  ]);

  const activity = activities.find((row) => row.activity_id === activityId);
  if (!activity) return null;

  const log = logs.find((row) => row.activity_id === activityId);
  const memberById = new Map(members.map((row) => [row.application_id ?? "", row]));

  const budgetRows = budgets.filter(
    (row) => row.activity_id === activityId && row.budget_type === "actual",
  );

  return {
    activityId,
    sessionNumber: Math.trunc(parseNumber(activity.session_number ?? "", 0)),
    topic: activity.topic ?? "",
    objective: activity.objective ?? "",
    expectedEffect: activity.expected_effect ?? "",
    activityDate: activity.activity_date ?? "",
    startTime: activity.start_time ?? "",
    endTime: activity.end_time ?? "",
    location: activity.location ?? "",
    status: (activity.status || "완료") as ActivityStatus,
    authorName: memberById.get(activity.owner_member_id ?? "")?.name ?? "",
    content: log?.content ?? "",
    evaluation: log?.evaluation ?? "",
    participants: participants
      .filter((row) => row.activity_id === activityId)
      .map((row) => {
        const member = memberById.get(row.member_id ?? "");
        return {
          name: member?.name ?? "",
          organization: member?.organization ?? "",
          position: member?.position ?? "",
          attendanceStatus: (row.attendance_status ?? "") as AttendanceStatus,
          absenceNote: row.absence_note ?? "",
        };
      })
      .sort((a, b) => a.organization.localeCompare(b.organization, "ko")),
    budgetItems: budgetRows.map((row) => ({
      category: row.category ?? "",
      itemName: row.item_name ?? "",
      calculationBasis: row.calculation_basis ?? "",
      amount: parseNumber(row.amount ?? "", 0),
    })),
    actualTotal: budgetRows.reduce((sum, row) => sum + parseNumber(row.amount ?? "", 0), 0),
    photos: photos
      .filter((row) => row.activity_id === activityId)
      .sort((a, b) => parseNumber(a.sort_order ?? "", 0) - parseNumber(b.sort_order ?? "", 0))
      .map((row) => ({
        photoId: row.photo_id ?? "",
        imagePath: `/api/photos/${encodeURIComponent(row.drive_file_id ?? "")}`,
        caption: row.caption ?? "",
        isCover: row.is_cover === "TRUE",
      })),
  };
}

/** 수정 화면이 폼을 채우는 데 필요한 값 */
export type ActivityEditValues = {
  activityId: string;
  sessionNumber: number;
  authorMemberId: string;
  topic: string;
  objective: string;
  expectedEffect: string;
  activityDate: string;
  startTime: string;
  endTime: string;
  location: string;
  content: string;
  evaluation: string;
  participants: Array<{
    memberId: string;
    attendanceStatus: AttendanceStatus;
    absenceNote: string;
  }>;
  budgetItems: Array<{
    category: string;
    itemName: string;
    calculationBasis: string;
    amount: number;
  }>;
  existingPhotos: Array<{
    photoId: string;
    imagePath: string;
    caption: string;
    isCover: boolean;
  }>;
};

/**
 * 수정 화면용 값.
 *
 * getActivityDetail 은 참여자를 이름으로 돌려주므로 폼에서 다시 고를 수 없다.
 * 여기서는 폼이 쓰는 식별자(member_id)를 그대로 돌려준다.
 */
export async function getActivityEditValues(
  activityId: string,
): Promise<ActivityEditValues | null> {
  const [activities, logs, participants, budgets, photos] = await Promise.all([
    readSheet("activities"),
    readSheet("activity_logs"),
    readSheet("activity_participants"),
    readSheet("budget_items"),
    readSheet("photos"),
  ]);

  const activity = activities.find((row) => row.activity_id === activityId);
  if (!activity) return null;

  const log = logs.find((row) => row.activity_id === activityId);

  return {
    activityId,
    sessionNumber: Math.trunc(parseNumber(activity.session_number ?? "", 0)),
    authorMemberId: activity.owner_member_id ?? "",
    topic: activity.topic ?? "",
    objective: activity.objective ?? "",
    expectedEffect: activity.expected_effect ?? "",
    activityDate: activity.activity_date ?? "",
    startTime: activity.start_time ?? "",
    endTime: activity.end_time ?? "",
    location: activity.location ?? "",
    content: log?.content ?? "",
    evaluation: log?.evaluation ?? "",
    participants: participants
      .filter((row) => row.activity_id === activityId)
      .map((row) => ({
        memberId: row.member_id ?? "",
        attendanceStatus: (row.attendance_status ?? "") as AttendanceStatus,
        absenceNote: row.absence_note ?? "",
      })),
    budgetItems: budgets
      .filter((row) => row.activity_id === activityId && row.budget_type === "actual")
      .map((row) => ({
        category: row.category ?? "",
        itemName: row.item_name ?? "",
        calculationBasis: row.calculation_basis ?? "",
        amount: parseNumber(row.amount ?? "", 0),
      })),
    existingPhotos: photos
      .filter((row) => row.activity_id === activityId)
      .sort((a, b) => parseNumber(a.sort_order ?? "", 0) - parseNumber(b.sort_order ?? "", 0))
      .map((row) => ({
        photoId: row.photo_id ?? "",
        imagePath: `/api/photos/${encodeURIComponent(row.drive_file_id ?? "")}`,
        caption: row.caption ?? "",
        isCover: row.is_cover === "TRUE",
      })),
  };
}

/**
 * 활동일지 작성 시 고를 수 있는 참여자 목록.
 *
 * members 시트가 채워지기 전이라도 활동을 기록할 수 있어야 하므로
 * 불참 처리되지 않은 신청자를 후보로 쓴다. 식별자는 application_id 다.
 */
export async function listMemberOptions(): Promise<MemberOption[]> {
  const applicants = await readSheet("applicants");

  return applicants
    .filter((row) => row.application_status !== "불참")
    .map((row) => ({
      memberId: row.application_id ?? "",
      name: row.name ?? "",
      organization: row.organization ?? "",
      position: row.position ?? "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

/** 총 지원금 대비 사용액 집계 (스키마 문서 7.2) */
export async function getBudgetSummary() {
  const [settings, activities, budgets] = await Promise.all([
    getSettings(),
    readSheet("activities"),
    readSheet("budget_items"),
  ]);

  const statusById = new Map(
    activities.map((row) => [row.activity_id ?? "", row.status ?? ""]),
  );

  // 상태로 배타적으로 나눠 신청액과 사용액이 이중으로 차감되지 않게 한다.
  const RESERVED = new Set(["승인", "활동예정", "기록필요", "기록검토중"]);

  let confirmedSpent = 0;
  let reserved = 0;

  for (const row of budgets) {
    const status = statusById.get(row.activity_id ?? "") ?? "";
    const amount = parseNumber(row.amount ?? "", 0);

    if (row.budget_type === "actual" && status === "완료") {
      confirmedSpent += amount;
    } else if (row.budget_type === "planned" && RESERVED.has(status)) {
      reserved += amount;
    }
  }

  return {
    totalBudget: settings.totalBudget,
    confirmedSpent,
    reserved,
    available: settings.totalBudget - confirmedSpent - reserved,
    remaining: settings.totalBudget - confirmedSpent,
  };
}

// ---------------------------------------------------------------------------
// 내부
// ---------------------------------------------------------------------------

async function getMemberNameMap(): Promise<Map<string, string>> {
  const applicants = await readSheet("applicants");
  return new Map(applicants.map((row) => [row.application_id ?? "", row.name ?? ""]));
}

/** ACT-연도-회기. 같은 회기가 이미 있으면 뒤에 일련번호를 붙인다. */
function nextActivityId(
  existing: Awaited<ReturnType<typeof readSheet>>,
  activityDate: string,
  sessionNumber: number,
): string {
  const year = activityDate.slice(0, 4);
  const base = `ACT-${year}-${pad(sessionNumber, 2)}`;

  if (!existing.some((row) => row.activity_id === base)) {
    return base;
  }

  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!existing.some((row) => row.activity_id === candidate)) {
      return candidate;
    }
  }

  return `${base}-${Date.now()}`;
}

function parseParticipants(raw: unknown) {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const record = entry as Record<string, unknown>;
    const memberId = str(record.memberId);
    if (!memberId) return [];

    const status = str(record.attendanceStatus);
    const attendanceStatus: AttendanceStatus = (
      ["참석", "지각", "조퇴", "불참"] as const
    ).includes(status as "참석")
      ? (status as AttendanceStatus)
      : "";

    return [
      {
        memberId,
        planned: record.planned === true || record.planned === "true",
        attendanceStatus,
        absenceNote: str(record.absenceNote).slice(0, 200),
      },
    ];
  });
}

function parseBudgetItems(raw: unknown) {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const record = entry as Record<string, unknown>;

    const itemName = str(record.itemName);
    const calculationBasis = str(record.calculationBasis);
    const amount = Math.trunc(parseNumber(String(record.amount ?? ""), 0));

    // 완전히 빈 줄은 무시한다. 폼에서 빈 줄이 남아도 오류로 처리하지 않는다.
    if (!itemName && !calculationBasis && amount === 0) return [];

    const rawCategory = str(record.category) as BudgetCategory;
    const category: BudgetCategory = BUDGET_CATEGORIES.includes(rawCategory)
      ? rawCategory
      : "기타";

    return [{ category, itemName, calculationBasis, amount }];
  });
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
