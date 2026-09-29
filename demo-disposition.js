(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const input = $("candidate-url");
  const scan = $("scan-button");
  const analysis = $("analysis");
  const copy = $("copy-button");
  const pool = $("profile-link");
  const disposition = $("disposition-button");
  const toast = $("toast");
  const reqs = (window.DEMO_DATA?.reqs || []).filter(req => /^DEMO-REQ-\d+$/.test(req.reqId));
  const candidates = reqs.flatMap(req => (req.candidates || [])
    .filter(candidate => /^DEMO-ID-\d+$/.test(candidate.id))
    .map(candidate => ({ req, candidate })));
  const localHub = new URL("demo-ta-hub.html", window.location.href);
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  let generation = 0;
  let timers = [];
  let current = null;
  let result = null;

  function localUrl(req, candidate) {
    const url = new URL(localHub.href);
    url.searchParams.set("req", req.reqId);
    if (candidate) url.searchParams.set("candidate", candidate.id);
    url.searchParams.set("scoutTheme", document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    return url.href;
  }

  function resolveCandidate() {
    if (!input.value.trim()) return null;
    try {
      const url = new URL(input.value.trim(), window.location.href);
      if (url.protocol !== localHub.protocol || url.host !== localHub.host ||
          url.pathname !== localHub.pathname || url.username || url.password) return null;
      if (url.searchParams.getAll("candidate").length !== 1 ||
          url.searchParams.getAll("req").length > 1) return null;
      const id = url.searchParams.get("candidate");
      const reqId = url.searchParams.get("req");
      const matches = candidates.filter(entry => entry.candidate.id === id &&
        (reqId === null || entry.req.reqId === reqId));
      // An ID shared across applications needs explicit requisition context.
      return matches.length === 1 ? matches[0] : null;
    } catch {
      return null;
    }
  }

  function setStep(active) {
    document.querySelectorAll("[data-step]").forEach(step => {
      const number = Number(step.dataset.step);
      step.classList.toggle("is-active", number === active);
      step.classList.toggle("is-complete", number < active);
      if (number === active) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
    });
  }

  function status(title, detail) {
    $("status").querySelector("strong").textContent = title;
    $("status-detail").textContent = detail;
  }

  function invalidate() {
    generation += 1;
    timers.forEach(clearTimeout);
    timers = [];
    current = null;
    result = null;
    document.body.dataset.state = "blank";
    analysis.innerHTML = "";
    analysis.setAttribute("aria-busy", "false");
    ["workflow", "analysis", "actions", "workflow-hint", "copy-button", "disposition-button"]
      .forEach(id => $(id).classList.add("hidden"));
    copy.disabled = true;
    pool.disabled = true;
    disposition.disabled = true;
    scan.textContent = "Scan page";
    toast.textContent = "";
    setStep(1);
    const candidate = resolveCandidate();
    scan.disabled = !candidate;
    input.setAttribute("aria-invalid", String(Boolean(input.value.trim()) && !candidate));
    if (!input.value.trim()) {
      status("Paste a candidate profile link to begin.",
        "The helper starts blank so it never shows a previous candidate by accident.");
    } else if (candidate) {
      status("Ready to scan this synthetic candidate.",
        `${candidate.candidate.name} · ${candidate.req.reqId}. No live calls will be made.`);
    } else {
      status("Enter a known local demo candidate URL.",
        "Choose a synthetic example or paste its demo-ta-hub.html link. Unknown candidates, mismatched requisitions and external URLs are not accepted.");
    }
  }

  function isUnavailable(req) {
    const states = [req.status, req.state, req.sla?.status, req.lifecycle?.status].filter(Boolean).join(" ");
    return Boolean(req.closed || req.isClosed || req.preApproval || req.sla?.preApproval ||
      req.lifecycle?.preApproval || req.lifecycle?.closed || req.lifecycle?.isClosed ||
      req.lifecycle?.hired || req.sla?.hired ||
      /closed|cancelled|canceled|filled|pre[\s-]?approval/i.test(states));
  }

  function buildResult(entry) {
    const applications = reqs.filter(req => (req.candidates || []).some(c => c.id === entry.candidate.id));
    const appliedIds = new Set(applications.map(req => req.reqId));
    const excluded = reqs.filter(req => appliedIds.has(req.reqId) || isUnavailable(req));
    // This deterministic six-role sample illustrates matching, not a skills assessment.
    const jobs = reqs.filter(req => !appliedIds.has(req.reqId) && !isUnavailable(req)).slice(0, 6);
    return { applications, excluded, jobs, matchedCount: jobs.length + excluded.length };
  }

  function renderResult(entry, data) {
    analysis.innerHTML = `
      <section class="summary" aria-label="Synthetic scan counts">
        <div class="metric"><div class="metric-label">Current req</div><div class="metric-value">${escape(entry.req.reqId)}</div></div>
        <div class="metric"><div class="metric-label">Applications</div><div class="metric-value">${data.applications.length} / ${data.applications.length}</div></div>
        <div class="metric"><div class="metric-label">Matched Requisitions entries</div><div class="metric-value">${data.matchedCount} / ${data.matchedCount}</div></div>
      </section>
      <h2>Recommended roles to consider (${data.jobs.length})</h2>
      <p class="subhead">Eligible Open roles from a synthetic Matched Requisitions sample, in demo order. Illustrative only, not a real match assessment.</p>
      <div class="jobs">${data.jobs.map(job => `<a class="job" href="${escape(localUrl(job))}" target="_blank" rel="noopener noreferrer"><div class="job-title">${escape(job.title)}</div><div class="job-meta">Req ${escape(job.reqId)} · Open</div></a>`).join("")}</div>
      <details>
        <summary>Why other roles were excluded</summary>
        <p class="hint">The current requisition and previously applied requisitions are excluded.</p>
        <p class="hint">Closed, filled and Pre-Approval requisitions are not recommended. This sample includes up to six eligible roles plus the exclusions below; it is not a live portfolio scan.</p>
        <div class="exclusion-list" aria-label="Excluded requisitions">${data.excluded.map(req => `<span class="req-pill">${escape(req.reqId)}</span>`).join("")}</div>
      </details>`;
  }

  function scanPage() {
    if (document.body.dataset.state === "scanning") return;
    const entry = resolveCandidate();
    invalidate();
    if (!entry) return;
    current = entry;
    const token = generation;
    const scannedInput = input.value;
    document.body.dataset.state = "scanning";
    ["workflow", "actions", "workflow-hint"].forEach(id => $(id).classList.remove("hidden"));
    analysis.setAttribute("aria-busy", "true");
    pool.disabled = false;
    scan.textContent = "Scanning...";
    scan.disabled = true;
    status("Scanning native Career Hub containers.",
      "Offline simulation: reading synthetic Applications and Matched Requisitions.");
    $("workflow-hint").textContent = "This scan reads only synthetic demo data. Reset or edit the link to cancel.";
    timers.push(setTimeout(() => {
      if (token !== generation) return;
      status("Scanning native Career Hub containers.",
        "Offline simulation: checking Open roles and excluding existing applications, closed and Pre-Approval requisitions.");
    }, 900));
    timers.push(setTimeout(() => {
      if (token !== generation) return;
      if (input.value !== scannedInput) {
        invalidate();
        return;
      }
      timers = [];
      result = buildResult(entry);
      renderResult(entry, result);
      document.body.dataset.state = "completed";
      analysis.setAttribute("aria-busy", "false");
      analysis.classList.remove("hidden");
      disposition.classList.remove("hidden");
      disposition.disabled = false;
      copy.classList.toggle("hidden", !result.jobs.length);
      copy.disabled = !result.jobs.length;
      scan.textContent = "Scanned";
      status(`${entry.candidate.name} analysis verified.`,
        result.jobs.length ? "Synthetic scan complete. Review the recommendations, then open disposition manually."
          : "No eligible Open roles remain after filtering; there is nothing to insert.");
      setStep(2);
      $("workflow-hint").textContent = "“Add to a Talent Pool” and “Open disposition” open only this local synthetic candidate. “Insert into email” opens a formatted preview. Sending through Outlook requires recipient review and explicit confirmation.";
      toast.textContent = result.jobs.length ? "Scan complete. Recommendations are ready." : "Scan complete. No eligible recommendations found.";
    }, 2000));
  }

  function openCandidate(action) {
    if (!current) return;
    const resolved = resolveCandidate();
    if (resolved?.req !== current.req || resolved?.candidate !== current.candidate) {
      invalidate();
      return;
    }
    window.open(localUrl(current.req, current.candidate), "_blank", "noopener,noreferrer");
    toast.textContent = `${action}: local candidate preview requested. No disposition or pool membership was submitted.`;
    if (action === "Open disposition" && result) setStep(3);
  }

  async function insertEmail() {
    if (!current || !result?.jobs.length || document.body.dataset.state !== "completed") return;
    const resolved = resolveCandidate();
    if (resolved?.req !== current.req || resolved?.candidate !== current.candidate) {
      invalidate();
      return;
    }
    if (typeof window.DemoEmail?.open !== "function") {
      toast.textContent = "Email preview is unavailable. Load the shared demo-email.js helper and try again.";
      return;
    }
    const title = `Recommended roles for ${current.candidate.name}`;
    const intro = "Based on your experience, you may also be interested in these current opportunities:";
    const disclaimer = "Please feel free to review any role that aligns with your interests. These synthetic recommendations do not guarantee consideration or an interview. Other active applications remain unaffected. All roles shown are synthetic demonstration data.";
    const html = `<p><strong>Recommended roles to consider</strong></p><p>${intro}</p><p>${result.jobs.map(job => `<a href="${escape(localUrl(job))}">${escape(job.title)}</a><br>`).join("")}</p><p>${disclaimer}</p>`;
    const text = ["Recommended roles to consider", "", intro, "",
      ...result.jobs.flatMap(job => [job.title, localUrl(job), ""]), disclaimer].join("\n");
    const token = generation;
    try {
      await window.DemoEmail.open({ title, html, text });
      if (token !== generation) return;
      setStep(3);
      toast.textContent = "Formatted recommendations opened in the demo email preview. Nothing was sent.";
    } catch {
      if (token === generation) toast.textContent = "The email preview could not open. Please try again.";
    }
  }

  const examples = document.createDocumentFragment();
  candidates.forEach(entry => {
    const option = document.createElement("option");
    option.value = localUrl(entry.req, entry.candidate);
    option.label = `${entry.candidate.name} · ${entry.req.reqId}`;
    examples.appendChild(option);
  });
  $("candidate-examples").appendChild(examples);
  $("example-link").addEventListener("click", event => {
    event.preventDefault();
    if (!candidates.length) {
      toast.textContent = "No synthetic examples are available. Check that demo-data.js is loaded.";
      return;
    }
    input.value = localUrl(candidates[0].req, candidates[0].candidate);
    invalidate();
    input.focus();
  });
  input.addEventListener("input", invalidate);
  input.addEventListener("change", () => {
    const resolved = resolveCandidate();
    if (!current || resolved?.req !== current.req || resolved?.candidate !== current.candidate) invalidate();
  });
  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !scan.disabled) scanPage();
  });
  scan.addEventListener("click", scanPage);
  pool.addEventListener("click", () => openCandidate("Add to a Talent Pool"));
  disposition.addEventListener("click", () => openCandidate("Open disposition"));
  copy.addEventListener("click", insertEmail);
  $("reset-button").addEventListener("click", () => {
    input.value = "";
    invalidate();
    input.focus();
  });
  window.addEventListener("pagehide", invalidate);
  input.value = "";
  invalidate();
})();
