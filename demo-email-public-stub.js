(() => {
  'use strict';
  function escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  window.DemoEmail = {
    report(rows, title) {
      const reqs = Array.isArray(rows) ? rows : [];
      return `
        <section style="font-family:Segoe UI,Aptos,sans-serif;line-height:1.45">
          <h1>${escape(title || 'Hiring Progress Report')}</h1>
          <p>This public demo shows synthetic data only. Email sending and draft creation are disabled.</p>
          <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse">
            <thead><tr><th>Req ID</th><th>Position</th><th>HM</th><th>Review</th><th>Screen</th><th>Interview</th></tr></thead>
            <tbody>${reqs.map(r => `<tr><td>${escape(r.reqId)}</td><td>${escape(r.title)}</td><td>${escape(r.hm)}</td><td>${escape(r.review)}</td><td>${escape(r.screen)}</td><td>${escape(r.interview)}</td></tr>`).join('')}</tbody>
          </table>
        </section>`;
    },
    open({ title, html }) {
      const win = window.open('', '_blank', 'noopener,noreferrer,width=980,height=720');
      if (!win) return;
      win.document.write(`<!doctype html><meta charset="utf-8"><title>${escape(title || 'Demo report')}</title>${html || ''}`);
      win.document.close();
    }
  };
})();
