"use client";

import { useId, useState } from "react";

import { ACCEPTED_IMAGE_MIME, compressImage, type CompressedImage } from "@/lib/image-compress";

export type SelectedPhoto = CompressedImage & {
  /** 목록 안에서 구분하기 위한 임시 키 */
  key: string;
  caption: string;
  isCover: boolean;
};

const MAX_PHOTOS = 12;

type Props = {
  photos: SelectedPhoto[];
  onChange: (photos: SelectedPhoto[]) => void;
  disabled?: boolean;
  error?: string;
};

/**
 * 활동 사진 여러 장 첨부 칸.
 *
 * 촬영과 앨범 선택을 모두 지원하고, 앨범은 여러 장을 한 번에 고를 수 있다.
 * 사진별 설명과 대표 사진 지정을 함께 받는다. (LOG-06, LOG-07)
 */
export function PhotoField({ photos, onChange, disabled, error }: Props) {
  const inputId = useId();

  const [working, setWorking] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null, input: HTMLInputElement) {
    setLocalError(null);
    if (!files || files.length === 0) return;

    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setLocalError(`사진은 최대 ${MAX_PHOTOS}장까지 올릴 수 있습니다.`);
      input.value = "";
      return;
    }

    const picked = Array.from(files).slice(0, room);
    const rejected = Array.from(files).length - picked.length;

    setWorking(true);
    const added: SelectedPhoto[] = [];

    try {
      for (const file of picked) {
        if (!ACCEPTED_IMAGE_MIME.includes(file.type)) continue;

        // 사진은 여러 장이 한 요청에 담기므로 명함보다 작게 줄인다.
        const compressed = await compressImage(file, {
          maxEdge: 1400,
          targetBytes: 900 * 1024,
        });

        added.push({
          ...compressed,
          key: `${Date.now()}-${added.length}-${Math.random().toString(36).slice(2, 8)}`,
          caption: "",
          isCover: false,
        });
      }

      if (added.length === 0) {
        setLocalError("JPG, PNG, WEBP 형식만 올릴 수 있습니다.");
        return;
      }

      const next = [...photos, ...added];
      // 대표 사진이 없으면 첫 장을 대표로 둔다.
      if (!next.some((photo) => photo.isCover)) {
        next[0] = { ...next[0], isCover: true };
      }
      onChange(next);

      if (rejected > 0) {
        setLocalError(`${MAX_PHOTOS}장 제한으로 ${rejected}장은 제외했습니다.`);
      }
    } catch {
      setLocalError("이미지를 처리하지 못했습니다. 다른 사진으로 시도해 주세요.");
    } finally {
      setWorking(false);
      input.value = "";
    }
  }

  function updateCaption(key: string, caption: string) {
    onChange(photos.map((photo) => (photo.key === key ? { ...photo, caption } : photo)));
  }

  function setCover(key: string) {
    onChange(photos.map((photo) => ({ ...photo, isCover: photo.key === key })));
  }

  function remove(key: string) {
    const next = photos.filter((photo) => photo.key !== key);
    if (next.length > 0 && !next.some((photo) => photo.isCover)) {
      next[0] = { ...next[0], isCover: true };
    }
    onChange(next);
    setLocalError(null);
  }

  function move(key: string, direction: -1 | 1) {
    const index = photos.findIndex((photo) => photo.key === key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= photos.length) return;

    const next = [...photos];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  const shownError = error ?? localError;
  const busy = disabled || working;
  const totalKb = Math.round(photos.reduce((sum, photo) => sum + photo.bytes, 0) / 1024);

  return (
    <div>
      <span className="text-sm font-bold text-ink">
        모임 사진 <RequiredMark />
      </span>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
        최소 1장, 최대 {MAX_PHOTOS}장. 인쇄물 2페이지부터 순서대로 실립니다. 대표 사진은 목록에서
        먼저 보입니다.
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
            onChange={(event) => void handleFiles(event.target.files, event.target)}
            className="sr-only"
          />
        </label>

        <label className={fileButtonClass(busy)} htmlFor={`${inputId}-album`}>
          <span aria-hidden="true">🖼️</span>
          앨범에서 선택 (여러 장)
          <input
            id={`${inputId}-album`}
            type="file"
            accept={ACCEPTED_IMAGE_MIME.join(",")}
            multiple
            disabled={busy}
            onChange={(event) => void handleFiles(event.target.files, event.target)}
            className="sr-only"
          />
        </label>
      </div>

      {working ? (
        <p role="status" className="mt-2 text-sm text-ink-muted">
          사진을 준비하고 있습니다...
        </p>
      ) : null}

      {photos.length > 0 ? (
        <>
          <p className="mt-4 text-xs text-ink-muted">
            {photos.length}장 · 합계 약 {totalKb.toLocaleString("ko-KR")}KB
          </p>

          <ul className="mt-2 space-y-3">
            {photos.map((photo, index) => (
              <li
                key={photo.key}
                className="rounded-lg border border-line bg-canvas p-3 sm:flex sm:gap-4"
              >
                <img
                  src={photo.previewUrl}
                  alt={`사진 ${index + 1} 미리보기`}
                  className="h-28 w-full shrink-0 rounded-md bg-surface object-contain sm:w-40"
                />

                <div className="mt-3 flex-1 sm:mt-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-ink">
                      {index + 1}번
                      {photo.isCover ? (
                        <span className="ml-2 rounded-full bg-teal/15 px-2 py-0.5 text-teal">
                          대표
                        </span>
                      ) : null}
                    </span>

                    <span className="flex items-center gap-1">
                      <IconButton
                        label={`사진 ${index + 1} 위로`}
                        onClick={() => move(photo.key, -1)}
                        disabled={index === 0}
                      >
                        ↑
                      </IconButton>
                      <IconButton
                        label={`사진 ${index + 1} 아래로`}
                        onClick={() => move(photo.key, 1)}
                        disabled={index === photos.length - 1}
                      >
                        ↓
                      </IconButton>
                    </span>
                  </div>

                  <input
                    type="text"
                    value={photo.caption}
                    onChange={(event) => updateCaption(photo.key, event.target.value)}
                    placeholder="사진 설명 (예: 도서 토론 진행 모습)"
                    maxLength={200}
                    className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70 hover:border-brand-blue/50"
                  />

                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {!photo.isCover ? (
                      <button
                        type="button"
                        onClick={() => setCover(photo.key)}
                        className="text-xs font-semibold text-brand-blue underline"
                      >
                        대표 사진으로
                      </button>
                    ) : null}
                    <span className="text-xs text-ink-muted">
                      {Math.round(photo.bytes / 1024).toLocaleString("ko-KR")}KB
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(photo.key)}
                      className="ml-auto rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-danger/50 hover:text-danger"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {shownError ? (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {shownError}
        </p>
      ) : null}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink-soft hover:border-brand-blue/50 disabled:opacity-40"
    >
      <span aria-hidden="true">{children}</span>
    </button>
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

function fileButtonClass(disabled: boolean): string {
  return [
    "flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink-soft transition-colors",
    disabled ? "cursor-not-allowed opacity-60" : "hover:border-brand-blue/50 hover:text-brand-blue",
  ].join(" ");
}
