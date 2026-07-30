/**
 * 이미지 업로드 엔드포인트 (명함 + 활동 사진 공용)
 *
 * 왜 Apps Script 를 쓰는가
 *   서비스 계정에는 Google Drive 저장용량이 없어서 파일을 직접 만들 수 없다.
 *   ("Service Accounts do not have storage quota" 오류)
 *   Apps Script 는 스프레드시트 소유자 권한으로 실행되므로 소유자 용량에 저장되고
 *   파일 소유자도 소유자 본인이 된다.
 *
 * 흐름
 *   신청 폼 / 활동일지 작성 → Next.js API → (공유 시크릿) → 이 Web App → Drive 저장
 *   명함집 · 활동일지 열람 → Next.js API 프록시 → (서비스 계정 읽기) → Drive 파일
 *
 * 파일은 공개로 바꾸지 않는다. 링크를 아는 사람이 볼 수 있게 하면
 * 명함에 적힌 연락처나 활동 사진이 그대로 노출된다. 로그인한 사용자에게만
 * Next.js 프록시를 통해 전달한다.
 *
 * kind 로 저장 위치를 나눈다.
 *   'card'  → 명함 폴더 (settings.card_folder_id)
 *   'photo' → 활동 사진 폴더 (settings.activity_photo_folder_id)
 *
 * 설치 순서
 *   1. sheets-setup.gs 와 같은 Apps Script 프로젝트에 이 파일을 추가한다.
 *   2. 스크립트 속성에 SERVICE_ACCOUNT_EMAIL 을 넣는다.
 *      프로젝트 설정 → 스크립트 속성 → 속성 추가
 *   3. setupCardUpload 를 실행한다.
 *      명함·활동 사진 폴더를 만들고, 서비스 계정에 읽기 권한을 주고, 업로드 시크릿을 생성한다.
 *      실행 로그에 출력된 UPLOAD_SECRET 값을 복사한다.
 *   4. 배포 → 새 배포 → 유형: 웹 앱
 *      실행 계정: 나
 *      액세스 권한: 모든 사용자
 *      배포 후 나오는 웹 앱 URL 을 복사한다.
 *   5. Next.js 환경변수에 넣는다.
 *      APPS_SCRIPT_UPLOAD_URL = 웹 앱 URL
 *      APPS_SCRIPT_UPLOAD_SECRET = UPLOAD_SECRET 값
 *
 * "액세스 권한: 모든 사용자"로 두는 이유는 Vercel 서버가 Google 로그인 없이
 * 호출해야 하기 때문이다. 시크릿이 없는 요청은 이 스크립트가 거부한다.
 *
 * 이미 명함 업로드용으로 설치했다면 이 파일 내용만 갈아끼우고 setupCardUpload 를
 * 다시 실행한 뒤 새 배포(또는 배포 관리에서 버전 갱신)를 하면 된다. 기존
 * UPLOAD_SECRET 은 그대로 유지된다.
 */

var CARD_FOLDER_NAME = '뉴비스쿨 2기 명함';
var PHOTO_FOLDER_NAME = '뉴비스쿨 2기 활동 사진';
var ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
/** 업로드 허용 최대 크기. 클라이언트에서 압축한 뒤 넘어온다. */
var MAX_BYTES = 6 * 1024 * 1024;

var FOLDER_SPEC = {
  card: { settingsKey: 'card_folder_id', folderName: CARD_FOLDER_NAME },
  photo: { settingsKey: 'activity_photo_folder_id', folderName: PHOTO_FOLDER_NAME },
};

// ---------------------------------------------------------------------------
// 설치
// ---------------------------------------------------------------------------

/** 최초 1회 실행. 폴더 생성, 서비스 계정 권한 부여, 시크릿 생성 */
function setupCardUpload() {
  var props = PropertiesService.getScriptProperties();
  var serviceAccount = props.getProperty('SERVICE_ACCOUNT_EMAIL');

  if (!serviceAccount) {
    throw new Error(
      '스크립트 속성에 SERVICE_ACCOUNT_EMAIL 을 먼저 넣으세요. ' +
        '프로젝트 설정 → 스크립트 속성 → 속성 추가',
    );
  }

  var lines = [];
  var kinds = Object.keys(FOLDER_SPEC);

  for (var i = 0; i < kinds.length; i++) {
    var kind = kinds[i];
    var folder = getOrCreateFolder(kind);

    // 서비스 계정이 파일을 읽을 수 있어야 화면에 표시할 수 있다. 쓰기 권한은 주지 않는다.
    try {
      folder.addViewer(serviceAccount);
    } catch (error) {
      Logger.log(kind + ' 폴더 권한 부여 실패. 폴더를 직접 공유하세요: ' + error);
    }

    lines.push(kind + ' 폴더 이름: ' + folder.getName());
    lines.push(kind + ' 폴더 ID: ' + folder.getId());
    lines.push(kind + ' 폴더 URL: ' + folder.getUrl());
    lines.push('');
  }

  var secret = props.getProperty('UPLOAD_SECRET');
  if (!secret) {
    secret = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty('UPLOAD_SECRET', secret);
  }

  lines.push('읽기 권한 부여: ' + serviceAccount);
  lines.push('');
  lines.push('UPLOAD_SECRET = ' + secret);
  lines.push('');
  lines.push('이 시크릿을 Vercel 환경변수 APPS_SCRIPT_UPLOAD_SECRET 에 넣으세요.');
  lines.push('웹 앱 URL 은 배포 후 APPS_SCRIPT_UPLOAD_URL 에 넣으세요.');

  Logger.log(lines.join('\n'));
  return lines.join('\n');
}

/** kind 에 해당하는 폴더를 찾거나 만들고 settings 시트에 폴더 ID 를 기록한다. */
function getOrCreateFolder(kind) {
  var spec = FOLDER_SPEC[kind];
  if (!spec) {
    throw new Error('알 수 없는 kind 입니다: ' + kind);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('settings');

  if (!sheet) {
    throw new Error('settings 시트가 없습니다. sheets-setup.gs 의 setupAll 을 먼저 실행하세요.');
  }

  var lastRow = sheet.getLastRow();
  var values = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, 2).getValues() : [];

  var rowIndex = -1;
  var storedId = '';
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim() === spec.settingsKey) {
      rowIndex = i + 2;
      storedId = String(values[i][1] || '').trim();
      break;
    }
  }

  if (storedId) {
    try {
      return DriveApp.getFolderById(storedId);
    } catch (error) {
      Logger.log('기록된 폴더를 찾지 못해 새로 만듭니다: ' + error);
    }
  }

  var folder = DriveApp.createFolder(spec.folderName);

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 2).setValue(folder.getId());
  } else {
    sheet
      .getRange(sheet.getLastRow() + 1, 1, 1, 5)
      .setValues([[spec.settingsKey, folder.getId(), 'text', spec.folderName + ' Drive 폴더 ID', nowIsoLocal()]]);
  }

  return folder;
}

// ---------------------------------------------------------------------------
// 업로드 엔드포인트
// ---------------------------------------------------------------------------

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: 'empty_body' });
    }

    var request = JSON.parse(e.postData.contents);
    var expected = PropertiesService.getScriptProperties().getProperty('UPLOAD_SECRET');

    if (!expected) {
      return jsonResponse({ ok: false, error: 'not_configured' });
    }

    if (!request.secret || !constantTimeEquals(String(request.secret), expected)) {
      return jsonResponse({ ok: false, error: 'unauthorized' });
    }

    var kind = FOLDER_SPEC[request.kind] ? request.kind : 'card';

    var mimeType = String(request.mimeType || '');
    if (ALLOWED_MIME.indexOf(mimeType) === -1) {
      return jsonResponse({ ok: false, error: 'unsupported_type' });
    }

    var base64 = String(request.dataBase64 || '');
    if (!base64) {
      return jsonResponse({ ok: false, error: 'empty_file' });
    }

    // base64 는 원본의 약 4/3 크기다.
    if ((base64.length * 3) / 4 > MAX_BYTES) {
      return jsonResponse({ ok: false, error: 'too_large' });
    }

    var bytes = Utilities.base64Decode(base64);
    var fileName = buildFileName(request, mimeType);
    var blob = Utilities.newBlob(bytes, mimeType, fileName);

    var folder = getOrCreateFolder(kind);
    var file = folder.createFile(blob);

    // 공개 설정을 바꾸지 않는다. 폴더 권한만 상속한다.

    return jsonResponse({
      ok: true,
      fileId: file.getId(),
      fileName: file.getName(),
      fileUrl: file.getUrl(),
    });
  } catch (error) {
    // 원인은 Apps Script 실행 로그에만 남기고 응답에는 담지 않는다.
    Logger.log('업로드 실패: ' + error);
    return jsonResponse({ ok: false, error: 'internal_error' });
  }
}

/** 배포 확인용. 시크릿이나 목록은 노출하지 않는다. */
function doGet() {
  return jsonResponse({ ok: true, service: 'newbie-file-upload' });
}

// ---------------------------------------------------------------------------
// 유틸
// ---------------------------------------------------------------------------

function buildFileName(request, mimeType) {
  var extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  // 명함은 applicationId, 활동 사진은 activityId 를 넘겨받는다.
  var ownerId = sanitize(request.applicationId || request.activityId) || 'UNKNOWN';
  var name = sanitize(request.name);

  return name ? ownerId + '_' + name + '.' + extension : ownerId + '.' + extension;
}

/** 파일 이름에 쓸 수 없는 문자와 경로 구분자를 제거한다. */
function sanitize(value) {
  return String(value == null ? '' : value)
    .replace(/[\\/:*?"<>|\r\n\t]/g, '')
    .trim()
    .slice(0, 40);
}

/** 시크릿 비교 시 길이·내용에 따른 시간 차이를 줄인다. */
function constantTimeEquals(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  var mismatch = 0;
  for (var i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function nowIsoLocal() {
  return Utilities.formatDate(new Date(), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ssXXX");
}
