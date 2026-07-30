/**
 * 브라우저에서 이미지를 줄여 base64 로 만든다.
 *
 * 원본을 그대로 올리면 휴대전화 사진이 수 MB 를 넘어 서버에서 거부된다.
 * 긴 변을 제한하고 JPEG 품질을 낮춰가며 목표 크기 아래로 맞춘다. (PRD 15)
 *
 * 클라이언트 전용 모듈이다. 서버에서 import 하지 않는다.
 */

export const ACCEPTED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"];

export type CompressedImage = {
  /** 서버로 보낼 base64 본문. 접두어(data:...)는 포함하지 않는다. */
  dataBase64: string;
  mimeType: string;
  /** 화면 미리보기용 data URL */
  previewUrl: string;
  bytes: number;
};

export type CompressOptions = {
  /** 긴 변의 최대 픽셀 */
  maxEdge: number;
  /** 목표 상한 바이트 */
  targetBytes: number;
};

export async function compressImage(
  file: File,
  options: CompressOptions,
): Promise<CompressedImage> {
  const bitmap = await loadImage(file);

  const scale = Math.min(1, options.maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("canvas 를 사용할 수 없습니다.");
  }

  // 투명 영역이 검게 나오지 않도록 흰색으로 채운다.
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);

  if ("close" in bitmap && typeof bitmap.close === "function") {
    bitmap.close();
  }

  let dataUrl = "";
  for (const quality of [0.85, 0.75, 0.65, 0.5, 0.4]) {
    dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (estimateBytes(dataUrl) <= options.targetBytes) {
      break;
    }
  }

  return {
    dataBase64: dataUrl.slice(dataUrl.indexOf(",") + 1),
    mimeType: "image/jpeg",
    previewUrl: dataUrl,
    bytes: estimateBytes(dataUrl),
  };
}

export function estimateBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.round((base64.length * 3) / 4);
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }

  // createImageBitmap 이 없는 브라우저를 위한 대체 경로
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
      image.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
