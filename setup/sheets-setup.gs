/**
 * 뉴비스쿨 2기 동문회 - Google Sheets 데이터베이스 구축 스크립트
 *
 * 사용법
 *   1. 대상 스프레드시트를 연다.
 *   2. 확장 프로그램 → Apps Script 를 연다.
 *   3. 이 파일 내용을 전부 붙여넣고 저장한다.
 *   4. 함수 목록에서 setupAll 을 선택하고 실행한다.
 *   5. 최초 실행 시 권한 승인 창이 뜨면 승인한다.
 *
 * 이 스크립트는 여러 번 실행해도 안전하다(idempotent).
 * 이미 있는 시트의 데이터는 지우지 않고 헤더와 서식만 다시 맞춘다.
 *
 * 참고 문서: docs/google-sheets-database-schema.md
 */

// ---------------------------------------------------------------------------
// 서식 상수
// ---------------------------------------------------------------------------

/** ID, 전화번호, ISO 날짜시간 문자열 등 Sheets가 자동 변환하면 안 되는 값 */
var TEXT = '@';
/** 금액, 수량 */
var NUMBER = '#,##0';
/** 날짜만 저장하는 컬럼 */
var DATE = 'yyyy-mm-dd';

// ---------------------------------------------------------------------------
// 선택값 정의
// ---------------------------------------------------------------------------

var CHOICES = {
  value_type: ['text', 'number', 'date', 'datetime', 'boolean', 'url'],
  attendance_intent: ['참석희망', '불참'],
  application_status: ['검토중', '참여확정', '대기', '불참'],
  boolean: ['TRUE', 'FALSE'],
  // activity_owner 는 두지 않는다. 회기 담당자는 activities.owner_member_id 로 표현한다.
  role: ['member', 'admin'],
  activity_status: [
    '임시저장',
    '승인대기',
    '반려',
    '승인',
    '활동예정',
    '기록필요',
    '기록검토중',
    '완료',
    '취소',
  ],
  attendance_status: ['참석', '지각', '조퇴', '불참'],
  budget_type: ['planned', 'actual'],
  budget_category: ['식비', '도서비', '강사비', '대관비', '교통비', '재료비', '기타'],
  review_status: ['임시저장', '제출', '보완요청', '완료'],
  entity_type: ['applicant', 'member', 'activity', 'activity_log', 'budget_item', 'photo'],
};

// ---------------------------------------------------------------------------
// 시트 정의
// ---------------------------------------------------------------------------
//
// 각 컬럼: [영문 컬럼명, 표시형식(null 이면 기본), 드롭다운 선택값(없으면 null)]

var SHEETS = [
  {
    name: 'settings',
    columns: [
      ['key', TEXT, null],
      ['value', TEXT, null],
      ['value_type', TEXT, CHOICES.value_type],
      ['description', null, null],
      ['updated_at', TEXT, null],
    ],
  },
  {
    // 이메일과 참석 의사 라디오는 받지 않는다.
    // 소통은 팀 채팅방으로 하고, 이메일은 명함으로 공유되므로
    // 개인정보 최소수집 원칙에 따라 수집 항목에서 뺐다.
    // attendance_intent 컬럼은 운영자가 시트에서 불참 처리할 수 있도록 남겨 두고
    // 접수 시에는 항상 참석희망으로 기록한다.
    name: 'applicants',
    personal: true,
    columns: [
      ['application_id', TEXT, null],
      ['program_id', TEXT, null],
      ['applied_at', TEXT, null],
      ['name', TEXT, null],
      ['organization', TEXT, null],
      ['position', TEXT, null],
      ['phone', TEXT, null],
      ['attendance_intent', TEXT, CHOICES.attendance_intent],
      ['privacy_consent', TEXT, CHOICES.boolean],
      ['privacy_consent_at', TEXT, null],
      ['card_share_consent', TEXT, CHOICES.boolean],
      ['business_card_file_id', TEXT, null],
      ['business_card_url', TEXT, null],
      ['application_status', TEXT, CHOICES.application_status],
      ['admin_note', null, null],
      ['updated_at', TEXT, null],
    ],
  },
  {
    name: 'members',
    personal: true,
    columns: [
      ['member_id', TEXT, null],
      ['program_id', TEXT, null],
      ['application_id', TEXT, null],
      ['name', TEXT, null],
      ['organization', TEXT, null],
      ['position', TEXT, null],
      ['phone', TEXT, null],
      ['email', TEXT, null],
      ['role', TEXT, CHOICES.role],
      ['business_card_file_id', TEXT, null],
      ['business_card_url', TEXT, null],
      ['active', TEXT, CHOICES.boolean],
      ['joined_at', TEXT, null],
      ['updated_at', TEXT, null],
    ],
  },
  {
    name: 'activities',
    columns: [
      ['activity_id', TEXT, null],
      ['program_id', TEXT, null],
      ['session_number', NUMBER, null],
      ['owner_member_id', TEXT, null],
      ['topic', TEXT, null],
      ['objective', null, null],
      ['expected_effect', null, null],
      ['activity_date', DATE, null],
      ['start_time', TEXT, null],
      ['end_time', TEXT, null],
      ['location', TEXT, null],
      ['status', TEXT, CHOICES.activity_status],
      ['submitted_at', TEXT, null],
      ['approved_at', TEXT, null],
      ['approved_by', TEXT, null],
      ['rejection_reason', null, null],
      ['created_at', TEXT, null],
      ['updated_at', TEXT, null],
    ],
  },
  {
    name: 'activity_participants',
    columns: [
      ['activity_participant_id', TEXT, null],
      ['activity_id', TEXT, null],
      ['member_id', TEXT, null],
      ['planned', TEXT, CHOICES.boolean],
      ['attendance_status', TEXT, CHOICES.attendance_status],
      ['absence_note', null, null],
      ['checked_at', TEXT, null],
      ['updated_at', TEXT, null],
    ],
  },
  {
    name: 'budget_items',
    columns: [
      ['budget_item_id', TEXT, null],
      ['activity_id', TEXT, null],
      ['budget_type', TEXT, CHOICES.budget_type],
      ['category', TEXT, CHOICES.budget_category],
      ['item_name', TEXT, null],
      ['calculation_basis', TEXT, null],
      ['quantity', NUMBER, null],
      ['unit_price', NUMBER, null],
      ['amount', NUMBER, null],
      ['evidence_file_url', TEXT, null],
      ['memo', null, null],
      ['created_at', TEXT, null],
      ['updated_at', TEXT, null],
    ],
  },
  {
    name: 'activity_logs',
    columns: [
      ['activity_log_id', TEXT, null],
      ['activity_id', TEXT, null],
      ['author_member_id', TEXT, null],
      ['content', null, null],
      ['evaluation', null, null],
      ['review_status', TEXT, CHOICES.review_status],
      ['review_note', null, null],
      ['submitted_at', TEXT, null],
      ['completed_at', TEXT, null],
      ['completed_by', TEXT, null],
      ['created_at', TEXT, null],
      ['updated_at', TEXT, null],
    ],
  },
  {
    name: 'photos',
    columns: [
      ['photo_id', TEXT, null],
      ['activity_id', TEXT, null],
      ['drive_file_id', TEXT, null],
      ['file_url', TEXT, null],
      ['caption', TEXT, null],
      ['is_cover', TEXT, CHOICES.boolean],
      ['sort_order', NUMBER, null],
      ['uploaded_by', TEXT, null],
      ['uploaded_at', TEXT, null],
    ],
  },
  {
    name: 'audit_logs',
    columns: [
      ['audit_id', TEXT, null],
      ['actor_member_id', TEXT, null],
      ['entity_type', TEXT, CHOICES.entity_type],
      ['entity_id', TEXT, null],
      ['action', TEXT, null],
      ['before_value', TEXT, null],
      ['after_value', TEXT, null],
      ['note', null, null],
      ['created_at', TEXT, null],
    ],
  },
];

// ---------------------------------------------------------------------------
// settings 초기값
// ---------------------------------------------------------------------------
//
// 모집 기간과 문의처는 스키마 문서에 없던 값이다.
// 모집 상태 자동 표시(REC-02)와 모집 페이지 하단 문의처 표기에 필요하다.
// 실제 운영값이 확정되면 시트에서 직접 수정한다.

var SETTINGS_SEED = [
  ['program_id', 'NEWBIE-2026-02', 'text', '프로그램 식별자'],
  ['program_name', '뉴비스쿨 2기 동문회', 'text', '화면과 인쇄물에 표시할 프로그램명'],
  ['cohort', '2', 'number', '기수'],
  ['organization_name', '중부재단', 'text', '주최 기관명'],

  ['recruitment_start_at', '2026-07-30T09:00:00+09:00', 'datetime', '모집 시작 일시'],
  ['recruitment_end_at', '2026-08-04T18:00:00+09:00', 'datetime', '모집 마감 일시'],

  ['activity_start_date', '2026-08-01', 'date', '활동 시작일'],
  ['activity_end_date', '2026-12-31', 'date', '활동 종료일'],

  ['total_budget', '1000000', 'number', '총 지원금'],
  ['minimum_participants', '7', 'number', '활동 신청 최소 참여 예정 인원'],

  // 문의처는 이름과 역할만 공개한다.
  // 기장·부기장 개인 휴대번호를 공개 페이지에 노출하지 않기 위해 전화번호 키를 두지 않았다.
  ['contact_leader_name', '서울특별시사회복지사협회 이재중', 'text', '기장 성명'],
  ['contact_vice_leader_name', '방화11종합사회복지관 맹예림', 'text', '부기장 성명'],
  ['contact_email', 'client_first@sasw.or.kr', 'text', '공식 문의 이메일. 선택'],

  // 팀 채팅방 링크는 공개 페이지에 노출하지 않는다.
  // 접수 완료 화면과 로그인 후 화면에만 표시한다.
  ['team_chat_url', '', 'url', '팀 채팅방 초대 링크'],
  ['team_chat_name', '팀 채팅방', 'text', '채팅방 표시 이름. 예: 카카오톡 오픈채팅'],

  ['privacy_retention_period', '동문회 활동 종료 후 3년', 'text', '개인정보 보유·이용 기간'],
  ['recruitment_notice_url', '', 'url', '모집 안내문 PDF 링크'],

  // 이미지를 보관할 Drive 폴더 ID. Apps Script 업로드 엔드포인트가 사용한다.
  // activity_photo_folder_id 는 비워 두면 setupCardUpload 가 폴더를 만들어 채운다.
  ['card_folder_id', '1o2wNpl_fKi2OxQLnYP0SkTbE2ytRZu5s', 'text', '명함 이미지 Drive 폴더 ID'],
  ['activity_photo_folder_id', '', 'text', '활동 사진 Drive 폴더 ID'],
];

// ---------------------------------------------------------------------------
// 메인
// ---------------------------------------------------------------------------

/** 전체 구축. 이 함수를 실행한다. */
function setupAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var report = [];

  for (var i = 0; i < SHEETS.length; i++) {
    report.push(setupSheet(ss, SHEETS[i], i));
  }

  report.push(seedSettings(ss));
  report.push(protectPersonalDataSheets(ss));

  SpreadsheetApp.flush();
  Logger.log(report.join('\n'));
  return report.join('\n');
}

/** 시트 하나를 생성하고 헤더·서식·드롭다운을 적용한다. */
function setupSheet(ss, spec, position) {
  var sheet = ss.getSheetByName(spec.name);
  var created = false;

  if (!sheet) {
    sheet = ss.insertSheet(spec.name, position);
    created = true;
  }

  var headers = spec.columns.map(function (c) {
    return c[0];
  });
  var colCount = headers.length;

  // 필요한 만큼만 열을 남긴다.
  if (sheet.getMaxColumns() > colCount) {
    sheet.deleteColumns(colCount + 1, sheet.getMaxColumns() - colCount);
  } else if (sheet.getMaxColumns() < colCount) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), colCount - sheet.getMaxColumns());
  }

  // 헤더 입력 및 스타일
  var headerRange = sheet.getRange(1, 1, 1, colCount);
  headerRange.setValues([headers]);
  headerRange
    .setFontWeight('bold')
    .setBackground('#1B1D75')
    .setFontColor('#FFFFFF')
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('left');
  sheet.setRowHeight(1, 32);

  // 첫 행 고정
  sheet.setFrozenRows(1);

  // 필터
  var existingFilter = sheet.getFilter();
  if (existingFilter) {
    existingFilter.remove();
  }
  sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), colCount).createFilter();

  // 컬럼별 표시형식과 드롭다운
  if (sheet.getMaxRows() < 2) {
    sheet.insertRowsAfter(1, 999);
  }
  var lastRow = sheet.getMaxRows();
  for (var c = 0; c < spec.columns.length; c++) {
    var format = spec.columns[c][1];
    var choices = spec.columns[c][2];
    var bodyRange = sheet.getRange(2, c + 1, lastRow - 1, 1);

    if (format) {
      bodyRange.setNumberFormat(format);
    }

    bodyRange.clearDataValidations();
    if (choices) {
      var rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(choices, true)
        .setAllowInvalid(false)
        .setHelpText('허용값: ' + choices.join(', '))
        .build();
      bodyRange.setDataValidation(rule);
    }
  }

  sheet.autoResizeColumns(1, colCount);

  return '[' + (created ? '생성' : '갱신') + '] ' + spec.name + ' (' + colCount + '개 컬럼)';
}

/** settings 시트에 없는 키만 추가한다. 기존 값은 덮어쓰지 않는다. */
function seedSettings(ss) {
  var sheet = ss.getSheetByName('settings');
  var now = nowIso();

  var existing = {};
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (keys[i][0]) {
        existing[String(keys[i][0])] = true;
      }
    }
  }

  var rows = [];
  for (var j = 0; j < SETTINGS_SEED.length; j++) {
    var seed = SETTINGS_SEED[j];
    if (!existing[seed[0]]) {
      rows.push([seed[0], seed[1], seed[2], seed[3], now]);
    }
  }

  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
  }

  return '[settings] 초기값 ' + rows.length + '건 추가, ' + Object.keys(existing).length + '건 유지';
}

/**
 * 개인정보 시트에 경고형 보호를 적용한다.
 *
 * 경고형(warning only)을 쓰는 이유:
 * 편집자를 제한하는 강한 보호를 걸면 웹 앱의 서비스 계정도 쓰기가 막혀
 * 신청 접수가 실패한다. 경고형은 사람이 실수로 셀을 수정할 때 확인창을 띄우고
 * API 쓰기는 통과시킨다.
 *
 * 더 강하게 막으려면 서비스 계정 발급 후 lockPersonalDataSheets 를 쓴다.
 */
function protectPersonalDataSheets(ss) {
  var applied = [];

  for (var i = 0; i < SHEETS.length; i++) {
    if (!SHEETS[i].personal) continue;

    var sheet = ss.getSheetByName(SHEETS[i].name);
    var existing = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    for (var p = 0; p < existing.length; p++) {
      existing[p].remove();
    }

    sheet
      .protect()
      .setDescription(SHEETS[i].name + ' : 개인정보 포함. 수정 주의')
      .setWarningOnly(true);

    applied.push(SHEETS[i].name);
  }

  return '[보호] 경고형 보호 적용: ' + applied.join(', ');
}

/**
 * 개인정보 시트를 서비스 계정과 지정 운영자만 편집할 수 있게 잠근다.
 *
 * 서비스 계정을 발급하고 스프레드시트에 편집자로 공유한 뒤에 실행한다.
 * 실행 전 아래 두 값을 실제 값으로 바꾼다.
 */
function lockPersonalDataSheets() {
  var SERVICE_ACCOUNT_EMAIL = 'CHANGE-ME@CHANGE-ME.iam.gserviceaccount.com';
  var ADMIN_EMAILS = ['CHANGE-ME@example.org'];

  if (SERVICE_ACCOUNT_EMAIL.indexOf('CHANGE-ME') === 0) {
    throw new Error('SERVICE_ACCOUNT_EMAIL 과 ADMIN_EMAILS 를 실제 값으로 수정한 뒤 실행하세요.');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var allowed = [SERVICE_ACCOUNT_EMAIL].concat(ADMIN_EMAILS);

  for (var i = 0; i < SHEETS.length; i++) {
    if (!SHEETS[i].personal) continue;

    var sheet = ss.getSheetByName(SHEETS[i].name);
    var existing = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    for (var p = 0; p < existing.length; p++) {
      existing[p].remove();
    }

    var protection = sheet.protect().setDescription(SHEETS[i].name + ' : 개인정보 포함');
    protection.removeEditors(protection.getEditors());
    protection.addEditors(allowed);
  }

  return '[보호] 편집 제한 적용: ' + allowed.join(', ');
}

// ---------------------------------------------------------------------------
// 더미 데이터
// ---------------------------------------------------------------------------

/**
 * 개발·검증용 가상 데이터를 넣는다.
 * 실제 명단을 넣기 전에 이 데이터로 화면과 접수 흐름을 검증한다.
 * 검증이 끝나면 clearDummyData 로 지운다.
 */
function seedDummyData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = nowIso();
  var programId = 'NEWBIE-2026-02';

  var names = ['가나다', '라마바', '사아자', '차카타', '파하가', '나다라', '마바사', '아자차'];
  var orgs = [
    '테스트종합사회복지관',
    '샘플노인복지관',
    '예시장애인복지관',
    '더미청소년센터',
    '가상지역자활센터',
    '테스트아동센터',
    '샘플가족센터',
    '예시사회복지관',
  ];
  var positions = [
    '사회복지사',
    '선임사회복지사',
    '사례관리자',
    '사회복지사',
    '팀원',
    '사회복지사',
    '주임',
    '사회복지사',
  ];

  var applicants = ss.getSheetByName('applicants');
  var members = ss.getSheetByName('members');
  var applicantRows = [];
  var memberRows = [];

  for (var i = 0; i < names.length; i++) {
    var seq = pad(i + 1, 4);
    var applicationId = 'APP-20260730-' + seq;
    var confirmed = i < 7;
    var phone = '010-0000-' + pad(i + 1, 4);

    applicantRows.push([
      applicationId,
      programId,
      now,
      names[i],
      orgs[i],
      positions[i],
      phone,
      '참석희망',
      'TRUE',
      now,
      'FALSE',
      '',
      '',
      // 승인 절차가 없으므로 신청 = 참여 확정이다.
      '참여확정',
      '더미 데이터',
      now,
    ]);

    if (confirmed) {
      memberRows.push([
        'MEM-' + pad(i + 1, 4),
        programId,
        applicationId,
        names[i],
        orgs[i],
        positions[i],
        phone,
        'dummy' + (i + 1) + '@example.invalid',
        i === 0 ? 'admin' : 'member',
        '',
        '',
        'TRUE',
        now,
        now,
      ]);
    }
  }

  applicants
    .getRange(applicants.getLastRow() + 1, 1, applicantRows.length, applicantRows[0].length)
    .setValues(applicantRows);
  members
    .getRange(members.getLastRow() + 1, 1, memberRows.length, memberRows[0].length)
    .setValues(memberRows);

  return '[더미] 신청자 ' + applicantRows.length + '명, 참여자 ' + memberRows.length + '명 추가';
}

/** 더미 데이터를 포함한 모든 데이터 행을 지운다. settings 는 유지한다. */
function clearDummyData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cleared = [];

  for (var i = 0; i < SHEETS.length; i++) {
    if (SHEETS[i].name === 'settings') continue;

    var sheet = ss.getSheetByName(SHEETS[i].name);
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getMaxColumns()).clearContent();
      cleared.push(SHEETS[i].name + '(' + (lastRow - 1) + '행)');
    }
  }

  return '[초기화] ' + (cleared.length ? cleared.join(', ') : '지울 데이터 없음');
}

// ---------------------------------------------------------------------------
// 상태 정리
// ---------------------------------------------------------------------------

/**
 * 이미 접수된 신청의 '검토중' 상태를 '참여확정'으로 일괄 변경한다.
 *
 * 동문회에는 승인 절차가 없다. 신청하면 그대로 참여가 확정된다.
 * 초기 버전에서 기본값을 '검토중'으로 저장했기 때문에, 그때 접수된 행만
 * 한 번 정리해 주면 된다. 이후 접수분은 처음부터 '참여확정'으로 저장된다.
 *
 * '대기'와 '불참'은 운영자가 의도적으로 지정한 값이므로 건드리지 않는다.
 */
function confirmPendingApplicants() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('applicants');

  if (!sheet) {
    throw new Error('applicants 시트가 없습니다. setupAll 을 먼저 실행하세요.');
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return '[상태 정리] 접수된 신청이 없습니다.';
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var statusColumn = headers.indexOf('application_status') + 1;
  var updatedColumn = headers.indexOf('updated_at') + 1;

  if (statusColumn === 0) {
    throw new Error('application_status 컬럼을 찾지 못했습니다.');
  }

  var statuses = sheet.getRange(2, statusColumn, lastRow - 1, 1).getValues();
  var now = nowIso();
  var changed = 0;

  for (var i = 0; i < statuses.length; i++) {
    if (String(statuses[i][0]).trim() !== '검토중') continue;

    sheet.getRange(i + 2, statusColumn).setValue('참여확정');
    if (updatedColumn > 0) {
      sheet.getRange(i + 2, updatedColumn).setValue(now);
    }
    changed += 1;
  }

  var message = '[상태 정리] 검토중 → 참여확정 ' + changed + '건 변경';
  Logger.log(message);
  return message;
}

// ---------------------------------------------------------------------------
// 유틸
// ---------------------------------------------------------------------------

/** 한국 시간 기준 ISO 8601 문자열 */
function nowIso() {
  return Utilities.formatDate(new Date(), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function pad(n, width) {
  var s = String(n);
  while (s.length < width) {
    s = '0' + s;
  }
  return s;
}
