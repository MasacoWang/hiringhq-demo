(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const colors = getComputedStyle(document.documentElement);
  const color = (name, fallback) => colors.getPropertyValue(name).trim() || fallback;
  const border = color('--cp-border', 'GrayText');
  const accent = color('--cp-accent', 'LinkText');
  const cell = `padding:10px;border:1px solid ${border};text-align:left;vertical-align:top;overflow-wrap:anywhere`;
  const table = (headers, rows) => `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px;margin:12px 0"><thead><tr>${headers.map(h => `<th style="${cell};background:${color('--cp-surface-soft','ButtonFace')}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map(v => `<td style="${cell}">${v}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}" style="${cell}">No records in this selection.</td></tr>`}</tbody></table>`;
  function report(reqs, title) {
    const count = key => reqs.reduce((sum, r) => sum + Number(r.totals?.[key] || r.lifecycle?.[key] || 0), 0);
    let html = `<h1 style="font-size:24px;color:${accent}">${esc(title)}</h1><p>Synthetic demo report - all people and requisitions below are fictional.</p>`;
    html += table(['Requisitions','Review','Screen','Interview','Offer','Pre-Hire','Hired'], [[reqs.length, count('review'), count('screen'), count('interview'), count('offer'), count('preHire'), count('hired')].map(esc)]);
    html += '<h2 style="font-size:18px">Requisition overview</h2>';
    html += table(['Req ID','Position','Hiring manager','Days open','Status'], reqs.map(r => [r.reqId,r.title,r.hm,r.daysOpen,r.lifecycle?.preApproval?'Pre-Approval':r.lifecycle?.hired?'Hired':r.candidates.length?'In progress':'Not started'].map(esc)));
    for (const r of reqs) {
      html += `<h2 style="font-size:18px;color:${accent}">${esc(r.reqId)} | ${esc(r.title)}</h2><p>Hiring manager: ${esc(r.hm)} | Days open: ${esc(r.daysOpen)}</p>`;
      html += table(['Candidate','Stage','Feedback','Schedule'], r.candidates.map(c => [
        esc(c.name), esc(c.stage),
        c.entries.length ? c.entries.map(e => `${esc(e.reviewerName || 'Reviewer')} - ${esc(e.formName || e.category || 'Feedback')}: <b>${esc(e.decision || e.status || 'Pending')}</b>${e.date ? ' ('+esc(e.date)+')' : ''}`).join('<br>') : 'No feedback',
        c.meetings.length ? c.meetings.map(m => `${esc(m.title || m.meetingType || 'Interview')} - ${esc(m.status || m.scheduleStatus || '')}<br>${esc(m.dateTime || m.date || m.startTime || '')}`).join('<br><br>') : 'No meetings'
      ]));
    }
    return html;
  }
  function plainText(html) {
    const node = document.createElement('div');
    node.innerHTML = html.replace(/<\/(?:p|h[1-6]|tr|table)>/gi, '$&\n').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(?:th|td)>/gi, '$&\t');
    return node.textContent.trim();
  }
  function download(content, type, name) {
    const objectUrl = URL.createObjectURL(new Blob([content], {type}));
    const a = document.createElement('a');
    a.href = objectUrl; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
  }
  function base64(value) {
    let binary = '';
    for (const byte of new TextEncoder().encode(value)) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
  function emailSafeHtml(html) {
    const node = document.createElement('div');
    node.innerHTML = html;
    // Local demo navigation cannot work for a recipient on another computer.
    node.querySelectorAll('a[href]').forEach(link => {
      const url = new URL(link.getAttribute('href'), location.href);
      if (url.protocol === 'file:' || url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
        link.replaceWith(...link.childNodes);
      }
    });
    return node.innerHTML;
  }
  function attachDelivery(current, recipient, title, html) {
    const start = current.querySelector('#demoEmailSend');
    const delivery = current.querySelector('#demoEmailDelivery');
    let busy = false;
    current.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    start.onclick = async () => {
      delivery.hidden = false;
      delivery.replaceChildren();
      if (location.origin !== 'http://127.0.0.1:8778') {
        delivery.innerHTML = '<p>Direct sending needs the local Outlook email bridge. Open <b>OPEN FAKE DATA DASHBOARD.cmd</b> from the demo folder, then use Send to recruiter in that window. Copy, .eml and composer still work here.</p><a href="http://127.0.0.1:8778/ta-hub-dashboards.html#reports" target="_blank" rel="noopener">Open sending-enabled demo (if already running)</a>';
        return;
      }
      if (!recipient.value.trim() || !recipient.checkValidity() || /[\r\n]/.test(recipient.value) || /\.invalid$/i.test(recipient.value)) {
        delivery.textContent = 'Enter one real recruiter email address first. Example / .invalid addresses cannot receive mail.';
        recipient.focus(); recipient.reportValidity();
        return;
      }
      start.disabled = true;
      delivery.textContent = 'Connecting to the signed-in desktop Outlook account...';
      try {
        const response = await fetch('/api/email/session', {signal:AbortSignal.timeout(20000),cache:'no-store'});
        const session = await response.json();
        if (!response.ok) throw new Error(session.message || session.error || 'Outlook connection failed');
        if (session.offline) throw new Error('Outlook is offline. Connect Outlook before sending.');
        if (!session.token || !Array.isArray(session.accounts) || !session.accounts.length) throw new Error('No Outlook sending account is available.');
        delivery.innerHTML = '<h3>Review real email delivery</h3><label>From: <select id="demoEmailFrom"></select></label><p id="demoEmailEnvelope"></p><p>The complete HTML report shown below will be sent as the email body, not an attachment. It contains only synthetic demonstration data.</p><label style="display:block;margin:12px 0"><input id="demoEmailConsent" type="checkbox"> I reviewed the sender, recipient, subject and full report below and confirm sending this real email.</label><button type="button" id="demoEmailConfirm" disabled>Confirm and send HTML email</button><p id="demoEmailSendStatus" role="status"></p>';
        const sender = delivery.querySelector('#demoEmailFrom');
        if (session.accounts.length > 1) sender.add(new Option('Choose sending account',''));
        session.accounts.forEach(account => sender.add(new Option(`${account.name || account.email} <${account.email}>`,account.email)));
        const envelope = delivery.querySelector('#demoEmailEnvelope');
        const consent = delivery.querySelector('#demoEmailConsent');
        const confirm = delivery.querySelector('#demoEmailConfirm');
        const sendStatus = delivery.querySelector('#demoEmailSendStatus');
        let submittedPayload = null, storedAttempt = null, storageKey = '';
        const showEnvelope = () => {
          envelope.textContent = `To: ${recipient.value.trim()} | Subject: ${title}`;
          consent.checked = false;
          confirm.disabled = true;
        };
        showEnvelope();
        const invalidate = () => {
          if (busy || submittedPayload) return;
          showEnvelope();
          sendStatus.textContent = 'Details changed. Review and confirm again before sending.';
        };
        recipient.oninput = invalidate;
        sender.addEventListener('change', invalidate);
        consent.onchange = () => {
          confirm.disabled = !consent.checked || !sender.value || !recipient.value.trim() || !recipient.checkValidity();
        };
        const setBusy = value => {
          busy = value;
          current.querySelector('#demoEmailClose').disabled = value;
          confirm.disabled = value;
          start.disabled = value || Boolean(submittedPayload);
          sender.disabled = value || Boolean(submittedPayload);
          recipient.readOnly = value || Boolean(submittedPayload);
          consent.disabled = value || Boolean(submittedPayload);
        };
        confirm.onclick = async () => {
          if (busy) return;
          if (!submittedPayload && (!consent.checked || !sender.value || !recipient.value.trim() || !recipient.checkValidity() || /\.invalid$/i.test(recipient.value))) {
            sendStatus.textContent = 'Review the sender and enter a real recipient before confirming.';
            return;
          }
          setBusy(true);
          let requestStarted = false;
          try {
            if (!submittedPayload) {
              const payload = {from:sender.value,to:recipient.value.trim(),subject:title,html,confirmed:true};
              const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)));
              storageKey = 'taHubDemoEmail:' + Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
              const stored = localStorage.getItem(storageKey);
              storedAttempt = stored ? JSON.parse(stored) : {requestId:crypto.randomUUID(),status:'pending'};
              if (!storedAttempt.requestId) throw new Error('The saved email attempt is invalid. No send was attempted.');
              if (storedAttempt.status === 'submitted') {
                submittedPayload = {...payload,requestId:storedAttempt.requestId};
                sendStatus.textContent = `This exact report was already submitted to Outlook for ${payload.to}. No duplicate was sent. Check Sent Items / Outbox.`;
                return;
              }
              // Persist before the request so refresh/reopen cannot silently send a duplicate.
              localStorage.setItem(storageKey,JSON.stringify(storedAttempt));
              submittedPayload = {...payload,requestId:storedAttempt.requestId};
            }
            sendStatus.textContent = 'Submitting the HTML email to Outlook. Please wait; do not send another copy.';
            requestStarted = true;
            const result = await fetch('/api/email/send', {
              method:'POST',
              headers:{'Content-Type':'application/json','X-Demo-Token':session.token},
              body:JSON.stringify(submittedPayload),
              signal:AbortSignal.timeout(75000)
            });
            const outcome = await result.json();
            if (outcome.status === 'submitted') {
              storedAttempt.status = 'submitted';
              localStorage.setItem(storageKey,JSON.stringify(storedAttempt));
              sendStatus.textContent = `Submitted to Outlook for ${submittedPayload.to}. The full HTML report is the email body. Delivery is not yet confirmed; check Sent Items / Outbox.`;
            } else {
              sendStatus.textContent = `${outcome.message || outcome.error || 'Outlook did not confirm submission.'} No automatic retry. Check Outlook before trying another report.`;
              if (outcome.status === 'unknown' || outcome.status === 'pending') {
                confirm.textContent = 'Check submission status';
              } else {
                confirm.textContent = 'Submission not confirmed';
                confirm.dataset.blocked = 'true';
              }
            }
          } catch (error) {
            sendStatus.textContent = requestStarted
              ? `Submission status is unknown: ${error.message}. Do not send another copy. Check Outlook or use Check submission status (same request, no duplicate).`
              : `Could not prepare safe delivery: ${error.message}. No email was submitted by this action.`;
            if (requestStarted) confirm.textContent = 'Check submission status';
          } finally {
            setBusy(false);
            confirm.disabled = storedAttempt?.status === 'submitted' || confirm.dataset.blocked === 'true';
          }
        };
      } catch (error) {
        delivery.textContent = `Direct sending is unavailable: ${error.message}. Start OPEN FAKE DATA DASHBOARD.cmd and ensure classic Outlook is signed in. Copy, .eml and composer remain available.`;
      } finally {
        if (!busy) start.disabled = false;
      }
    };
  }
  let dialog;
  function open({title, html}) {
    if (dialog) dialog.remove();
    const previousFocus = document.activeElement;
    const wrapped = `<div style="font-family:Segoe UI,Aptos,Calibri,sans-serif;line-height:1.5;color:${color('--cp-text','CanvasText')};background:${color('--cp-surface','Canvas')};padding:20px">${emailSafeHtml(html)}<p style="font-size:12px">Disclaimer: All candidate, requisition, interview, and hiring information shown in this demo is synthetic data generated for demonstration purposes only.</p></div>`;
    const text = plainText(wrapped);
    dialog = document.createElement('dialog');
    dialog.id = 'demoEmailDialog';
    dialog.setAttribute('aria-label', 'Formatted email report');
    dialog.style.cssText = 'width:min(1100px,92vw);max-height:90vh;border:1px solid var(--cp-border);border-radius:16px;background:var(--cp-surface,Canvas);color:var(--cp-text,CanvasText);padding:20px;font-family:Segoe UI,Aptos,Calibri,sans-serif';
    dialog.innerHTML = `<h2 style="margin-top:0">Email report</h2><p><b>Subject:</b> ${esc(title)}</p><label>Recruiter email (required for direct send): <input id="demoEmailTo" type="email" placeholder="Enter recipient yourself" style="min-width:260px"></label><p>Send the full HTML report directly through Outlook after review and confirmation, or use the existing copy, draft and composer options. Nothing is sent automatically.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" id="demoEmailSend">Send to recruiter</button><button type="button" id="demoEmailCopy">Copy formatted report</button><button type="button" id="demoEmailDraft">Save email draft (.eml)</button><button type="button" id="demoEmailCompose">Open email composer</button><button type="button" id="demoEmailClose">Close</button></div><p id="demoEmailStatus" role="status"></p><section id="demoEmailDelivery" hidden style="padding:12px;border:1px solid var(--cp-border);border-radius:10px"></section><div id="demoEmailBody" tabindex="0" style="margin-top:16px;overflow:auto;max-height:55vh;border:1px solid var(--cp-border)">${wrapped}</div>`;
    document.body.appendChild(dialog);
    const current = dialog;
    const body = current.querySelector('#demoEmailBody');
    const status = current.querySelector('#demoEmailStatus');
    const recipient = current.querySelector('#demoEmailTo');
    attachDelivery(current,recipient,title,wrapped);
    const selectReport = () => {
      body.focus();
      const range = document.createRange(); range.selectNodeContents(body);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    };
    async function copyReport() {
      let lastError;
      if (navigator.clipboard?.write && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([wrapped],{type:'text/html'}),'text/plain':new Blob([text],{type:'text/plain'})})]);
          status.textContent = 'Formatted report copied. Paste into Outlook with Ctrl+V, review the recipient, then send.';
          return true;
        } catch (error) { lastError = error; }
      }
      selectReport();
      // Local-file iframes may deny the async Clipboard API; copy both formats in the user gesture.
      const onCopy = event => {
        event.clipboardData.setData('text/html', wrapped);
        event.clipboardData.setData('text/plain', text);
        event.preventDefault();
      };
      document.addEventListener('copy', onCopy);
      let copied = false;
      try { copied = document.execCommand('copy'); }
      catch (error) { lastError = error; }
      finally { document.removeEventListener('copy', onCopy); }
      if (copied) status.textContent = 'Formatted report copied. Paste into Outlook with Ctrl+V, review the recipient, then send.';
      else {
        console.warn('Formatted clipboard copy unavailable', lastError || 'Copy command declined');
        status.textContent = 'Browser blocked automatic copying. The report is selected: press Ctrl+C, then paste into Outlook, or save the .eml draft.';
      }
      return copied;
    }
    async function copy() {
      const button = current.querySelector('#demoEmailCopy');
      if (button.disabled) return false;
      button.disabled = true;
      status.textContent = 'Copying formatted report...';
      try { return await copyReport(); }
      finally { button.disabled = false; }
    }
    function validRecipient() {
      if (recipient.value.includes('\r') || recipient.value.includes('\n') || !recipient.checkValidity()) {
        recipient.reportValidity(); status.textContent = 'Enter a valid email address or leave it blank.'; return false;
      }
      return true;
    }
    current.querySelector('#demoEmailCopy').onclick = copy;
    current.querySelector('#demoEmailDraft').onclick = () => {
      if (!validRecipient()) return;
      const subject = Array.from(title.replace(/[\r\n]/g,' '));
      const words = [];
      for (let i = 0; i < subject.length; i += 10) words.push(`=?UTF-8?B?${base64(subject.slice(i,i+10).join(''))}?=`);
      const subjectHeader = words.join('\r\n ');
      const encoded = base64(`<!doctype html><html><head><meta charset="utf-8"></head><body>${wrapped}</body></html>`).match(/.{1,76}/g).join('\r\n');
      const message = `X-Unsent: 1\r\n${recipient.value ? 'To: '+recipient.value+'\r\n' : ''}Subject: ${subjectHeader}\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${encoded}\r\n`;
      download(message, 'message/rfc822', title.replace(/[^\w -]/g,'').slice(0,90)+'.eml');
      status.textContent = 'Email draft downloaded with the full formatted report. Open it in Outlook, review the recipient, and send manually.';
    };
    current.querySelector('#demoEmailCompose').onclick = () => {
      if (!validRecipient()) return;
      const a = document.createElement('a');
      a.href = `mailto:${encodeURIComponent(recipient.value)}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent('Paste the formatted report here (Ctrl+V) after selecting Copy formatted report in the demo.')}`;
      a.click();
      status.textContent = 'Email composer requested. Use Copy formatted report, replace the placeholder with Ctrl+V, and review before sending. For the complete prefilled report, use Save email draft (.eml).';
    };
    current.querySelector('#demoEmailClose').onclick = () => current.close();
    current.addEventListener('close', () => { current.remove(); previousFocus?.focus(); });
    current.showModal();
    void copy();
  }
  window.DemoEmail = {open, report};
  document.addEventListener('click', event => {
    const button = event.target.closest('.idone-hm-btn');
    if (!button) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const row = button.closest('tr');
    const reqId = button.closest('[data-idone-req]')?.dataset.idoneReq || row?.dataset.reqid || row?.textContent.match(/DEMO-REQ-\d{3}/)?.[0];
    const req = window.DEMO_DATA.reqs.find(r => r.reqId === reqId);
    if (!req) throw new Error('Cannot identify the requisition for this email report');
    const title = `Interview complete - ${req.reqId} - ${req.title}`;
    open({title, html:`<p>Hi ${esc(req.hm)},</p><p>Please review interview feedback and confirm the next step / final decision.</p>`+report([req],title)});
  }, true);
})();
