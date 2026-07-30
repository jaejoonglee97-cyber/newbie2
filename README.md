# 뉴비스쿨 2기 동문회 운영 페이지

중부재단 2026년 신입사회복지사 역량강화교육 `<뉴비스쿨>` 2기 동문회 운영 웹페이지.

- 데이터 저장소: Google Sheets + Google Drive
- 호스팅: Vercel
- 프레임워크: Next.js 15 App Router, Tailwind CSS v4

## 화면

| 경로 | 내용 | 접근 |
|---|---|---|
| `/` | 모집 안내. 운영 개요, 활동 취지, 운영 절차, 유의사항 | 공개 |
| `/apply` | 참석 희망 신청. 제출 후 같은 화면에서 접수 안내로 전환 | 공개 |
| `/login` | 동문회 공통 비밀번호 로그인 | 공개 |
| `/cards` | 뉴비스쿨 2기 명함집 | 참여자 |
| `/activities` | 활동 기록 목록, 예산 집계 | 참여자 |
| `/activities/new` | 활동일지 작성 | 참여자 |
| `/activities/[id]` | 활동 상세 | 참여자 |
| `/activities/[id]/print` | A4 인쇄 · PDF 저장 | 참여자 |
| `/admin` | 신청자 명단 (휴대전화 포함) | 운영자 |

접수 완료 안내를 별도 페이지로 만들지 않은 이유는 개인정보를 URL 쿼리로 넘기지 않기 위해서다. 접수번호와 성명이 주소창·브라우저 이력·서버 로그에 남지 않는다.

## 권한

공동 비밀번호 2단 구조다. 20명 규모에 계정 시스템을 만드는 것은 과투자이므로 공유 비밀번호를 쓰되, 비밀번호는 환경변수로만 관리하고 세션 쿠키는 HMAC 으로 서명한다.

| 권한 | 볼 수 있는 것 |
|---|---|
| 비로그인 | 모집 안내, 신청 폼 |
| 참여자 | 명함집, 활동 기록, 활동일지 작성·인쇄 |
| 운영자 | 위 전부 + 신청자 명단과 휴대전화, 공개 미동의 명함 |

운영자 비밀번호를 먼저 판정하므로 두 비밀번호를 같게 설정하면 참여자도 운영자 권한을 받는다. 반드시 다르게 설정한다.

## 수집 항목

| 구분 | 항목 |
|---|---|
| 필수 | 성명, 소속기관, 직책, 휴대전화 |
| 선택 | 명함 이미지 (별도 공개 동의) |

이메일과 참석 의사는 받지 않는다. 소통은 팀 채팅방에서 하고 이메일은 명함으로 공유되므로 개인정보 최소수집 원칙에 따라 제외했다. 신청 자체가 참석 희망 표명이므로 라디오도 두지 않았다. `applicants.attendance_intent` 컬럼은 운영자가 시트에서 불참 처리할 수 있도록 남겨 두고 접수 시에는 항상 `참석희망`으로 기록한다.

## 로컬 실행

```bash
npm install
```

```bash
npm run dev
```

환경변수가 없으면 자동으로 **검증 모드(mock)** 로 동작한다. 가상 데이터로 화면과 저장 흐름을 확인할 수 있고, 화면 상단에 검증 모드임이 표시된다.

## 구축 순서

### 1. Google Sheets 시트 만들기

1. 대상 스프레드시트를 연다.
2. 확장 프로그램 → Apps Script 를 연다.
3. `setup/sheets-setup.gs` 내용을 전부 붙여넣고 저장한다.
4. 함수 목록에서 `setupAll` 을 선택해 실행한다. 최초 실행 시 권한을 승인한다.

시트 9개, 헤더, 첫 행 고정, 필터, 드롭다운, 표시형식, `settings` 초기값, 개인정보 시트 경고형 보호가 한 번에 적용된다.

> **주의**: `setupAll` 은 헤더를 다시 쓰고 남는 열을 지운다. 실제 데이터를 넣은 뒤에 컬럼 구성이 바뀌면 데이터가 어긋날 수 있다. 스키마를 바꿀 때는 실데이터 투입 전에 재실행한다.

이어서 `settings` 시트에서 아래 값을 확인·수정한다.

| key | 확인할 내용 |
|---|---|
| `recruitment_start_at` | 모집 시작 일시 |
| `recruitment_end_at` | 모집 마감 일시. 이 시각이 지나면 신청 폼이 자동으로 닫힌다 |
| `contact_leader_name` | 기장 |
| `contact_vice_leader_name` | 부기장 |
| `team_chat_url` | 팀 채팅방 초대 링크. 접수 완료 화면과 로그인 후 화면에만 노출된다 |
| `privacy_retention_period` | 개인정보 보유·이용 기간. 동의 문구에 그대로 표시된다 |
| `card_folder_id` | 명함 이미지 Drive 폴더 ID |
| `activity_photo_folder_id` | 활동 사진 Drive 폴더 ID. `setupCardUpload` 가 채운다 |

검증용 가상 데이터가 필요하면 `seedDummyData`, 지울 때는 `clearDummyData` 를 실행한다.

### 2. 서비스 계정 발급

1. Google Cloud Console 에서 프로젝트를 만든다.
2. **Google Sheets API** 와 **Google Drive API** 를 사용 설정한다.
3. 서비스 계정을 만들고 JSON 키를 발급받는다.
4. 서비스 계정 이메일을 대상 스프레드시트에 **편집자**로 공유한다.

JSON 키 파일은 저장소에 두지 않는다. `.gitignore` 가 `*service-account*.json` 을 막고 있지만, 애초에 프로젝트 폴더 밖에 보관하는 편이 안전하다.

### 3. 이미지 업로드 엔드포인트 배포

서비스 계정에는 Drive 저장용량이 없어 파일을 직접 만들 수 없다(`Service Accounts do not have storage quota`). Apps Script 를 업로드 창구로 두어 스프레드시트 소유자 계정 용량에 저장한다.

1. `setup/card-upload.gs` 를 같은 Apps Script 프로젝트에 추가한다.
2. 프로젝트 설정 → 스크립트 속성에 `SERVICE_ACCOUNT_EMAIL` 을 넣는다.
3. `setupCardUpload` 를 실행한다. 명함·활동사진 폴더를 만들고, 서비스 계정에 읽기 권한을 주고, `UPLOAD_SECRET` 을 생성해 실행 로그에 출력한다.
4. 배포 → 새 배포 → 유형 **웹 앱**, 실행 계정 **나**, 액세스 권한 **모든 사용자**.
5. 웹 앱 URL 과 `UPLOAD_SECRET` 을 환경변수에 넣는다.

액세스 권한을 "모든 사용자"로 두는 이유는 Vercel 서버가 Google 로그인 없이 호출해야 하기 때문이다. 시크릿이 없는 요청은 스크립트가 거부한다.

이미 명함용으로 배포했다면 파일 내용만 갈아끼우고 `setupCardUpload` 를 다시 실행한 뒤 배포 버전을 갱신하면 된다. 기존 시크릿은 유지된다.

### 4. 환경변수

`.env.local.example` 을 `.env.local` 로 복사해 값을 채운다.

```bash
cp .env.local.example .env.local
```

### 5. 연결 점검

```bash
npm run check:sheets
```

인증, 스프레드시트 접근, 9개 시트와 헤더, `settings` 필수 값, 쓰기 권한을 차례로 확인하고 실패 지점마다 무엇을 고쳐야 하는지 알려준다. 서비스 계정 키는 출력하지 않는다.

### 6. Vercel 배포

1. Vercel 프로젝트를 만들고 이 저장소를 연결한다.
2. Settings → Environment Variables 에 `.env.local.example` 의 모든 항목을 넣는다.
3. Settings → Functions → Function Region 을 **Seoul (icn1)** 로 지정한다.

리전을 서울로 두는 이유는 응답 속도와 함께, 개인정보가 처리되는 위치를 국내로 유지하기 위해서다.

## 실데이터 투입 순서

이 순서를 뒤집지 않는다.

1. 검증 모드(mock)로 화면과 저장 흐름을 확인한다.
2. 시트를 연결한 뒤 `seedDummyData` 의 가상 인물로 접수·조회를 확인한다.
3. 서비스 계정 키가 클라이언트 번들과 저장소에 없는지 확인한다.
4. Vercel 배포본에서 다시 한 번 접수와 활동일지 저장을 확인한다.
5. `clearDummyData` 로 가상 데이터를 지운다.
6. 모집을 공개한다.

## 활동일지 A4 인쇄

`/activities/[id]/print` 는 스키마 문서 6장의 인쇄 규칙을 따른다.

- 1페이지: 문서 제목, 작성자, 모임 일시·장소·주제·목표·기대효과, 모임 내용, 평가·소감, 참여자 명단, 예산 사용내역
- 2페이지 이후: 모임 사진 6장씩. 사진이 많으면 자동으로 다음 페이지로 넘어간다
- `@page A4 portrait`, 여백 15mm, `.no-print` 요소는 인쇄 시 숨김

PDF 로 저장하려면 인쇄 창에서 대상을 "PDF로 저장"으로 바꾼다. 용지 A4, 배율 100%, 배경 그래픽 켜기를 권장한다.

사진이 다 받아지기 전에 인쇄하면 종이에 빈 칸이 찍히므로, 이미지 로딩이 끝날 때까지 인쇄 버튼이 잠긴다.

## 개인정보 관련 구현 사항

- 서비스 계정 키, 업로드 시크릿, 로그인 비밀번호는 서버 전용이다. 관련 모듈은 `server-only` 를 import 하므로 클라이언트에서 import 하면 빌드가 실패한다.
- 모든 경로에 `noindex, nofollow` 를 적용해 검색엔진 수집을 막는다.
- 명함과 활동 사진은 Drive 에서 공개로 바꾸지 않는다. 로그인한 사용자에게만 `/api/cards/[fileId]`, `/api/photos/[fileId]` 프록시로 전달하고, 요청한 파일 ID 가 시트에 등록된 것인지 확인한다.
- 명함은 공개 동의(`card_share_consent`)를 받은 것만 참여자에게 보인다. 운영자는 전부 볼 수 있다.
- 명함집에는 휴대전화를 표시하지 않는다.
- 명함 공개 동의는 수집·이용 동의와 목적이 달라 별도 항목으로 받는다. 명함을 첨부했을 때만 나타난다.
- 접수·저장 API는 오류 상황에서 내부 구조나 입력값을 응답에 담지 않는다.
- 모집 기간은 화면뿐 아니라 서버에서 다시 확인한다. 폼을 우회한 직접 요청도 마감 후에는 거부된다.
- 이미지 형식·용량·장수를 클라이언트와 서버에서 각각 검증한다.

## 확인이 필요한 사항

1. **스프레드시트와 Drive 폴더의 소유 계정.** 현재 개인 계정이다. 명함에는 이름·소속·직책·연락처가, 활동 사진에는 참여자 얼굴이 담긴다. 개인 계정에 당사자 정보를 두면 위탁(개인정보보호법 제26조) 문서 의무를 충족하지 못한다고 해석될 여지가 있다. 배포 전에 중부재단 계정으로 옮기는 것을 권한다. 소유자만 바뀌면 코드는 그대로 동작한다.
2. **개인정보 보유 기간.** `settings.privacy_retention_period` 의 기본값은 임시값이다.
3. **활동 사진 이용 동의 범위.** 현재 활동일지 작성 시 사진 공개 동의를 별도로 받지 않는다. 참여자 촬영물 이용 동의를 운영 정책으로 확정해야 한다.
4. **휴대전화 수집 필요성.** 팀 채팅방 초대에 쓰고 있으나 초대 방식이 바뀌면 재검토한다.

## 알려진 제약

- 접수 API에 요청 빈도 제한이 없다. 서버리스 환경에서는 인스턴스 간 상태가 공유되지 않아 단순 메모리 카운터로는 막히지 않는다. 대량 시도가 우려되면 Vercel WAF 가 필요하다.
- 신청 ID는 같은 날 최대 일련번호에 1을 더해 만든다. 동시 접수가 정확히 겹치면 같은 번호가 나올 수 있다. 하루 수십 건 규모에서는 발생하기 어렵고 시트에서 확인·수정할 수 있다.
- Google Sheets 에는 트랜잭션이 없다. 활동일지 저장은 5개 시트에 순차 기록하므로 중간에 실패하면 일부만 남을 수 있다. `audit_logs` 에서 무엇이 기록됐는지 확인할 수 있다.
- 활동일지는 저장 즉시 완료 상태가 된다. 승인·반려 워크플로는 아직 없다.
- 신청자 상태 변경과 명단 내보내기는 화면에서 할 수 없다. `applicants` 시트에서 `application_status` 를 직접 바꾼다.
- 활동일지 수정·삭제 기능이 없다. 잘못 저장하면 시트에서 직접 고친다.
- 검증 모드 데이터는 OS 임시 폴더 파일에 저장된다. 서버리스에서는 인스턴스 간 공유되지 않으므로 검증 전용이다.
- 한글 본문 글꼴은 시스템 산세리프 스택을 쓴다.

## 중부재단 로고

`public/` 아래에 아래 이름 중 하나로 넣으면 헤더에 자동으로 표시된다. 없으면 기관명 텍스트로 대체된다.

```text
jungbu-foundation-logo-white.svg   (헤더가 네이비라 흰색 버전을 우선 사용)
jungbu-foundation-logo-white.png
jungbu-foundation-logo.svg
jungbu-foundation-logo.png
```

`-white` 가 없는 파일은 흰 배경 판을 깔아 표시한다.

## 폴더 구조

```text
setup/sheets-setup.gs        Google Sheets 구축 Apps Script
setup/card-upload.gs         명함·활동사진 업로드 Web App
scripts/check-sheets.mjs     Sheets 연결 점검
scripts/test-intake.mjs      신청 접수 API 검증
scripts/test-activity-log.mjs 활동일지 저장 API 검증

src/app/                     화면과 API 라우트
src/components/              화면 구성 요소
src/lib/config.ts            서버 전용 설정 판정
src/lib/auth.ts              공동 비밀번호 로그인, 서명 쿠키
src/lib/sheets.ts            Google Sheets REST 접근
src/lib/card-storage.ts      이미지 업로드·읽기 (명함·활동사진)
src/lib/mock-store.ts        검증용 가상 저장소
src/lib/repo.ts              데이터 접근 단일 창구
src/lib/settings.ts          settings 읽기, 모집 상태 판정
src/lib/applicants.ts        신청 검증, 중복 감지, 명함집·명단 조회
src/lib/activity-logs.ts     활동일지 저장·조회, 예산 집계
src/lib/image-compress.ts    브라우저 이미지 압축 (클라이언트 전용)
src/lib/format.ts            한국 시간 기준 날짜·금액 포맷
src/lib/logo.ts              로고 파일 탐색
```

## 명령어

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run check:sheets
```

```bash
node scripts/test-intake.mjs
```

```bash
node --env-file=.env.local scripts/test-activity-log.mjs
```
