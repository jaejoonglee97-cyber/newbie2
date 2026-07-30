"use client";

import Link from "next/link";
import { useId, useState, type FormEvent, type ReactNode } from "react";

import { CardField, type SelectedCard } from "./card-field";
import { formatDateTime } from "@/lib/format";
import type { ApplicationReceipt, FieldErrors } from "@/lib/types";

type Props = {
  retentionPeriod: string;
  leaderName: string;
  viceLeaderName: string;
  teamChatName: string;
  cardUploadEnabled: boolean;
};

type FormState = {
  name: string;
  organization: string;
  position: string;
  phone: string;
  privacyConsent: boolean;
  cardShareConsent: boolean;
};

const EMPTY: FormState = {
  name: "",
  organization: "",
  position: "",
  phone: "",
  privacyConsent: false,
  cardShareConsent: false,
};

export function ApplyForm({
  retentionPeriod,
  leaderName,
  viceLeaderName,
  teamChatName,
  cardUploadEnabled,
}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [card, setCard] = useState<SelectedCard | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<ApplicationReceipt | null>(null);
  const [honeypot, setHoneypot] = useState("");

  const formId = useId();

  // 접수가 끝나면 폼을 완료 안내로 교체한다.
  // 개인정보를 URL 쿼리로 넘기지 않기 위해 별도 페이지로 이동하지 않는다.
  if (receipt) {
    return (
      <Receipt
        receipt={receipt}
        leaderName={leaderName}
        viceLeaderName={viceLeaderName}
        teamChatName={teamChatName}
      />
    );
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  function handleCardChange(next: SelectedCard | null) {
    setCard(next);
    setErrors((prev) => ({ ...prev, businessCard: undefined, cardShareConsent: undefined }));
    if (!next) {
      setForm((prev) => ({ ...prev, cardShareConsent: false }));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setErrors({});

    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          website: honeypot,
          businessCard: card
            ? { mimeType: card.mimeType, dataBase64: card.dataBase64 }
            : undefined,
        }),
      });

      const data = (await response.json()) as {
        ok: boolean;
        receipt?: ApplicationReceipt;
        errors?: FieldErrors;
        message?: string;
      };

      if (data.ok && data.receipt) {
        setReceipt(data.receipt);
        return;
      }

      if (data.errors) {
        setErrors(data.errors);
        setMessage("입력값을 확인해 주세요.");
        return;
      }

      setMessage(data.message ?? "접수에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } catch {
      setMessage("네트워크 오류가 발생했습니다. 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-7">
      {/* 접수가 끝나면 이 안내도 함께 사라지도록 폼 안에 둔다. */}
      <p className="leading-relaxed text-ink-soft">
        아래 항목을 작성해 주세요. 3분 이내로 마칠 수 있습니다.
      </p>

      {message ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
        >
          {message}
        </p>
      ) : null}

      <Field
        id={`${formId}-name`}
        label="성명"
        required
        error={errors.name}
        input={
          <input
            id={`${formId}-name`}
            type="text"
            autoComplete="name"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            className={inputClass(errors.name)}
            placeholder="예: 김뉴비"
          />
        }
      />

      <Field
        id={`${formId}-organization`}
        label="소속기관"
        required
        error={errors.organization}
        input={
          <input
            id={`${formId}-organization`}
            type="text"
            autoComplete="organization"
            value={form.organization}
            onChange={(event) => update("organization", event.target.value)}
            className={inputClass(errors.organization)}
            placeholder="예: ○○종합사회복지관"
          />
        }
      />

      <Field
        id={`${formId}-position`}
        label="직책"
        required
        error={errors.position}
        input={
          <input
            id={`${formId}-position`}
            type="text"
            autoComplete="organization-title"
            value={form.position}
            onChange={(event) => update("position", event.target.value)}
            className={inputClass(errors.position)}
            placeholder="예: 사회복지사"
          />
        }
      />

      <Field
        id={`${formId}-phone`}
        label="휴대전화"
        required
        error={errors.phone}
        hint={`${teamChatName} 초대와 활동 안내에 사용합니다. 다른 참여자에게 공개되지 않습니다.`}
        input={
          <input
            id={`${formId}-phone`}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
            className={inputClass(errors.phone)}
            placeholder="010-1234-5678"
          />
        }
      />

      {cardUploadEnabled ? (
        <CardField
          value={card}
          onChange={handleCardChange}
          error={errors.businessCard}
          disabled={submitting}
        />
      ) : null}

      <section className="rounded-[14px] border border-line bg-canvas p-5">
        <h2 className="text-sm font-bold text-ink">
          개인정보 수집·이용 동의 <RequiredMark />
        </h2>
        <dl className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
          <Row term="수집 항목" desc="성명, 소속기관, 직책, 휴대전화" />
          <Row term="선택 항목" desc="명함 이미지" />
          <Row
            term="이용 목적"
            desc="동문회 참여자 확정, 활동 일정 안내 및 연락, 동문 명함집 제작"
          />
          <Row term="보유 기간" desc={retentionPeriod} />
          <Row
            term="거부 권리"
            desc="동의를 거부하실 수 있습니다. 다만 이 경우 동문회 참여 신청이 어렵습니다."
          />
        </dl>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg bg-surface px-4 py-3.5">
          <input
            type="checkbox"
            checked={form.privacyConsent}
            onChange={(event) => update("privacyConsent", event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#1267AA]"
          />
          <span className="text-sm font-medium text-ink">
            위 내용을 확인하였으며 개인정보 수집·이용에 동의합니다.
          </span>
        </label>

        {errors.privacyConsent ? (
          <p role="alert" className="mt-2 text-sm font-medium text-danger">
            {errors.privacyConsent}
          </p>
        ) : null}
      </section>

      {/*
        명함 공개는 수집·이용 동의와 목적이 다르므로 별도로 받는다.
        명함을 첨부했을 때만 나타난다.
      */}
      {card ? (
        <section className="rounded-[14px] border border-brand-blue/30 bg-brand-blue/5 p-5">
          <h2 className="text-sm font-bold text-ink">
            명함 공개 동의 <RequiredMark />
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            첨부하신 명함 이미지는 <strong className="font-semibold text-ink">동문회 명함집</strong>
            에서 다른 뉴비스쿨 2기 참여자에게 공개됩니다. 명함에 적힌 연락처와 이메일도 함께
            보이게 됩니다. 공개를 원하지 않으시면 첨부를 취소해 주세요.
          </p>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg bg-surface px-4 py-3.5">
            <input
              type="checkbox"
              checked={form.cardShareConsent}
              onChange={(event) => update("cardShareConsent", event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#1267AA]"
            />
            <span className="text-sm font-medium text-ink">
              명함 이미지가 동문회 참여자에게 공개되는 것에 동의합니다.
            </span>
          </label>

          {errors.cardShareConsent ? (
            <p role="alert" className="mt-2 text-sm font-medium text-danger">
              {errors.cardShareConsent}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* 자동 프로그램 차단용. 사람에게는 보이지 않는다. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={`${formId}-website`}>웹사이트</label>
        <input
          id={`${formId}-website`}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-start">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-lg bg-brand-blue px-8 py-3.5 text-base font-bold text-white transition-colors hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:bg-ink-muted"
        >
          {submitting ? "접수 중..." : "신청 제출하기"}
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-6 py-3.5 text-sm font-semibold text-ink-soft hover:border-brand-blue/50"
        >
          안내 페이지로 돌아가기
        </Link>
      </div>
    </form>
  );
}

/** 접수 완료 안내. (REC-05) */
function Receipt({
  receipt,
  leaderName,
  viceLeaderName,
  teamChatName,
}: {
  receipt: ApplicationReceipt;
  leaderName: string;
  viceLeaderName: string;
  teamChatName: string;
}) {
  const officers = [leaderName, viceLeaderName].filter(Boolean).join("·");

  return (
    <div role="status" className="space-y-6">
      <div className="rounded-[14px] border border-success/30 bg-success-soft px-6 py-8 text-center">
        <p aria-hidden="true" className="text-3xl text-success">
          ✓
        </p>
        <h2 className="mt-3 text-xl font-bold text-ink">신청이 접수되었습니다</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          {receipt.name}님의 참석 희망 의사가 정상적으로 등록되었습니다.
        </p>
      </div>

      <dl className="divide-y divide-line rounded-[14px] border border-line bg-surface px-6">
        <div className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
          <dt className="w-24 shrink-0 text-sm font-medium text-ink-muted">접수번호</dt>
          <dd className="font-mono text-sm font-semibold text-ink">{receipt.applicationId}</dd>
        </div>
        <div className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
          <dt className="w-24 shrink-0 text-sm font-medium text-ink-muted">접수 일시</dt>
          <dd className="text-sm text-ink">{formatDateTime(receipt.appliedAt)}</dd>
        </div>
        <div className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
          <dt className="w-24 shrink-0 text-sm font-medium text-ink-muted">명함</dt>
          <dd className="text-sm text-ink">
            {receipt.cardUploaded ? "등록 완료" : receipt.cardFailed ? "등록 실패" : "미첨부"}
          </dd>
        </div>
        <div className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
          <dt className="w-24 shrink-0 text-sm font-medium text-ink-muted">처리 상태</dt>
          <dd className="text-sm text-ink">검토 중</dd>
        </div>
      </dl>

      {receipt.possibleDuplicate ? (
        <p className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm leading-relaxed text-warning">
          같은 연락처로 접수된 이력이 있습니다. 중복 신청 여부를 운영자가 확인한 뒤
          안내드립니다.
        </p>
      ) : null}

      {receipt.cardFailed ? (
        <p className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm leading-relaxed text-warning">
          신청은 접수되었으나 명함 이미지 저장에 실패했습니다. 신청 자체는 유효하며, 명함은
          기장·부기장이 따로 요청드릴 예정입니다.
        </p>
      ) : null}

      <div className="rounded-[14px] border border-line bg-surface p-6">
        <h3 className="text-sm font-bold text-ink">다음 안내</h3>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
          <li>
            검토 후 참여 확정 결과와 함께 {teamChatName} 초대를 보내드립니다. 동문회 소통은
            채팅방에서 진행합니다.
          </li>
          <li>
            신청 내용을 수정하거나 취소하시려면 접수번호와 함께{" "}
            {officers ? (
              <strong className="font-semibold text-ink">{officers}</strong>
            ) : (
              "기장·부기장"
            )}
            에게 연락해 주세요.
          </li>
          <li>이 화면을 벗어나면 접수번호가 다시 표시되지 않으니 기록해 두시기 바랍니다.</li>
        </ul>
      </div>

      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-6 py-3.5 text-sm font-semibold text-ink-soft hover:border-brand-blue/50"
      >
        안내 페이지로 돌아가기
      </Link>
    </div>
  );
}

function Field({
  id,
  label,
  required,
  hint,
  error,
  input,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  input: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-bold text-ink">
        {label} {required ? <RequiredMark /> : null}
      </label>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-ink-muted">{hint}</p> : null}
      <div className="mt-2">{input}</div>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Row({ term, desc }: { term: string; desc: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-20 shrink-0 font-medium text-ink-muted">{term}</dt>
      <dd>{desc}</dd>
    </div>
  );
}

function RequiredMark() {
  return (
    <span className="text-danger">
      <span aria-hidden="true">*</span>
      <span className="sr-only">필수</span>
    </span>
  );
}

function inputClass(error?: string) {
  return [
    "w-full rounded-lg border bg-surface px-4 py-3 text-base text-ink transition-colors",
    "placeholder:text-ink-muted/70",
    error ? "border-danger" : "border-line hover:border-brand-blue/50",
  ].join(" ");
}
