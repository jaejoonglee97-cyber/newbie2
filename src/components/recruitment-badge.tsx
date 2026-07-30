import type { RecruitmentStatus } from "@/lib/types";

/**
 * 모집 상태 배지. (REC-02)
 *
 * 색상만으로 구분하지 않고 기호와 텍스트를 함께 쓴다. (PRD 13.1)
 */
export function RecruitmentBadge({ status }: { status: RecruitmentStatus }) {
  const style = {
    open: { className: "bg-success-soft text-success", mark: "●" },
    before: { className: "bg-warning-soft text-warning", mark: "◐" },
    closed: { className: "bg-canvas text-ink-muted", mark: "○" },
  }[status.phase];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${style.className}`}
    >
      <span aria-hidden="true">{style.mark}</span>
      {status.label}
    </span>
  );
}
