(function () {
  const $ = id => document.getElementById(id);
  const { rpc, hashEmail, store } = window.MH;
  const { render, fromStatus, LABELS, esc } = window.MH_MAP;
  const KEY = "mh-hash";
  let me = null;        // { hash, switch, rows, mine, answers }
  let lastPairs = {}, selPair = null, probePair = null, lastStatus = null, prevFlags = null, prevPorts = null, prevConfirmed = null, flash = new Set(), feed = [];

  function showErr(el, msg) { el.textContent = msg; el.hidden = !msg; }

  // ---------- join ----------
  $("joinForm").addEventListener("submit", async e => {
    e.preventDefault();
    showErr($("joinErr"), "");
    const email = $("email").value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { showErr($("joinErr"), "Please enter a valid email address."); return; }
    try {
      const hash = await hashEmail(email);
      await rpc("claim_seat", { p_hash: hash });
      store.set(KEY, hash);
      await loadMe(hash);
    } catch (err) { showErr($("joinErr"), err.message); }
  });

  $("switchUser").addEventListener("click", () => {
    store.del(KEY); me = null;
    $("consoleCard").hidden = true; $("labelDock").hidden = true; $("mapHow").hidden = true; $("about").open = true; $("sProgBox").hidden = true; $("rcCard").hidden = true; window.MH_PLANES.update(false, false); $("doneCard").hidden = true; $("joinCard").hidden = false; $("mapJoin").hidden = false;
    $("email").value = ""; $("email").focus();
    drawMap();
  });

  async function loadMe(hash) {
    const v = await rpc("get_my_view", { p_hash: hash });
    if (!v) { store.del(KEY); $("joinCard").hidden = false; $("mapJoin").hidden = false; return; }
    me = { hash, flags: v.flags || [], switch: v.switch, rows: v.rows || [], mine: v.mine || {}, labels: Object.assign({}, v.mine || {}), sent: Object.keys(v.mine || {}).length > 0, answers: v.answers };
    selPort = null; selLabel = null;
    $("joinCard").hidden = true; $("mapJoin").hidden = true;
    $("consoleCard").hidden = false;
    $("rcCard").hidden = false;
    $("swName").textContent = me.switch;
    $("swRole").textContent = window.MH_TOPO.role(me.switch) + " · " + me.rows.length + " ports";
    const dark = me.rows.length === 0;
    $("darkPanel").hidden = !dark;
    $("mapHow").hidden = dark; $("about").open = false;
    $("labelDock").hidden = dark;
    renderPanel();
    if (me.rows.length) { selPort = me.rows[0].port; renderProbe(selPort); } else renderPanel();
    renderRc();
    drawMap();
  }

  // ---------- front panel ----------
  const LCOL = { OK: "var(--ok)", MISWIRED: "var(--bad)", ONE_WAY: "#FF8C42", HIGH_ERRORS: "var(--warn)", LINK_DOWN: "#9AA7B2", PEER_SILENT: "#B58CFF" };
  const HINT = { OK: "Plan and reality agree, both directions", MISWIRED: "A different peer than the plan", ONE_WAY: "Only one direction works", HIGH_ERRORS: "Up and correct, but error rate is high", LINK_DOWN: "PHY down: no working cable", PEER_SILENT: "PHY up but no ND from the peer" };
  let selLabel = null, selPort = null; const probed = new Set();
  const rowOf = p => me.rows.filter(r => r.port === p)[0];

  function renderPanel() {
    $("tray").innerHTML = Object.keys(LABELS).map(k => '<span role="button" tabindex="0" class="tag' + (selLabel === k ? " sel" : "") + '" draggable="true" data-label="' + k + '" aria-pressed="' + (selLabel === k) + '" title="' + HINT[k] + '" style="--tc:' + LCOL[k] + '"><i></i>' + LABELS[k] + "</span>").join("");
    $("trayHint").innerHTML = selLabel ? "<b>" + LABELS[selLabel] + "</b> is selected. Now click a port to put it there." : "Drag a label onto a port, or click a label first and then a port.";
    const n = me.rows.length, done = Object.keys(me.labels).length;
    $("sendReport").disabled = !n;
    $("reportMsg").textContent = done === n ? (me.sent ? "Report on file. You can change labels and send again." : "All ports labeled. Send your report.") : done + " of " + n + " ports labeled. Label every port, then send.";
    renderTable();
    drawMap();
  }

  function renderTable() {
    $("portRows").innerHTML = me.rows.map(r => "<tr><th scope=\"row\">" + esc(r.port) + "</th><td>" + esc(r.expected) + "</td><td>" + esc(r.discovered) + "</td><td>" + esc(r.peer_hears) +
      '</td><td class="' + (r.phy === "DOWN" ? "bad" : "") + '">' + esc(r.phy) + "</td><td>" + esc(r.err) + "</td><td>" + (me.labels[r.port] ? LABELS[me.labels[r.port]] : "\u2014") + "</td></tr>").join("");
  }

  function setLabel(port, label) { me.labels[port] = label; renderPanel(); }

  $("map").addEventListener("click", e => {
    const j = e.target.closest("[data-port]"); if (!j || !me) return;
    const port = j.getAttribute("data-port");
    if (selLabel && selPort === port) { setLabel(port, selLabel); return; }
    selPort = port; renderProbe(port);
    if (selLabel) setLabel(port, selLabel);
  });
  $("map").addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target.closest && e.target.closest("[data-port]")) { e.preventDefault(); e.target.closest("[data-port]").dispatchEvent(new MouseEvent("click", { bubbles: true })); }
  });
  $("map").addEventListener("dragover", e => { if (e.target.closest("[data-port]")) e.preventDefault(); });
  $("map").addEventListener("drop", e => {
    const j = e.target.closest("[data-port]"); if (!j) return; e.preventDefault();
    const l = e.dataTransfer.getData("text/plain"); if (!LABELS[l]) return;
    selPort = j.getAttribute("data-port"); setLabel(selPort, l); renderProbe(selPort);
  });
  $("tray").addEventListener("click", e => { const t = e.target.closest("[data-label]"); if (!t) return; selLabel = selLabel === t.dataset.label ? null : t.dataset.label; renderPanel(); });
  $("tray").addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.closest("[data-label]")) { e.preventDefault(); e.target.closest("[data-label]").click(); } });
  $("tray").addEventListener("dragstart", e => { const t = e.target.closest("[data-label]"); if (t) e.dataTransfer.setData("text/plain", t.dataset.label); });

  // The probe is drawn on the map itself (see MH_MAP): plan dashed, what was heard solid.
  function renderProbe(port) {
    const r = rowOf(port); if (!r) return;
    probed.add(port);
    const peerSw = r.expected && r.expected !== "-" ? r.expected.split(" ")[0] : null;
    probePair = null; if (peerSw) { [me.switch + "|" + peerSw, peerSw + "|" + me.switch].forEach(k => { if (lastPairs[k]) probePair = k; }); }
    const silent = r.discovered === "-", bad = x => ' class="bad"';
    $("probeText").innerHTML = "<b>Port " + esc(port) + "</b>" +
      '<table class="probe-tbl"><thead><tr><th>Plan says</th><th>Heard</th><th>PHY</th><th>Peer hears you</th><th>Error rate</th></tr></thead><tbody><tr>' +
      "<td>" + esc(r.expected) + "</td><td" + (!silent && r.discovered !== r.expected ? bad() : "") + ">" + (silent ? "nothing" : esc(r.discovered)) + "</td><td" + (r.phy === "DOWN" ? bad() : "") + ">" + esc(r.phy) + "</td><td" + (r.peer_hears === "no" ? bad() : "") + ">" + esc(r.peer_hears) + "</td><td" + (r.err !== "<1e-12" ? bad() : "") + ">" + esc(r.err) + "</td></tr></tbody></table>";
    renderPanel();
  }

  $("sendReport").addEventListener("click", async () => {
    const n = me.rows.length, done = Object.keys(me.labels).length;
    if (done < n) { $("reportMsg").textContent = (n - done) + " port" + (n - done > 1 ? "s" : "") + " still need a label."; return; }
    $("sendReport").disabled = true;
    try {
      const sent = await rpc("submit_report", { p_hash: me.hash, p_labels: me.labels });
      me.sent = true; me.mine = Object.assign({}, me.labels);
      renderPanel(); renderRc();
      $("reportMsg").textContent = "Sent: " + sent + " ports. Watch the map below.";
      await refresh();
      $("mapCard").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) { $("reportMsg").textContent = err.message; }
    $("sendReport").disabled = false;
  });

  // ---------- progress ----------
  function renderDone() {
    const el = $("doneCard"); if (!el) return;
    el.hidden = !me;
    if (!me) return;
    const sent = me.rows.length === 0 || Object.keys(me.mine || {}).length > 0, ans = !!me.answers;
    const pc = window.MH_PLANES ? window.MH_PLANES.count() : 0, pt = window.MH_PLANES ? window.MH_PLANES.total : 7;
    const item = (ok, text, opt) => '<li class="' + (ok ? "ok" : "") + '"><span class="tick" aria-hidden="true">' + (ok ? "\u2713" : "\u25CB") + "</span> " + text + (opt ? ' <span class="fine">(optional)</span>' : "") + "</li>";
    $("sProgBox").hidden = false; $("sProg").textContent = ((sent ? 1 : 0) + (ans ? 1 : 0)) + " / 2";
    $("sProgBox").classList.toggle("up", sent && ans);
    $("doneList").innerHTML = item(sent, me.rows.length ? "Report sent" : "Nothing to report from this switch", false) + item(ans, "Both root-cause questions saved", false) +
      item(me.flags.length > 0, "Flags placed on the map: " + me.flags.length + " of 5", true) + item(pc === pt, "Firepath parts placed: " + pc + " of " + pt, true);
  }
  document.addEventListener("planes-change", () => { if (me) renderDone(); });

  // ---------- root cause ----------
  function renderRc() {
    const unlocked = me && (me.rows.length === 0 || Object.keys(me.mine).length > 0);
    $("rcLock").hidden = !!unlocked;
    window.MH_PLANES.update(!!me, !!unlocked);
    renderDone();
    $("rcForm").hidden = !unlocked;
    if (me && me.answers) {
      ["q1", "q2"].forEach(q => { const el = document.querySelector('input[name="' + q + '"][value="' + me.answers[q] + '"]'); if (el) el.checked = true; });
      $("rcMsg").textContent = "Answers saved. The class result is revealed in class.";
    }
  }
  $("rcForm").addEventListener("submit", async e => {
    e.preventDefault();
    const q1 = (document.querySelector('input[name="q1"]:checked') || {}).value, q2 = (document.querySelector('input[name="q2"]:checked') || {}).value;
    if (!q1 || !q2) { $("rcMsg").textContent = "Answer both questions."; return; }
    try {
      await rpc("submit_answers", { p_hash: me.hash, p_q1: q1, p_q2: q2 });
      me.answers = { q1, q2 }; renderDone();
      $("rcMsg").textContent = "Answers saved. The class result is revealed in class.";
    } catch (err) { $("rcMsg").textContent = err.message; }
  });

  // ---------- shared map ----------
  function drawMap() {
    const base = lastStatus ? fromStatus(lastStatus) : { latest: {}, reported: new Set(), confirmed: new Set() };
    const ap = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute("data-port");
    const panel = me && me.rows.length ? { sw: me.switch, rows: me.rows, labels: me.labels, sel: selPort, probed } : null;
    lastPairs = render($("map"), Object.assign(base, { probePair, me: me && me.switch, flash, selPair, myflags: me ? me.flags : [], panel }));
    if (ap) { const f = $("map").querySelector('[data-port="' + ap + '"]'); if (f) f.focus(); }
    renderLink();
  }

  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.h);
    toast.h = setTimeout(() => { t.hidden = true; }, 5000);
  }
  function hhmm() { const d = new Date(); return d.toTimeString().slice(0, 8); }

  function diffEvents(st) {
    const cur = {}, bySwitch = {};
    (st.ports || []).forEach(p => { cur[p.s + ":" + p.p] = p.l; });
    const conf = new Set((st.faults || []).filter(f => f.confirmed).map(f => f.id));
    if (prevPorts) {
      Object.keys(cur).forEach(k => { if (prevPorts[k] !== cur[k]) { const sw = k.split(":")[0]; bySwitch[sw] = (bySwitch[sw] || 0) + 1; } });
      Object.keys(bySwitch).forEach(sw => {
        const mine = me && me.switch === sw;
        feed.unshift({ t: hhmm(), text: (mine ? "You (" + sw + ")" : sw) + " reported " + bySwitch[sw] + " port" + (bySwitch[sw] > 1 ? "s" : "") });
      });
      conf.forEach(id => { if (!prevConfirmed.has(id)) {
        const f = (st.faults || []).filter(x => x.id === id)[0];
        feed.unshift({ t: hhmm(), text: "Problem " + id + " confirmed: " + (f.ports || []).map(p => p.s + " " + p.p).join(", "), hot: true });
        toast("Problem " + id + " confirmed!");
      } });
      feed = feed.slice(0, 40);
    }
    const fl = st.flags || {};
    if (prevFlags) Object.keys(fl).forEach(k => { if ((fl[k] || 0) > (prevFlags[k] || 0)) feed.unshift({ t: hhmm(), text: "A flag went on " + k.replace("|", " \u2194 ") + " (" + fl[k] + " now)" }); });
    prevFlags = fl;
    flash = new Set(Object.keys(bySwitch));
    if (flash.size) setTimeout(() => { flash = new Set(); drawMap(); }, 3200);
    prevPorts = cur; prevConfirmed = conf;
    if (feed.length) $("feed").innerHTML = feed.slice(0, 8).map(e => '<li class="' + (e.hot ? "hot" : "") + '"><span class="ts">' + e.t + "</span> " + esc(e.text) + "</li>").join("");
  }

  async function refresh() {
    try {
      lastStatus = await rpc("fabric_status", {});
      showErr($("mapErr"), "");
    } catch (err) { showErr($("mapErr"), err.message); return; }
    const st = lastStatus, done = (st.faults || []).filter(f => f.confirmed);
    const allUp = done.length === st.faults_total && st.faults_total > 0;
    if (allUp && prevConfirmed && prevConfirmed.size < st.faults_total) toast("FABRIC UP. Firepath may route.");
    diffEvents(st);
    $("sFaults").textContent = done.length + " / " + st.faults_total;
    const sw = new Set((st.ports || []).map(p => p.s));
    $("sReported").textContent = sw.size + " / 15";
    $("sFabric").textContent = allUp ? "UP" : "DOWN";
    $("strip").classList.toggle("up", allUp);
    $("faultList").innerHTML = (allUp ? '<div class="up-banner">FABRIC UP. All five problems are confirmed. Firepath may route. What each problem was gets revealed in class.</div>' : '<p class="faults-sum">' + done.length + " of " + st.faults_total + " problems confirmed</p>") +
      done.map(f => '<article class="fault ok"><h3>Problem ' + f.id + "</h3><p>Ports: " + esc((f.ports || []).map(p => p.s + " " + p.p).join(", ")) + "</p></article>").join("");
    drawMap();
  }

  // ---------- link card and flags ----------
  function renderLink() {
    const el = $("linkCard"), p = selPair && lastPairs[selPair];
    if (!p) { el.hidden = true; return; }
    el.hidden = false;
    const flagged = me && me.flags.indexOf(selPair) >= 0, left = me ? 5 - me.flags.length : 0;
    const count = (lastStatus && lastStatus.flags && lastStatus.flags[selPair]) || 0;
    el.innerHTML = '<div class="lc-head"><b class="mono">' + esc(p.a) + " \u2194 " + esc(p.b) + '</b><span class="fine">' + count + " flag" + (count === 1 ? "" : "s") + " from the class</span></div>" +
      "<ul>" + p.tips.map(t => "<li>" + esc(t) + "</li>").join("") + "</ul>" +
      (me ? '<div class="row"><button class="btn ' + (flagged ? "" : "primary") + '" id="flagBtn" type="button"' + (!flagged && left <= 0 ? " disabled" : "") + ">" + (flagged ? "Remove my flag" : "Flag as suspect") + '</button><span class="fine">' + (left <= 0 && !flagged ? "All 5 flags are placed. Remove one to move it." : "You have " + left + " of 5 flags left.") + "</span></div>" : '<p class="fine">Take a switch to flag links.</p>');
  }
  $("map").addEventListener("click", e => {
    const t = e.target.closest("[data-pair]"); if (!t) return;
    selPair = t.getAttribute("data-pair"); drawMap();
    $("linkCard").scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
  $("linkCard").addEventListener("click", async e => {
    if (!e.target.closest("#flagBtn") || !me || !selPair) return;
    const b = e.target.closest("#flagBtn"); b.disabled = true;
    try { me.flags = await rpc("toggle_suspect", { p_hash: me.hash, p_pair: selPair }); renderDone(); await refresh(); }
    catch (err) { toast(err.message); }
    renderLink();
  });

  // ---------- boot ----------
  drawMap();
  if (!window.MH.configured) {
    showErr($("joinErr"), "This site is not connected to its database yet. Instructors: fill in js/config.js.");
    showErr($("mapErr"), "No database connection.");
  } else {
    const h = store.get(KEY);
    if (h) loadMe(h).catch(err => showErr($("joinErr"), err.message));
    refresh();
    setInterval(() => { if (!document.hidden) refresh(); }, window.MH.refreshMs);
  }
})();
