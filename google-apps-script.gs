/**
 * Highlights tap study: receives taps from the prototype and serves them to the results dashboard.
 *
 * Setup (once):
 * 1. Create a new Google Sheet. Extensions > Apps Script. Delete the sample code and paste this file.
 * 2. Change DASHBOARD_KEY below to your own password (letters and numbers).
 * 3. Deploy > New deployment > type "Web app".
 *    Execute as: Me.  Who has access: Anyone.  Click Deploy and approve the permissions.
 * 4. Copy the Web app URL (ends in /exec) into config.js in the study folder.
 *
 * If you edit this code later: Deploy > Manage deployments > pencil icon > Version: New version > Deploy.
 * The URL stays the same.
 */

const DASHBOARD_KEY = 'change-me';

const TAP_COLS = ['session', 'seq', 'screen', 'element', 'part', 'x', 'y', 't_ms', 'video_time',
  'story_loop', 'pointer', 'press_ms', 'long_press', 'received_at'];
const EVENT_COLS = ['session', 'type', 't_ms', 'screen', 'loop', 'debug', 'viewport', 'user_agent', 'received_at'];

function sheet_(name, cols) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(cols);
    sh.setFrozenRows(1);
  }
  return sh;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const rows = Array.isArray(body.rows) ? body.rows.slice(0, 500) : [];
    const now = new Date().toISOString();
    const taps = [], events = [];
    rows.forEach(r => {
      r.received_at = now;
      if (r.type) events.push(EVENT_COLS.map(c => r[c] === undefined || r[c] === null ? '' : r[c]));
      else taps.push(TAP_COLS.map(c => r[c] === undefined || r[c] === null ? '' : r[c]));
    });
    if (taps.length) {
      const sh = sheet_('Taps', TAP_COLS);
      sh.getRange(sh.getLastRow() + 1, 1, taps.length, TAP_COLS.length).setValues(taps);
    }
    if (events.length) {
      const sh = sheet_('Events', EVENT_COLS);
      sh.getRange(sh.getLastRow() + 1, 1, events.length, EVENT_COLS.length).setValues(events);
    }
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}

function read_(name, cols) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, cols.length).getValues();
  return values.map(v => {
    const o = {};
    cols.forEach((c, i) => o[c] = v[i] instanceof Date ? v[i].toISOString() : v[i]);
    return o;
  });
}

function doGet(e) {
  const out = (obj) => ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  if (!e.parameter || e.parameter.key !== DASHBOARD_KEY) return out({ error: 'wrong_key' });
  if (e.parameter.action === 'clear') return out(clear_());
  return out({ taps: read_('Taps', TAP_COLS), events: read_('Events', EVENT_COLS), server_time: new Date().toISOString() });
}

// Called by the dashboard's "Clear data" button. Nothing is deleted: the current tabs are renamed
// to "archive" tabs, and fresh Taps / Events tabs are created with the next tap.
function clear_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d HH:mm:ss');
    let archived = 0;
    ['Taps', 'Events'].forEach(name => {
      const sh = ss.getSheetByName(name);
      if (sh) { sh.setName(name + ' archive ' + stamp); archived++; }
    });
    return { cleared: true, archived: archived, stamp: stamp };
  } finally {
    lock.releaseLock();
  }
}
