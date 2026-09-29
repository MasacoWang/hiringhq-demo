(() => {
  'use strict';
  const data=window.DEMO_DATA;
  if(!data)throw new Error('Synthetic hub data is missing');
  const views={
    daily:{title:'Hiring Progress Overview',desc:'Progress & status overview for every req (one row per candidate): pipeline stage, latest feedback, upcoming interview, plus full-portfolio stats and Offer/Pre-Hire/Hired and Not-Started blocks. Each column filters, headers sort, and candidate/req links are clickable.',src:'daily-report-table.html'},
    combined:{title:'Feedback + Schedule dashboard',desc:'Combined view that compares feedback status with schedule status. One row per candidate with current stage, latest feedback, the stage-aware interview/phone-screen schedule, and candidate source.',src:'combined-feedback-schedule-dashboard.html'},
    req:{title:'TA Hub Req SLA dashboard',desc:'Per-req SLA: New App 7–13d/≥14d aging, 5-day OA disposition, and Hire/EC close. Self-scrapes on each Req SLA run.',src:'req-sla-dashboard.html'},
    reports:{title:'Reports',desc:'Generate hiring-progress emails: a Daily Recruiter report to yourself (with optional auto-send schedule), and a per-HM Weekly report saved as an Outlook draft or emailed to yourself.'},
    disposition:{title:'Disposition Helper',desc:'When dispositioning a candidate: paste their Career Hub profile link to see better-matched open positions (to add into the disposition email) and add them to a suitable Talent Pool. Runs locally against your signed-in Career Hub session; never submits disposition or sends email for you.',src:'demo-disposition.html'}
  };
  const frame=document.getElementById('dashboardFrame'), panel=document.getElementById('reportsPanel'),open=document.getElementById('openLink');
  // Auto-grow the iframe to its content height so the whole dashboard flows into the page and the
  // outer window scrolls — makes "zoom out to see everything" work instead of trapping content in
  // a fixed-height inner scroll box.
  function resizeFrameToContent(){
    try{
      const doc=frame.contentDocument;
      if(!doc||!doc.body)return;
      const h=Math.max(doc.documentElement.scrollHeight,doc.body.scrollHeight);
      if(h>0&&Math.abs(parseInt(frame.style.height||0,10)-h)>2)frame.style.height=h+'px';
    }catch(e){}
  }
  let frameRO=null;
  function attachFrameAutoResize(){
    resizeFrameToContent();
    try{
      const doc=frame.contentDocument;
      if(frameRO)frameRO.disconnect();
      frameRO=new ResizeObserver(()=>resizeFrameToContent());
      if(doc&&doc.body)frameRO.observe(doc.body);
      if(doc&&doc.documentElement)frameRO.observe(doc.documentElement);
    }catch(e){}
    let ticks=0;const poll=setInterval(()=>{resizeFrameToContent();if(++ticks>24)clearInterval(poll);},250);
  }
  frame.addEventListener('load',attachFrameAutoResize);
  window.addEventListener('resize',resizeFrameToContent);
  let current='';
  function setTab(tab){
    const key=Object.hasOwn(views,tab)?tab:'daily',view=views[key];
    document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===key));
    document.getElementById('viewerTitle').textContent=view.title;
    document.getElementById('viewerDesc').textContent=view.desc;
    const reports=key==='reports';
    frame.style.display=reports?'none':'block';panel.style.display=reports?'flex':'none';open.style.display=reports?'none':'inline-block';
    if(view.src){frame.title=view.title;if(current!==key)frame.src=view.src;open.href=view.src;}
    current=key;
    if(location.hash!=='#'+key)history.replaceState(null,'','#'+key);
  }
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
  window.addEventListener('hashchange',()=>setTab(location.hash.slice(1)));
  setTab(location.hash.slice(1));
  const status=document.getElementById('serverStatus');status.textContent='● Offline demo · synthetic data only';status.className='server-status up';
  const refreshHelp=document.getElementById('refreshHelp'); if(refreshHelp) refreshHelp.style.display='none';
  document.getElementById('refreshAllBtn').onclick=()=>{
    if(current!=='reports')frame.src=views[current].src;
    document.getElementById('refreshMsg').textContent='Saved demo data reloaded. No live scrape.';
  };
  const hmSelect=document.getElementById('hmSelect');
  [...new Set(data.reqs.map(r=>r.hm))].sort().forEach(hm=>{const o=document.createElement('option');o.value=hm;o.textContent=hm;hmSelect.appendChild(o);});
  const fresh=document.getElementById('hmFresh');fresh.checked=false;fresh.disabled=true;fresh.parentElement.title='Live refresh is disabled in the synthetic demo.';
  const scheduleStatus=document.getElementById('recSchedStatus');scheduleStatus.textContent='Demo schedule is off. No scheduled task is created.';
  function parseEnglishTime(value){
    const match=String(value||'').trim().match(/^(0?[1-9]|1[0-2]):([0-5][0-9])\s*([AP])M$/i);
    if(!match)return null;
    const hour12=Number(match[1]), minute=match[2], ampm=match[3].toUpperCase()+'M';
    const hour24=ampm==='AM'?(hour12===12?0:hour12):(hour12===12?12:hour12+12);
    return {display:String(hour12).padStart(2,'0')+':'+minute+' '+ampm,hour24,minute:Number(minute)};
  }
  function setTimeValid(ok){
    const wrap=document.getElementById('recTimeField');
    const input=document.getElementById('recTime');
    if(wrap)wrap.classList.toggle('invalid',!ok);
    if(input)input.setAttribute('aria-invalid', ok?'false':'true');
    scheduleStatus.classList.toggle('warn',!ok);
    scheduleStatus.classList.toggle('on',ok&&/weekdays at/.test(scheduleStatus.textContent));
  }
  function safeButton(id, handler){
    const old=document.getElementById(id), btn=old.cloneNode(true);
    old.replaceWith(btn);
    btn.addEventListener('click', handler);
    return btn;
  }
  safeButton('recSchedSet', ()=>{
    const input=document.getElementById('recTime');
    const parsed=parseEnglishTime(input.value);
    if(!parsed){
      scheduleStatus.textContent='Enter a valid English time, e.g. 01:00 PM. No demo schedule was created.';
      setTimeValid(false);
      return;
    }
    input.value=parsed.display;
    scheduleStatus.textContent='Demo schedule: weekdays at '+parsed.display+' (simulation only).';
    setTimeValid(true);
  });
  const recTime=document.getElementById('recTime');
  if(recTime)recTime.addEventListener('input',()=>setTimeValid(true));
  safeButton('recSchedOff', ()=>{scheduleStatus.textContent='Demo schedule is off. No scheduled task is created.';setTimeValid(true);});
  document.querySelectorAll('.hm-btn[data-mode]').forEach(b=>b.onclick=()=>{
    const isDaily=b.classList.contains('rec-btn'), hm=hmSelect.value;
    const rows=isDaily||hm==='all'?data.reqs:data.reqs.filter(r=>r.hm===hm);
    const title=isDaily?'Daily Recruiter — Hiring Progress Overview':`Weekly Hiring Manager — ${hm==='all'?'All HMs':hm}`;
    window.DemoEmail.open({title,html:window.DemoEmail.report(rows,title)});
    document.getElementById('hmMsg').textContent='Formatted report ready · '+rows.length+' synthetic requisitions. Send to recruiter after confirmation, or copy / save an email draft.';
  });
})();
