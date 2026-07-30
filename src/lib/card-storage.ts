import "server-only";

import { getDataSource, getUploadConfig } from "./config";
import { getAccessToken } from "./sheets";
import type { CardUpload } from "./types";

/**
 * 이미지 저장과 읽기. 명함과 활동 사진 모두 여기를 지난다.
 *
 * 저장: Apps Script Web App 을 거친다.
 *   서비스 계정에는 Drive 저장용량이 없어 파일을 직접 만들 수 없다.
 *   Apps Script 는 스프레드시트 소유자 권한으로 실행되므로 소유자 용량에 저장된다.
 *
 * 읽기: 서비스 계정의 drive.readonly 권한으로 바이트를 받아 프록시한다.
 *   파일을 "링크가 있는 모든 사용자"로 공개하지 않는다. 명함에는 연락처가
 *   적혀 있고 활동 사진에는 얼굴이 담기므로 로그인한 사용자에게만 전달한다.
 */

export type UploadKind = "card" | "photo";

export type UploadResult = { fileId: string; fileUrl: string };

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

/** 클라이언트에서 압축한 뒤 넘어오는 값의 상한. Vercel 요청 본문 한계를 고려한다. */
export const MAX_CARD_BYTES = 3 * 1024 * 1024;

export function isAllowedCardMime(mimeType: string): boolean {
  return ALLOWED_MIME.has(mimeType);
}

/**
 * 이미지를 저장한다.
 *
 * 실패해도 예외를 던지지 않고 null 을 돌려준다.
 * 호출하는 쪽에서 실패를 어떻게 다룰지 결정한다.
 */
export async function uploadImage(
  kind: UploadKind,
  ownerId: string,
  name: string,
  upload: CardUpload,
): Promise<UploadResult | null> {
  if (!isAllowedCardMime(upload.mimeType)) {
    return null;
  }

  // 검증 모드에서는 실제 Drive 를 쓰지 않는다.
  if (getDataSource() === "mock") {
    // 같은 활동에 여러 장을 올려도 구분되도록 무작위 꼬리를 붙인다.
    const suffix = Math.random().toString(36).slice(2, 8);
    return { fileId: `mock-${kind}-${ownerId}-${suffix}`, fileUrl: "" };
  }

  const config = getUploadConfig();
  if (!config) {
    return null;
  }

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: config.secret,
        kind,
        // Apps Script 는 명함이면 applicationId, 사진이면 activityId 로 파일명을 만든다.
        applicationId: kind === "card" ? ownerId : undefined,
        activityId: kind === "photo" ? ownerId : undefined,
        name,
        mimeType: upload.mimeType,
        dataBase64: upload.dataBase64,
      }),
      // Apps Script 는 실행이 느릴 수 있어 넉넉하게 둔다.
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      console.error("[card-storage] 업로드 응답 오류", response.status);
      return null;
    }

    const data = (await response.json()) as {
      ok?: boolean;
      fileId?: string;
      fileUrl?: string;
      error?: string;
    };

    if (!data.ok || !data.fileId) {
      console.error("[card-storage] 업로드 실패", data.error ?? "unknown");
      return null;
    }

    return { fileId: data.fileId, fileUrl: data.fileUrl ?? "" };
  } catch (error) {
    console.error("[card-storage] 업로드 중 예외", error);
    return null;
  }
}

/** 명함 업로드. uploadImage 의 얇은 래퍼다. */
export async function uploadCard(
  applicationId: string,
  name: string,
  upload: CardUpload,
): Promise<UploadResult | null> {
  return uploadImage("card", applicationId, name, upload);
}

export type CardImage = { body: ArrayBuffer; contentType: string };

/**
 * 이미지 바이트를 읽는다.
 *
 * 호출하는 쪽에서 반드시 로그인 여부를 먼저 확인해야 한다.
 * 이 함수 자체는 권한을 검사하지 않는다.
 */
export async function fetchCardImage(fileId: string): Promise<CardImage | null> {
  if (getDataSource() === "mock") {
    return { body: placeholderSvg(fileId), contentType: "image/svg+xml" };
  }

  try {
    const token = await getAccessToken();
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error("[card-storage] 이미지 읽기 실패", response.status);
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    if (!isAllowedCardMime(contentType.split(";")[0].trim())) {
      console.error("[card-storage] 허용되지 않는 형식", contentType);
      return null;
    }

    return { body: await response.arrayBuffer(), contentType };
  } catch (error) {
    console.error("[card-storage] 이미지 읽기 중 예외", error);
    return null;
  }
}

/** 검증 모드에서 이미지 자리에 보여줄 대체 이미지 */
function placeholderSvg(seed: string): ArrayBuffer {
  const hue = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
  const isPhoto = seed.includes("-photo-");
  const label = isPhoto ? "활동 사진 자리" : "검증 모드 대체 이미지";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 340">
  <rect width="500" height="340" fill="hsl(${hue} 30% 94%)"/>
  <rect x="1" y="1" width="498" height="338" fill="none" stroke="hsl(${hue} 30% 78%)" stroke-width="2"/>
  <text x="250" y="165" text-anchor="middle" font-family="sans-serif" font-size="22" fill="hsl(${hue} 25% 40%)">${label}</text>
  <text x="250" y="198" text-anchor="middle" font-family="sans-serif" font-size="15" fill="hsl(${hue} 20% 52%)">실제 이미지가 아닙니다</text>
</svg>`;

  return new TextEncoder().encode(svg).buffer as ArrayBuffer;
}
