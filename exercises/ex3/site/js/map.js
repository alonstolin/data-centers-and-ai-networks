// Draws the shared fabric map as SVG.
(function () {
  const LABELS = { OK: "OK", MISWIRED: "Miswired", ONE_WAY: "One-way", HIGH_ERRORS: "High errors", LINK_DOWN: "Link down", PEER_SILENT: "Peer silent" };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function linkState(l, o) {
    const ka = l.a.s + ":" + l.a.p, kb = l.b.s + ":" + l.b.p;
    const la = o.latest[ka], lb = o.latest[kb];
    if (o.confirmed.has(ka) || o.confirmed.has(kb)) return "confirmed";
    if (o.truth && (o.truth.has(ka) || o.truth.has(kb))) return "hidden";
    if ((la && la !== "OK") || (lb && lb !== "OK")) return "suspect";
    if (la === "OK" && lb === "OK") return "verified";
    if (la === "OK" || lb === "OK") return "half";
    return "unknown";
  }

  const ORDER = { unknown: 0, half: 1, verified: 2, hidden: 3, suspect: 4, confirmed: 5 };

  function render(svg, o) {
    const T = window.MH_TOPO, P = T.pos;
    // one line per switch pair (the two parallel links are summarised by the worse of the two)
    const pairs = {};
    T.links.forEach(l => {
      const k = l.a.s + "|" + l.b.s, st = linkState(l, o);
      const la = o.latest[l.a.s + ":" + l.a.p], lb = o.latest[l.b.s + ":" + l.b.p];
      const line = l.a.s + " " + l.a.p + " \u2194 " + l.b.s + " " + l.b.p + " | " + l.a.s + ": " + (la ? LABELS[la] : "no report") + ", " + l.b.s + ": " + (lb ? LABELS[lb] : "no report");
      const p = pairs[k] || (pairs[k] = { a: l.a.s, b: l.b.s, st: "unknown", tips: [], tier: l.tier });
      if (ORDER[st] > ORDER[p.st]) p.st = st;
      p.tips.push(line);
    });
    let h = '<defs><filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    const flags = o.flags || {}, mine = new Set(o.myflags || []);
    Object.values(pairs).sort((x, y) => ORDER[x.st] - ORDER[y.st]).forEach(p => {
      const [x1, y1] = P[p.a], [x2, y2] = P[p.b];
      p.key = p.a + "|" + p.b;
      if (o.selPair === p.key || o.probePair === p.key) h += '<line class="lk-sel" x1="' + x1 + '" y1="' + (y1 + 16) + '" x2="' + x2 + '" y2="' + (y2 - (p.b.startsWith("T") ? 12 : 16)) + '"/>';
      const ya = y1 + (p.a.startsWith("SP") ? 16 : 16), yb = y2 - (p.b.startsWith("T") ? 12 : 16);
      h += '<line class="lk lk-' + p.st + '" x1="' + x1 + '" y1="' + ya + '" x2="' + x2 + '" y2="' + yb + '"' + (p.st === "confirmed" ? ' filter="url(#glow)"' : "") + "><title>" + esc(p.a + " \u2194 " + p.b + "\n" + p.tips.join("\n")) + "</title></line>";
    });
    // wide invisible hit areas (thin lines are hard to click) and flag markers
    Object.values(pairs).forEach(p => {
      const [x1, y1] = P[p.a], [x2, y2] = P[p.b], yb = y2 - (p.b.startsWith("T") ? 12 : 16);
      h += '<line class="hit" data-pair="' + p.key + '" x1="' + x1 + '" y1="' + (y1 + 16) + '" x2="' + x2 + '" y2="' + yb + '"><title>' + esc(p.a + " \u2194 " + p.b + " (click to inspect and flag)") + "</title></line>";
    });
    Object.values(pairs).forEach(p => {
      const c = flags[p.key]; if (!c) return;
      const [x1, y1] = P[p.a], [x2, y2] = P[p.b], yb = y2 - (p.b.startsWith("T") ? 12 : 16), mx = (x1 + x2) / 2, my = ((y1 + 16) + yb) / 2;
      h += '<g class="flag' + (mine.has(p.key) ? " mine" : "") + '" data-pair="' + p.key + '"><circle cx="' + mx + '" cy="' + my + '" r="10"/><text x="' + mx + '" y="' + (my + 4) + '" text-anchor="middle">' + c + "</text></g>";
    });
    T.ALL.forEach(s => {
      const [x, y] = P[s], tor = s.startsWith("T"), w = tor ? 54 : 74, hh = tor ? 24 : 32;
      const cls = ["nd", tor ? "nd-tor" : s.startsWith("AG") ? "nd-ag" : "nd-sp"];
      if (o.reported && o.reported.has(s)) cls.push("nd-reported");
      if (o.me === s) cls.push("nd-me");
      if (o.flash && o.flash.has(s)) cls.push("nd-flash");
      if (tor) {
        // the rack under the ToR: four servers (hosts). They are not part of the puzzle.
        h += '<g class="rack' + (o.me === s ? " rack-me" : "") + '"><line class="rk-feed" x1="' + x + '" y1="' + (y + hh / 2) + '" x2="' + x + '" y2="' + (y + 28) + '"/><rect class="rk-frame" x="' + (x - 24) + '" y="' + (y + 28) + '" width="48" height="86" rx="4"/>';
        for (let i = 0; i < 4; i++) h += '<rect class="rk-srv" x="' + (x - 18) + '" y="' + (y + 35 + i * 19) + '" width="36" height="13" rx="2"/><circle class="rk-led" cx="' + (x + 12) + '" cy="' + (y + 41.5 + i * 19) + '" r="1.8"/><line class="rk-slot" x1="' + (x - 13) + '" y1="' + (y + 41.5 + i * 19) + '" x2="' + (x + 3) + '" y2="' + (y + 41.5 + i * 19) + '"/>';
        h += "</g>";
      }
      h += '<g class="' + cls.join(" ") + '"><rect x="' + (x - w / 2) + '" y="' + (y - hh / 2) + '" width="' + w + '" height="' + hh + '" rx="5"/>' +
        '<text x="' + x + '" y="' + (y + 4.5) + '" text-anchor="middle">' + s + "</text>" +
        (o.me === s ? '<text class="you" x="' + x + '" y="' + (y + (tor ? 132 : 34)) + '" text-anchor="middle">\u25B2 YOU</text>' : "") + "</g>";
    });
    h += '<text class="blk" x="260" y="486" text-anchor="middle">BLOCK A</text><text class="blk" x="700" y="486" text-anchor="middle">BLOCK B</text>' +
         '<text class="tier" x="12" y="56">SPINE</text><text class="tier" x="12" y="204">AGGR.</text><text class="tier" x="12" y="344">ToR</text><text class="tier" x="12" y="408">SERVERS</text>';
    svg.innerHTML = h;
    return pairs;
  }

  function fromStatus(st) {
    const latest = {}, reported = new Set(), confirmed = new Set();
    (st.ports || []).forEach(r => { latest[r.s + ":" + r.p] = r.l; reported.add(r.s); });
    (st.faults || []).forEach(f => { if (f.confirmed) (f.ports || []).forEach(p => confirmed.add(p.s + ":" + p.p)); });
    return { latest, reported, confirmed, flags: st.flags || {} };
  }

  window.MH_MAP = { render, fromStatus, LABELS, esc };
})();
