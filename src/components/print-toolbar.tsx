"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * 인쇄 화면 상단 도구 막대.
 *
 * 인쇄 시에는 .no-print 로 숨겨진다.
 *
 * 사진이 다 받아지기 전에 인쇄 창을 띄우면 종이에 빈 칸이 찍힌다.
 * 이미지 로딩이 끝날 때까지 인쇄 버튼을 잠가 둔다.
 */
export function PrintToolbar({ activityId }: { activityId: string }) {
  const [imagesReady, setImagesReady] = useState(false);

  useEffect(() => {
    const images = Array.from(document.querySelectorAll<HTMLImageElement>(".sheet img"));

    if (images.length === 0) {
      setImagesReady(true);
      return;
    }

    let remaining = images.filter((image) => !image.complete).length;
    if (remaining === 0) {
      setImagesReady(true);
      return;
    }

    const done = () => {
      remaining -= 1;
      if (remaining <= 0) setImagesReady(true);
    };

    const pending = images.filter((image) => !image.complete);
    for (const image of pending) {
      image.addEventListener("load", done, { once: true });
      // 실패한 이미지 때문에 영원히 잠기지 않게 오류도 완료로 센다.
      image.addEventListener("error", done, { once: true });
    }

    // 이미지가 응답하지 않는 경우를 위한 최대 대기 시간
    const timer = setTimeout(() => setImagesReady(true), 15_000);

    return () => {
      clearTimeout(timer);
      for (const image of pending) {
        image.removeEventListener("load", done);
        image.removeEventListener("error", done);
      }
    };
  }, []);

  return (
    <div className="no-print sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-[200mm] flex-wrap items-center gap-3 px-5 py-3">
        <Link
          href={`/activities/${activityId}`}
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:border-brand-blue/50"
        >
          ← 상세로
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          disabled={!imagesReady}
          className="rounded-lg bg-brand-blue px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:bg-ink-muted"
        >
          {imagesReady ? "인쇄 · PDF 저장" : "사진 불러오는 중..."}
        </button>

        <p className="text-xs leading-relaxed text-ink-muted">
          인쇄 창에서 <strong className="font-semibold text-ink-soft">대상을 &ldquo;PDF로 저장&rdquo;</strong>
          으로 바꾸면 PDF 파일이 됩니다. 용지 A4, 배율 100%, 배경 그래픽 켜기를 권장합니다.
        </p>
      </div>
    </div>
  );
}
