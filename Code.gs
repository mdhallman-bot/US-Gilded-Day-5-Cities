/**
 * DAY 5 — LUCIA'S DIARY: save/resume backend
 *
 * SETUP (no spreadsheet ID to paste):
 * 1. Open https://script.google.com in your SCHOOL Google account.
 * 2. New project; name it "Day 5 — Lucia Responses".
 * 3. Replace Code.gs with this entire file. Save.
 * 4. Select setupDay5 in the function menu and click Run. Authorize it.
 *    Execution log prints the URL of the new, private response spreadsheet.
 *    Running setup again reuses the same spreadsheet.
 * 5. Deploy > New deployment > gear icon > Web app.
 *    Execute as: Me. Who has access: Anyone.
 *    If school policy does not offer Anyone, stop and tell me what it offers.
 *    Keep the response spreadsheet private; do NOT publish it or share publicly.
 * 6. Deploy. Copy the Web app URL ending /exec and send it back here.
 *    The lesson HTML will be connected after you supply that URL.
 *
 * CONTRACT FOR THE LATER HTML INTEGRATION:
 * Cross-origin HTML FORM POST into a hidden iframe. One field, payload, contains
 * JSON. Server returns an HTML page that postMessages the result to clientOrigin.
 * Do not use an opaque no-cors fetch response as evidence that a save succeeded.
 * Wait for message type lucia-day5-response with the matching requestId.
 * Verify the unpredictable requestId and a Google script response origin. The Apps Script
 * HTML response runs inside a nested Google script.googleusercontent.com frame.
 * Its source is NOT the outer iframe; window.top delivers the reply to the lesson.
 * Send one request at a time; debounce saves; retry the SAME payload/requestId.
 *
 * payload = {
 *   action: 'save' | 'load', lesson: 'lucia-day5-v1',
 *   alias: 'cedar-482',
 *   accessKey: <32–128 hex characters generated with crypto.getRandomValues>,
 *   requestId: <unique 8–100 character ID>, clientOrigin: location.origin,
 *   baseRevision: 0, // required on save; use revision from last confirmed load/save
 *   snapshot: {page:0, answers:{responseId:'student text'}} // save only
 * }
 * Save a new record with baseRevision 0. Load before saving on a new device.
 * accessKey is a private resume code, separate from alias; never use a name,
 * email, school ID, or an alias alone as the key. Keep code in browser storage
 * and recovery download; students need it to resume on another device.
 * No endpoint lists students or retrieves responses by alias alone.
 * A conflict returns current server revision WITHOUT replacing either copy.
 * Retain local/recovery data until a confirmed save. Never silently merge.
 */
const LESSON = 'lucia-day5-v1';
const TAB = 'Responses';
const HEADERS = ['Key hash','Alias','Updated UTC','Revision','Last request ID',
                 'Answered','Total','Completion %','Page','Answers JSON'];

function setupDay5() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const props = PropertiesService.getScriptProperties();
    let id = props.getProperty('DAY5_SHEET_ID');
    const book = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('Day 5 — Lucia Responses');
    if (!id) props.setProperty('DAY5_SHEET_ID', book.getId());
    let sheet = book.getSheetByName(TAB);
    if (!sheet) sheet = book.insertSheet(TAB);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.setFrozenRows(1);
      sheet.getRange(1,1,1,HEADERS.length).setFontWeight('bold');
    }
    Logger.log('Response spreadsheet: ' + book.getUrl());
    return book.getUrl();
  } finally { lock.releaseLock(); }
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ok:true, lesson:LESSON,
    status:'Day 5 backend is running. Use the lesson to save or resume.'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let p = {}, origin = '', result;
  try {
    const raw = e && e.parameter && e.parameter.payload;
    if (typeof raw !== 'string' || raw.length > 60000) throw Error('Invalid or oversized request.');
    p = JSON.parse(raw);
    origin = validOrigin_(p.clientOrigin);
    result = handleRequest_(p);
  } catch (err) {
    result = {ok:false, code:'error', message:String(err.message || err)};
  }
  result.type = 'lucia-day5-response';
  result.requestId = typeof p.requestId === 'string' ? p.requestId.slice(0,100) : '';
  // Invalid origins receive no cross-window response; never post to wildcard '*'.
  const html = origin ? '<!doctype html><meta charset="utf-8"><script>window.top.postMessage(' +
    safeJson_(result) + ',' + safeJson_(origin) + ');</script>' : '<p>Invalid request origin.</p>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function handleRequest_(p) {
  validOrigin_(p.clientOrigin);
  if (p.lesson !== LESSON) throw Error('Wrong lesson.');
  if (!['save','load'].includes(p.action)) throw Error('Unknown action.');
  if (typeof p.alias !== 'string' || !/^[A-Za-z0-9-]{3,24}$/.test(p.alias)) throw Error('Invalid alias.');
  if (typeof p.accessKey !== 'string' || !/^[a-f0-9]{32,128}$/i.test(p.accessKey)) throw Error('Invalid private resume code.');
  if (typeof p.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(p.requestId)) throw Error('Invalid request ID.');
  let snapshot;
  if (p.action === 'save') {
    if (!Number.isInteger(p.baseRevision) || p.baseRevision < 0) throw Error('Missing save revision.');
    snapshot = cleanSnapshot_(p.snapshot);
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const id = PropertiesService.getScriptProperties().getProperty('DAY5_SHEET_ID');
    if (!id) throw Error('Teacher must run setupDay5 first.');
    const sheet = SpreadsheetApp.openById(id).getSheetByName(TAB);
    if (!sheet) throw Error('Response tab is missing.');
    const hash = hashKey_(p.accessKey);
    const match = sheet.getLastRow() > 1 ? sheet.getRange(2,1,sheet.getLastRow()-1,1)
      .createTextFinder(hash).matchEntireCell(true).findNext() : null;
    const row = match ? match.getRow() : 0;
    const old = row ? sheet.getRange(row,1,1,HEADERS.length).getValues()[0] : null;
    const revision = old ? Number(old[3]) : 0;
    if (p.action === 'load') {
      if (!old) return {ok:true, found:false, revision:0};
      return {ok:true, found:true, revision:revision, updated:String(old[2]),
        alias:String(old[1]), snapshot:decodeRow_(old)};
    }
    // An identical retry after a lost acknowledgement is safe and does not add a revision.
    if (old && old[4] === p.requestId) return {ok:true, saved:true, revision:revision, updated:String(old[2])};
    if (p.baseRevision !== revision) return {ok:false, code:'conflict', revision:revision,
      message:'Newer work is saved online. Keep this local copy and load the online copy before choosing which to keep.'};
    const answers = snapshot.answers, ids = Object.keys(answers);
    const answered = ids.filter(k => answers[k].trim().length > 0).length;
    const updated = new Date().toISOString();
    const values = [hash,p.alias,updated,revision+1,p.requestId,answered,ids.length,
      ids.length ? Math.round(100*answered/ids.length) : 0,snapshot.page,JSON.stringify(answers)];
    sheet.getRange(row || sheet.getLastRow()+1,1,1,HEADERS.length).setValues([values]);
    SpreadsheetApp.flush();
    return {ok:true,saved:true,revision:revision+1,updated:updated};
  } finally { lock.releaseLock(); }
}

function cleanSnapshot_(s) {
  if (!s || !Number.isInteger(s.page) || s.page < 0 || s.page > 9) throw Error('Invalid lesson page.');
  if (!s.answers || typeof s.answers !== 'object' || Array.isArray(s.answers)) throw Error('Missing answers.');
  const keys = Object.keys(s.answers), answers = Object.create(null);
  if (!keys.length || keys.length > 60) throw Error('Invalid answer count.');
  keys.forEach(k => {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(k) || ['constructor','prototype','__proto__'].includes(k)) throw Error('Invalid answer ID.');
    if (typeof s.answers[k] !== 'string' || s.answers[k].length > 10000) throw Error('Answer is too long.');
    answers[k] = s.answers[k];
  });
  if (JSON.stringify(answers).length > 45000) throw Error('Responses are too large for one save. Download recovery and contact the teacher.');
  return {page:s.page,answers:answers};
}
function decodeRow_(row) { return {page:Number(row[8]),answers:JSON.parse(row[9])}; }
function hashKey_(key) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, LESSON+':'+key, Utilities.Charset.UTF_8)
    .map(b => ('0'+((b+256)%256).toString(16)).slice(-2)).join('');
}
function validOrigin_(origin) {
  if (typeof origin !== 'string' || !/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]{1,5})?$/.test(origin))
    throw Error('Open the lesson from its HTTPS website.');
  return origin;
}
function safeJson_(v) {
  return JSON.stringify(v).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
}
