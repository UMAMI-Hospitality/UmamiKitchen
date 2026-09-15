/**
 * Char & Barten — kitchen reporting backend
 * Google Apps Script, bound to a Google Sheet.
 *
 * Paste into Extensions → Apps Script, change TOKEN below, then
 * Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone.
 * Copy the /exec URL into the app's CONFIG block.
 *
 * Sheets are created automatically on first run.
 */

/* CHANGE THIS. It must match API_TOKEN in the app. */
var TOKEN = 'char-barten-2026';

/**
 * SELF-CHECK — no deployment needed.
 * Pick "check" in the function dropdown at the top, press Run,
 * and read the Execution log. It tells you exactly what is wrong.
 */
function check() {
  var names = ['Index', 'index', 'Index.html', 'App'];
  var found = null, size = 0;
  for (var i = 0; i < names.length; i++) {
    try {
      var c = HtmlService.createHtmlOutputFromFile(names[i]).getContent();
      found = names[i]; size = c.length; break;
    } catch (e) {}
  }

  Logger.log('================ KITCHEN LOG CHECK ================');

  if (!found) {
    Logger.log('RESULT: No HTML file found.');
    Logger.log('FIX: click + next to Files, choose HTML, name it Index,');
    Logger.log('     paste the app in, then press Cmd+S.');
  } else if (size < 2000) {
    Logger.log('RESULT: "' + found + '" exists but is nearly empty (' + size + ' characters).');
    Logger.log('        That is Google\'s blank template, not the app.');
    Logger.log('FIX: open ' + found + ', select all, paste the app over it, Cmd+S.');
    Logger.log('     The app is about 69,700 characters.');
  } else if (size < 65000) {
    Logger.log('RESULT: "' + found + '" has only ' + size + ' characters.');
    Logger.log('        The paste was cut short — it should be about 69,700.');
    Logger.log('FIX: select all in that file and paste the whole thing again.');
  } else {
    Logger.log('RESULT: OK. "' + found + '" holds ' + size + ' characters.');
    Logger.log('        Last characters: ' + JSON.stringify(
      HtmlService.createHtmlOutputFromFile(found).getContent().slice(-20)));
    Logger.log('NEXT: Deploy > Manage deployments > pencil > Version: New version > Deploy.');
    Logger.log('      Then open the /exec URL with nothing after it.');
  }

  try {
    Logger.log('Spreadsheet attached: ' + SpreadsheetApp.getActiveSpreadsheet().getName());
  } catch (e) {
    Logger.log('WARNING: this script is not bound to a spreadsheet.');
  }
  Logger.log('==================================================');
  return 'Check finished — read the log above.';
}

var R_HEAD = ['id','date','date_key','venue','filed_by','time','status','released_by',
              'corrections','covers','food_revenue','waste_kg','waste_egp',
              'rostered','vacation','absent','on_floor','ticket_min','temps',
              'dish_checked','recipe_result','guest_comments','issues','updated_at','payload'];
var U_HEAD = ['id','name','role','venue','signs','pin'];
var O_HEAD = ['name'];
var C_HEAD = ['category','cost_per_kg'];
var M_HEAD = ['key','venue','month','updated_at','payload'];
var G_HEAD = ['key','venue','month','radwan','radwan_by','radwan_at',
              'fareed','fareed_by','fareed_at','owner','owner_by','owner_at',
              'evidence_gate','updated_at'];
var A_HEAD = ['id','priority','outlet','category','issue','impact','corrective_action','owner','due','status'];

/* ---------------- entry points ---------------- */

/**
 * Opening the /exec URL with no parameters serves the app itself.
 * With ?action=... it behaves as the JSON API, as before.
 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action) return handle(p);

  /* Accept whatever the HTML file ended up being called. */
  var names = ['Index', 'index', 'INDEX', 'Index.html', 'index.html', 'App', 'app'];
  var page = null;
  for (var i = 0; i < names.length; i++) {
    try { page = HtmlService.createHtmlOutputFromFile(names[i]); break; } catch (err) {}
  }
  if (!page) {
    return HtmlService.createHtmlOutput(
      '<div style="font:15px/1.6 -apple-system,Arial;padding:40px;max-width:640px;color:#1C1B19">' +
      '<h2 style="font-family:Georgia,serif;font-weight:400">The app file is missing</h2>' +
      '<p>Code.gs is deployed and working — it just cannot find the page.</p>' +
      '<p><b>In the Apps Script editor:</b></p><ol>' +
      '<li>Look at <b>Files</b> on the left. If there is no <b>Index.html</b>, click <b>+ → HTML</b> and name it <b>Index</b>.</li>' +
      '<li>Paste the app into it and press <b>Ctrl/Cmd + S</b> to save.</li>' +
      '<li><b>This is the part that catches people:</b> a deployment is a frozen snapshot. If you deployed before adding the file, the live version still has no page. ' +
      'Go to <b>Deploy → Manage deployments →</b> pencil icon → <b>Version: New version</b> → <b>Deploy</b>.</li>' +
      '</ol><p style="color:#8C857A;font-size:13px">Use <i>Manage deployments</i> rather than <i>New deployment</i>, ' +
      'or you will get another new URL each time.</p></div>')
      .setTitle('Umami — Kitchen Log');
  }
  /* Apps Script only permits a short whitelist of meta tags — viewport is
     the one that matters. The rest already live in the HTML head. */
  page.setTitle('Umami — Kitchen Log');
  try { page.addMetaTag('viewport', 'width=device-width, initial-scale=1'); } catch (err) {}
  try { page.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); } catch (err) {}
  return page;
}

function doPost(e) {
  var b = {};
  try { b = JSON.parse(e.postData.contents); } catch (err) {}
  return handle(b);
}

/**
 * Called directly by the page via google.script.run when the app is
 * served from here. No network request leaves the browser, so there is
 * nothing to block and no token to match — this already runs as you.
 */
function apiCall(payload) {
  var p = payload || {};
  p.token = TOKEN;
  return JSON.parse(handle(p).getContent());
}

function handle(p) {
  try {
    /* Diagnostic. Deliberately answers before the token check, and never
       reveals the token itself — only whether yours matched. */
    if (p.action === 'ping') {
      var given = (p.token === undefined || p.token === null) ? '' : String(p.token);
      return out({
        ok: true,
        version: 'v2',
        deployedCodeIsCurrent: true,
        tokenYouSent: given ? (given.length + ' characters') : 'none sent',
        tokenExpected: TOKEN.length + ' characters',
        tokensMatch: given === TOKEN,
        hintIfNotMatching: given === TOKEN ? '' :
          (given.trim() === TOKEN.trim()
            ? 'They differ only by a space at the start or end — retype it.'
            : 'Different values. Copy line 14 of Code.gs into config.js exactly.'),
        sheet: SpreadsheetApp.getActiveSpreadsheet().getName()
      });
    }

    if (String(p.token) !== TOKEN) return out({ error: 'Unauthorised' });
    switch (p.action) {
      case 'bootstrap': return out({
        ok: true, users: getUsers(), outlets: getOutlets(),
        rates: getRates(), reports: getReports(), months: getMonths(),
        signoff: getSignoff(), actions: getActions()
      });
      case 'reports':  return out({ ok: true, reports: getReports() });
      case 'month':    return out(saveMonth(p));
      case 'signoff':  return out(saveSignoff(p));
      case 'actions':  return out(writeRows('Actions', A_HEAD, p.actions,
                          function (a) { return [a.id,a.priority,a.venue,a.cat,a.issue,
                                                 a.impact,a.action,a.owner,a.due,a.status]; }));
      case 'save':     return out(saveReport(p.report));
      case 'status':   return out(setStatus(p.id, p.status, p.by));
      case 'users':    return out(writeRows('Users',   U_HEAD, p.users,
                          function (u) { return [u.id, u.name, u.role, u.venue, u.signs || '', u.pin]; }));
      case 'outlets':  return out(writeRows('Outlets', O_HEAD, p.outlets,
                          function (o) { return [o]; }));
      case 'rates':    return out(writeRows('Rates',   C_HEAD,
                          Object.keys(p.rates || {}),
                          function (k) { return [k, p.rates[k]]; }));
      default:         return out({ error: 'Unknown action: ' + p.action });
    }
  } catch (err) {
    return out({ error: String(err) });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- sheet plumbing ---------------- */

function ss() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet(name, head) {
  var s = ss().getSheetByName(name);
  if (!s) {
    s = ss().insertSheet(name);
    s.getRange(1, 1, 1, head.length).setValues([head])
      .setFontWeight('bold').setBackground('#1C1B19').setFontColor('#FFFFFF');
    s.setFrozenRows(1);
  }
  return s;
}

function rows(name, head) {
  var s = sheet(name, head);
  if (s.getLastRow() < 2) return [];
  var v = s.getRange(2, 1, s.getLastRow() - 1, head.length).getValues();
  return v.filter(function (r) { return String(r[0]).length; });
}

/** Replace a whole sheet's contents. Used for users, outlets and rates. */
function writeRows(name, head, list, toRow) {
  var s = sheet(name, head);
  if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, head.length).clearContent();
  var data = (list || []).map(toRow);
  if (data.length) s.getRange(2, 1, data.length, head.length).setValues(data);
  return { ok: true, saved: data.length };
}

/* ---------------- reads ---------------- */

function getUsers() {
  var d = rows('Users', U_HEAD);
  if (!d.length) {                       // seed on very first run
    var seed = [
      ['u3', 'Chef Irfan Malek',   'Executive Chef', '',       '',       '1234'],
      ['u1', 'Chef Hossam Hassan', 'Head Chef',      'Char',   '',       '1234'],
      ['u2', 'Chef Mustafa Said',  'Head Chef',      'Barten', '',       '1234']
    ];
    sheet('Users', U_HEAD).getRange(2, 1, seed.length, U_HEAD.length).setValues(seed);
    d = seed;
  }
  return d.map(function (r) {
    return { id: String(r[0]), name: String(r[1]), role: String(r[2]),
             venue: String(r[3]), signs: String(r[4] || ''), pin: String(r[5]) };
  });
}

function getOutlets() {
  var d = rows('Outlets', O_HEAD);
  if (!d.length) {
    sheet('Outlets', O_HEAD).getRange(2, 1, 2, 1).setValues([['Char'], ['Barten']]);
    return ['Char', 'Barten'];
  }
  return d.map(function (r) { return String(r[0]); });
}

function getRates() {
  var o = {};
  rows('Rates', C_HEAD).forEach(function (r) { o[String(r[0])] = Number(r[1]) || 0; });
  return o;
}

function getReports() {
  return rows('Reports', R_HEAD).map(function (r) {
    var p = {};
    try { p = JSON.parse(r[R_HEAD.indexOf('payload')] || '{}'); } catch (e) {}
    return {
      id: String(r[0]), dateLabel: String(r[1]), dateKey: String(r[2]),
      venue: String(r[3]), who: String(r[4]), time: String(r[5]),
      status: String(r[6]) || 'draft', releasedBy: String(r[7]) || '',
      edited: p.edited || '', versions: p.versions || [], d: p.d || {}
    };
  });
}

function getMonths() {
  var o = {};
  rows('Monthly', M_HEAD).forEach(function (r) {
    try { o[String(r[0])] = JSON.parse(r[4] || '{}'); } catch (e) {}
  });
  return o;
}

/** One row per venue-month. Saving again replaces that row. */
function saveMonth(p) {
  if (!p.key) return { error: 'No month key' };
  var sh = sheet('Monthly', M_HEAD);
  var row = [p.key, p.venue, p.month, new Date(), JSON.stringify(p.data || {})];
  var ids = sh.getLastRow() > 1
    ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); })
    : [];
  var at = ids.indexOf(String(p.key));
  if (at === -1) sh.appendRow(row);
  else sh.getRange(at + 2, 1, 1, M_HEAD.length).setValues([row]);
  return { ok: true, key: p.key };
}

function getSignoff() {
  var o = {};
  rows('Signoff', G_HEAD).forEach(function (r) {
    o[String(r[0])] = {
      radwan: String(r[3]) || 'Pending', radwanBy: String(r[4] || ''), radwanAt: String(r[5] || ''),
      fareed: String(r[6]) || 'Pending', fareedBy: String(r[7] || ''), fareedAt: String(r[8] || ''),
      owner:  String(r[9]) || 'Pending', ownerBy:  String(r[10] || ''), ownerAt:  String(r[11] || ''),
      gate3:  String(r[12]) || 'PASS'
    };
  });
  return o;
}

function saveSignoff(p) {
  if (!p.key) return { error: 'No sign-off key' };
  var sh = sheet('Signoff', G_HEAD), d = p.data || {};
  var row = [p.key, p.venue, p.month,
             d.radwan, d.radwanBy || '', d.radwanAt || '',
             d.fareed, d.fareedBy || '', d.fareedAt || '',
             d.owner,  d.ownerBy  || '', d.ownerAt  || '',
             d.gate3, new Date()];
  var ids = sh.getLastRow() > 1
    ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); })
    : [];
  var at = ids.indexOf(String(p.key));
  if (at === -1) sh.appendRow(row);
  else sh.getRange(at + 2, 1, 1, G_HEAD.length).setValues([row]);
  return { ok: true };
}

function getActions() {
  return rows('Actions', A_HEAD).map(function (r) {
    return { id: String(r[0]), priority: String(r[1]), venue: String(r[2]), cat: String(r[3]),
             issue: String(r[4]), impact: String(r[5]), action: String(r[6]),
             owner: String(r[7]), due: String(r[8]), status: String(r[9]) || 'Open' };
  });
}

/* ---------------- writes ---------------- */

function saveReport(rep) {
  if (!rep || !rep.id) return { error: 'No report supplied' };
  var s = sheet('Reports', R_HEAD);
  var row = buildRow(rep);
  var ids = s.getLastRow() > 1
    ? s.getRange(2, 1, s.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); })
    : [];
  var at = ids.indexOf(String(rep.id));
  if (at === -1) s.appendRow(row);
  else s.getRange(at + 2, 1, 1, R_HEAD.length).setValues([row]);
  return { ok: true, id: rep.id, created: at === -1 };
}

function setStatus(id, status, by) {
  var s = sheet('Reports', R_HEAD);
  if (s.getLastRow() < 2) return { error: 'No reports' };
  var ids = s.getRange(2, 1, s.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); });
  var at = ids.indexOf(String(id));
  if (at === -1) return { error: 'Report not found' };
  s.getRange(at + 2, R_HEAD.indexOf('status') + 1).setValue(status);
  s.getRange(at + 2, R_HEAD.indexOf('released_by') + 1).setValue(status === 'released' ? (by || '') : '');
  return { ok: true };
}

/** Flat columns so the sheet is readable and pivotable; payload keeps full fidelity. */
function buildRow(r) {
  var d = r.d || {}, b = d.brig || {}, lines = d.lines || [];
  var kg = 0, egp = 0;
  lines.forEach(function (l) { kg += Number(l.kg) || 0; egp += Number(l.egp) || 0; });
  return [
    r.id, r.dateLabel, r.dateKey, r.venue, r.who, r.time,
    r.status || 'draft', r.releasedBy || '',
    (r.versions || []).length,
    d.covers || 0, d.rev || 0,
    Math.round(kg * 10) / 10, Math.round(egp),
    b.r || 0, b.v || 0, b.a || 0, (b.r || 0) - (b.v || 0) - (b.a || 0),
    d.ticket || '',
    d.temps === 'fail' ? 'OUT OF RANGE' : 'in range',
    d.dish || '',
    d.recipe === 'fail' ? ('DEVIATION: ' + (d.dev || '')) : 'matched spec',
    (d.fbs || []).length, (d.isss || []).length,
    new Date(),
    JSON.stringify({ d: d, versions: r.versions || [], edited: r.edited || '' })
  ];
}
