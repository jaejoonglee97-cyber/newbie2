"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import type { AttendanceChoice, PollResult } from "@/lib/poll-types";

type Props = {
  result: PollResult;
  memberNames: string[];
  isAdmin?: boolean;
};

export function PollCard({ result, memberNames, isAdmin = false }: Props) {
  const { poll, options, votes, attendanceSummary } = result;
  const formId = useId();
  const router = useRouter();

  const [voterName, setVoterName] = useState("");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceChoice | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDate, setConfirmingDate] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 현재 사용자가 이미 투표했는지
  const myVote = voterName ? votes.find((v) => v.voterName === voterName) : undefined;

  function toggleDate(optionId: string) {
    setSelectedDates((prev) =>
      prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId],
    );
  }

  async function handleVote() {
    if (!voterName) { setMessage("이름을 먼저 선택해 주세요."); return; }

    const selected =
      poll.pollType === "date"
        ? selectedDates
        : selectedAttendance
          ? [selectedAttendance]
          : [];

    if (selected.length === 0) {
      setMessage(poll.pollType === "date" ? "가능한 날짜를 하나 이상 선택해 주세요." : "참석 여부를 선택해 주세요.");
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/polls/${poll.pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterName, selectedOptions: selected }),
      });
      const data = await res.json() as { ok: boolean; message?: string };
      if (data.ok) {
        setSuccess(true);
        router.refresh();
      } else {
        setMessage(data.message ?? "투표에 실패했습니다.");
      }
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm() {
    if (!confirmingDate) { setMessage("확정할 날짜를 선택해 주세요."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/polls/${poll.pollId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", confirmedDate: confirmingDate }),
      });
      const data = await res.json() as { ok: boolean };
      if (data.ok) router.refresh();
    } catch { /* noop */ } finally { setSubmitting(false); }
  }

  async function handleClose() {
    if (!confirm("투표를 마감하시겠습니까?")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/polls/${poll.pollId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close" }),
      });
      const data = await res.json() as { ok: boolean };
      if (data.ok) router.refresh();
    } catch { /* noop */ } finally { setSubmitting(false); }
  }

  const isClosed = poll.status === "closed";
  const isConfirmed = poll.status === "confirmed";
  const totalVoters = votes.length;

  const statusBadge = isConfirmed
    ? { label: "✅ 확정", cls: "bg-success-soft text-success" }
    : isClosed
      ? { label: "마감", cls: "bg-canvas text-ink-muted" }
      : { label: "🗳️ 진행 중", cls: "bg-brand-blue/10 text-brand-blue" };

  return (
    <div className="rounded-[14px] border border-line bg-surface overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge.cls}`}>
              {statusBadge.label}
            </span>
            <span className="text-xs text-ink-muted">
              {poll.pollType === "date" ? "📅 날짜투표" : "✋ 참석투표"}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-bold text-ink">{poll.title}</h3>
          {poll.description ? <p className="mt-1 text-sm text-ink-soft">{poll.description}</p> : null}
          {isConfirmed && poll.confirmedDate ? (
            <p className="mt-2 text-sm font-semibold text-success">
              📌 확정 날짜: {poll.confirmedDate}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 text-xs text-ink-muted">{totalVoters}명 투표</span>
      </div>

      <div className="px-6 pb-6 space-y-5">
        {/* 날짜투표 결과 */}
        {poll.pollType === "date" && (
          <div className="space-y-2">
            {options.map((opt) => {
              const pct = totalVoters > 0 ? Math.round((opt.voterNames.length / totalVoters) * 100) : 0;
              const isTop = options.length > 0 && opt.voterNames.length === Math.max(...options.map(o => o.voterNames.length)) && opt.voterNames.length > 0;
              return (
                <div key={opt.optionId} className={`rounded-lg border p-3 ${isTop && !isClosed && !isConfirmed ? "border-brand-blue/40 bg-brand-blue/5" : "border-line bg-canvas"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-ink">
                      {isTop && !isClosed && !isConfirmed ? "🥇 " : ""}{opt.optionLabel}
                    </span>
                    <span className="text-sm font-bold text-navy">{opt.voterNames.length}명</span>
                  </div>
                  {/* 진행 막대 */}
                  <div className="h-1.5 rounded-full bg-line overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-blue transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {opt.voterNames.length > 0 && (
                    <p className="mt-1.5 text-xs text-ink-muted">{opt.voterNames.join(", ")}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 참석투표 결과 */}
        {poll.pollType === "attendance" && attendanceSummary && (
          <div className="grid grid-cols-3 gap-3">
            <AttendBox
              emoji="✅"
              label="참석"
              names={attendanceSummary.attend}
              color="bg-success-soft text-success"
            />
            <AttendBox
              emoji="❌"
              label="불참"
              names={attendanceSummary.absent}
              color="bg-danger-soft text-danger"
            />
            <AttendBox
              emoji="❓"
              label="미결정"
              names={attendanceSummary.undecided}
              color="bg-canvas text-ink-muted"
            />
          </div>
        )}

        {/* 투표 폼 */}
        {!isClosed && !isConfirmed && (
          <div className="rounded-lg border border-line bg-canvas p-4 space-y-3">
            <p className="text-sm font-bold text-ink">내 투표</p>

            {/* 이름 선택 */}
            <div>
              <label htmlFor={`${formId}-name`} className="text-xs font-semibold text-ink-soft">
                이름 선택 <span className="text-danger" aria-hidden>*</span>
              </label>
              <select
                id={`${formId}-name`}
                value={voterName}
                onChange={(e) => { setVoterName(e.target.value); setSuccess(false); setMessage(null); }}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
              >
                <option value="">내 이름을 선택하세요</option>
                {memberNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {myVote ? (
                <p className="mt-1 text-xs text-ink-muted">
                  이미 투표하셨습니다. 다시 선택하면 덮어씁니다.
                </p>
              ) : null}
            </div>

            {/* 날짜투표 선택 */}
            {poll.pollType === "date" && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-ink-soft">참석 가능한 날짜 (복수 선택 가능)</p>
                {options.map((opt) => (
                  <label
                    key={opt.optionId}
                    className={`flex items-center gap-2.5 cursor-pointer rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      selectedDates.includes(opt.optionId)
                        ? "border-brand-blue/50 bg-brand-blue/5 text-ink"
                        : "border-line bg-surface text-ink-soft hover:border-brand-blue/30"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedDates.includes(opt.optionId)}
                      onChange={() => toggleDate(opt.optionId)}
                      className="h-4 w-4 accent-[#1267AA]"
                    />
                    {opt.optionLabel}
                  </label>
                ))}
              </div>
            )}

            {/* 참석투표 선택 */}
            {poll.pollType === "attendance" && (
              <div className="flex gap-2">
                {(["attend", "absent", "undecided"] as AttendanceChoice[]).map((choice) => {
                  const labels = { attend: "✅ 참석", absent: "❌ 불참", undecided: "❓ 미결정" };
                  return (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setSelectedAttendance(choice)}
                      className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                        selectedAttendance === choice
                          ? "border-brand-blue bg-brand-blue text-white"
                          : "border-line bg-surface text-ink-soft hover:border-brand-blue/40"
                      }`}
                    >
                      {labels[choice]}
                    </button>
                  );
                })}
              </div>
            )}

            {message ? (
              <p className="text-sm font-medium text-danger">{message}</p>
            ) : null}

            {success ? (
              <p className="text-sm font-semibold text-success">투표가 완료되었습니다! 🎉</p>
            ) : (
              <button
                type="button"
                onClick={handleVote}
                disabled={submitting}
                className="w-full rounded-lg bg-brand-blue py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-blue-hover disabled:opacity-60"
              >
                {submitting ? "투표 중..." : "투표하기"}
              </button>
            )}
          </div>
        )}

        {/* 운영자 관리 패널 */}
        {isAdmin && !isClosed && !isConfirmed && (
          <div className="rounded-lg border border-warning/30 bg-warning-soft p-4 space-y-3">
            <p className="text-sm font-bold text-warning">⚙️ 운영자 관리</p>

            {poll.pollType === "date" && options.length > 0 && (
              <div className="flex gap-2 flex-wrap items-end">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-ink-soft">최종 날짜 확정</label>
                  <select
                    value={confirmingDate}
                    onChange={(e) => setConfirmingDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                  >
                    <option value="">날짜 선택</option>
                    {options.map((opt) => (
                      <option key={opt.optionId} value={opt.optionDate}>
                        {opt.optionLabel} ({opt.voterNames.length}명)
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="rounded-lg bg-success px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
                >
                  날짜 확정
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink-soft hover:border-danger/50 hover:text-danger disabled:opacity-60"
            >
              투표 마감
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AttendBox({
  emoji,
  label,
  names,
  color,
}: {
  emoji: string;
  label: string;
  names: string[];
  color: string;
}) {
  return (
    <div className={`rounded-lg p-3 ${color}`}>
      <p className="text-lg font-bold text-center">{emoji}</p>
      <p className="mt-0.5 text-xs font-semibold text-center">{label} {names.length}명</p>
      {names.length > 0 && (
        <p className="mt-1.5 text-xs text-center leading-relaxed opacity-80">
          {names.join(", ")}
        </p>
      )}
    </div>
  );
}
