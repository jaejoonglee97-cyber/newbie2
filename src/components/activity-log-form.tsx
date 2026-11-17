"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { PhotoField, type SelectedPhoto } from "./photo-field";
import { BUDGET_CATEGORIES } from "@/lib/activity-types";
import type {
  ActivityLogFieldErrors,
  AttendanceStatus,
  BudgetCategory,
  MemberOption,
} from "@/lib/activity-types";
import { SCORE_LABELS, type SessionFeedback } from "@/lib/feedback-types";
import { formatWon } from "@/lib/format";

/**
 * 수정 모드에서 폼을 채우는 값.
 *
 * 이 값이 있으면 새로 만들지 않고 기존 활동일지를 고친다.
 * 회기 번호는 활동 ID 에 들어 있어 바꿀 수 없으므로 읽기 전용으로 보여준다.
 */
export type ActivityEditInitial = {
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

type Props = {
  members: MemberOption[];
  activityStartDate: string;
  activityEndDate: string;
  nextSessionNumber: number;
  availableBudget: number;
  /**
   * 회차별 만족도 집계.
   *
   * 만족도는 모임이 끝난 자리에서 먼저 받고 활동일지는 나중에 쓴다.
   * 평가를 적을 때 그 회차 응답을 옆에 놓고 볼 수 있게 넘긴다.
   */
  feedbackSummaries?: SessionFeedback[];
  /** 수정 모드일 때만 넘긴다. 없으면 새로 작성한다. */
  initial?: ActivityEditInitial;
};

type ParticipantState = {
  memberId: string;
  selected: boolean;
  attendanceStatus: AttendanceStatus;
  absenceNote: string;
};

type BudgetRow = {
  key: string;
  category: BudgetCategory;
  itemName: string;
  calculationBasis: string;
  amount: string;
};

const ATTENDED: AttendanceStatus[] = ["참석", "지각", "조퇴"];

function newBudgetRow(): BudgetRow {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category: "식비",
    itemName: "",
    calculationBasis: "",
    amount: "",
  };
}

export function ActivityLogForm({
  members,
  activityStartDate,
  activityEndDate,
  nextSessionNumber,
  availableBudget,
  feedbackSummaries = [],
  initial,
}: Props) {
  const router = useRouter();
  const formId = useId();
  const isEditing = initial !== undefined;

  const [sessionNumber, setSessionNumber] = useState(
    String(initial?.sessionNumber ?? nextSessionNumber),
  );
  const sessionFeedback = feedbackSummaries.find(
    (summary) => summary.sessionNumber === Number(sessionNumber),
  );

  const [authorMemberId, setAuthorMemberId] = useState(initial?.authorMemberId ?? "");
  const [topic, setTopic] = useState(initial?.topic ?? "");
  const [objective, setObjective] = useState(initial?.objective ?? "");
  const [expectedEffect, setExpectedEffect] = useState(initial?.expectedEffect ?? "");
  const [activityDate, setActivityDate] = useState(initial?.activityDate ?? "");
  const [startTime, setStartTime] = useState(initial?.startTime || "14:00");
  const [endTime, setEndTime] = useState(initial?.endTime || "17:00");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [evaluation, setEvaluation] = useState(initial?.evaluation ?? "");

  const [participants, setParticipants] = useState<ParticipantState[]>(() => {
    const saved = new Map(
      (initial?.participants ?? []).map((participant) => [participant.memberId, participant]),
    );

    return members.map((member) => {
      const match = saved.get(member.memberId);
      return {
        memberId: member.memberId,
        selected: match !== undefined,
        attendanceStatus: match?.attendanceStatus ?? "",
        absenceNote: match?.absenceNote ?? "",
      };
    });
  });

  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>(() => {
    if (!initial || initial.budgetItems.length === 0) {
      return [newBudgetRow()];
    }

    return initial.budgetItems.map((item) => ({
      ...newBudgetRow(),
      category: (BUDGET_CATEGORIES as readonly string[]).includes(item.category)
        ? (item.category as BudgetCategory)
        : "기타",
      itemName: item.itemName,
      calculationBasis: item.calculationBasis,
      amount: String(item.amount),
    }));
  });

  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);

  /** 수정 모드에서 지우기로 표시한 기존 사진 */
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);

  const [errors, setErrors] = useState<ActivityLogFieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** 사진을 한 장씩 올리는 동안 보여 줄 진행 문구 */
  const [progress, setProgress] = useState<string | null>(null);
  /** 저장은 됐는데 사진 일부가 실패했을 때, 상세 화면으로 가는 길을 보여 준다. */
  const [savedActivityId, setSavedActivityId] = useState<string | null>(null);

  const memberById = useMemo(
    () => new Map(members.map((member) => [member.memberId, member])),
    [members],
  );

  const attendedCount = participants.filter(
    (p) => p.selected && ATTENDED.includes(p.attendanceStatus),
  ).length;

  const budgetTotal = budgetRows.reduce(
    (sum, row) => sum + Math.max(0, Math.trunc(Number(row.amount.replace(/[^\d]/g, "")) || 0)),
    0,
  );

  const overBudget = budgetTotal > availableBudget;

  function clearError(key: keyof ActivityLogFieldErrors) {
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function toggleParticipant(memberId: string, selected: boolean) {
    clearError("participants");
    setParticipants((prev) =>
      prev.map((p) =>
        p.memberId === memberId
          ? {
              ...p,
              selected,
              // 선택하면 기본값을 참석으로 둔다. 해제하면 상태를 비운다.
              attendanceStatus: selected ? p.attendanceStatus || "참석" : "",
              absenceNote: selected ? p.absenceNote : "",
            }
          : p,
      ),
    );
  }

  function setAttendance(memberId: string, attendanceStatus: AttendanceStatus) {
    clearError("participants");
    setParticipants((prev) =>
      prev.map((p) =>
        p.memberId === memberId
          ? {
              ...p,
              attendanceStatus,
              absenceNote: attendanceStatus === "불참" ? p.absenceNote : "",
            }
          : p,
      ),
    );
  }

  function updateBudget(key: string, patch: Partial<BudgetRow>) {
    clearError("budgetItems");
    setBudgetRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setProgress(null);
    setMessage(null);
    setErrors({});

    const selected = participants.filter((p) => p.selected);

    /*
     * 새 사진은 첫 장만 저장 요청에 싣고 나머지는 저장 뒤 한 장씩 보낸다.
     *
     * 한 요청에 몰아 담으면 Vercel 의 요청 크기 한도(4.5MB)를 넘는다.
     * 사진 900KB 가 base64 로 1.2MB 가 되므로 네 장이면 넘고, 그때는 서버가
     * JSON 대신 오류 화면을 돌려줘 원인 없이 "오류"만 뜬다.
     * 대표로 고른 사진을 첫 장으로 둔다. 저장 요청에 실린 사진이 대표가 된다.
     */
    const ordered = [...photos].sort((a, b) => Number(b.isCover) - Number(a.isCover));
    const [firstPhoto, ...laterPhotos] = ordered;

    try {
      const response = await fetch(
        isEditing ? `/api/activities/${encodeURIComponent(initial.activityId)}` : "/api/activities",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionNumber: Number(sessionNumber),
            removedPhotoIds,
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
            participants: selected.map((p) => ({
              memberId: p.memberId,
              planned: true,
              attendanceStatus: p.attendanceStatus,
              absenceNote: p.absenceNote,
            })),
            budgetItems: budgetRows.map((row) => ({
              category: row.category,
              itemName: row.itemName,
              calculationBasis: row.calculationBasis,
              amount: Math.trunc(Number(row.amount.replace(/[^\d]/g, "")) || 0),
            })),
            photos: firstPhoto ? [toPayload(firstPhoto)] : [],
            // 저장 뒤 따로 올릴 장수. 사진 최소 1장 조건을 판단할 때만 쓴다.
            pendingPhotoCount: laterPhotos.length,
          }),
        },
      );

      const data = await readResult<{
        activityId?: string;
        errors?: ActivityLogFieldErrors;
      }>(response);

      if (data.ok && data.activityId) {
        const failedPhotos = await uploadRemainingPhotos(data.activityId, laterPhotos);

        if (failedPhotos > 0) {
          // 활동일지는 저장됐다. 화면을 떠나지 않고 무엇이 남았는지 알린다.
          setPhotos(laterPhotos.slice(laterPhotos.length - failedPhotos));
          setMessage(
            `활동일지는 저장했습니다. 다만 사진 ${failedPhotos}장은 올리지 못했습니다. ` +
              `상세 화면의 수정 버튼에서 다시 추가해 주세요.`,
          );
          setSavedActivityId(data.activityId);
          return;
        }

        router.push(`/activities/${data.activityId}`);
        // 상세 화면이 방금 고친 값을 읽도록 서버 데이터를 다시 받아온다.
        router.refresh();
        return;
      }

      if (data.errors) {
        setErrors(data.errors);
        // 어느 칸이 문제인지 위에서도 바로 보이게 문구를 모아 보여 준다.
        const reasons = Object.values(data.errors).filter(Boolean);
        setMessage(
          reasons.length > 0
            ? `저장하지 못했습니다. ${reasons.join(" / ")}`
            : "입력값을 확인해 주세요.",
        );
        return;
      }

      setMessage(data.message ?? "저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } catch {
      setMessage("네트워크 오류가 발생했습니다. 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  /** 저장 뒤 남은 사진을 한 장씩 올린다. 실패한 장수를 돌려준다. */
  async function uploadRemainingPhotos(
    activityId: string,
    rest: SelectedPhoto[],
  ): Promise<number> {
    let failedCount = 0;

    for (let i = 0; i < rest.length; i += 1) {
      setProgress(`사진 ${i + 2}/${rest.length + 1}장 올리는 중`);

      try {
        const response = await fetch(`/api/activities/${encodeURIComponent(activityId)}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toPayload(rest[i])),
        });
        const result = await readResult(response);
        if (!result.ok) failedCount += 1;
      } catch {
        failedCount += 1;
      }
    }

    return failedCount;
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-10">
      {message ? (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium leading-relaxed text-danger"
        >
          {message}
          {savedActivityId ? (
            <Link
              href={`/activities/${savedActivityId}`}
              className="ml-2 font-bold underline"
            >
              저장된 활동일지 보기
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* 기본 정보 */}
      <Section title="기본 정보" description="활동일지 양식의 머리말에 해당합니다.">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field id={`${formId}-session`} label="회기" required error={errors.sessionNumber}>
            <input
              id={`${formId}-session`}
              type="number"
              min={1}
              max={99}
              value={sessionNumber}
              /* 회기 번호는 활동 ID 에 들어 있어 수정할 수 없다. */
              readOnly={isEditing}
              onChange={(event) => {
                setSessionNumber(event.target.value);
                clearError("sessionNumber");
              }}
              className={`${inputClass(errors.sessionNumber)} ${
                isEditing ? "cursor-not-allowed bg-canvas text-ink-muted" : ""
              }`}
            />
            {isEditing ? (
              <p className="mt-1 text-xs text-ink-muted">회기 번호는 바꿀 수 없습니다.</p>
            ) : null}
          </Field>

          <Field id={`${formId}-author`} label="작성자" required error={errors.authorMemberId}>
            <select
              id={`${formId}-author`}
              value={authorMemberId}
              onChange={(event) => {
                setAuthorMemberId(event.target.value);
                clearError("authorMemberId");
              }}
              className={inputClass(errors.authorMemberId)}
            >
              <option value="">선택해 주세요</option>
              {members.map((member) => (
                <option key={member.memberId} value={member.memberId}>
                  {member.name} · {member.organization}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field id={`${formId}-topic`} label="모임 주제" required error={errors.topic}>
          <input
            id={`${formId}-topic`}
            type="text"
            value={topic}
            onChange={(event) => {
              setTopic(event.target.value);
              clearError("topic");
            }}
            className={inputClass(errors.topic)}
            placeholder="예: 신입사회복지사의 관계 맺기"
          />
        </Field>

        <Field id={`${formId}-objective`} label="모임 목표" required error={errors.objective}>
          <textarea
            id={`${formId}-objective`}
            rows={3}
            value={objective}
            onChange={(event) => {
              setObjective(event.target.value);
              clearError("objective");
            }}
            className={inputClass(errors.objective)}
            placeholder="예: 추천 도서를 읽고 현장 적용 경험을 나눈다."
          />
        </Field>

        <Field
          id={`${formId}-effect`}
          label="기대 효과"
          required
          error={errors.expectedEffect}
        >
          <textarea
            id={`${formId}-effect`}
            rows={3}
            value={expectedEffect}
            onChange={(event) => {
              setExpectedEffect(event.target.value);
              clearError("expectedEffect");
            }}
            className={inputClass(errors.expectedEffect)}
            placeholder="예: 동료 지지체계 형성과 실천역량 향상"
          />
        </Field>

        <div className="grid gap-6 sm:grid-cols-3">
          <Field
            id={`${formId}-date`}
            label="모임 날짜"
            required
            error={errors.activityDate}
            hint={`${activityStartDate} ~ ${activityEndDate}`}
          >
            <input
              id={`${formId}-date`}
              type="date"
              min={activityStartDate}
              max={activityEndDate}
              value={activityDate}
              onChange={(event) => {
                setActivityDate(event.target.value);
                clearError("activityDate");
              }}
              className={inputClass(errors.activityDate)}
            />
          </Field>

          <Field id={`${formId}-start`} label="시작 시각" required error={errors.startTime}>
            <input
              id={`${formId}-start`}
              type="time"
              value={startTime}
              onChange={(event) => {
                setStartTime(event.target.value);
                clearError("startTime");
              }}
              className={inputClass(errors.startTime)}
            />
          </Field>

          <Field id={`${formId}-end`} label="종료 시각" required error={errors.endTime}>
            <input
              id={`${formId}-end`}
              type="time"
              value={endTime}
              onChange={(event) => {
                setEndTime(event.target.value);
                clearError("endTime");
              }}
              className={inputClass(errors.endTime)}
            />
          </Field>
        </div>

        <Field id={`${formId}-location`} label="모임 장소" required error={errors.location}>
          <input
            id={`${formId}-location`}
            type="text"
            value={location}
            onChange={(event) => {
              setLocation(event.target.value);
              clearError("location");
            }}
            className={inputClass(errors.location)}
            placeholder="예: 중부재단 회의실"
          />
        </Field>
      </Section>

      {/* 모임 내용 */}
      <Section title="모임 내용과 평가" description="인쇄물 1페이지 본문에 실립니다.">
        <Field id={`${formId}-content`} label="모임 내용" required error={errors.content}>
          <textarea
            id={`${formId}-content`}
            rows={8}
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              clearError("content");
            }}
            className={inputClass(errors.content)}
            placeholder="무엇을 어떻게 진행했는지 적어 주세요."
          />
        </Field>

        {sessionFeedback ? <FeedbackReference summary={sessionFeedback} /> : null}

        <Field
          id={`${formId}-evaluation`}
          label="모임 평가 및 소감"
          required
          error={errors.evaluation}
        >
          <textarea
            id={`${formId}-evaluation`}
            rows={8}
            value={evaluation}
            onChange={(event) => {
              setEvaluation(event.target.value);
              clearError("evaluation");
            }}
            className={inputClass(errors.evaluation)}
            placeholder="참여자들의 반응과 느낀 점을 적어 주세요."
          />
        </Field>
      </Section>

      {/* 참여자 */}
      <Section title="참여자 및 출석" description="모임에 온 사람을 체크하고 출석 상태를 고릅니다.">
        <p className="rounded-lg bg-canvas px-4 py-3 text-sm font-semibold text-ink-soft">
          현재 실제 참석 {attendedCount}명
        </p>

        {members.length === 0 ? (
          <p className="rounded-lg border border-line bg-canvas px-4 py-6 text-center text-sm text-ink-muted">
            참여자 명단이 비어 있습니다. 먼저 신청자를 접수해 주세요.
          </p>
        ) : (
          <ul className="space-y-2">
            {participants.map((participant) => {
              const member = memberById.get(participant.memberId);
              if (!member) return null;

              return (
                <li
                  key={participant.memberId}
                  className={`rounded-lg border p-3 transition-colors ${
                    participant.selected
                      ? "border-brand-blue/40 bg-brand-blue/5"
                      : "border-line bg-surface"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex flex-1 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={participant.selected}
                        onChange={(event) =>
                          toggleParticipant(participant.memberId, event.target.checked)
                        }
                        className="h-4 w-4 accent-[#1267AA]"
                      />
                      <span>
                        <span className="font-semibold text-ink">{member.name}</span>
                        <span className="ml-2 text-sm text-ink-soft">{member.organization}</span>
                        {member.position ? (
                          <span className="ml-2 text-sm text-ink-muted">{member.position}</span>
                        ) : null}
                      </span>
                    </label>

                    {participant.selected ? (
                      <select
                        value={participant.attendanceStatus}
                        onChange={(event) =>
                          setAttendance(
                            participant.memberId,
                            event.target.value as AttendanceStatus,
                          )
                        }
                        aria-label={`${member.name} 출석 상태`}
                        className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
                      >
                        <option value="참석">참석</option>
                        <option value="지각">지각</option>
                        <option value="조퇴">조퇴</option>
                        <option value="불참">불참</option>
                      </select>
                    ) : null}
                  </div>

                  {participant.selected && participant.attendanceStatus === "불참" ? (
                    <input
                      type="text"
                      value={participant.absenceNote}
                      onChange={(event) =>
                        setParticipants((prev) =>
                          prev.map((p) =>
                            p.memberId === participant.memberId
                              ? { ...p, absenceNote: event.target.value }
                              : p,
                          ),
                        )
                      }
                      placeholder="불참 사유 (선택)"
                      aria-label={`${member.name} 불참 사유`}
                      className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70"
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {errors.participants ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {errors.participants}
          </p>
        ) : null}
      </Section>

      {/* 예산 */}
      <Section title="예산 사용내역" description="활동 후 실제로 사용한 금액을 적어 주세요.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas text-left">
                <th className="px-3 py-2 font-bold text-ink">분류</th>
                <th className="px-3 py-2 font-bold text-ink">항목명</th>
                <th className="px-3 py-2 font-bold text-ink">산출 근거</th>
                <th className="px-3 py-2 text-right font-bold text-ink">금액</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {budgetRows.map((row) => (
                <tr key={row.key} className="border-b border-line">
                  <td className="px-3 py-2">
                    <select
                      value={row.category}
                      onChange={(event) =>
                        updateBudget(row.key, {
                          category: event.target.value as BudgetCategory,
                        })
                      }
                      aria-label="예산 분류"
                      className="w-full rounded-md border border-line bg-surface px-2 py-2"
                    >
                      {BUDGET_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.itemName}
                      onChange={(event) => updateBudget(row.key, { itemName: event.target.value })}
                      placeholder="예: 식비"
                      aria-label="항목명"
                      className="w-full rounded-md border border-line bg-surface px-2 py-2"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.calculationBasis}
                      onChange={(event) =>
                        updateBudget(row.key, { calculationBasis: event.target.value })
                      }
                      placeholder="예: 10명 × 15,000원 (선택)"
                      aria-label="산출 근거"
                      className="w-full rounded-md border border-line bg-surface px-2 py-2"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={row.amount}
                      onChange={(event) => updateBudget(row.key, { amount: event.target.value })}
                      placeholder="105000"
                      aria-label="금액"
                      className="w-full rounded-md border border-line bg-surface px-2 py-2 text-right"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        setBudgetRows((prev) =>
                          prev.length === 1
                            ? [newBudgetRow()]
                            : prev.filter((item) => item.key !== row.key),
                        )
                      }
                      aria-label="이 예산 줄 삭제"
                      className="rounded-md border border-line px-2 py-1.5 text-xs text-ink-soft hover:border-danger/50 hover:text-danger"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="px-3 py-3 text-right font-bold text-ink">
                  합계
                </td>
                <td className="px-3 py-3 text-right font-bold text-navy">
                  {formatWon(budgetTotal)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setBudgetRows((prev) => [...prev, newBudgetRow()])}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink-soft hover:border-brand-blue/50"
          >
            + 예산 항목 추가
          </button>
          <span className="text-sm text-ink-muted">
            가용 예산 {formatWon(availableBudget)}
          </span>
        </div>

        {overBudget ? (
          <p className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
            합계가 가용 예산을 {formatWon(budgetTotal - availableBudget)} 초과합니다. 저장은
            가능하지만 운영자 확인이 필요합니다.
          </p>
        ) : null}

        {errors.budgetItems ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {errors.budgetItems}
          </p>
        ) : null}
      </Section>

      {/* 사진 */}
      <Section title="모임 사진" description="인쇄물 2페이지부터 순서대로 실립니다.">
        {initial && initial.existingPhotos.length > 0 ? (
          <div className="mb-6">
            <p className="text-sm font-bold text-ink">
              이미 올린 사진 ({initial.existingPhotos.length - removedPhotoIds.length}장)
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              지우기로 표시한 사진은 저장할 때 Drive 에서도 함께 지워집니다.
            </p>

            <ul className="mt-3 grid gap-3 sm:grid-cols-3">
              {initial.existingPhotos.map((photo) => {
                const removed = removedPhotoIds.includes(photo.photoId);

                return (
                  <li
                    key={photo.photoId}
                    className={`overflow-hidden rounded-lg border ${
                      removed ? "border-danger/50 bg-danger-soft" : "border-line bg-surface"
                    }`}
                  >
                    <img
                      src={photo.imagePath}
                      alt={photo.caption || "활동 사진"}
                      className={`aspect-[4/3] w-full bg-canvas object-contain ${
                        removed ? "opacity-40" : ""
                      }`}
                      loading="lazy"
                    />
                    <div className="border-t border-line px-3 py-2">
                      <p className="truncate text-xs text-ink-muted">
                        {photo.caption || "설명 없음"}
                      </p>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => {
                          clearError("photos");
                          setRemovedPhotoIds((prev) =>
                            removed
                              ? prev.filter((id) => id !== photo.photoId)
                              : [...prev, photo.photoId],
                          );
                        }}
                        className={`mt-2 w-full rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors ${
                          removed
                            ? "border-line bg-surface text-ink-soft hover:border-brand-blue/50"
                            : "border-line text-ink-soft hover:border-danger/50 hover:text-danger"
                        }`}
                      >
                        {removed ? "되돌리기" : "지우기"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <PhotoField
          photos={photos}
          onChange={(next) => {
            setPhotos(next);
            clearError("photos");
          }}
          error={errors.photos}
          disabled={submitting}
        />
      </Section>

      <div className="flex flex-col gap-3 border-t border-line pt-8 sm:flex-row-reverse sm:items-center sm:justify-start">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-lg bg-brand-blue px-8 py-3.5 text-base font-bold text-white transition-colors hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:bg-ink-muted"
        >
          {submitting
            ? "저장 중..."
            : isEditing
              ? "수정 내용 저장"
              : "활동일지 저장"}
        </button>
        <Link
          href={isEditing ? `/activities/${initial.activityId}` : "/activities"}
          className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-6 py-3.5 text-sm font-semibold text-ink-soft hover:border-brand-blue/50"
        >
          {isEditing ? "취소" : "목록으로"}
        </Link>
      </div>

      {submitting ? (
        <p role="status" className="text-sm text-ink-muted">
          {progress ?? "저장하는 중입니다."} 화면을 닫지 말고 잠시 기다려 주세요.
        </p>
      ) : null}
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-navy">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-bold text-ink">
        {label}{" "}
        {required ? (
          <span className="text-danger">
            <span aria-hidden="true">*</span>
            <span className="sr-only">필수</span>
          </span>
        ) : null}
      </label>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
      <div className="mt-2">{children}</div>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function inputClass(error?: string) {
  return [
    "w-full rounded-lg border bg-surface px-4 py-3 text-base text-ink transition-colors",
    "placeholder:text-ink-muted/70",
    error ? "border-danger" : "border-line hover:border-brand-blue/50",
  ].join(" ");
}

/**
 * 이 회차에 먼저 들어온 만족도 응답.
 *
 * 평가를 적기 직전에 놓는다. 기억에 의존해 쓰는 대신 참여자가 실제로 남긴
 * 말을 보고 쓰게 하려는 것이다. 응답은 익명이라 누가 썼는지는 알 수 없다.
 */
function FeedbackReference({ summary }: { summary: SessionFeedback }) {
  return (
    <details className="rounded-[14px] border border-brand-blue/30 bg-brand-blue/5 p-5">
      <summary className="cursor-pointer text-sm font-bold text-navy">
        {summary.sessionNumber}회기 만족도 {summary.count}명 · 평균 {summary.averageScore}점
        <span className="ml-2 font-medium text-ink-muted">(평가 쓸 때 참고)</span>
      </summary>

      <ul className="mt-4 space-y-1">
        {([5, 4, 3, 2, 1] as const).map((score) => {
          const count = summary.scoreCounts[score];
          const ratio = summary.count > 0 ? (count / summary.count) * 100 : 0;

          return (
            <li key={score} className="flex items-center gap-3 text-xs">
              <span className="w-24 shrink-0 text-ink-muted">
                {score} {SCORE_LABELS[score]}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                <span
                  className="block h-full rounded-full bg-brand-blue"
                  style={{ width: `${ratio}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right font-semibold text-ink-soft">{count}</span>
            </li>
          );
        })}
      </ul>

      {summary.bestParts.length > 0 ? (
        <div className="mt-5">
          <h4 className="text-xs font-bold text-ink-soft">좋았던 점</h4>
          <ul className="mt-2 space-y-1.5">
            {summary.bestParts.map((text, index) => (
              <li key={index} className="rounded-lg bg-surface px-3 py-2 text-sm text-ink">
                {text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.nextWishes.length > 0 ? (
        <div className="mt-5">
          <h4 className="text-xs font-bold text-ink-soft">다음에 해보고 싶은 활동</h4>
          <ul className="mt-2 space-y-1.5">
            {summary.nextWishes.map((text, index) => (
              <li key={index} className="rounded-lg bg-surface px-3 py-2 text-sm text-ink">
                {text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </details>
  );
}

function toPayload(photo: SelectedPhoto) {
  return {
    mimeType: photo.mimeType,
    dataBase64: photo.dataBase64,
    caption: photo.caption,
    isCover: photo.isCover,
  };
}

/**
 * 응답을 읽는다. JSON 이 아니어도 원인을 알 수 있는 문구로 바꿔 돌려준다.
 *
 * 요청이 너무 크거나(413) 시간이 오래 걸리면(504) 우리 코드가 아니라
 * Vercel 이 막는다. 그때는 JSON 이 아닌 화면이 오므로 그대로 읽으면 예외가
 * 나고, 화면에는 원인 없이 "네트워크 오류"만 떴다.
 */
async function readResult<T extends object = object>(
  response: Response,
): Promise<{ ok: boolean; message?: string } & Partial<T>> {
  const text = await response.text();

  try {
    return JSON.parse(text) as { ok: boolean; message?: string } & Partial<T>;
  } catch {
    const byStatus: Record<number, string> = {
      401: "로그인이 풀렸습니다. 다시 로그인한 뒤 저장해 주세요. 입력한 내용은 복사해 두세요.",
      403: "운영자로 로그인해야 저장할 수 있습니다.",
      413: "보내는 내용이 너무 큽니다. 사진 수를 줄여 다시 시도해 주세요.",
      429: "잠시 요청이 몰렸습니다. 1분 뒤 다시 저장해 주세요.",
      504: "저장이 오래 걸려 끊겼습니다. 목록에서 저장됐는지 확인한 뒤 다시 시도해 주세요.",
    };

    return {
      ok: false,
      message:
        byStatus[response.status] ??
        `저장하지 못했습니다. (오류 ${response.status}) 잠시 후 다시 시도해 주세요.`,
    } as { ok: boolean; message?: string } & Partial<T>;
  }
}
