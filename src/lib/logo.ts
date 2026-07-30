import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";
import { cache } from "react";

/**
 * 중부재단 로고 파일을 찾는다.
 *
 * public/ 아래에 아래 이름 중 하나로 파일을 넣으면 헤더에 자동으로 표시된다.
 * 파일이 없으면 null 을 돌려주고 헤더는 기관명 텍스트로 대체한다.
 * 없는 이미지를 가리켜 깨진 그림이 뜨는 일을 막기 위해 실제 존재 여부를 확인한다.
 *
 * 권장: 배경이 투명한 PNG 또는 SVG. 헤더가 네이비 배경이므로
 * 흰색 또는 밝은 색 버전이 있으면 그쪽이 더 잘 보인다.
 */
const CANDIDATES = [
  "jungbu-foundation-logo-white.svg",
  "jungbu-foundation-logo-white.png",
  "jungbu-foundation-logo.svg",
  "jungbu-foundation-logo.png",
];

export type LogoAsset = {
  src: string;
  /** 흰 배경 로고를 네이비 헤더에 올릴 때 흰 판을 깔아 준다. */
  needsBackdrop: boolean;
};

export const getLogo = cache((): LogoAsset | null => {
  const publicDir = join(process.cwd(), "public");

  for (const fileName of CANDIDATES) {
    if (existsSync(join(publicDir, fileName))) {
      return {
        src: `/${fileName}`,
        needsBackdrop: !fileName.includes("white"),
      };
    }
  }

  return null;
});
