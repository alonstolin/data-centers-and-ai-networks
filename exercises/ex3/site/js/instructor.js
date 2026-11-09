(function () {
  const $ = id => document.getElementById(id);
  const P = window.MH_PUZZLE, T = window.MH_TOPO, { LABELS, esc } = window.MH_MAP;
  const acc = (sw, port) => (P.truth[sw + ":" + port] ? P.truth[sw + ":" + port].a : ["OK"]);
  const isOk = (d, k) => { const [sw, port] = k.split(":"); return !!d[k] && acc(sw, port).indexOf(d[k]) >= 0; };
  const faultPorts = id => Object.keys(P.truth).filter(k => P.truth[k].f === id);
  const found = (d, id) => new Set(faultPorts(id).filter(k => isOk(d, k)).map(k => k.split(":")[0])).size >= 2;
  const linkKey = l => l.a.s + "|" + l.b.s;
  const endF = e => { const t = P.truth[e.s + ":" + e.p]; return t && t.f; };
  const faulty = new Set(T.links.filter(l => endF(l.a) || endF(l.b)).map(linkKey));
  const pct = (n, d) => (d ? Math.round(100 * n / d) : 0) + "%";
  const tbl = (head, rows) => "<thead><tr>" + head.map(h => "<th>" + h + "</th>").join("") + "</tr></thead><tbody>" + rows.map(r => "<tr>" + r.map(c => "<td>" + c + "</td>").join("") + "</tr>").join("") + "</tbody>";

  // ---------- the answer map ----------
  const FCOL = { 1: "#D0343A", 2: "#B5179E", 3: "#FF8C42", 4: "#A86A00", 5: "#7B5CD6" };
  const SHORT = { OK: "OK", MISWIRED: "Miswired", ONE_WAY: "One-way", HIGH_ERRORS: "High err", LINK_DOWN: "Link down", PEER_SILENT: "Silent" };
  function answerMap() {
    const latest = {}, confirmed = new Set();
    Object.keys(P.truth).forEach(k => { latest[k] = P.truth[k].a[0]; confirmed.add(k); });
    const svg = $("map");
    window.MH_MAP.render(svg, { latest, reported: new Set(), confirmed, flags: {}, myflags: [], me: null, flash: new Set(), master: true, drained: new Set() });
    const Pp = T.pos, isT = s => /^T/.test(s);
    const ends = l => { const a = Pp[l.a.s], b = Pp[l.b.s]; return [a[0], a[1] + 16, b[0], b[1] - (isT(l.b.s) ? 12 : 16)]; };
    let h = "";
    // the cable that really exists: T4 p2 lands on AG4 d4
    const ag4 = Pp.AG4, t4 = Pp.T4;
    h += '<line class="ans-real" x1="' + ag4[0] + '" y1="' + (ag4[1] + 16) + '" x2="' + t4[0] + '" y2="' + (t4[1] - 12) + '"><title>The real cable: T4 p2 to AG4 d4</title></line>';
    const upN = {};
    T.links.forEach(l => {
      const fa = endF(l.a), fb = endF(l.b), f = fa || fb; if (!f) return;
      const ui = upN[l.a.s] = (upN[l.a.s] || 0) + 1, tu = l.tier === "tor" ? 0.08 + 0.17 * (ui - 1) : 0.2;
      const [x1, y1, x2, y2] = ends(l), tm = l.tier === "tor" ? 0.62 : 0.5, mx = x1 + (x2 - x1) * tm, my = y1 + (y2 - y1) * tm;
      [[l.a, tu], [l.b, 0.82]].forEach(([e, t]) => {
        const tr = P.truth[e.s + ":" + e.p]; if (!tr) return;
        const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t, txt = e.p + " " + tr.a.map(a => SHORT[a]).join("/");
        h += '<g class="ans-end"><rect x="' + (x - txt.length * 3.1 - 4) + '" y="' + (y - 8) + '" width="' + (txt.length * 6.2 + 8) + '" height="16" rx="4" style="stroke:' + FCOL[f] + '"/><text x="' + x + '" y="' + (y + 4) + '" text-anchor="middle">' + esc(txt) + "</text></g>";
      });
      h += '<g class="ans-badge"><circle cx="' + mx + '" cy="' + my + '" r="10" style="fill:' + FCOL[f] + '"/><text x="' + mx + '" y="' + (my + 4) + '" text-anchor="middle">' + f + "</text></g>";
    });
    const t7 = Pp.T7;
    h += '<g class="ans-dead"><line x1="' + (t7[0] - 30) + '" y1="' + (t7[1] - 15) + '" x2="' + (t7[0] + 30) + '" y2="' + (t7[1] + 15) + '"/><line x1="' + (t7[0] + 30) + '" y1="' + (t7[1] - 15) + '" x2="' + (t7[0] - 30) + '" y2="' + (t7[1] + 15) + '"/></g>';
    svg.insertAdjacentHTML("beforeend", h);
    $("ansList").innerHTML = P.faults.map(f => '<li><span class="ans-n" style="background:' + FCOL[f.id] + '">' + f.id + "</span><div><b>" + esc(f.title) + "</b> " + esc(f.text) + ' <span class="ref">(' + esc(f.ref) + ")</span></div></li>").join("") +
      '<li><span class="ans-n q">?</span><div><b>Root cause answers:</b> Q1 T7&rsquo;s software crashed. Q2 the link works in one direction only.</div></li>';
    $("answerCard").hidden = false;
  }

  function show(subs) {
    answerMap();
    const n = subs.length;
    $("sum").textContent = n + " submission" + (n === 1 ? "" : "s") + ".";
    ["faultsCard", "portsCard", "wrongCard", "rcCard2", "masterCard", "studentsCard"].forEach(id => { $(id).hidden = false; });
    $("faults").innerHTML = P.faults.map(f => {
      const c = subs.filter(s => found(s.diag || {}, f.id)).length;
      return '<article class="fault ok"><h3>' + esc(f.title) + " · " + c + " of " + n + " (" + pct(c, n) + ')</h3><p>' + esc(f.text) + ' <span class="ref">(' + esc(f.ref) + ")</span></p></article>";
    }).join("");
    const fp = Object.keys(P.truth).sort();
    $("portTbl").innerHTML = tbl(["Port", "Fault", "Right answer"].concat(Object.keys(LABELS).map(k => LABELS[k]), ["Not diagnosed"]), fp.map(k => {
      const [sw, port] = k.split(":"), cnt = {}; let none = 0;
      subs.forEach(s => { const l = (s.diag || {})[k]; if (l) cnt[l] = (cnt[l] || 0) + 1; else none++; });
      return [esc(sw + " " + port), P.truth[k].f, P.truth[k].a.map(a => LABELS[a]).join(" / ")].concat(Object.keys(LABELS).map(l => (P.truth[k].a.indexOf(l) >= 0 ? "<b>" + (cnt[l] || 0) + "</b>" : (cnt[l] || 0))), [none]);
    }));
    const wrong = {};
    subs.forEach(s => Object.keys(s.diag || {}).forEach(k => { wrong[k] = wrong[k] || { w: 0, t: 0 }; wrong[k].t++; if (!isOk(s.diag, k)) wrong[k].w++; }));
    const top = Object.keys(wrong).filter(k => wrong[k].w).sort((a, b) => wrong[b].w - wrong[a].w).slice(0, 12);
    $("wrongTbl").innerHTML = tbl(["Port", "Wrong", "Of diagnosed"], top.map(k => [esc(k.replace(":", " ")), wrong[k].w, wrong[k].t]));
    const rc = (q, right, opts) => { const c = {}; subs.forEach(s => { const a = (s.answers || {})[q]; if (a) c[a] = (c[a] || 0) + 1; }); const tot = Object.values(c).reduce((a, b) => a + b, 0);
      return "<h3>" + q.toUpperCase() + "</h3><div class=\"bars\">" + Object.keys(opts).map(k => "<div><span>" + opts[k] + (k === right ? " ✓" : "") + '</span><span class="t"><span class="' + (k === right ? "right" : "") + '" style="width:' + (tot ? 100 * (c[k] || 0) / tot : 0) + '%"></span></span><b>' + (c[k] || 0) + "</b></div>").join("") + "</div>"; };
    $("rcBars").innerHTML = rc("q1", P.rc.q1, { cables: "Two separate cable faults", power: "T7 lost power", crash: "T7's software crashed", miswire: "T7's cables were plugged into the wrong ports" }) +
      rc("q2", P.rc.q2, { crash: "AG3's software crashed", oneway: "The link works in one direction only", miswire: "The cable goes to a different switch", down: "The cable is unplugged" });
    $("drainTbl").innerHTML = tbl(["Link", "Broken?", "Drained by"], T.links.map(l => { const k = linkKey(l), c = subs.filter(s => (s.drained || []).indexOf(k) >= 0).length; return [esc(l.a.s + " " + l.a.p + " ↔ " + l.b.s + " " + l.b.p), faulty.has(k) ? "<b>broken</b>" : "", c + " of " + n]; }));
    $("stuTbl").innerHTML = tbl(["Email", "Diagnosed", "Wrong", "Faults found", "Q1", "Q2", "Master clean"], subs.map(s => {
      const d = s.diag || {}, ks = Object.keys(d), w = ks.filter(k => !isOk(d, k)).length, fd = P.faults.filter(f => found(d, f.id)).length, dr = new Set(s.drained || []), a = s.answers || {};
      const clean = dr.size === faulty.size && Array.from(faulty).every(k => dr.has(k));
      return [esc(s.nick || "(no email)"), ks.length, w, fd + " / " + P.faults.length, a.q1 ? (a.q1 === P.rc.q1 ? "✓" : "✗") : "—", a.q2 ? (a.q2 === P.rc.q2 ? "✓" : "✗") : "—", dr.size ? (clean ? "✓" : "✗ (" + dr.size + ")") : "—"];
    }));
  }

  // ---------- homework ----------
  const DEADLINE = Date.parse("2026-11-15T13:00:00+02:00");
  const PARTS = ["Firepath master", "Firepath client", "Link State Database (LSD)", "Control Plane Network (CPN)", "Neighbor Discovery (ND)", "BGP at the CBRs", "Cluster config"];
  const PLANE = { data: "Data", control: "Control", management: "Management", outside: "Outside SDN" };
  const CHOICE = { A: "A. Fully distributed", B: "B. Google's split (Firepath)", C: "C. Fully centralized" };
  function showHomework(rows) {
    $("hwCard").hidden = false;
    const late = r => Date.parse(r.at) > DEADLINE, on = rows.filter(r => !late(r));
    $("hwSum").textContent = rows.length + " submission" + (rows.length === 1 ? "" : "s") + ", " + on.length + " on time, " + (rows.length - on.length) + " late.";
    const c = { A: 0, B: 0, C: 0 }; on.forEach(r => { const k = (r.answers || {}).choice; if (c[k] !== undefined) c[k]++; });
    const tot = c.A + c.B + c.C;
    $("hwTally").innerHTML = '<div class="bars">' + Object.keys(CHOICE).map(k => "<div><span>" + CHOICE[k] + '</span><span class="t"><span class="right" style="width:' + (tot ? 100 * c[k] / tot : 0) + '%"></span></span><b>' + c[k] + "</b></div>").join("") + "</div>";
    $("hwPlaceTbl").innerHTML = tbl(["Part"].concat(Object.keys(PLANE).map(k => PLANE[k]), ["Not placed"]), PARTS.map((p, i) => {
      const cnt = {}; let none = 0; on.forEach(r => { const v = ((r.answers || {}).place || {})[i + 1]; if (v) cnt[v] = (cnt[v] || 0) + 1; else none++; });
      return [(i + 1) + ". " + esc(p)].concat(Object.keys(PLANE).map(k => cnt[k] || 0), [none]);
    }));
    const hard = a => (a.hard || []).filter(h => h.part || h.text).map(h => (h.part ? "<b>" + esc(PARTS[h.part - 1] || h.part) + ":</b> " : "") + esc(h.text || "")).join("<br>");
    $("hwAnsTbl").innerHTML = tbl(["Student", "Choice", "Why (2b)", "What would change my mind (2c)", "Hardest placements (1b)", "Firepath vs OpenFlow (1c)"], rows.map(r => {
      const a = r.answers || {};
      return [esc(r.name || "") + "<br><span class=\"fine\">" + esc(r.email) + "</span>" + (late(r) ? '<br><span class="err">late</span>' : ""), esc(a.choice || "—"), esc(a.why || ""), esc(a.change || ""), hard(a), esc(a.diff || "")];
    }));
  }

  async function load() {
    $("err").hidden = true;
    try {
      const key = $("key").value;
      show(await window.MH.rpc("all_submissions", { p_key: key })); $("reload").hidden = false;
      try { showHomework(await window.MH.rpc("all_homework", { p_key: key })); } catch (e2) { $("sum").textContent += " (Homework answers are not available yet: run supabase/homework.sql.)"; }
    }
    catch (e) { $("err").textContent = e.message; $("err").hidden = false; }
  }
  $("keyForm").addEventListener("submit", e => { e.preventDefault(); load(); });
  $("reload").addEventListener("click", load);
})();
