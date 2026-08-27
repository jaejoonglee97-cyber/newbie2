"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";

import type { MemberOption } from "@/lib/activity-types";
import type { ReportDetail, ReportFieldErrors } from "@/lib/report-types";

type Props = {
  members: MemberOption[];
  existingReport?: ReportDetail | null;
};

export function ReportForm({ members, existingReport }: Props) {
  const router = useRouter();
  const formId = useId();

  const [authorMemberId, setAuthorMemberId] = useState(existingReport?.authorMemberId ?? "");
  const [topic, setTopic] = useState(existingReport?.topic ?? "");
  const [mainContent, setMainContent] = useState(existingReport?.mainContent ?? "");
  const [activityArea, setActivityArea] = useState(existingReport?.activityArea ?? "");
  const [goalAchievement, setGoalAchievement] = useState(existingReport?.goalAchievement ?? "");
  const [benefits, setBenefits] = useState(existingReport?.benefits ?? "");
  const [regrets, setRegrets] = useState(existingReport?.regrets ?? "");
  const [futurePlans, setFuturePlans] = useState(existingReport?.futurePlans ?? "");
  const [impressions, setImpressions] = useState(existingReport?.impressions ?? "");

  const [errors, setErrors] = useState<ReportFieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function clearError(key: keyof ReportFieldErrors) {
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setErrors({});

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorMemberId,
          topic,
          mainContent,
          activityArea,
          goalAchievement,
          benefits,
          regrets,
          futurePlans,
          impressions,
        }),
      });

      const data = (await response.json()) as {
        ok: boolean;
        reportId?: string;
        errors?: ReportFieldErrors;
        message?: string;
      };

      if (data.ok && data.reportId) {
        router.push(`/activities/report/print`);
        return;
      }

      if (data.errors) {
        setErrors(data.errors);
        setMessage("입력값을 확인해 주세요.");
        return;
      }

      setMessage(data.message ?? "저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } catch {
      setMessage("네트워크 오류가 발생했습니다. 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-10">
      {message ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
        >
          {message}
        </p>
      ) : null}

      <Section title="활동 개요">
        <div className="grid gap-6 sm:grid-cols-2">
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
          
          <Field id={`${formId}-area`} label="활동지역" required error={errors.activityArea}>
            <input
              id={`${formId}-area`}
              type="text"
              value={activityArea}
              onChange={(event) => {
                setActivityArea(event.target.value);
                clearError("activityArea");
              }}
              className={inputClass(errors.activityArea)}
              placeholder="예: 서울, 인천 등 소속기관 지역"
            />
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
            placeholder="예: 신입사회복지사 역량강화교육 <뉴비스쿨> 동문회 활동"
          />
        </Field>

        <Field id={`${formId}-main`} label="주요 내용" required error={errors.mainContent}>
          <textarea
            id={`${formId}-main`}
            rows={3}
            value={mainContent}
            onChange={(event) => {
              setMainContent(event.target.value);
              clearError("mainContent");
            }}
            className={inputClass(errors.mainContent)}
            placeholder="예: 스터디 0회, 외부강사 강의 0회, 수퍼비전 0회, 독서모임 0회"
          />
        </Field>
      </Section>

      <Section title="정성적 평가 및 소감">
        <Field
          id={`${formId}-goal`}
          label="활동 목표 대비 달성정도 및 성과"
          required
          error={errors.goalAchievement}
        >
          <textarea
            id={`${formId}-goal`}
            rows={4}
            value={goalAchievement}
            onChange={(event) => {
              setGoalAchievement(event.target.value);
              clearError("goalAchievement");
            }}
            className={inputClass(errors.goalAchievement)}
            placeholder="활동신청서에 작성한 내용을 중심으로 작성해 주세요."
          />
        </Field>

        <Field id={`${formId}-benefits`} label="동문회 활동으로 유익했던 점" required error={errors.benefits}>
          <textarea
            id={`${formId}-benefits`}
            rows={4}
            value={benefits}
            onChange={(event) => {
              setBenefits(event.target.value);
              clearError("benefits");
            }}
            className={inputClass(errors.benefits)}
          />
        </Field>

        <Field
          id={`${formId}-regrets`}
          label="동문회 활동에서 아쉬웠던 점 및 개선방안"
          required
          error={errors.regrets}
        >
          <textarea
            id={`${formId}-regrets`}
            rows={4}
            value={regrets}
            onChange={(event) => {
              setRegrets(event.target.value);
              clearError("regrets");
            }}
            className={inputClass(errors.regrets)}
          />
        </Field>

        <Field id={`${formId}-future`} label="추후 계획" required error={errors.futurePlans}>
          <textarea
            id={`${formId}-future`}
            rows={3}
            value={futurePlans}
            onChange={(event) => {
              setFuturePlans(event.target.value);
              clearError("futurePlans");
            }}
            className={inputClass(errors.futurePlans)}
            placeholder="향후 모임계획, 유지 여부, 기타 계획 등"
          />
        </Field>

        <Field id={`${formId}-impressions`} label="구성원의 소감 한마디" required error={errors.impressions}>
          <textarea
            id={`${formId}-impressions`}
            rows={4}
            value={impressions}
            onChange={(event) => {
              setImpressions(event.target.value);
              clearError("impressions");
            }}
            className={inputClass(errors.impressions)}
            placeholder="모든 구성원 소감을 다 넣어주시면 좋겠습니다. (전반적으로 써주셔도 됩니다.)"
          />
        </Field>
      </Section>

      <div className="flex flex-col gap-3 border-t border-line pt-8 sm:flex-row-reverse sm:items-center sm:justify-start">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-lg bg-brand-blue px-8 py-3.5 text-base font-bold text-white transition-colors hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:bg-ink-muted"
        >
          {submitting ? "저장 중..." : "결과보고서 저장 후 인쇄하기"}
        </button>
        {existingReport ? (
          <Link
            href="/activities/report/print"
            className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-6 py-3.5 text-sm font-semibold text-ink-soft hover:border-brand-blue/50"
          >
            인쇄 화면으로 가기
          </Link>
        ) : null}
        <Link
          href="/activities"
          className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-6 py-3.5 text-sm font-semibold text-ink-soft hover:border-brand-blue/50"
        >
          취소
        </Link>
      </div>
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
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
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
