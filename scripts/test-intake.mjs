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

const valid = {
  name: "가나다",
  organization: "테스트종합사회복지관",
  phone: "01012345678",
  email: "Dummy.One@Example.Invalid",
  attendanceIntent: "참석희망",
  privacyConsent: true,
};

const cases = [
  {
    label: "정상 접수 · 전화번호 정규화와 이메일 소문자화 확인",
    payload: valid,
    expect: 201,
  },
  {
    label: "같은 이메일 재접수 · 중복 감지 표시",
    payload: { ...valid, phone: "01087654321" },
    expect: 201,
  },
  {
    label: "전 항목 검증 실패",
    payload: {
      name: "김",
      organization: "",
      phone: "123",
      email: "not-an-email",
      attendanceIntent: "",
      privacyConsent: false,
    },
    expect: 422,
  },
  {
    label: "개인정보 동의 누락",
    payload: { ...valid, email: "dummy.two@example.invalid", privacyConsent: false },
    expect: 422,
  },
  {
    label: "자동 프로그램 차단칸 채워짐",
    payload: { ...valid, website: "http://spam.example" },
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
  const ok = response.status === testCase.expect;

  if (!ok) failed += 1;

  console.log(`${ok ? "OK  " : "실패"} [${response.status}] ${testCase.label}`);
  if (!ok) {
    console.log(`     기대한 상태코드: ${testCase.expect}`);
  }
  console.log(`     ${JSON.stringify(body.receipt ?? body.errors ?? body)}`);
  console.log();
}

if (failed > 0) {
  console.log(`실패 ${failed}건`);
  process.exit(1);
}

console.log(`${cases.length}건 모두 통과`);
