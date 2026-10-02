import fs from 'node:fs';
import path from 'node:path';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cp1252High = '\u20ac\u0081\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u008d\u017d\u008f\u0090\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u009d\u017e\u0178';
const reverseCp1252 = new Map([...cp1252High].map((ch, i) => [ch, 0x80 + i]));
function cp1252Byte(ch) {
  const code = ch.charCodeAt(0);
  if (code <= 0xff) return code;
  return reverseCp1252.get(ch);
}
function decodeMojibakeAt(text, i) {
  const first = cp1252Byte(text[i]);
  if (first === undefined) return null;
  const need = first >= 0xf0 && first <= 0xf4 ? 4 : first >= 0xe0 && first <= 0xef ? 3 : first >= 0xc2 && first <= 0xdf ? 2 : 0;
  if (!need || i + need > text.length) return null;
  const bytes = [];
  for (let j = 0; j < need; j++) {
    const byte = cp1252Byte(text[i + j]);
    if (byte === undefined) return null;
    bytes.push(byte);
  }
  for (let j = 1; j < bytes.length; j++) if ((bytes[j] & 0xc0) !== 0x80) return null;
  const decoded = Buffer.from(bytes).toString('utf8');
  return decoded.includes('\ufffd') ? null : {decoded, length: need};
}
export function repairDisplayEncoding(value) {
  let text = String(value ?? '');
  for (let pass = 0; pass < 3; pass++) {
    let out = '';
    for (let i = 0; i < text.length;) {
      const hit = decodeMojibakeAt(text, i);
      if (hit) {
        out += hit.decoded;
        i += hit.length;
      } else {
        out += text[i++];
      }
    }
    if (out === text) break;
    text = out;
  }
  return text;
}
function repairDataStrings(value) {
  if (typeof value === 'string') return repairDisplayEncoding(value);
  if (Array.isArray(value)) return value.map(repairDataStrings);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, repairDataStrings(v)]));
  }
  return value;
}
function forceEnglishReportsTime(html) {
  html = html.replace(/\.hm-report \.rec-sched-row input\[type="time"\] \{[^}]*\}/, `$&
    .hm-report .rec-time-field { display:inline-flex; align-items:center; gap:5px; padding:4px 7px; border:1.5px solid var(--cp-border-strong); border-radius:8px; background:var(--cp-surface); color:var(--cp-text); min-width:112px; }
    .hm-report .rec-time-field:focus-within { outline:2px solid var(--cp-accent); outline-offset:2px; }
    .hm-report .rec-time-field.invalid { border-color:#dc2626; box-shadow:0 0 0 1px #dc2626 inset; }
    .hm-report .rec-time-field input { font:inherit; font-size:.8rem; border:0; outline:0; background:transparent; color:inherit; width:72px; padding:0; }
    .hm-report .rec-time-icon { font-size:.85rem; line-height:1; }`);
  return html.replace(/<input\s+type="time"\s+id="recTime"\s+value="13:00"\s*\/?>/i,
    '<span class="rec-time-field" id="recTimeField"><input type="text" id="recTime" value="01:00 PM" inputmode="text" autocomplete="off" aria-label="Auto-send time in English 12-hour format, for example 01:00 PM" pattern="^(0?[1-9]|1[0-2]):[0-5][0-9]\\\\s?(AM|PM|am|pm)$"><span class="rec-time-icon" aria-hidden="true">🕐</span></span>');
}

function stripInlineScripts(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>\s*/gi, '');
}

export function buildDemoUi(base, themeScript, themeCss) {
  const sourceBase = base.replace(/\s+Fake Data Demo$/i, '');
  const readJson = name => repairDataStrings(JSON.parse(fs.readFileSync(path.join(base, 'data', name), 'utf8')));
  const reqs = readJson('reqs-list.json').reqs;
  const feedback = readJson('drawer-feedback-final.json').reqs;
  const schedules = readJson('interview-schedule-final.json').reqs;
  const sla = readJson('req-sla-demo-data.json').rows;
  const records = reqs.map(req => {
    if (!/^DEMO-REQ-\d{3}$/.test(req.reqId)) throw new Error('Non-demo requisition in local mock data');
    const fb = feedback[req.reqId] || {};
    const sc = schedules[req.reqId] || {};
    const candidates = new Map();
    for (const c of [...(fb.candidates || []), ...(sc.candidates || [])]) {
      const key = c.profileId || c.name;
      if (!key || !c.name) throw new Error(`Missing synthetic candidate identity: ${req.reqId}`);
      const prior = candidates.get(key) || {};
      candidates.set(key, {
        id: key, name: c.name, stage: c.hiringStage || c.stage || prior.stage || 'Review',
        entries: c.entries || prior.entries || [],
        meetings: c.meetings || prior.meetings || [],
      });
    }
    return {...req, totals: fb.totals || {}, sla: sla.find(r => r.reqId === req.reqId),
      candidates: [...candidates.values()]};
  });
  const data = {mode:'synthetic-offline', version:'0917-format-20260921', reqs:records};
  fs.writeFileSync(path.join(base, 'demo-data.js'), 'window.DEMO_DATA = ' + JSON.stringify(data).replace(/</g, '\\u003c') + ';\n');
  fs.writeFileSync(path.join(base, 'demo-theme.css'), themeCss + '\n');
  const guideSource = path.join(sourceBase, 'guide.html');
  if (fs.existsSync(guideSource)) {
    fs.writeFileSync(path.join(base, 'guide.html'), fs.readFileSync(guideSource, 'utf8').replace(/^\uFEFF/, ''));
  }
  const hubSource = path.join(sourceBase, 'ta-hub-dashboards.html');
  if (fs.existsSync(hubSource)) {
    let html = fs.readFileSync(hubSource, 'utf8').replace(/^\uFEFF/, '');
    html = stripInlineScripts(html);
    html = forceEnglishReportsTime(html);
    const eyebrow = '<p class="eyebrow">TA Hub dashboard hub</p>';
    if (!html.includes(eyebrow)) throw new Error('Cannot locate the hub header for the synthetic data label');
    html = html.replace(eyebrow, '<p class="eyebrow">TA Hub dashboard hub <span id="demoHeaderLabel" style="display:inline-block;margin-left:24px;text-transform:none;letter-spacing:normal">DEMO-Synthetic Data</span></p>');
    if (!html.includes('</main>')) throw new Error('Cannot locate the hub footer for the demo disclaimer');
    html = html.replace('</main>', '<footer id="demoDisclaimer" style="margin-top:20px;padding:16px 0;border-top:1px solid var(--cp-border);color:var(--cp-text-muted);font-size:12px;line-height:1.6">Disclaimer: All candidate, requisition, interview, and hiring information shown in this demo is synthetic data generated for demonstration purposes only.</footer>\n  </main>');
    fs.writeFileSync(path.join(base, 'ta-hub-dashboards.html'), html);
  }
  const page = (title, view, content = '') => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} - Synthetic Demo</title>${themeScript}
<link rel="stylesheet" href="demo-theme.css"><link rel="stylesheet" href="demo-ui.css"></head>
<body class="mock-page" data-demo-view="${view}"><header class="mock-top">
<div><span class="demo-badge">SYNTHETIC DEMO · OFFLINE</span><h1>${escapeHtml(title)}</h1>
<p>No real TA Hub or EC connection. All people, requisitions, links and actions on this page are simulated.</p></div>
<a class="mock-button" href="ta-hub-dashboards.html">Back to Command Center</a></header>
<main id="mockContent">${content}</main><script src="demo-data.js"></script><script src="demo-runtime.js"></script></body></html>`;
  for (const [name, title, view] of [
    ['demo-ta-hub.html', 'TA Hub', 'ta'],
    ['demo-ec.html', 'EC · Requisition Management', 'ec'],
    ['demo-disposition.html', 'Disposition Helper', 'disposition'],
  ]) {
    const target = path.join(base, name);
    if (!fs.existsSync(target)) fs.writeFileSync(target, page(title, view));
  }

  const files = fs.readdirSync(base).filter(f => f.endsWith('.html'));
  files.push(...fs.readdirSync(path.join(base, 'data')).filter(f => f.endsWith('.html')).map(f => path.join('data', f)));
  for (const file of files) {
    if (file.startsWith('demo-') || file === 'guide.html') continue;
    const filename = path.join(base, file);
    let html = repairDisplayEncoding(fs.readFileSync(filename, 'utf8'));
    const localPrefix = path.dirname(file) === '.' ? '' : '../';
    html = html.replace(/href="file:\/\/\/[^"]+"(?=[^>]*>Open full dashboard)/gi,
      `href="${localPrefix}ta-hub-dashboards.html"`);
    if (file === 'daily-report-table.html') {
      html = html.replace('var total=reqRows.length;',
        "function countReqs(rows){return new Set(rows.map(function(r){return r.getAttribute('data-reqid');})).size;}\n  var total=countReqs(reqRows);");
      html = html.replace("var n=reqRows.filter(function(r){return r.style.display!=='none';}).length;",
        "var n=countReqs(reqRows.filter(function(r){return r.style.display!=='none';}));");
      html = html.replace("var pn=reqRows.filter(function(r){ return mB(r)&&r.getAttribute('data-phase')===ph; }).length;",
        "var pn=countReqs(reqRows.filter(function(r){ return mB(r)&&r.getAttribute('data-phase')===ph; }));");
    }
    if (file === 'interview-schedule-dashboard.html') {
      html = html.replace(/(<code id="scheduleServerPath"[^>]*>)[^<]*(<\/code>)/,
        '$1Not used in the synthetic demo. Use the demo email launcher for Outlook email only.$2');
      html = html.replace(/href="file:\/\/\/[^"]*Start%20Schedule%20Refresh%20Server\.cmd"([^>]*>)Open server launcher/gi,
        'href="ta-hub-dashboards.html#reports"$1Open demo reports');
      html = html.replace(/\(function initRefresh\(\)\{[\s\S]*?check\(\); setInterval\(check, 8000\);\s*\}\)\(\);/,
        `(function initDemoRefresh(){
          const status=document.getElementById('serverStatus');
          if(status)status.textContent='Offline demo';
          ['runSelected','runAll'].forEach(id=>{
            const button=document.getElementById(id);
            if(button)button.onclick=()=>{
              const log=document.getElementById('refreshLog');
              if(log){log.style.display='block';log.textContent='Synthetic schedule data is loaded. No live scrape.';}
            };
          });
        })();`);
    }
    html = html.replace(/<!-- DEMO-LOCAL-ASSETS:START -->[\s\S]*?<!-- DEMO-LOCAL-ASSETS:END -->\s*/g, '');
    const prefix = path.dirname(file) === '.' ? '' : '../';
    const hubScript = file === 'ta-hub-dashboards.html' ? '<script src="demo-hub.js"></script>' : '';
    const slaScript = file === 'req-sla-dashboard.html' ? '<script src="demo-sla.js"></script>' : '';
    const assets = `<!-- DEMO-LOCAL-ASSETS:START --><script src="${prefix}demo-data.js"></script><script src="${prefix}demo-email.js"></script><script src="${prefix}demo-runtime.js"></script>${hubScript}${slaScript}<!-- DEMO-LOCAL-ASSETS:END -->`;
    if (!/<\/body>/i.test(html)) throw new Error(`Missing body: ${file}`);
    html = html.replace(/<\/body>/i, assets + '</body>');
    fs.writeFileSync(filename, html);
  }
  const manifestPath = path.join(base, 'fake-data-demo-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.interfaceVersion = '0917 Kit / AI Recruiting Command Center / Reports panel';
  manifest.localMockPages = ['demo-ta-hub.html','demo-ec.html','demo-disposition.html'];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}
