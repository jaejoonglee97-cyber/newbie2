/**
 * 참석 희망 신청 접수 API 검증 스크립트
 *
 * 실행 (dev 서버가 떠 있어야 한다):
 *   node scripts/test-intake.mjs
 *   node scripts/test-intake.mjs http://localhost:3000
 *
 * 검증 모드(mock)에서 실행하는 것을 전제로 한다.
 * 실제 시트에 연결된 상태에서 실행하면 시트에 가상 신청이 쌓인다.
 * 그 경우 Apps Script 의 clearDummyData 로 정리한다.
 *
 * 여기 쓰인 값은 모두 가상 인물이며 실제 개인정보가 아니다.
 */

const base = process.argv[2] ?? "http://localhost:3000";
const url = `${base}/api/applications`;

// 이메일과 참석 의사는 수집하지 않는다. 직책이 필수다.
const valid = {
  name: "가나다",
  organization: "테스트종합사회복지관",
  position: "사회복지사",
  phone: "01012345678",
  introduction: "아동 사례관리 2년차입니다.",
  expectation: "동료들과 사례를 나누며 시야를 넓히고 싶습니다.",
  privacyConsent: true,
};

/** 명함 첨부 검증용 1x1 JPEG */
const TINY_JPEG =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDs0NDT/wAALCAABAAEBAREA/8QAFAABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJQA/9k=";

const cases = [
  {
    label: "정상 접수 · 전화번호 정규화, 상태는 참여확정",
    payload: valid,
    expect: 201,
    check: (body) =>
      body.receipt?.possibleDuplicate === false ? null : "중복이 아닌데 중복으로 표시됨",
  },
  {
    label: "같은 연락처 재접수 · 중복 감지 표시",
    payload: { ...valid, name: "라마바" },
    expect: 201,
    check: (body) =>
      body.receipt?.possibleDuplicate === true ? null : "같은 연락처인데 중복 표시가 없음",
  },
  {
    label: "전 항목 검증 실패",
    payload: {
      name: "김",
      organization: "",
      position: "",
      phone: "123",
      expectation: "",
      privacyConsent: false,
    },
    expect: 422,
  },
  {
    label: "직책 누락",
    payload: { ...valid, phone: "01011112222", position: "" },
    expect: 422,
  },
  {
    label: "기대하는 점 누락",
    payload: { ...valid, phone: "01066667777", expectation: "" },
    expect: 422,
  },
  {
    label: "한 줄 소개 없이 접수 (선택 항목)",
    payload: { ...valid, phone: "01077778888", introduction: "" },
    expect: 201,
  },
  {
    label: "개인정보 동의 누락",
    payload: { ...valid, phone: "01022223333", privacyConsent: false },
    expect: 422,
  },
  {
    label: "명함 첨부했으나 공개 동의 없음",
    payload: {
      ...valid,
      phone: "01033334444",
      businessCard: { mimeType: "image/jpeg", dataBase64: TINY_JPEG },
    },
    expect: 422,
  },
  {
    label: "명함 첨부 + 공개 동의",
    payload: {
      ...valid,
      phone: "01044445555",
      cardShareConsent: true,
      businessCard: { mimeType: "image/jpeg", dataBase64: TINY_JPEG },
    },
    expect: 201,
    check: (body) => (body.receipt?.cardUploaded === true ? null : "명함이 저장되지 않음"),
  },
  {
    label: "자동 프로그램 차단칸 채워짐",
    payload: { ...valid, phone: "01055556666", website: "http://spam.example" },
    expect: 400,
  },
];

let failed = 0;

for (const testCase of cases) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(testCase.payload),
  });
  const body = await response.json();
  const statusOk = response.status === testCase.expect;
  const checkError = statusOk && testCase.check ? testCase.check(body) : null;
  const ok = statusOk && !checkError;

  if (!ok) failed += 1;

  console.log(`${ok ? "OK  " : "실패"} [${response.status}] ${testCase.label}`);
  if (!statusOk) {
    console.log(`     기대한 상태코드: ${testCase.expect}`);
  }
  if (checkError) {
    console.log(`     ${checkError}`);
  }
  console.log(`     ${JSON.stringify(body.receipt ?? body.errors ?? body)}`);
  console.log();
}

if (failed > 0) {
  console.log(`실패 ${failed}건`);
  process.exit(1);
}

console.log(`${cases.length}건 모두 통과`);
