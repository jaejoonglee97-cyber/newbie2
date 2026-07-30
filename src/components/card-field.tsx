"use client";

import { useId, useState } from "react";

import { ACCEPTED_IMAGE_MIME, compressImage, type CompressedImage } from "@/lib/image-compress";

export type SelectedCard = CompressedImage;

type Props = {
  value: SelectedCard | null;
  onChange: (card: SelectedCard | null) => void;
  disabled?: boolean;
  error?: string;
};

/**
 * 명함 이미지 선택 칸.
 *
 * 촬영과 앨범 선택을 나눠 둔다. capture="environment" 는 모바일에서
 * 갤러리 대신 후면 카메라를 바로 연다.
 */
export function CardField({ value, onChange, disabled, error }: Props) {
  const inputId = useId();

  const [working, setWorking] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleFile(file: File | undefined, input: HTMLInputElement) {
    setLocalError(null);

    if (!file) {
      onChange(null);
      return;
    }

    if (!ACCEPTED_IMAGE_MIME.includes(file.type)) {
      setLocalError("JPG, PNG, WEBP 형식만 올릴 수 있습니다.");
      input.value = "";
      return;
    }

    setWorking(true);
    try {
      onChange(await compressImage(file, { maxEdge: 1600, targetBytes: 2 * 1024 * 1024 }));
    } catch {
      setLocalError("이미지를 처리하지 못했습니다. 다른 사진으로 시도해 주세요.");
    } finally {
      setWorking(false);
      // 같은 파일을 다시 골라도 change 가 발생하도록 값을 비운다.
      input.value = "";
    }
  }

  const shownError = error ?? localError;
  const busy = disabled || working;

  return (
    <div>
      <span className="text-sm font-bold text-ink">
        명함 이미지 <span className="text-ink-muted">(선택)</span>
      </span>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
        교육에서 명함을 나누지 못한 분들을 위해 동문 명함집을 만듭니다. 첨부하지 않아도 신청은
        정상 접수됩니다.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className={fileButtonClass(busy)} htmlFor={`${inputId}-camera`}>
          <span aria-hidden="true">📷</span>
          지금 촬영하기
          <input
            id={`${inputId}-camera`}
            type="file"
            accept={ACCEPTED_IMAGE_MIME.join(",")}
            capture="environment"
            disabled={busy}
            onChange={(event) => void handleFile(event.target.files?.[0], event.target)}
            className="sr-only"
          />
        </label>

        <label className={fileButtonClass(busy)} htmlFor={`${inputId}-album`}>
          <span aria-hidden="true">🖼️</span>
          앨범에서 선택
          <input
            id={`${inputId}-album`}
            type="file"
            accept={ACCEPTED_IMAGE_MIME.join(",")}
            disabled={busy}
            onChange={(event) => void handleFile(event.target.files?.[0], event.target)}
            className="sr-only"
          />
        </label>
      </div>

      {working ? (
        <p role="status" className="mt-2 text-sm text-ink-muted">
          이미지를 준비하고 있습니다...
        </p>
      ) : null}

      {value ? (
        <div className="mt-4 rounded-lg border border-line bg-canvas p-4">
          <img
            src={value.previewUrl}
            alt="선택한 명함 미리보기"
            className="mx-auto max-h-48 w-auto rounded-md bg-surface object-contain"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-ink-muted">
              {Math.round(value.bytes / 1024).toLocaleString("ko-KR")}KB 로 압축됨
            </span>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setLocalError(null);
              }}
              className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-danger/50 hover:text-danger"
            >
              첨부 취소
            </button>
          </div>
        </div>
      ) : null}

      {shownError ? (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {shownError}
        </p>
      ) : null}
    </div>
  );
}

function fileButtonClass(disabled: boolean): string {
  return [
    "flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink-soft transition-colors",
    disabled ? "cursor-not-allowed opacity-60" : "hover:border-brand-blue/50 hover:text-brand-blue",
  ].join(" ");
}
