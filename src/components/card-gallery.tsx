"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CardEntry } from "@/lib/types";

/**
 * 명함집 목록과 확대 보기.
 *
 * 개별 URL(/cards/APP-...)을 만들지 않는다. 주소가 생기면 채팅방 등으로
 * 옮겨 붙이기 쉬워지고, 명함에는 연락처가 그대로 적혀 있다. 확대 보기는
 * 같은 화면 위에서만 열린다.
 */
export function CardGallery({ entries }: { entries: CardEntry[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);

  const move = useCallback(
    (step: number) => {
      setOpenIndex((current) => {
        if (current === null) return current;
        // 목록 양 끝에서 순환한다.
        return (current + step + entries.length) % entries.length;
      });
    },
    [entries.length],
  );

  return (
    <>
      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry, index) => (
          <li key={entry.applicationId}>
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-haspopup="dialog"
              className="group flex h-full w-full flex-col overflow-hidden rounded-[14px] border border-line bg-surface text-left transition-colors hover:border-brand-blue/60"
            >
              <CardThumb entry={entry} />

              <div className="flex flex-1 flex-col border-t border-line p-4">
                <p className="font-bold text-ink group-hover:text-brand-blue">{entry.name}</p>
                <p className="mt-1 text-sm text-ink-soft">{entry.organization}</p>
                {entry.position ? (
                  <p className="mt-0.5 text-sm text-ink-muted">{entry.position}</p>
                ) : null}

                {entry.introduction ? (
                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-soft">
                    {entry.introduction}
                  </p>
                ) : null}

                <span className="mt-3 text-xs font-semibold text-brand-blue">
                  크게 보기 →
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {openIndex !== null ? (
        <CardDetail
          entry={entries[openIndex]}
          position={openIndex + 1}
          total={entries.length}
          onClose={close}
          onPrev={() => move(-1)}
          onNext={() => move(1)}
        />
      ) : null}
    </>
  );
}

function CardThumb({ entry }: { entry: CardEntry }) {
  if (!entry.cardImagePath) {
    return (
      <div className="flex aspect-[5/3] w-full flex-col items-center justify-center gap-1 bg-canvas">
        <span aria-hidden="true" className="text-2xl font-bold text-ink-muted/60">
          {entry.name.slice(0, 1)}
        </span>
        <span className="text-xs text-ink-muted">명함 미등록</span>
      </div>
    );
  }

  return (
    <img
      src={entry.cardImagePath}
      alt={`${entry.name} 명함`}
      className="aspect-[5/3] w-full bg-canvas object-contain"
      loading="lazy"
    />
  );
}

/** 확대 보기. Esc 로 닫고 좌우 화살표로 다음 사람으로 넘긴다. */
function CardDetail({
  entry,
  position,
  total,
  onClose,
  onPrev,
  onNext,
}: {
  entry: CardEntry;
  position: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onPrev();
      if (event.key === "ArrowRight") onNext();
    }

    document.addEventListener("keydown", handleKey);

    // 뒤 목록이 함께 스크롤되지 않게 막는다.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    closeRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, onPrev, onNext]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${entry.name} 명함 확대 보기`}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/70 p-4 sm:items-center sm:p-8"
      onClick={(event) => {
        // 바깥 어두운 영역을 누르면 닫는다.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-[14px] bg-surface shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <p className="text-xs font-medium text-ink-muted">
            {position} / {total}
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink-soft transition-colors hover:border-danger/50 hover:text-danger"
          >
            닫기
          </button>
        </div>

        <div className="p-5 sm:p-7">
          {entry.cardImagePath ? (
            <img
              src={entry.cardImagePath}
              alt={`${entry.name} 명함`}
              className="mx-auto w-full max-w-2xl rounded-lg border border-line bg-canvas object-contain"
            />
          ) : (
            <div className="flex aspect-[5/3] w-full max-w-2xl mx-auto flex-col items-center justify-center gap-2 rounded-lg border border-line bg-canvas">
              <span aria-hidden="true" className="text-4xl font-bold text-ink-muted/60">
                {entry.name.slice(0, 1)}
              </span>
              <span className="text-sm text-ink-muted">등록된 명함이 없습니다</span>
            </div>
          )}

          <div className="mt-6">
            <h2 className="text-xl font-bold text-navy">{entry.name}</h2>
            <p className="mt-1 text-ink-soft">
              {entry.organization}
              {entry.position ? ` · ${entry.position}` : ""}
            </p>

            {entry.introduction ? (
              <p className="mt-4 border-l-2 border-teal pl-4 leading-relaxed text-ink-soft">
                {entry.introduction}
              </p>
            ) : null}

            {entry.expectation ? (
              <section className="mt-6 rounded-lg bg-canvas p-5">
                <h3 className="text-sm font-bold text-ink">동문회에 기대하는 점</h3>
                <p className="mt-2 whitespace-pre-line leading-relaxed text-ink-soft">
                  {entry.expectation}
                </p>
              </section>
            ) : null}
          </div>
        </div>

        {total > 1 ? (
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
            <button
              type="button"
              onClick={onPrev}
              className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft transition-colors hover:border-brand-blue/50 hover:text-brand-blue"
            >
              ← 이전
            </button>
            <button
              type="button"
              onClick={onNext}
              className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft transition-colors hover:border-brand-blue/50 hover:text-brand-blue"
            >
              다음 →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
