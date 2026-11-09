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

  function panel(pn, P, o) {
    const sw = pn.sw, tor = /^T/.test(sw), y0 = 540, py = 584, pw = 36, ph = 40, gap = 4;
    const groups = [];
    pn.rows.forEach(r => { const g = r.port.charAt(0).toLowerCase(); let G = groups.filter(x => x.g === g)[0]; if (!G) groups.push(G = { g, rows: [] }); G.rows.push(r); });
    if (tor) groups.push({ g: "s", rows: [], servers: true });
    const title = { d: "DOWN PORTS", u: "UP PORTS", p: tor ? "UP PORTS" : "PORTS", s: "SERVER PORTS" };
    const gw = 8 * (pw + gap) - gap, ggap = 28, total = groups.length * gw + (groups.length - 1) * ggap, x0 = 480 - total / 2;
    let h = "", centers = {};
    const [nx, ny] = P[sw], top = tor ? ny + 114 : ny + 18;
    h += '<polygon class="zoom" points="' + (nx - 20) + "," + top + " " + (nx + 20) + "," + top + " " + (x0 + total + 14) + "," + y0 + " " + (x0 - 14) + "," + y0 + '"/>';
    h += '<rect class="chassis" x="' + (x0 - 14) + '" y="' + y0 + '" width="' + (total + 28) + '" height="92" rx="8"/>';
    h += '<text class="ch-name" text-anchor="end" x="' + (x0 + total + 2) + '" y="' + (y0 + 17) + '">' + esc(sw) + " · your switch</text>";
    groups.forEach((G, gi) => {
      const gx = x0 + gi * (gw + ggap);
      h += '<text class="ch-grp" x="' + gx + '" y="' + (py - 8) + '">' + title[G.g] + "</text>";
      for (let i = 0; i < 8; i++) {
        const x = gx + i * (pw + gap);
        if (G.servers) { h += '<g class="pt pt-static"><rect x="' + x + '" y="' + py + '" width="' + pw + '" height="' + ph + '" rx="4"/><text x="' + (x + pw / 2) + '" y="' + (py + 25) + '" text-anchor="middle">s' + (i + 1) + "</text></g>"; continue; }
        const r = G.rows[i]; if (!r) continue;
        const l = pn.labels[r.port], sel = pn.sel === r.port, seen = pn.probed.has(r.port);
        centers[r.port] = x + pw / 2;
        h += '<g class="pt' + (sel ? " pt-sel" : "") + (seen && !l ? " pt-seen" : "") + '" data-port="' + esc(r.port) + '" tabindex="0" role="button" aria-label="Port ' + esc(r.port) + (l ? ", labeled " + LABELS[l] : seen ? ", probed" : ", not probed") + '"><title>' + esc(r.port + (l ? ": " + LABELS[l] : "")) + '</title><rect x="' + x + '" y="' + py + '" width="' + pw + '" height="' + ph + '" rx="4"' + (l ? ' style="stroke:' + PCOL[l] + '"' : "") + "/>" +
          '<circle cx="' + (x + pw / 2) + '" cy="' + (py + 9) + '" r="3.5" style="fill:' + (l ? PCOL[l] : "var(--idle)") + '"/>' +
          '<text class="pn" x="' + (x + pw / 2) + '" y="' + (py + 27) + '" text-anchor="middle">' + esc(r.port) + "</text>" +
          '<text class="pl" x="' + (x + pw / 2) + '" y="' + (py + ph + 14) + '" text-anchor="middle" style="fill:' + (l ? PCOL[l] : "var(--muted)") + '">' + (l ? SYM[l] : seen ? "·" : "") + "</text></g>";
      }
    });
    const r = pn.sel && pn.rows.filter(x => x.port === pn.sel)[0];
    if (r && centers[r.port] != null) {
      const sx = centers[r.port], sy = py, plan = swOf(r.expected), heard = swOf(r.discovered);
      const down = r.phy === "DOWN", hi = r.err !== "<1e-12", match = !down && heard && r.discovered === r.expected;
      const rad = t => (/^T/.test(t) ? 31 : 44);
      const route = t => { const [tx, ty] = P[t], ey = ty + (/^T/.test(t) ? 14 : 18); return "M" + sx + "," + sy + " C" + sx + "," + (y0 - 70) + " " + tx + "," + (ey + 60) + " " + tx + "," + ey; };
      let pr = "";
      if (plan && P[plan] && !match) pr += '<path class="pb-plan" d="' + route(plan) + '"/>';
      if (plan && P[plan]) pr += '<circle class="pb-ring pb-plan-ring" cx="' + P[plan][0] + '" cy="' + P[plan][1] + '" r="' + rad(plan) + '"/>';
      if (down) {
        pr += '<line class="pb-cable pb-cut" x1="' + sx + '" y1="' + sy + '" x2="' + sx + '" y2="' + (y0 - 22) + '"/><text class="pb-x" x="' + sx + '" y="' + (y0 - 28) + '" text-anchor="middle">✕</text><text class="pb-note" x="' + sx + '" y="' + (y0 - 52) + '" text-anchor="middle">no signal (PHY down)</text>';
      } else if (!heard || !P[heard]) {
        pr += '<line class="pb-cable pb-silent" x1="' + sx + '" y1="' + sy + '" x2="' + sx + '" y2="' + (y0 - 40) + '"/><text class="pb-x warn" x="' + sx + '" y="' + (y0 - 46) + '" text-anchor="middle">?</text><text class="pb-note" x="' + sx + '" y="' + (y0 - 70) + '" text-anchor="middle">PHY up, but nothing heard</text>';
      } else {
        const d = route(heard);
        pr += '<path class="pb-cable' + (hi ? " pb-noisy" : "") + (match ? "" : " pb-bad") + '" d="' + d + '"/><circle class="pb-pulse" r="5"><animateMotion dur="2.2s" repeatCount="indefinite" path="' + d + '"/></circle>';
        pr += '<circle class="pb-ring ' + (match ? "pb-ok-ring" : "pb-bad-ring") + '" cx="' + P[heard][0] + '" cy="' + P[heard][1] + '" r="' + rad(heard) + '"/>';
      }
      h += pr;
    }
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
        (o.me === s ? '<text class="you" x="' + x + '" y="' + (y + (tor ? 132 : 34)) + '" text-anchor="middle">\u25B2 YOU</text>' : "") + "</g>";
    });

    // ---- your switch, zoomed in below the map, with the probe running into the network ----
    const pn = o.panel;
    svg.setAttribute("viewBox", pn ? "0 0 960 700" : "0 0 960 500");
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
