(() => {
  'use strict';
  const root = new URL('.', document.currentScript.src);
  const data = window.DEMO_DATA;
  if (!data || data.mode !== 'synthetic-offline') throw new Error('Synthetic demo data is missing');

  const reqs = data.reqs;
  const byId = new Map(reqs.map(r => [r.reqId, r]));
  const params = new URLSearchParams(location.search);
  const view = document.body.dataset.demoView;
  const content = document.getElementById('mockContent');
  const selected = byId.get(params.get('req'));
  let ecWelcomeVisible = true;

  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hash = value => String(value ?? '').split('').reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const initials = name => String(name || 'Demo User').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  const slug = name => String(name || 'demo.user').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'demo.user';
  const pick = (arr, seed) => arr[hash(seed) % arr.length];
  const stageLabel = stage => {
    const s = String(stage || '').toLowerCase();
    if (s === 'hired') return 'Hired';
    if (s.includes('offer')) return 'Offer';
    if (s.includes('pre-hire')) return 'Pre-Hire';
    if (s.includes('interview')) return 'Interview Feedback Received';
    if (s.includes('screen')) return s.includes('completed') ? 'Person Screen Completed' : 'Person Screen Pending';
    if (s.includes('review')) return 'Business Review Pending';
    if (s.includes('forward')) return 'Forwarded';
    if (s.includes('internal')) return 'Internal Site';
    if (s.includes('job board')) return stage;
    return stage || 'Business Review Pending';
  };
  const stageKey = stage => {
    const s = String(stage || '').toLowerCase();
    if (s === 'hired') return 'hired';
    if (s.includes('pre-hire')) return 'preHire';
    if (s.includes('offer')) return 'offer';
    if (s.includes('interview')) return 'interview';
    if (s.includes('screen')) return 'screen';
    if (s.includes('new') || s.includes('applicant')) return 'newApp';
    return 'review';
  };
  const stageName = key => ({newApp:'Applicants',review:'Review',screen:'Screen',interview:'Interview',offer:'Offer',preHire:'Pre-Hire',hired:'Hired'}[key] || key);
  const total = (r, key) => key === 'all'
    ? Object.values(r.totals || {}).reduce((a, b) => a + Number(b || 0), 0) || r.candidates.length
    : Number(r.totals?.[key] ?? r.candidates.filter(c => stageKey(c.stage) === key).length);
  const roleSeeds = ['Manufacturing Program Manager','Cloud Reliability Engineer','Hardware Systems Lead','Operations Program Manager','Mechanical Design Manager','AI Infrastructure Specialist','Quality Systems Engineer','Data Center Planner'];
  const companySeeds = ['Northstar Systems','Cedar Labs','Contoso Manufacturing','Fabrikam Devices','Blue Yonder Works','Summit Robotics','Alpine Compute','Orchard Industrial'];
  const locationSeeds = ['Taipei, Taiwan','Redmond, WA','Dublin, Ireland','Singapore','Phoenix, AZ','Austin, TX','Amsterdam, Netherlands','Toronto, Canada'];

  function url(file, req, candidate) {
    const u = new URL(file, root);
    if (req) u.searchParams.set('req', req);
    if (candidate) u.searchParams.set('candidate', candidate);
    u.searchParams.set('scoutTheme', document.documentElement.dataset.theme || 'light');
    return u.href;
  }
  const taLink = (r, c) => url('demo-ta-hub.html', r?.reqId, c?.id);
  const ecLink = r => url('demo-ec.html', r?.reqId);
  const candidateRole = (c, r) => `${pick(roleSeeds, c.id)}${r?.title ? ' · ' + r.title : ''}`;
  const candidateCompany = c => pick(companySeeds, c.id + c.name);
  const candidateLocation = c => pick(locationSeeds, c.id);
  const safeEmail = c => `${slug(c.name)}@example.invalid`;
  const safePhone = c => `+1 555 01${String(hash(c.id) % 100).padStart(2, '0')} (synthetic)`;

  function msMark() {
    return '<span class="ms-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
  }
  function taHeader(active = 'Requisitions') {
    return `<header class="ta-header">${msMark()}<span class="ms-word">Microsoft</span><span class="ta-divider"></span><span class="ta-brand">TALENT<br><b>ACQUISITION HUB</b></span>
      <nav><a class="${active==='Requisitions'?'active':''}">Requisitions</a><a>Talent⌄</a><a>Engage⌄</a><a>More⌄</a></nav>
      <label class="ta-search"><input id="globalSearch" placeholder="Search for Requisitions or Candidates"><span>⌕</span></label>
      <div class="ta-icons"><span>▣</span><span>♡</span><span>▦</span><span class="avatar-mini">DU</span><span>⌄</span></div></header>`;
  }
  function toast(message) {
    let box = document.getElementById('mockToast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'mockToast';
      box.className = 'mock-toast';
      document.body.appendChild(box);
    }
    box.textContent = message;
    box.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => box.classList.remove('show'), 2600);
  }
  function showMissing(message) {
    content.innerHTML = `${view === 'ec' ? ecShell('Job Requisitions') : taHeader()}<main class="mock-shell"><section class="missing-card"><h2>Demo record not found</h2><p>${escape(message)}</p><a href="${taLink()}">Open demo requisition list</a></section></main>`;
  }
  function avatar(name, extra = '') {
    return `<span class="person-avatar ${extra}" aria-hidden="true">${escape(initials(name))}</span>`;
  }
  function feedbackAvatars(c, field = 'entries') {
    const entries = (c[field] || c.entries || []).slice(0, 4);
    const more = Math.max(0, (c[field] || c.entries || []).length - entries.length);
    return `<span class="feedback-stack">${entries.map((e, i) => `<span class="fb fb-${i % 5}">${escape(initials(e.reviewerName || e.title || e.formName || 'Demo'))}</span>`).join('')}${more ? `<span class="fb fb-more">+${more}</span>` : ''}</span>`;
  }

  function renderTaList() {
    content.innerHTML = taHeader() + `<main class="ta-page"><section class="req-directory"><div class="dir-title"><h1>Requisitions</h1><span class="demo-corner">Synthetic demo · offline only</span></div>
      <div class="pipeline-tools"><label class="pill active">Views : All Active⌄</label><label class="pill">Stage⌄</label><label class="pill">Location⌄</label><label class="pill">Skills/Keywords⌄</label><label class="pill">All filters <b>0</b></label><input id="reqListSearch" placeholder="Search synthetic requisitions"></div>
      <table class="pipeline-table"><thead><tr><th>Req ID</th><th>Position</th><th>Hiring Manager</th><th>Status</th><th>Applicants</th><th>Action</th></tr></thead><tbody id="reqRows"></tbody></table></section></main>`;
    const draw = () => {
      const q = document.getElementById('reqListSearch').value.toLowerCase();
      document.getElementById('reqRows').innerHTML = reqs.filter(r => (`${r.reqId} ${r.title} ${r.hm}`).toLowerCase().includes(q)).map(r => {
        const status = r.lifecycle?.preApproval ? 'Pre-Approval' : r.lifecycle?.hired ? 'Hired' : 'Open';
        return `<tr><td><a href="${taLink(r)}">${escape(r.reqId)}</a></td><td><a href="${taLink(r)}">${escape(r.title)}</a></td><td>${escape(r.hm)}</td><td>${escape(status)}</td><td>${total(r,'all')}</td><td><a href="${ecLink(r)}">Open EC</a></td></tr>`;
      }).join('');
    };
    document.getElementById('reqListSearch').addEventListener('input', draw);
    draw();
  }

  function renderPipeline(r) {
    const stages = [['all','Applicants'],['review','Review'],['screen','Screen'],['interview','Interview'],['offer','Offer'],['preHire','Pre-Hire'],['hired','Hired'],['prospects','Prospects'],['contacted','Contacted Prospects'],['analytics','Analytics']];
    content.innerHTML = taHeader() + `<main class="pipeline" data-reqid="${escape(r.reqId)}">
      <section class="pipeline-title"><div><h1>${escape(r.title)} <button class="round">⌄</button><button class="round mark">●</button><button class="round">ⓘ</button></h1>
      <p><span>${escape(r.reqId)}</span> · ${escape(candidateLocation({id:r.reqId}))} <span class="dot green"></span> Open <span class="dot purple"></span> Posted <span class="dot blue"></span> successfactors <span class="dot green"></span> Parent</p></div>
      <div><a class="ec-callout" href="${ecLink(r)}">Open EC list</a><button class="calibrate">Calibrate Requisition</button><button class="kebab">⋮</button></div></section>
      <nav class="stage-tabs" id="stageTabs">${stages.map(([key, label]) => `<button data-stage="${key}" class="${key==='all'?'active':''}">${escape(label)} <b>${key==='prospects' ? Math.max(0,total(r,'review')-7) : key==='contacted' || key==='analytics' ? 0 : total(r,key)}</b></button>`).join('')}</nav>
      <section class="pipeline-controls"><button class="view-pill active">Views : All Active⌄</button><span class="divider"></span><button class="filter-pill">Stage⌄</button><button class="filter-pill">Location⌄</button><button class="filter-pill">Skills/Keywords⌄</button><button class="filter-pill">☷ All filters <b>0</b></button><select id="sortCandidates"><option value="time">Sort by : Application Time - Low to High</option><option value="name">Sort by : Applicant A-Z</option><option value="stage">Sort by : Hiring Stage</option></select><input id="candidateSearch" placeholder="Search candidates"><div class="view-icons"><button>⌕</button><button class="selected">≡</button><button>▥</button><button>☷</button></div></section>
      <section class="pipeline-grid"><table class="candidate-table"><thead><tr><th><input type="checkbox"></th><th>Applicant <b>${total(r,'all')}</b></th><th>Hiring Stage</th><th>Application Time</th><th>Feedback</th><th>Decision Feedback</th><th>Sourced by</th></tr></thead><tbody id="candidateRows"></tbody></table></section>
      <p class="synthetic-foot">Named rows are synthetic demo profiles from window.DEMO_DATA; tab totals may include aggregate synthetic counts without detail records.</p></main>`;
    let activeStage = 'all';
    const draw = () => {
      const q = document.getElementById('candidateSearch').value.toLowerCase();
      const sort = document.getElementById('sortCandidates').value;
      let list = r.candidates.filter(c => activeStage === 'all' || stageKey(c.stage) === activeStage);
      list = list.filter(c => (`${c.name} ${candidateRole(c,r)} ${candidateCompany(c)} ${stageLabel(c.stage)}`).toLowerCase().includes(q));
      if (sort === 'name') list.sort((a,b) => a.name.localeCompare(b.name));
      if (sort === 'stage') list.sort((a,b) => stageLabel(a.stage).localeCompare(stageLabel(b.stage)));
      if (sort === 'time') list.sort((a,b) => hash(a.id) - hash(b.id));
      document.getElementById('candidateRows').innerHTML = list.length ? list.map((c, i) => {
        const days = 4 + (hash(c.id) % 70);
        return `<tr data-candidate="${escape(c.id)}"><td><input type="checkbox"></td><td><a class="applicant-cell" href="${taLink(r,c)}">${avatar(c.name)}<span><b>${escape(c.name)}</b><small>${escape(candidateRole(c,r))}, ${escape(candidateCompany(c))}</small></span></a></td><td>${escape(stageLabel(c.stage))}<br><small>${stageKey(c.stage)==='review'?'Job Board (Eightfold)':stageName(stageKey(c.stage))}</small></td><td>${escape(applicationDate(i, days))}</td><td>${feedbackAvatars(c)}</td><td>${feedbackAvatars(c, 'entries')}</td><td>${escape(pick(['Talent Team','Hiring Event','Referral','ATS','Internal Site'], c.id))}</td></tr>`;
      }).join('') : `<tr><td colspan="7" class="empty-row">No named synthetic profiles in this stage.</td></tr>`;
    };
    document.querySelectorAll('#stageTabs button').forEach(b => b.addEventListener('click', () => {
      activeStage = b.dataset.stage;
      document.querySelectorAll('#stageTabs button').forEach(x => x.classList.toggle('active', x === b));
      draw();
    }));
    document.getElementById('candidateSearch').addEventListener('input', draw);
    document.getElementById('sortCandidates').addEventListener('change', draw);
    draw();
  }

  function applicationDate(i, days) {
    const month = ['Jul','Aug','Sep'][hash(i + ':' + days) % 3];
    const day = 1 + ((days + i * 7) % 28);
    return `${month} ${day}${day === 1 || day === 21 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th'}, 2026`;
  }

  function renderCandidate(r, c) {
    const idx = r.candidates.findIndex(x => x.id === c.id);
    const prev = r.candidates[idx - 1], next = r.candidates[idx + 1];
    const matched = [r, ...reqs.filter(x => x.reqId !== r.reqId && !x.lifecycle?.preApproval).slice(0, 7)];
    content.innerHTML = taHeader() + `<main class="candidate-view" data-reqid="${escape(r.reqId)}">
      <div class="crumb"><a href="${taLink()}">Requisitions</a><span>/</span><a href="${taLink(r)}">${escape(r.title)} (${escape(r.reqId)})</a></div>
      <section class="action-row"><button class="star">☆</button><button data-action="advance">Advance Stage⌄</button><button data-action="contact">Contact⌄</button><button data-action="schedule">Schedule⌄</button><button data-action="feedback">Feedback⌄</button><a class="ec-profile-link" href="${ecLink(r)}">Open EC list</a><button data-action="menu">⋮</button><span class="spacer"></span><a class="arrow ${prev?'':'disabled'}" href="${prev?taLink(r,prev):'#'}">‹</a><span>${idx + 1} of ${Math.max(total(r,'all'), r.candidates.length)}</span><a class="arrow ${next?'':'disabled'}" href="${next?taLink(r,next):'#'}">›</a></section>
      <section class="profile-columns"><div class="left-col"><section class="profile-hero">${avatar(c.name, 'large')}<div><h1>${escape(c.name)}</h1><h2>${escape(candidateRole(c,r))}, ${escape(candidateCompany(c))}</h2><p>⌖ ${escape(candidateLocation(c))} (synthetic local time)</p><p>▣ ${15 + hash(c.id) % 14} years of total experience | ${3 + hash(c.name) % 9} years relevant to this position</p><p>☷ Sourced via ${escape(pick(['ATS','Referral','Career Site','Event'], c.id))} (synthetic)</p><p>♙ Prospect Owner - no owner assigned</p></div><button data-action="download">⬇</button><button data-action="edit">✎</button></section>
        <section class="req-status"><b>${escape(r.title)} (${escape(r.reqId)})</b><span>${escape(stageLabel(c.stage))}</span><button>⌄</button></section>
        <nav class="profile-tabs" id="profileTabs">${['Profile','Applications','Feedback','Messages','Hiring Activities','Notes'].map((t,i)=>`<button data-tab="${t}" class="${i===0?'active':''}">${t} <b>${i===0?3:i===1?2:i===2?c.entries.length:i===3?55:i===4?c.meetings.length||2:''}</b></button>`).join('')}</nav>
        <nav class="sub-tabs"><button class="active">Overview</button><button>Résumé</button><button>LinkedIn</button><button>Files <b>3</b></button></nav><div id="profilePanel"></div></div>
        <aside class="right-col"><section class="side-card"><div class="side-title"><h2>Personal Info</h2><button data-action="add">Add new⌄</button></div><div class="side-pills"><span>Contact <b>2</b></span><span>Links <b>0</b></span><span>Files <b>3</b></span><span>Profiles <b>4</b></span></div><p>✉ <a href="#" data-action="contact">${escape(safeEmail(c))}</a> <small>(primary)</small><button>⋮</button></p><p>☎ <a href="#" data-action="contact">${escape(safePhone(c))}</a> <small>(placeholder)</small><button>⋮</button></p></section>
        <section class="side-card compact"><div class="side-title"><h2>Add notes & tags</h2><button data-action="note">Add new⌄</button></div></section>
        <section class="side-card"><h2>Matched Requisitions <b>${matched.length}</b></h2>${matched.slice(0,5).map(m=>`<a class="match-row" href="${taLink(m)}"><span class="briefcase">▣</span><span><b>${escape(m.title)} (${escape(m.reqId)})</b><small>⌖ ${escape(candidateLocation({id:m.reqId}))} · ${escape(m.hm)} · ${m.lifecycle?.hired?'Hired':'Open'}</small></span><i>⋮</i></a>`).join('')}<button class="see-more">See more <b>${Math.max(0, matched.length - 5)}</b></button></section></aside></section></main>`;
    const panel = document.getElementById('profilePanel');
    const drawTab = tab => {
      if (tab === 'Feedback') {
        panel.innerHTML = `<section class="content-card"><h2>Feedback</h2>${simpleTable(['Reviewer','Form','Status','Decision','Date'], c.entries.map(e => [e.reviewerName, e.formName || e.category, e.status, e.decision || 'Pending', e.date]))}</section>`;
      } else if (tab === 'Hiring Activities') {
        panel.innerHTML = `<section class="content-card"><h2>Hiring Activities</h2>${simpleTable(['Activity','Status','When'], (c.meetings.length ? c.meetings : [{title:'Synthetic interview planning',status:'Preview only',date:'Not scheduled'}]).map(m => [m.title || m.meetingType || 'Interview', m.status || m.scheduleStatus || 'Demo', m.dateTime || m.date || m.startTime || 'See schedule dashboard']))}</section>`;
      } else if (tab === 'Applications') {
        panel.innerHTML = `<section class="content-card"><h2>Applications</h2>${simpleTable(['Requisition','Stage','Source'], [[`${r.title} (${r.reqId})`, stageLabel(c.stage), 'Synthetic demo']])}</section>`;
      } else if (tab === 'Messages') {
        panel.innerHTML = `<section class="content-card"><h2>Messages</h2><p>No outbound messages are sent in this offline mock. Use Contact to preview a local-only action.</p></section>`;
      } else if (tab === 'Notes') {
        panel.innerHTML = `<section class="content-card"><h2>Notes</h2><p>Demo notes are shown only in this page and are not saved to any service.</p></section>`;
      } else {
        panel.innerHTML = `<section class="content-card"><h2>Additional Info</h2><p>All values are generated synthetic placeholders for the offline demo.</p></section><section class="content-card"><h2>Candidate</h2><dl><dt>ATS Candidate Id</dt><dd>${escape(c.id)}</dd><dt>EE Internal Candidate Id</dt><dd>DEMO-${hash(c.id)}</dd><dt>Current employer</dt><dd>${escape(candidateCompany(c))}</dd><dt>Primary skill areas</dt><dd>${escape(pick(['Manufacturing systems, stakeholder management','Cloud operations, incident response','Hardware validation, supplier coordination','Program management, process design'], c.id))}</dd></dl></section>`;
      }
    };
    document.querySelectorAll('#profileTabs button').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('#profileTabs button').forEach(x => x.classList.toggle('active', x === b));
      drawTab(b.dataset.tab);
    }));
    document.querySelectorAll('[data-action]').forEach(el => el.addEventListener('click', ev => {
      ev.preventDefault();
      toast(`${el.dataset.action}: local preview only. No email, calendar, or production action was triggered.`);
    }));
    drawTab('Profile');
  }

  function simpleTable(headers, rows) {
    return `<div class="mock-table-wrap"><table class="mock-table"><thead><tr>${headers.map(h=>`<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(row=>`<tr>${row.map(v=>`<td>${escape(v)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}" class="mock-empty">No synthetic records.</td></tr>`}</tbody></table></div>`;
  }

  function renderTa() {
    if (params.has('req') && !selected) return showMissing('The link does not match a synthetic requisition.');
    if (!selected) return renderTaList();
    const candidateId = params.get('candidate');
    const c = selected.candidates.find(x => x.id === candidateId);
    if (candidateId && !c) return showMissing('The candidate is not part of this synthetic requisition.');
    if (c) return renderCandidate(selected, c);
    return renderPipeline(selected);
  }

  function ecShell(title) {
    return `<header class="ec-top"><div class="ec-logo">EC</div><nav><a class="active">Job Requisitions</a><a>Recruiting</a><a>Admin Center</a></nav><span class="ec-fill"></span><span class="ec-badge">1</span><span>▣</span><span>?</span><span>♧</span><span class="ec-face">DU</span></header><div class="ec-underbar"><b>${escape(title)}</b><button id="ecHelp">Help</button><a href="${taLink(selected)}">Open TA Hub view</a></div>`;
  }
  function renderEc() {
    if (params.has('req') && !selected) return showMissing('The EC link does not match a synthetic requisition.');
    const scoped = selected ? [selected] : reqs;
    content.innerHTML = ecShell('Job Requisitions') + `<main class="ec-page"><section class="ec-panel"><div class="ec-title"><h1>Job Requisitions</h1><button>Offers</button></div><div class="ec-toolbar"><button>Columns</button><button>Filters</button><input id="ecSearch" placeholder="Search by requisition, title, manager, status"><select id="ecFilter"><option value="all">All statuses</option><option value="hired">Hired pending close</option><option value="open">Open</option><option value="preApproval">Pre-Approval</option></select></div><div class="ec-table-wrap"><table class="ec-table"><thead><tr><th>Req ID</th><th>Position</th><th>Hiring Manager</th><th>Status</th><th>Applicants</th><th>Onboarding Admin</th><th>Action</th></tr></thead><tbody id="ecRows"></tbody></table></div><p id="ecMessage" role="status"></p><button id="resetEc">Reset EC demo</button></section></main>${ecWelcomeVisible ? welcomeOverlay() : ''}`;
    const closed = new Set();
    const draw = () => {
      const q = document.getElementById('ecSearch').value.toLowerCase();
      const f = document.getElementById('ecFilter').value;
      const rows = scoped.filter(r => {
        const statusKey = r.lifecycle?.preApproval ? 'preApproval' : r.lifecycle?.hired ? 'hired' : 'open';
        return (f === 'all' || f === statusKey) && (`${r.reqId} ${r.title} ${r.hm} ${statusKey}`).toLowerCase().includes(q);
      });
      document.getElementById('ecRows').innerHTML = rows.map(r => {
        const statusText = closed.has(r.reqId) ? 'Closed (simulated)' : r.lifecycle?.preApproval ? 'Pre-Approval' : r.lifecycle?.hired ? 'Hired · Pending EC close' : 'Open';
        return `<tr data-reqid="${escape(r.reqId)}"><td><a href="${taLink(r)}">${escape(r.reqId)}</a></td><td><a href="${taLink(r)}">${escape(r.title)}</a></td><td>${escape(r.hm)} <span class="mini-card">▣</span></td><td id="ec-status-${escape(r.reqId)}">${escape(statusText)}</td><td>${total(r,'all')}</td><td>${escape(pick(['Annie Yang','Jordan Ray','Casey Quinn','Riley Stone'], r.reqId))} <span class="mini-card">▣</span></td><td>${r.lifecycle?.hired && !closed.has(r.reqId) ? `<button data-close-req="${escape(r.reqId)}">Simulate close</button>` : `<a href="${taLink(r)}">Open</a>`}</td></tr>`;
      }).join('') || '<tr><td colspan="7" class="empty-row">No matching synthetic requisitions.</td></tr>';
      document.querySelectorAll('[data-close-req]').forEach(b => b.addEventListener('click', () => {
        closed.add(b.dataset.closeReq);
        document.getElementById('ecMessage').textContent = `${b.dataset.closeReq} closed in this local preview only. No production changes.`;
        draw();
      }));
    };
    document.getElementById('ecSearch').addEventListener('input', draw);
    document.getElementById('ecFilter').addEventListener('change', draw);
    document.getElementById('resetEc').addEventListener('click', () => { closed.clear(); document.getElementById('ecMessage').textContent = 'EC demo reset for this page.'; draw(); });
    document.getElementById('ecHelp').addEventListener('click', () => { ecWelcomeVisible = true; renderEc(); });
    document.querySelectorAll('[data-dismiss-welcome]').forEach(b => b.addEventListener('click', () => { ecWelcomeVisible = false; renderEc(); }));
    draw();
  }

  function welcomeOverlay() {
    return `<div class="welcome-scrim"><section class="welcome-modal"><div class="welcome-art"><div class="monitor"><i></i><i></i><i></i></div><div class="desk"></div><div class="books"></div></div><h2>Welcome to the recruiting experience, starting in Employee Central</h2><p>Employee Central &gt; Recruiting will support the following requisition management tasks:</p><ul><li><a>Creating and editing requisitions</a></li><li><a>Assigning a recruiter</a></li><li><a>Posting to career sites</a></li></ul><p>For more information, access the resources below.</p><div class="welcome-links"><a>Talent Acquisition Hub Training</a><a>Setup &amp; Prepare Recruiting Procedure</a></div><p>To get started, select 'Next'.</p><footer><button data-dismiss-welcome>Don't show this message again</button><button data-dismiss-welcome class="next">Next</button></footer></section></div>`;
  }

  function renderDisposition() {
    const candidates = reqs.flatMap(r => r.candidates.map(c => ({r,c})));
    content.innerHTML = taHeader() + `<main class="mock-shell"><section class="missing-card"><h2>Candidate matching preview</h2><p>Offline, synthetic suggestions only. Nothing is submitted, added to a talent pool, or emailed.</p><label for="demoCandidate">Select a fake candidate</label><select id="demoCandidate">${candidates.map(({r,c},i)=>`<option value="${i}">${escape(c.name)} · ${escape(r.reqId)}</option>`).join('')}</select><button id="findDemoMatches">Find demo matches</button><div id="demoMatches"></div></section></main>`;
    document.getElementById('findDemoMatches').addEventListener('click', () => {
      const {r,c} = candidates[Number(document.getElementById('demoCandidate').value)];
      const matches = reqs.filter(x => x.reqId !== r.reqId && !x.lifecycle?.hired && !x.lifecycle?.preApproval).slice(0,3);
      document.getElementById('demoMatches').innerHTML = `<h3>Illustrative matches for <a href="${taLink(r,c)}">${escape(c.name)}</a></h3>${simpleTable(['Req ID','Position','HM','Reason'], matches.map(x => [x.reqId, x.title, x.hm, 'Synthetic example — not a real match assessment']))}`;
    });
  }

  if (view === 'ta') renderTa();
  if (view === 'ec') renderEc();
  if (view === 'disposition') renderDisposition();
  if (view) return;

  // Resolve context from report rows/cards, not from a guessed first requisition.
  function contextFor(a){
    const direct=a.closest('[data-reqid],[data-req-id],[id^="req-DEMO-REQ-"]');
    let id=direct?.dataset.reqid||direct?.dataset.reqId||direct?.id?.replace(/^req-/,'');
    if(byId.has(id))return byId.get(id);
    const text=a.textContent.trim();
    const exactId=text.match(/DEMO-REQ-\d{3}/)?.[0];
    if(byId.has(exactId))return byId.get(exactId);
    let p=a.parentElement;
    while(p&&p!==document.body){
      const ids=[...new Set((p.textContent.match(/DEMO-REQ-\d{3}/g)||[]))];
      if(ids.length===1&&byId.has(ids[0]))return byId.get(ids[0]);
      if(ids.length>1)break;
      p=p.parentElement;
    }
    const candidates=reqs.filter(r=>r.candidates.some(c=>c.name===text));
    if(candidates.length===1)return candidates[0];
    return undefined;
  }
  function wireLinks(){
    document.querySelectorAll('a[href="#demo-link"]').forEach(a=>{
      const r=contextFor(a), text=a.textContent.trim(), c=r?.candidates.find(c=>c.name===text);
      if (/Open full dashboard/i.test(text)) {
        a.href=url('ta-hub-dashboards.html');a.target='_blank';a.rel='noopener';
        return;
      }
      const isEc=/\bEC\b/i.test(text+' '+(a.title||''));
      a.href=isEc?ecLink(r):taLink(r,c);a.target='_blank';a.rel='noopener';
      a.dataset.demoDestination=isEc?'ec':c?'candidate':'req';
      a.title='Open local '+(isEc?'EC':'TA Hub')+' simulation'+(r?' · '+r.reqId:'');
    });
    if(location.pathname.endsWith('/req-sla-dashboard.html')){
      document.querySelectorAll('#tbody tr').forEach(tr=>{
        const id=tr.textContent.match(/DEMO-REQ-\d{3}/)?.[0],r=byId.get(id);
        if(r?.lifecycle?.hired&&!tr.querySelector('.demo-ec-link')){
          const a=document.createElement('a');a.className='demo-ec-link';a.textContent='Open EC list';a.href=ecLink(r);a.target='_blank';a.rel='noopener';tr.lastElementChild.appendChild(a);
        }
      });
    }
  }
  wireLinks();
  const observer=new MutationObserver(wireLinks);
  observer.observe(document.body,{childList:true,subtree:true});
})();
