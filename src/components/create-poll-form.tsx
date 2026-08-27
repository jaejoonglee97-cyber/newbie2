"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import type { PollType } from "@/lib/poll-types";

type Props = {
  memberNames: string[];
};

type OptionRow = { date: string; label: string };

export function CreatePollForm({ memberNames }: Props) {
  const formId = useId();
  const router = useRouter();

  const [pollType, setPollType] = useState<PollType>("date");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [options, setOptions] = useState<OptionRow[]>([
    { date: "", label: "" },
    { date: "", label: "" },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateOption(index: number, field: keyof OptionRow, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, [field]: value } : o)));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        pollType,
        title,
        description,
        createdBy,
        options:
          pollType === "date"
            ? options
                .filter((o) => o.date)
                .map((o) => ({ optionDate: o.date, optionLabel: o.label || o.date }))
            : [],
      };

      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok: boolean; message?: string; errors?: Record<string, string> };

      if (data.ok) {
        router.refresh();
        setTitle("");
        setDescription("");
        setOptions([{ date: "", label: "" }, { date: "", label: "" }]);
      } else {
        setError(
          data.message ??
            Object.values(data.errors ?? {}).join(" / ") ??
            "투표 생성에 실패했습니다.",
        );
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-[14px] border border-line bg-surface p-6 space-y-5">
      <h3 className="text-base font-bold text-ink">+ 새 투표 만들기</h3>

      {/* 투표 유형 */}
      <div className="flex gap-3">
        {(["date", "attendance"] as PollType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setPollType(type)}
            className={`flex-1 rounded-lg border py-2.5 text-sm font-semibold transition-colors ${
              pollType === type
                ? "border-brand-blue bg-brand-blue text-white"
                : "border-line bg-canvas text-ink-soft hover:border-brand-blue/40"
            }`}
          >
            {type === "date" ? "📅 날짜투표" : "✋ 참석투표"}
          </button>
        ))}
      </div>

      {/* 작성자 */}
      <div>
        <label htmlFor={`${formId}-by`} className="text-xs font-semibold text-ink-soft">
          작성자 (운영자)
        </label>
        <select
          id={`${formId}-by`}
          value={createdBy}
          onChange={(e) => setCreatedBy(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
        >
          <option value="">선택하세요</option>
          {memberNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* 제목 */}
      <div>
        <label htmlFor={`${formId}-title`} className="text-xs font-semibold text-ink-soft">
          투표 제목
        </label>
        <input
          id={`${formId}-title`}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            pollType === "date"
              ? "예: 2회기 모임 날짜를 정해요!"
              : "예: 9월 20일 모임 참석 여부를 알려주세요"
          }
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70"
        />
      </div>

      {/* 설명 (선택) */}
      <div>
        <label htmlFor={`${formId}-desc`} className="text-xs font-semibold text-ink-soft">
          추가 설명 (선택)
        </label>
        <input
          id={`${formId}-desc`}
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="예: 오후 2시 ~ 5시 기준입니다"
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70"
        />
      </div>

      {/* 날짜투표 후보 */}
      {pollType === "date" && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink-soft">후보 날짜 목록</p>
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="date"
                value={opt.date}
                onChange={(e) => updateOption(i, "date", e.target.value)}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
              />
              <input
                type="text"
                value={opt.label}
                onChange={(e) => updateOption(i, "label", e.target.value)}
                placeholder="표시 레이블 (예: 10/5 일요일 오후 2시)"
                className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                  className="rounded-lg border border-line px-2 text-xs text-ink-muted hover:text-danger"
                >
                  삭제
                </button>
              )}
            </div>
          ))}
          {options.length < 6 && (
            <button
              type="button"
              onClick={() => setOptions((prev) => [...prev, { date: "", label: "" }])}
              className="text-xs font-semibold text-brand-blue hover:underline"
            >
              + 날짜 추가
            </button>
          )}
        </div>
      )}

      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full rounded-lg bg-brand-blue py-3 text-sm font-bold text-white hover:bg-brand-blue-hover disabled:opacity-60"
      >
        {submitting ? "생성 중..." : "투표 생성하기"}
      </button>
    </div>
  );
}
