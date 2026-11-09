// Miswire Hunt, single-player version. Everything runs in the browser; progress is kept in localStorage.
(function () {
  const $ = id => document.getElementById(id);
  const { render, LABELS, esc } = window.MH_MAP;
  const P = window.MH_PUZZLE, T = window.MH_TOPO;
  const KEY = "mh-solo-v1";

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  let saved = {};
  try { saved = JSON.parse(store.get(KEY) || "{}") || {}; } catch (e) { saved = {}; }
  const diag = saved.diag || {};           // "SW:port" -> label
  let rcDone = !!saved.rcDone;
  const persist = () => store.set(KEY, JSON.stringify({ diag, rcDone }));

  const TOTAL_PORTS = Object.values(P.views).reduce((n, v) => n + v.length, 0);
  let sel = null, selPort = null, selLabel = null, prevFound = null;
  const probed = new Set();               // "SW:port"

  const rowsOf = sw => (P.views[sw] || []).map(a => ({ port: a[0], expected: a[1], discovered: a[2], peer_hears: a[3], phy: a[4], err: a[5] }));
  const accepted = (sw, port) => (P.truth[sw + ":" + port] ? P.truth[sw + ":" + port].a : ["OK"]);
  const ok = (sw, port) => { const l = diag[sw + ":" + port]; return !!l && accepted(sw, port).indexOf(l) >= 0; };

  // a fault is found when at least two different switches have diagnosed its ports correctly
  function foundFaults() {
    const out = [];
    P.faults.forEach(f => {
      const sws = new Set();
      Object.keys(P.truth).forEach(k => { if (P.truth[k].f === f.id) { const [sw, port] = k.split(":"); if (ok(sw, port)) sws.add(sw); } });
      if (sws.size >= 2) out.push(f.id);
    });
    return out;
  }
  function faultPorts(ids) {
    const set = new Set();
    Object.keys(P.truth).forEach(k => { if (ids.indexOf(P.truth[k].f) >= 0) set.add(k); });
    return set;
  }

  // ---------- map ----------
  function drawMap() {
    const found = foundFaults(), reported = new Set();
    Object.keys(diag).forEach(k => reported.add(k.split(":")[0]));
    const labels = {};
    if (sel) rowsOf(sel).forEach(r => { const l = diag[sel + ":" + r.port]; if (l) labels[r.port] = l; });
    const rows = sel ? rowsOf(sel) : [];
    const panel = sel && rows.length ? { sw: sel, rows, labels, sel: selPort, probed: new Set(rows.filter(r => probed.has(sel + ":" + r.port)).map(r => r.port)) } : null;
    const ap = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute("data-port");
    render($("map"), { latest: diag, reported, confirmed: faultPorts(found), flags: {}, myflags: [], me: sel, flash: new Set(), selPair: null, probePair: null, panel });
    if (ap) { const f = $("map").querySelector('[data-port="' + ap + '"]'); if (f) f.focus(); }
  }

  // ---------- status ----------
  function renderStatus() {
    const found = foundFaults(), n = Object.keys(diag).length, up = found.length === P.faults.length;
    $("sFaults").textContent = found.length + " / " + P.faults.length;
    $("sDiag").textContent = n + " / " + TOTAL_PORTS;
    $("sFabric").textContent = up ? "UP" : "DOWN";
    $("strip").classList.toggle("up", up);
    if (prevFound !== null) {
      found.forEach(id => { if (prevFound.indexOf(id) < 0) toast("Fault found: " + P.faults.filter(f => f.id === id)[0].title); });
      if (up && prevFound.length < P.faults.length) toast("FABRIC UP. All five faults found.");
    }
    prevFound = found;
    $("faultList").innerHTML = (up ? '<div class="up-banner">FABRIC UP. You found all five faults. Now answer the root-cause questions below.</div>' : '<p class="faults-sum">' + found.length + " of " + P.faults.length + " faults found</p>") +
      found.map(id => { const f = P.faults.filter(x => x.id === id)[0]; return '<article class="fault ok"><h3>' + esc(f.title) + "</h3><p>" + esc(f.text) + ' <span class="ref">(' + esc(f.ref) + ")</span></p></article>"; }).join("");
    const unlocked = found.length > 0;
    $("rcLock").hidden = unlocked; $("rcForm").hidden = !unlocked;
    window.MH_PLANES.update(true, true);
    renderDone(found);
  }

  function renderDone(found) {
    const pc = window.MH_PLANES.count(), pt = window.MH_PLANES.total;
    const item = (okk, text, opt) => '<li class="' + (okk ? "ok" : "") + '"><span class="tick" aria-hidden="true">' + (okk ? "✓" : "○") + "</span> " + text + (opt ? ' <span class="fine">(optional)</span>' : "") + "</li>";
    $("doneList").innerHTML = item(found.length === P.faults.length, "Faults found: " + found.length + " of " + P.faults.length) + item(rcDone, "Both root-cause questions answered correctly") + item(pc === pt, "Firepath parts placed: " + pc + " of " + pt, true);
  }
  document.addEventListener("planes-change", () => renderDone(foundFaults()));

  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.h);
    toast.h = setTimeout(() => { t.hidden = true; }, 5000);
  }

  // ---------- the open switch ----------
  const LCOL = { OK: "var(--ok)", MISWIRED: "var(--bad)", ONE_WAY: "#FF8C42", HIGH_ERRORS: "var(--warn)", LINK_DOWN: "#9AA7B2", PEER_SILENT: "#B58CFF" };
  const HINT = { OK: "Plan and reality agree, both directions", MISWIRED: "A different peer than the plan", ONE_WAY: "Only one direction works", HIGH_ERRORS: "Up and correct, but error rate is high", LINK_DOWN: "PHY down: no working cable", PEER_SILENT: "PHY up but no ND from the peer" };

  function renderDock() {
    const rows = sel ? rowsOf(sel) : [], dark = sel && !rows.length;
    $("selHint").hidden = !!sel;
    $("darkPanel").hidden = !dark;
    $("labelDock").hidden = !(sel && rows.length);
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
    const r = selPort && rowsOf(sel).filter(x => x.port === selPort)[0];
    if (!r) { $("probeText").textContent = "Click a port tab on " + sel + " to probe it."; return; }
    const silent = r.discovered === "-", bad = () => ' class="bad"';
    $("probeText").innerHTML = "<b>Port " + esc(sel + " " + r.port) + "</b>" +
      '<table class="probe-tbl"><thead><tr><th>Plan says</th><th>Heard</th><th>PHY</th><th>Peer hears you</th><th>Error rate</th></tr></thead><tbody><tr>' +
      "<td>" + esc(r.expected) + "</td><td" + (!silent && r.discovered !== r.expected ? bad() : "") + ">" + (silent ? "nothing" : esc(r.discovered)) + "</td><td" + (r.phy === "DOWN" ? bad() : "") + ">" + esc(r.phy) + "</td><td" + (r.peer_hears === "no" ? bad() : "") + ">" + esc(r.peer_hears) + "</td><td" + (r.err !== "<1e-12" ? bad() : "") + ">" + esc(r.err) + "</td></tr></tbody></table>" +
      '<p class="fine">"Plan says" comes from the cluster configuration that every switch received (Section 5.3.1).</p>';
  }

  function refresh() { renderDock(); renderProbe(); renderStatus(); drawMap(); }

  function openSwitch(sw) { sel = sw; selPort = null; refresh(); }
  function selectPort(port) { selPort = port; probed.add(sel + ":" + port); refresh(); }
  function setDiag(port, label) { diag[sel + ":" + port] = label; persist(); selPort = port; probed.add(sel + ":" + port); refresh(); }

  $("map").addEventListener("click", e => {
    const p = e.target.closest("[data-port]");
    if (p && sel) {
      const port = p.getAttribute("data-port");
      if (selLabel && selPort === port) { setDiag(port, selLabel); return; }
      selectPort(port);
      if (selLabel) setDiag(port, selLabel);
      return;
    }
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

  // coarse feedback: how many of your diagnoses are wrong (it does not say which)
  $("checkBtn").addEventListener("click", () => {
    const keys = Object.keys(diag), wrong = keys.filter(k => { const [sw, port] = k.split(":"); return !ok(sw, port); }).length;
    $("reportMsg").textContent = !keys.length ? "Diagnose a few ports first." : wrong === 0 ? "All " + keys.length + " diagnoses so far are correct." : wrong + " of your " + keys.length + " diagnoses are not right. Look again at the table and the order of checks.";
  });

  // ---------- root cause ----------
  const RC_TEXT = {
    q1: "T7's software crashed. Every port that faces T7 shows PHY up but no ND, and several independent cable faults at once would be very unlikely. ND doubles as a keepalive (Section 5.2.1).",
    q2: "The link works in one direction only. AG3 hears SP3, but SP3 hears nothing from AG3, so only the other end shows it is unidirectional."
  };
  function showRc() {
    if (rcDone) $("rcMsg").textContent = "Both correct. " + RC_TEXT.q1 + " " + RC_TEXT.q2;
  }
  $("rcForm").addEventListener("submit", e => {
    e.preventDefault();
    const q1 = (document.querySelector('input[name="q1"]:checked') || {}).value, q2 = (document.querySelector('input[name="q2"]:checked') || {}).value;
    if (!q1 || !q2) { $("rcMsg").textContent = "Answer both questions."; return; }
    const r1 = q1 === P.rc.q1, r2 = q2 === P.rc.q2;
    if (r1 && r2) { rcDone = true; persist(); showRc(); renderDone(foundFaults()); }
    else $("rcMsg").textContent = (r1 ? "Question 1 is right. " : r2 ? "Question 2 is right. " : "") + "Not quite. Look again at the ports around the faults you found, then try again.";
  });

  // ---------- boot ----------
  ["rcCard", "doneCard", "planeCard"].forEach(id => { $(id).hidden = false; });
  refresh();
  showRc();
})();
