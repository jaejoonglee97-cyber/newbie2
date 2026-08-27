"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * 활동일지 삭제 버튼.
 *
 * 되돌릴 수 없는 동작이므로 두 단계를 거친다. 먼저 무엇이 지워지는지 보여주고,
 * 회기와 주제를 확인한 뒤에만 실제로 지운다. 실수로 한 번 누른 것만으로는
 * 지워지지 않는다.
 */
export function DeleteActivityButton({
  activityId,
  sessionNumber,
  topic,
  photoCount,
}: {
  activityId: string;
  sessionNumber: number;
  topic: string;
  photoCount: number;
}) {
  const router = useRouter();

  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/activities/${encodeURIComponent(activityId)}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as {
        ok: boolean;
        photoFilesRemaining?: number;
        message?: string;
      };

      if (data.ok) {
        // 남은 Drive 파일이 있으면 목록에서 알 수 없으므로 여기서 알린다.
        const query =
          data.photoFilesRemaining && data.photoFilesRemaining > 0
            ? `?deleted=${encodeURIComponent(topic)}&photoFilesRemaining=${data.photoFilesRemaining}`
            : `?deleted=${encodeURIComponent(topic)}`;

        router.push(`/activities${query}`);
        router.refresh();
        return;
      }

      setMessage(data.message ?? "삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setDeleting(false);
    } catch {
      setMessage("네트워크 오류가 발생했습니다. 연결을 확인한 뒤 다시 시도해 주세요.");
      setDeleting(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink-soft transition-colors hover:border-danger/60 hover:text-danger"
      >
        삭제
      </button>
    );
  }

  return (
    <div className="w-full rounded-[14px] border border-danger/40 bg-danger-soft p-5">
      <p className="text-sm font-bold text-danger">이 활동일지를 지울까요?</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        <strong className="font-semibold text-ink">
          {sessionNumber}회기 · {topic}
        </strong>
        의 모임 내용, 참여자, 예산 내역
        {photoCount > 0 ? `, 사진 ${photoCount}장` : ""}이 시트에서 지워집니다.{" "}
        <strong className="font-semibold text-ink">되돌릴 수 없습니다.</strong>
      </p>
      <p className="mt-2 text-xs leading-relaxed text-ink-muted">
        누가 언제 지웠는지는 audit_logs 시트에 남습니다. 사진 파일은 Drive 휴지통으로
        옮겨집니다.
      </p>

      {message ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {message}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="inline-flex items-center justify-center rounded-lg bg-danger px-6 py-3 text-sm font-bold text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {deleting ? "지우는 중..." : "영구 삭제"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setMessage(null);
          }}
          disabled={deleting}
          className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink-soft hover:border-brand-blue/50 disabled:opacity-60"
        >
          취소
        </button>
      </div>
    </div>
  );
}
