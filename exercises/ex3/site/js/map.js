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


  const PCOL = { OK: "var(--ok)", MISWIRED: "var(--bad)", ONE_WAY: "#FF8C42", HIGH_ERRORS: "var(--warn)", LINK_DOWN: "#9AA7B2", PEER_SILENT: "#B58CFF" };
  const SYM = { OK: "✓", MISWIRED: "≠", ONE_WAY: "→", HIGH_ERRORS: "!", LINK_DOWN: "✕", PEER_SILENT: "?" };
  const swOf = t => (t && t !== "-" ? t.split(" ")[0] : null);

  // Ports are drawn as small tabs on the cable of the link they belong to, right next to your switch.
  function panel(pn, P, o) {
    const sw = pn.sw, [nx, ny] = P[sw], seen = {}, spot = {};
    let h = "";
    pn.rows.forEach(r => {
      const peer = swOf(r.expected); if (!peer || !P[peer]) return;
      const [px, py] = P[peer], dx = px - nx, dy = py - ny, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
      const k = seen[peer] = (seen[peer] || 0) + 1, vy = (py > ny ? 1 : -1) * (46 + (k - 1) * 22), t = vy / dy;
      spot[r.port] = { x: nx + dx * t, y: ny + vy, ux, uy, peer };
    });
    const r = pn.sel && pn.rows.filter(x => x.port === pn.sel)[0], S = r && spot[r.port];
    if (r && S) {
      const plan = swOf(r.expected), heard = swOf(r.discovered), down = r.phy === "DOWN", hi = r.err !== "<1e-12", match = !down && heard && r.discovered === r.expected;
      const isT = t => /^T/.test(t);
      const ring = (t, c) => { const w = isT(t) ? 54 : 74, hh = isT(t) ? 24 : 32; return '<rect class="pb-ring ' + c + '" x="' + (P[t][0] - w / 2 - 5) + '" y="' + (P[t][1] - hh / 2 - 5) + '" width="' + (w + 10) + '" height="' + (hh + 10) + '" rx="9"/>'; };
      // same geometry as the map's own link lines: upper node bottom edge to lower node top edge
      const seg = t => { const up = P[t][1] < ny ? t : sw, lo = up === t ? sw : t, a = P[up], b = P[lo]; const pts = [a[0], a[1] + 16, b[0], b[1] - (isT(lo) ? 12 : 16)]; return up === sw ? pts : [pts[2], pts[3], pts[0], pts[1]]; };
      const ln = (t, cls) => { const q = seg(t); return '<line class="' + cls + '" x1="' + q[0] + '" y1="' + q[1] + '" x2="' + q[2] + '" y2="' + q[3] + '"/>'; };
      const pulse = t => { const q = seg(t); return '<circle class="pb-pulse" r="4.5"><animateMotion dur="2s" repeatCount="indefinite" path="M' + q[0] + "," + q[1] + " L" + q[2] + "," + q[3] + '"/></circle>'; };
      h += ring(plan, "pb-plan-ring");
      if (down) h += ln(plan, "pb-cable pb-cut");
      else if (!heard || !P[heard]) h += ln(plan, "pb-cable pb-silent");
      else if (match) h += ln(heard, "pb-cable" + (hi ? " pb-noisy" : "")) + pulse(heard) + ring(heard, "pb-ok-ring");
      else h += ln(plan, "pb-plan") + ln(heard, "pb-cable pb-bad") + pulse(heard) + ring(heard, "pb-bad-ring");
    }
    pn.rows.forEach(rw => {
      const S2 = spot[rw.port]; if (!S2) return;
      const l = pn.labels[rw.port], sel = pn.sel === rw.port, sn = pn.probed.has(rw.port);
      h += '<g class="pt' + (sel ? " pt-sel" : "") + (sn && !l ? " pt-seen" : "") + '" data-port="' + esc(rw.port) + '" tabindex="0" role="button" aria-label="Port ' + esc(rw.port) + (l ? ", labeled " + LABELS[l] : sn ? ", probed" : ", not probed") + '"><title>' + esc("Port " + rw.port + " (click to probe)" + (l ? ": " + LABELS[l] : "")) + '</title>' +
        '<rect x="' + (S2.x - 13) + '" y="' + (S2.y - 9) + '" width="26" height="18" rx="4"' + (l ? ' style="stroke:' + PCOL[l] + ";fill:color-mix(in srgb," + PCOL[l] + ' 22%,var(--panel))"' : "") + "/>" +
        '<text class="pn" x="' + S2.x + '" y="' + (S2.y + 3.6) + '" text-anchor="middle">' + esc(rw.port) + "</text>" +
        (l ? '<text class="pl" x="' + (S2.x + 15) + '" y="' + (S2.y - 6) + '" style="fill:' + PCOL[l] + '">' + SYM[l] + "</text>" : "") + "</g>";
    });
    return h;
  }

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
        (o.me === s ? (tor ? '<text class="you" x="' + x + '" y="' + (y + 132) + '" text-anchor="middle">\u25B2 YOU</text>' : '<text class="you" x="' + (x + w / 2 + 8) + '" y="' + (y + 4) + '">\u25C0 YOU</text>') : "") + "</g>";
    });

    // ---- your switch, zoomed in below the map, with the probe running into the network ----
    const pn = o.panel;
    svg.setAttribute("viewBox", "0 0 960 500");
    if (pn) h += panel(pn, P, o);
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
