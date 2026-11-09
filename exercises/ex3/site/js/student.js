// Miswire Hunt, single-player console with delayed feedback.
// Layout: the map on the left, an inspector on the right, four mission steps in the top bar.
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
  let step = saved.step != null ? saved.step : 0, collected = !!saved.collected, collecting = false;
  const uid = saved.uid || (window.crypto && crypto.randomUUID ? crypto.randomUUID() : "u" + Date.now() + Math.random().toString(36).slice(2));
  const persist = () => store.set(KEY, JSON.stringify({ uid, diag, drained: Array.from(drained), answers, nick, submittedAt, step, collected }));

  const TOTAL_PORTS = Object.values(P.views).reduce((n, v) => n + v.length, 0);
  let sel = null, selPort = null;
  const probed = new Set();                      // "SW:port"

  const rowsOf = sw => (P.views[sw] || []).map(a => ({ port: a[0], expected: a[1], discovered: a[2], peer_hears: a[3], phy: a[4], err: a[5] }));
  const linkKey = l => l.a.s + "|" + l.b.s;
  const ORDER_KEYS = ["OK", "MISWIRED", "ONE_WAY", "HIGH_ERRORS", "LINK_DOWN", "PEER_SILENT"];
  const LCOL = { OK: "var(--ok)", MISWIRED: "var(--bad)", ONE_WAY: "#FF8C42", HIGH_ERRORS: "var(--warn)", LINK_DOWN: "#9AA7B2", PEER_SILENT: "#B58CFF" };
  const HINT = { OK: "Plan and reality agree, both directions", MISWIRED: "A different peer than the plan", ONE_WAY: "Only one direction works", HIGH_ERRORS: "Up and correct, but error rate is high", LINK_DOWN: "PHY down: no working cable", PEER_SILENT: "PHY up but nothing heard from the peer" };

  // ---------- map ----------
  function drawMap() {
    const reported = new Set();
    Object.keys(diag).forEach(k => reported.add(k.split(":")[0]));
    if (step === 0 && collected) T.ALL.forEach(s => { if (P.views[s]) reported.add(s); });
    const showSw = step === 1 && sel;
    const rows = showSw ? rowsOf(sel) : [];
    const labels = {};
    rows.forEach(r => { const l = diag[sel + ":" + r.port]; if (l) labels[r.port] = l; });
    const panel = rows.length ? { sw: sel, rows, labels, sel: selPort, probed: new Set(rows.filter(r => probed.has(sel + ":" + r.port)).map(r => r.port)) } : null;
    render($("map"), { latest: diag, reported, confirmed: new Set(), flags: {}, myflags: [], me: showSw ? sel : null, flash: new Set(), selPair: null, probePair: null, panel, master: true, masterSel: step === 2 || step === 0, drained });
    $("map").classList.toggle("drainmode", step === 2);
  }

  // ---------- mission bar ----------
  function renderMissions() {
    const nd = Object.keys(diag).length, na = (answers.q1 ? 1 : 0) + (answers.q2 ? 1 : 0);
    $("m0v").textContent = (collected ? 15 : 0) + " / 16";
    $("m1v").textContent = nd + " / " + TOTAL_PORTS;
    $("m2v").textContent = drained.size + (drained.size === 1 ? " link" : " links");
    $("m3v").textContent = na + " / 2";
    $("m4v").textContent = submittedAt ? "sent" : "not yet";
    const done = { 0: collected, 1: nd > 0, 2: drained.size > 0, 3: na === 2, 4: !!submittedAt };
    document.querySelectorAll(".ms").forEach(b => {
      const n = +b.dataset.step;
      b.classList.toggle("on", n === step);
      b.classList.toggle("done", done[n]);
      b.setAttribute("aria-current", n === step ? "step" : "false");
    });
    document.body.classList.toggle("submitted", !!submittedAt);
    $("prevBtn").hidden = step === 0;
    $("nextBtn").hidden = step === 4;
    $("nextBtn").textContent = ["Next: inspect switches →", "Next: drain links →", "Next: explain →", "Next: submit →"][step] || "";
  }

  // ---------- step 0: collect link state over the CPN ----------
  const portUp = r => r.phy === "UP" && r.discovered === r.expected && r.peer_hears === "yes";
  function endState(e) { const r = rowsOf(e.s).filter(x => x.port === e.p)[0]; return !P.views[e.s] ? "no report" : r && portUp(r) ? "UP" : "DOWN"; }
  function renderCollect() {
    $("collectBtn").disabled = collecting;
    $("collectBtn").textContent = collecting ? "Collecting..." : collected ? "Collect again" : "Collect link state from all switches";
    $("lsd").hidden = !collected || collecting;
    if (!collected) return;
    const down = T.links.filter(l => endState(l.a) !== "UP" || endState(l.b) !== "UP");
    $("lsdSum").innerHTML = "<b>15 of 16 switches answered.</b> T7 did not answer. " + (T.links.length - down.length) + " links up, " + down.length + " down.";
    $("lsdDown").innerHTML = down.map(l => {
      const sa = endState(l.a), sb = endState(l.b), c = x => '<span class="' + (x === "UP" ? "st-up" : "st-down") + '">' + x + "</span>";
      return '<li><button type="button" class="dl lsd-row" data-open="' + esc(l.a.s) + '"><span></span><span class="dl-t">' + esc(l.a.s + " " + l.a.p + " ↔ " + l.b.s + " " + l.b.p) + '</span><span class="fine">' + c(sa) + " / " + c(sb) + "</span></button></li>";
    }).join("");
  }
  function collect() {
    if (collecting) return;
    collecting = true; refresh();
    const svg = $("map"), M = [863, 70];
    let h = '<g class="cpn-anim">';
    T.ALL.forEach((s, i) => {
      const [x, y] = T.pos[s], back = !!P.views[s];
      h += '<line class="cpn-ln" x1="' + M[0] + '" y1="' + M[1] + '" x2="' + x + '" y2="' + y + '"/>';
      h += '<circle class="cpn-pk' + (back ? "" : " lost") + '" r="4" cx="-20" cy="-20"><animateMotion begin="indefinite" dur="' + (back ? 1.4 : 0.7) + 's" fill="freeze" path="M' + M[0] + "," + M[1] + " L" + x + "," + y + (back ? " L" + M[0] + "," + M[1] : "") + '"/></circle>';
    });
    svg.insertAdjacentHTML("beforeend", h + "</g>");
    svg.querySelectorAll(".cpn-anim animateMotion").forEach((a, i) => setTimeout(() => { try { a.beginElement(); } catch (e) {} }, i * 70));
    setTimeout(() => { collecting = false; collected = true; persist(); refresh(); }, T.ALL.length * 70 + 1600);
  }
  $("collectBtn").addEventListener("click", collect);
  $("lsdDown").addEventListener("click", e => { const b = e.target.closest("[data-open]"); if (b) openSwitch(b.getAttribute("data-open")); });

  // ---------- step 1: inspect ----------
  function renderInspect() {
    const rows = sel ? rowsOf(sel) : [], dark = sel === "T7";
    $("s1empty").hidden = !!sel;
    $("s1dark").hidden = !dark;
    $("s1sw").hidden = !(sel && rows.length);
    if (!sel || !rows.length) return;
    const nd = rows.filter(r => diag[sel + ":" + r.port]).length;
    $("swTitle").innerHTML = esc(sel) + ' <span class="role">' + esc(T.role(sel)) + "</span>" + '<span class="swprog">' + nd + " / " + rows.length + " diagnosed</span>";
    $("portList").innerHTML = rows.map(r => {
      const d = diag[sel + ":" + r.port], on = r.port === selPort;
      return '<li><button type="button" class="pl' + (on ? " on" : "") + '" data-port="' + esc(r.port) + '"><span class="pl-p">' + esc(r.port) + '</span><span class="pl-to"></span>' +
        (d ? '<span class="chip" style="--tc:' + LCOL[d] + '">' + LABELS[d] + "</span>" : '<span class="chip none">?</span>') + "</button></li>";
    }).join("");
    const r = rows.filter(x => x.port === selPort)[0];
    $("probe").hidden = !r;
    $("probeHint").hidden = !!r;
    if (!r) return;
    const silent = r.discovered === "-", mism = !silent && r.discovered !== r.expected;
    $("wire").innerHTML = wire(sel + " " + r.port, r);
    const fact = (id, v, bad) => { $(id).textContent = v; $(id).className = bad ? "bad" : ""; };
    fact("pvPhy", r.phy, r.phy === "DOWN");
    fact("pvHears", r.peer_hears, r.peer_hears === "no");
    fact("pvErr", r.err, r.err !== "<1e-12");
    $("dqPort").textContent = sel + " " + r.port;
    const cur = diag[sel + ":" + r.port];
    $("dbox").classList.toggle("todo", !cur);
    $("dgrid").innerHTML = ORDER_KEYS.map(k => '<button type="button" class="dg' + (cur === k ? " on" : "") + '" data-label="' + k + '" title="' + HINT[k] + '" style="--tc:' + LCOL[k] + '"><i></i>' + LABELS[k] + "</button>").join("");
  }


  // The plan and the reality drawn as port -> cable -> port, with one arrow per direction.
  function wire(me, r) {
    const silent = r.discovered === "-", mism = !silent && r.discovered !== r.expected, down = r.phy === "DOWN";
    const box = (x, y, t, cls) => '<rect class="wb ' + (cls || "") + '" x="' + x + '" y="' + y + '" width="96" height="26" rx="5"/><text class="wt ' + (cls || "") + '" x="' + (x + 48) + '" y="' + (y + 17) + '" text-anchor="middle">' + esc(t) + "</text>";
    const tri = (x, y, dir, cls) => '<path class="wa ' + cls + '" d="M' + x + " " + y + " l" + (-8 * dir) + " -5 v10 z\"/>";
    const cross = (x, y) => '<text class="wx" x="' + x + '" y="' + (y + 5) + '" text-anchor="middle">\u2715</text>';
    let h = '<text class="wl" x="0" y="70">WHAT THE SWITCH HEARS</text>' + box(0, 76, me, "me") + box(234, 76, silent ? "nothing" : r.discovered, silent || mism ? "bad" : "ok");
    if (down) {
      h += '<line class="wln bad dash" x1="96" y1="89" x2="234" y2="89"/>' + cross(165, 89) + '<text class="wnote bad" x="165" y="113" text-anchor="middle">no signal: PHY down</text>';
    } else {
      const out = r.peer_hears === "yes" ? "ok" : r.peer_hears === "no" ? "bad" : "unk", inn = silent ? "bad" : "ok";
      h += '<line class="wln ' + out + (out === "unk" ? " dash" : "") + '" x1="100" y1="83" x2="224" y2="83"/>' + tri(232, 83, 1, out) + (out === "bad" ? cross(165, 83) : "");
      h += '<line class="wln ' + inn + (inn === "bad" ? " dash" : "") + '" x1="106" y1="95" x2="230" y2="95"/>' + tri(98, 95, -1, inn) + (inn === "bad" ? cross(165, 95) : "");
      h += '<text class="wnote" x="165" y="114" text-anchor="middle">\u2192 peer hears you: ' + esc(r.peer_hears) + " \u00b7 \u2190 you hear: " + (silent ? "nothing" : "yes") + "</text>";
      if (r.err !== "<1e-12") h += '<text class="wnote warn" x="165" y="76" text-anchor="middle">error rate ' + esc(r.err) + "</text>";
    }
    if (mism) h += '<text class="wnote bad" x="282" y="66" text-anchor="middle">\u2260 map: ' + esc(r.expected) + "</text>";
    return '<svg viewBox="-2 58 334 62" role="img" aria-label="What the switch hears on this port">' + h + "</svg>";
  }

  // ---------- step 2: the Firepath master ----------
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
  const linkText = l => l.a.s + " " + l.a.p + " ↔ " + l.b.s + " " + l.b.p;

  function renderDrain() {
    const bad = T.links.filter(l => { const a = diag[l.a.s + ":" + l.a.p], b = diag[l.b.s + ":" + l.b.p]; return (a && a !== "OK") || (b && b !== "OK"); });
    const item = l => {
      const k = linkKey(l), a = diag[l.a.s + ":" + l.a.p], b = diag[l.b.s + ":" + l.b.p];
      return '<li><button type="button" class="dl' + (drained.has(k) ? " on" : "") + '" data-drain="' + k + '"><span class="dl-x">' + (drained.has(k) ? "✕" : "") + '</span><span class="dl-t">' + esc(linkText(l)) + '</span><span class="fine">' + (a ? LABELS[a] : "—") + " / " + (b ? LABELS[b] : "—") + "</span></button></li>";
    };
    $("flagged").innerHTML = bad.length ? bad.map(item).join("") : '<li class="fine">None yet. Diagnose ports in step 2 first.</li>';
    const dl = T.links.filter(l => drained.has(linkKey(l)));
    $("drainList").innerHTML = dl.length ? dl.map(item).join("") : '<li class="fine">Nothing drained.</li>';
    $("drainCount").textContent = "(" + drained.size + ")";
  }
  function recompute() {
    const rows = PAIRS.map(p => { const n = paths(p[0], p[1], drained), full = paths(p[0], p[1], new Set()); return "<tr><td>" + p[0] + " → " + p[1] + '</td><td class="num">' + n + " of " + full + " paths</td></tr>"; }).join("");
    $("masterRes").hidden = false;
    $("masterRes").innerHTML = "<table><tbody>" + rows + "</tbody></table>";
  }
  function toggleDrain(k) { if (drained.has(k)) drained.delete(k); else drained.add(k); $("masterRes").hidden = true; touch(); refresh(); }

  // ---------- step 4: submit ----------
  function renderSubmit() {
    const nd = Object.keys(diag).length, answered = !!(answers.q1 && answers.q2);
    const item = (ok, text) => '<li class="' + (ok ? "ok" : "") + '"><span class="tick" aria-hidden="true">' + (ok ? "✓" : "○") + "</span> " + text + "</li>";
    $("doneList").innerHTML = item(nd > 0, nd + " of " + TOTAL_PORTS + " ports diagnosed") + item(drained.size > 0, drained.size + " link" + (drained.size === 1 ? "" : "s") + " drained") + item(answered, answered ? "Both questions answered" : "Questions not answered yet");
    if (submittedAt) $("submitMsg").textContent = "Sent at " + new Date(submittedAt).toTimeString().slice(0, 5) + ". Thanks! You can change things and send again.";
  }

  // ---------- refresh ----------
  function refresh() {
    [0, 1, 2, 3, 4].forEach(n => { $("step" + n).hidden = n !== step; });
    if (step === 0) renderCollect();
    if (step === 1) renderInspect();
    if (step === 2) renderDrain();
    if (step === 4) renderSubmit();
    renderMissions(); drawMap();
    window.MH_PLANES.update(true, true);
  }
  function touch() { if (submittedAt) { submittedAt = null; $("submitMsg").textContent = ""; } persist(); }
  function goStep(n) { step = Math.max(0, Math.min(4, n)); persist(); refresh(); }

  function openSwitch(sw) {
    if (sw === "MASTER") { goStep(2); return; }
    sel = sw; step = 1;
    const rows = rowsOf(sw), first = rows.filter(r => !diag[sw + ":" + r.port])[0] || rows[0];
    selPort = first ? first.port : null;
    if (selPort) probed.add(sw + ":" + selPort);
    persist(); refresh();
  }
  function selectPort(port) { selPort = port; probed.add(sel + ":" + port); refresh(); }
  function setDiag(label) {
    if (!sel || !selPort) return;
    diag[sel + ":" + selPort] = label; touch();
    // move on to the next port of this switch that has no diagnosis yet
    const rows = rowsOf(sel), i = rows.findIndex(r => r.port === selPort);
    const next = rows.slice(i + 1).concat(rows.slice(0, i)).filter(r => !diag[sel + ":" + r.port])[0];
    if (next) { selPort = next.port; probed.add(sel + ":" + next.port); }
    refresh();
  }

  // ---------- events ----------
  $("map").addEventListener("click", e => {
    const p = e.target.closest("[data-port]");
    if (p && sel && step === 1) { selectPort(p.getAttribute("data-port")); return; }
    const n = e.target.closest("[data-sw]");
    if (n) { openSwitch(n.getAttribute("data-sw")); return; }
    const pr = e.target.closest("[data-pair]");
    if (pr && step === 2) toggleDrain(pr.getAttribute("data-pair"));
  });
  $("map").addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target.closest && e.target.closest("[data-port],[data-sw]")) { e.preventDefault(); e.target.closest("[data-port],[data-sw]").dispatchEvent(new MouseEvent("click", { bubbles: true })); }
  });
  $("portList").addEventListener("click", e => { const b = e.target.closest("[data-port]"); if (b) selectPort(b.getAttribute("data-port")); });
  $("dgrid").addEventListener("click", e => { const b = e.target.closest("[data-label]"); if (b) setDiag(b.dataset.label); });
  document.addEventListener("keydown", e => {
    // number keys 1-6 pick a diagnosis while a port is open
    if (step !== 1 || !selPort || /INPUT|TEXTAREA/.test((e.target.tagName || ""))) return;
    const i = "123456".indexOf(e.key); if (i >= 0) setDiag(ORDER_KEYS[i]);
  });
  $("inspector").addEventListener("click", e => { const b = e.target.closest("[data-drain]"); if (b) toggleDrain(b.getAttribute("data-drain")); });
  $("recomputeBtn").addEventListener("click", recompute);
  $("missions").addEventListener("click", e => { const b = e.target.closest("[data-step]"); if (b) goStep(+b.dataset.step); });
  $("prevBtn").addEventListener("click", () => goStep(step - 1));
  $("nextBtn").addEventListener("click", () => goStep(step + 1));
  function showClip(id) { $("paperBox").open = true; const el = $(id) || $("paperBox"); el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
  $("paperBtn").addEventListener("click", () => showClip("paperBox"));
  document.addEventListener("click", e => { const b = e.target.closest("[data-clip]"); if (b) showClip(b.getAttribute("data-clip")); });

  ["q1", "q2"].forEach(q => { const el = document.querySelector('input[name="' + q + '"][value="' + answers[q] + '"]'); if (el) el.checked = true; });
  $("rcForm").addEventListener("change", e => { if (e.target.name) { answers[e.target.name] = e.target.value; touch(); renderMissions(); } });

  $("nick").value = nick;
  $("nick").addEventListener("input", () => { nick = $("nick").value; persist(); });
  $("submitBtn").addEventListener("click", async () => {
    nick = $("nick").value.trim(); persist();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nick)) { $("submitMsg").textContent = "Enter your email address first."; $("nick").focus(); return; }
    if (!Object.keys(diag).length) { $("submitMsg").textContent = "Diagnose a few ports first (step 2)."; return; }
    $("submitBtn").disabled = true; $("submitMsg").textContent = "Sending...";
    try {
      await window.MH.rpc("submit_work", { p_id: uid, p_nick: nick, p_diag: diag, p_drained: Array.from(drained), p_answers: answers });
      submittedAt = Date.now(); persist(); refresh();
    } catch (err) { $("submitMsg").textContent = "Could not send: " + err.message + " Your work is still saved in this browser. Try again."; }
    $("submitBtn").disabled = false;
  });

  refresh();
})();
