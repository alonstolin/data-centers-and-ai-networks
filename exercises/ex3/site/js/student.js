// Miswire Hunt, single-player version with delayed feedback.
// The student's work is kept in localStorage and sent to Supabase only when they press Submit.
// Nothing here tells the student whether an answer is right: the results are discussed in class.
(function () {
  const $ = id => document.getElementById(id);
  const { render, LABELS, esc } = window.MH_MAP;
  const P = window.MH_PUZZLE, T = window.MH_TOPO;
  const KEY = "mh-solo-v2";

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  let saved = {};
  try { saved = JSON.parse(store.get(KEY) || "{}") || {}; } catch (e) { saved = {}; }
  const diag = saved.diag || {};                 // "SW:port" -> label
  const drained = new Set(saved.drained || []);  // "upper|lower" link keys taken out of routing
  const answers = saved.answers || {};           // { q1, q2 }
  let nick = saved.nick || "", submittedAt = saved.submittedAt || null;
  const uid = saved.uid || (window.crypto && crypto.randomUUID ? crypto.randomUUID() : "u" + Date.now() + Math.random().toString(36).slice(2));
  const persist = () => store.set(KEY, JSON.stringify({ uid, diag, drained: Array.from(drained), answers, nick, submittedAt }));

  const TOTAL_PORTS = Object.values(P.views).reduce((n, v) => n + v.length, 0);
  let sel = null, selPort = null, selLabel = null;
  const probed = new Set();                      // "SW:port"

  const rowsOf = sw => (P.views[sw] || []).map(a => ({ port: a[0], expected: a[1], discovered: a[2], peer_hears: a[3], phy: a[4], err: a[5] }));
  const linkKey = l => l.a.s + "|" + l.b.s;

  // ---------- map ----------
  function drawMap() {
    const reported = new Set();
    Object.keys(diag).forEach(k => reported.add(k.split(":")[0]));
    const rows = sel && sel !== "MASTER" ? rowsOf(sel) : [];
    const labels = {};
    rows.forEach(r => { const l = diag[sel + ":" + r.port]; if (l) labels[r.port] = l; });
    const panel = rows.length ? { sw: sel, rows, labels, sel: selPort, probed: new Set(rows.filter(r => probed.has(sel + ":" + r.port)).map(r => r.port)) } : null;
    const ap = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute("data-port");
    render($("map"), { latest: diag, reported, confirmed: new Set(), flags: {}, myflags: [], me: sel === "MASTER" ? null : sel, flash: new Set(), selPair: null, probePair: null, panel, master: true, masterSel: sel === "MASTER", drained });
    if (ap) { const f = $("map").querySelector('[data-port="' + ap + '"]'); if (f) f.focus(); }
  }

  // ---------- status and progress ----------
  function renderStatus() {
    $("sDiag").textContent = Object.keys(diag).length + " / " + TOTAL_PORTS;
    $("sDrain").textContent = String(drained.size);
    $("sSub").textContent = submittedAt ? "YES" : "NO";
    $("strip").classList.toggle("up", !!submittedAt);
    window.MH_PLANES.update(true, true);
    renderDone();
  }
  function renderDone() {
    const pc = window.MH_PLANES.count(), pt = window.MH_PLANES.total, nd = Object.keys(diag).length, answered = !!(answers.q1 && answers.q2);
    const item = (ok, text, opt) => '<li class="' + (ok ? "ok" : "") + '"><span class="tick" aria-hidden="true">' + (ok ? "✓" : "○") + "</span> " + text + (opt ? ' <span class="fine">(optional)</span>' : "") + "</li>";
    $("doneList").innerHTML = item(nd > 0, "Ports diagnosed: " + nd + " of " + TOTAL_PORTS) + item(answered, "Both root-cause questions answered") + item(!!submittedAt, "Work submitted") +
      item(drained.size > 0, "Firepath master: links drained: " + drained.size, true) + item(pc === pt, "Firepath parts placed: " + pc + " of " + pt, true);
  }
  document.addEventListener("planes-change", renderDone);

  // ---------- the open switch ----------
  const LCOL = { OK: "var(--ok)", MISWIRED: "var(--bad)", ONE_WAY: "#FF8C42", HIGH_ERRORS: "var(--warn)", LINK_DOWN: "#9AA7B2", PEER_SILENT: "#B58CFF" };
  const HINT = { OK: "Plan and reality agree, both directions", MISWIRED: "A different peer than the plan", ONE_WAY: "Only one direction works", HIGH_ERRORS: "Up and correct, but error rate is high", LINK_DOWN: "PHY down: no working cable", PEER_SILENT: "PHY up but no ND from the peer" };

  function renderDock() {
    const isM = sel === "MASTER", rows = sel && !isM ? rowsOf(sel) : [], dark = sel && !isM && !rows.length;
    $("selHint").hidden = !!sel;
    $("masterDock").hidden = !isM;
    document.querySelectorAll(".mleg").forEach(e => { e.hidden = !drained.size; });
    $("darkPanel").hidden = !dark;
    $("labelDock").hidden = !(sel && rows.length);
    if (isM) renderMaster();
    if (!sel || !rows.length) return;
    const done = rows.filter(r => diag[sel + ":" + r.port]).length;
    $("dockTitle").textContent = sel + " · " + T.role(sel) + " · " + rows.length + " ports";
    $("tray").innerHTML = Object.keys(LABELS).map(k => '<span role="button" tabindex="0" class="tag' + (selLabel === k ? " sel" : "") + '" draggable="true" data-label="' + k + '" aria-pressed="' + (selLabel === k) + '" title="' + HINT[k] + '" style="--tc:' + LCOL[k] + '"><i></i>' + LABELS[k] + "</span>").join("");
    $("trayHint").innerHTML = selLabel ? "<b>" + LABELS[selLabel] + "</b> is selected. Now click a port tab to put it there." : "Drag a diagnosis onto a port tab, or click one first and then a port tab.";
    $("reportMsg").textContent = done + " of " + rows.length + " ports of " + sel + " diagnosed.";
    $("portRows").innerHTML = rows.map(r => "<tr><th scope=\"row\">" + esc(r.port) + "</th><td>" + esc(r.expected) + "</td><td>" + esc(r.discovered) + "</td><td>" + esc(r.peer_hears) +
      '</td><td class="' + (r.phy === "DOWN" ? "bad" : "") + '">' + esc(r.phy) + "</td><td>" + esc(r.err) + "</td><td>" + (diag[sel + ":" + r.port] ? LABELS[diag[sel + ":" + r.port]] : "—") + "</td></tr>").join("");
  }

  function renderProbe() {
    const r = selPort && sel && sel !== "MASTER" && rowsOf(sel).filter(x => x.port === selPort)[0];
    if (!r) { $("probeText").textContent = "Click a port tab on the open switch to probe it."; return; }
    const silent = r.discovered === "-", bad = () => ' class="bad"';
    $("probeText").innerHTML = "<b>Port " + esc(sel + " " + r.port) + "</b>" +
      '<table class="probe-tbl"><thead><tr><th>Plan says</th><th>Heard</th><th>PHY</th><th>Peer hears you</th><th>Error rate</th></tr></thead><tbody><tr>' +
      "<td>" + esc(r.expected) + "</td><td" + (!silent && r.discovered !== r.expected ? bad() : "") + ">" + (silent ? "nothing" : esc(r.discovered)) + "</td><td" + (r.phy === "DOWN" ? bad() : "") + ">" + esc(r.phy) + "</td><td" + (r.peer_hears === "no" ? bad() : "") + ">" + esc(r.peer_hears) + "</td><td" + (r.err !== "<1e-12" ? bad() : "") + ">" + esc(r.err) + "</td></tr></tbody></table>" +
      '<p class="fine">"Plan says" comes from the cluster configuration that every switch received (Section 5.3.1).</p>';
  }

  function refresh() { renderDock(); renderProbe(); renderStatus(); drawMap(); }
  function touch() { submittedAt = submittedAt && null; $("submitMsg").textContent = ""; persist(); }

  function openSwitch(sw) { sel = sw; selPort = null; refresh(); }
  function selectPort(port) { selPort = port; probed.add(sel + ":" + port); refresh(); }
  function setDiag(port, label) { diag[sel + ":" + port] = label; selPort = port; probed.add(sel + ":" + port); touch(); refresh(); }

  // ---------- the Firepath master ----------
  // ECMP: number of shortest paths between two ToRs over the links that are not drained (T7 is crashed: not a node)
  function paths(src, dst, out) {
    const adj = {};
    T.links.forEach(l => {
      if (out.has(linkKey(l)) || l.a.s === "T7" || l.b.s === "T7") return;
      (adj[l.a.s] = adj[l.a.s] || []).push(l.b.s); (adj[l.b.s] = adj[l.b.s] || []).push(l.a.s);
    });
    const dist = { [src]: 0 }, cnt = { [src]: 1 }, q = [src];
    while (q.length) {
      const u = q.shift();
      (adj[u] || []).forEach(v => {
        if (dist[v] === undefined) { dist[v] = dist[u] + 1; cnt[v] = 0; q.push(v); }
        if (dist[v] === dist[u] + 1) cnt[v] += cnt[u];
      });
    }
    return cnt[dst] || 0;
  }
  const PAIRS = [["T1", "T8"], ["T4", "T5"], ["T5", "T6"]];

  function renderMaster() {
    $("mlinkRows").innerHTML = T.links.map(l => {
      const k = linkKey(l), la = diag[l.a.s + ":" + l.a.p], lb = diag[l.b.s + ":" + l.b.p];
      return '<tr class="' + (drained.has(k) ? "drain" : "") + '"><td><label><input type="checkbox" data-drain="' + k + '"' + (drained.has(k) ? " checked" : "") + '> drain</label></td><td>' + esc(l.a.s + " " + l.a.p + " ↔ " + l.b.s + " " + l.b.p) + "</td><td>" + (la ? LABELS[la] : "—") + " / " + (lb ? LABELS[lb] : "—") + "</td></tr>";
    }).join("");
    $("drainCount").textContent = drained.size + " link" + (drained.size === 1 ? "" : "s") + " drained.";
  }
  function recompute() {
    const rows = PAIRS.map(p => { const n = paths(p[0], p[1], drained); return "<tr><td>" + p[0] + " → " + p[1] + "</td><td>" + n + " path" + (n === 1 ? "" : "s") + "</td></tr>"; }).join("");
    $("masterRes").hidden = false;
    $("masterRes").innerHTML = "<table><tbody>" + rows + '</tbody></table><p class="fine">Fewer paths means less capacity. Taking out a working link costs capacity. Leaving a broken link in costs reliability, and a miswired one can cause loops (Section 5.2.1).</p>';
  }
  function toggleDrain(k) { if (drained.has(k)) drained.delete(k); else drained.add(k); $("masterRes").hidden = true; touch(); refresh(); }
  $("mlinkRows").addEventListener("change", e => { const c = e.target.closest("[data-drain]"); if (c) toggleDrain(c.getAttribute("data-drain")); });
  $("recomputeBtn").addEventListener("click", recompute);

  // ---------- map and tray events ----------
  $("map").addEventListener("click", e => {
    const p = e.target.closest("[data-port]");
    if (p && sel) {
      const port = p.getAttribute("data-port");
      if (selLabel && selPort === port) { setDiag(port, selLabel); return; }
      selectPort(port);
      if (selLabel) setDiag(port, selLabel);
      return;
    }
    const pr = e.target.closest("[data-pair]");
    if (pr && sel === "MASTER") { toggleDrain(pr.getAttribute("data-pair")); return; }
    const n = e.target.closest("[data-sw]");
    if (n) openSwitch(n.getAttribute("data-sw"));
  });
  $("map").addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target.closest && e.target.closest("[data-port]")) { e.preventDefault(); e.target.closest("[data-port]").dispatchEvent(new MouseEvent("click", { bubbles: true })); }
  });
  $("map").addEventListener("dragover", e => { if (e.target.closest("[data-port]")) e.preventDefault(); });
  $("map").addEventListener("drop", e => {
    const j = e.target.closest("[data-port]"); if (!j || !sel) return; e.preventDefault();
    const l = e.dataTransfer.getData("text/plain"); if (!LABELS[l]) return;
    setDiag(j.getAttribute("data-port"), l);
  });
  $("tray").addEventListener("click", e => { const t = e.target.closest("[data-label]"); if (!t) return; selLabel = selLabel === t.dataset.label ? null : t.dataset.label; renderDock(); });
  $("tray").addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.closest("[data-label]")) { e.preventDefault(); e.target.closest("[data-label]").click(); } });
  $("tray").addEventListener("dragstart", e => { const t = e.target.closest("[data-label]"); if (t) e.dataTransfer.setData("text/plain", t.dataset.label); });

  // ---------- root cause (saved, no verdict) ----------
  ["q1", "q2"].forEach(q => { const el = document.querySelector('input[name="' + q + '"][value="' + answers[q] + '"]'); if (el) el.checked = true; });
  $("rcForm").addEventListener("submit", e => {
    e.preventDefault();
    const q1 = (document.querySelector('input[name="q1"]:checked') || {}).value, q2 = (document.querySelector('input[name="q2"]:checked') || {}).value;
    if (!q1 || !q2) { $("rcMsg").textContent = "Answer both questions."; return; }
    answers.q1 = q1; answers.q2 = q2; touch(); renderDone();
    $("rcMsg").textContent = "Saved. We go through the answers in class.";
  });

  // ---------- submit ----------
  $("nick").value = nick;
  $("nick").addEventListener("input", () => { nick = $("nick").value; persist(); });
  function submitMsg() {
    if (submittedAt) $("submitMsg").textContent = "Submitted at " + new Date(submittedAt).toTimeString().slice(0, 5) + ". You can change things and submit again.";
  }
  $("submitBtn").addEventListener("click", async () => {
    if (!Object.keys(diag).length) { $("submitMsg").textContent = "Diagnose a few ports first."; return; }
    $("submitBtn").disabled = true; $("submitMsg").textContent = "Sending...";
    try {
      await window.MH.rpc("submit_work", { p_id: uid, p_nick: nick, p_diag: diag, p_drained: Array.from(drained), p_answers: answers });
      submittedAt = Date.now(); persist(); submitMsg(); renderStatus();
    } catch (err) { $("submitMsg").textContent = "Could not send: " + err.message + " Your work is still saved in this browser. Try again."; }
    $("submitBtn").disabled = false;
  });

  // ---------- boot ----------
  ["rcCard", "doneCard", "planeCard"].forEach(id => { $(id).hidden = false; });
  refresh();
  submitMsg();
})();
