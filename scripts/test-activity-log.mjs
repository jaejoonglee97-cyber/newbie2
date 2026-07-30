/**
 * 활동일지 저장 API 검증 스크립트
 *
 * 실행 (dev 서버가 떠 있어야 한다):
 *   node --env-file=.env.local scripts/test-activity-log.mjs
 *
 * 로그인이 필요하므로 .env.local 의 ADMIN_PASSWORD 를 읽어 쓴다.
 * 비밀번호를 이 파일에 적지 않는다.
 *
 * 검증 모드(mock)에서 실행하는 것을 전제로 한다.
 * 여기 쓰인 값은 모두 가상이며 실제 개인정보가 아니다.
 */

const base = process.argv[2] ?? "http://localhost:3000";

/** 1x1 투명 PNG. 실제 사진 대신 형식 검증용으로 쓴다. */
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function login(password) {
  const response = await fetch(`${base}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return response.headers.get("set-cookie")?.split(";")[0];
}

async function listMembers(cookie) {
  // 작성자와 참여자로 쓸 application_id 를 신청자 명단 화면에서 긁어온다.
  const response = await fetch(`${base}/admin`, { headers: { Cookie: cookie } });
  const html = await response.text();
  return [...new Set([...html.matchAll(/APP-\d{8}-\d{4}/g)].map((m) => m[0]))];
}

async function post(path, body, cookie) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json().catch(() => null) };
}

// 비밀번호를 코드에 두지 않는다. .env.local 의 값을 그대로 넘겨 쓴다.
//   node --env-file=.env.local scripts/test-activity-log.mjs
const password = process.env.ADMIN_PASSWORD ?? process.env.ALUMNI_PASSWORD;

if (!password) {
  console.error(
    "ADMIN_PASSWORD 가 없습니다. 아래처럼 실행하세요.\n" +
      "  node --env-file=.env.local scripts/test-activity-log.mjs",
  );
  process.exit(1);
}

const cookie = await login(password);
if (!cookie) {
  console.error("로그인 실패. ADMIN_PASSWORD 값을 확인하세요.");
  process.exit(1);
}

const memberIds = await listMembers(cookie);
console.log(`참여자 후보 ${memberIds.length}명:`, memberIds.join(", "));

if (memberIds.length < 7) {
  console.log(
    `\n주의: 최소 참석 인원(7명) 검증을 통과할 만큼 후보가 없습니다. 부족분은 실패로 나옵니다.\n`,
  );
}

function baseInput(overrides = {}) {
  return {
    sessionNumber: 1,
    authorMemberId: memberIds[0],
    topic: "신입사회복지사의 관계 맺기",
    objective: "추천 도서를 읽고 현장 적용 경험을 나눈다.",
    expectedEffect: "동료 지지체계 형성과 실천역량 향상",
    activityDate: "2026-08-22",
    startTime: "14:00",
    endTime: "17:00",
    location: "중부재단 회의실",
    content:
      "도서 주요 내용을 바탕으로 각자의 현장 사례를 나누고, 관계 맺기에서 어려웠던 순간을 함께 짚었다.",
    evaluation:
      "서로의 경험을 들으며 혼자만의 어려움이 아니었음을 확인했다. 다음 회기에도 사례 나눔을 이어가기로 했다.",
    participants: memberIds.map((id) => ({
      memberId: id,
      planned: true,
      attendanceStatus: "참석",
      absenceNote: "",
    })),
    budgetItems: [
      {
        category: "식비",
        itemName: "식비",
        calculationBasis: `${memberIds.length}명 × 15,000원`,
        amount: memberIds.length * 15000,
      },
      { category: "도서비", itemName: "추천 도서", calculationBasis: "3권 × 18,000원", amount: 54000 },
    ],
    photos: [
      { mimeType: "image/png", dataBase64: TINY_PNG, caption: "도서 토론 진행 모습", isCover: true },
      { mimeType: "image/png", dataBase64: TINY_PNG, caption: "단체 사진", isCover: false },
    ],
    ...overrides,
  };
}

const cases = [
  { label: "정상 저장", body: baseInput(), expect: 201 },
  {
    label: "사진 없음 (필수)",
    body: baseInput({ photos: [], sessionNumber: 2 }),
    expect: 422,
  },
  {
    label: "활동 기간 밖 날짜",
    body: baseInput({ activityDate: "2027-01-15", sessionNumber: 3 }),
    expect: 422,
  },
  {
    label: "종료 시각이 시작보다 이름",
    body: baseInput({ startTime: "17:00", endTime: "14:00", sessionNumber: 4 }),
    expect: 422,
  },
  {
    label: "예산 내역 없음",
    body: baseInput({ budgetItems: [], sessionNumber: 5 }),
    expect: 422,
  },
  {
    label: "참석자 전원 불참",
    body: baseInput({
      sessionNumber: 6,
      participants: memberIds.map((id) => ({
        memberId: id,
        planned: true,
        attendanceStatus: "불참",
        absenceNote: "일정 겹침",
      })),
    }),
    expect: 422,
  },
  {
    label: "모임 내용 너무 짧음",
    body: baseInput({ content: "짧음", sessionNumber: 7 }),
    expect: 422,
  },
];

let failed = 0;
let savedActivityId = null;

for (const testCase of cases) {
  const result = await post("/api/activities", testCase.body, cookie);
  const ok = result.status === testCase.expect;
  if (!ok) failed += 1;

  if (result.json?.activityId) savedActivityId = result.json.activityId;

  console.log(`${ok ? "OK  " : "실패"} [${result.status}] ${testCase.label}`);
  console.log(`     ${JSON.stringify(result.json?.errors ?? result.json)}`);
}

console.log("\n=== 로그인 없이 저장 시도 ===");
const anon = await fetch(`${base}/api/activities`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(baseInput({ sessionNumber: 9 })),
});
console.log(`${anon.status === 401 ? "OK  " : "실패"} [${anon.status}] 401 이어야 함`);
if (anon.status !== 401) failed += 1;

if (savedActivityId) {
  console.log("\n=== 저장된 활동 조회 및 인쇄 화면 ===");
  for (const path of [`/activities/${savedActivityId}`, `/activities/${savedActivityId}/print`]) {
    const response = await fetch(`${base}${path}`, { headers: { Cookie: cookie } });
    console.log(`${response.status === 200 ? "OK  " : "실패"} [${response.status}] ${path}`);
    if (response.status !== 200) failed += 1;
  }
}

console.log("");
if (failed > 0) {
  console.log(`실패 ${failed}건`);
  process.exit(1);
}
console.log("모두 통과");
