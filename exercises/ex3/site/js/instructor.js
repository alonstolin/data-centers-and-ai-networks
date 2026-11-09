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

  function show(subs) {
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
    $("stuTbl").innerHTML = tbl(["Name", "Diagnosed", "Wrong", "Faults found", "Q1", "Q2", "Master clean"], subs.map(s => {
      const d = s.diag || {}, ks = Object.keys(d), w = ks.filter(k => !isOk(d, k)).length, fd = P.faults.filter(f => found(d, f.id)).length, dr = new Set(s.drained || []), a = s.answers || {};
      const clean = dr.size === faulty.size && Array.from(faulty).every(k => dr.has(k));
      return [esc(s.nick || "(anonymous)"), ks.length, w, fd + " / " + P.faults.length, a.q1 ? (a.q1 === P.rc.q1 ? "✓" : "✗") : "—", a.q2 ? (a.q2 === P.rc.q2 ? "✓" : "✗") : "—", dr.size ? (clean ? "✓" : "✗ (" + dr.size + ")") : "—"];
    }));
  }

  async function load() {
    $("err").hidden = true;
    try { show(await window.MH.rpc("all_submissions", { p_key: $("key").value })); $("reload").hidden = false; }
    catch (e) { $("err").textContent = e.message; $("err").hidden = false; }
  }
  $("keyForm").addEventListener("submit", e => { e.preventDefault(); load(); });
  $("reload").addEventListener("click", load);
})();
