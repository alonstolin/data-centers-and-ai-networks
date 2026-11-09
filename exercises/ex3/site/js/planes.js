// Part 2: place the parts of Firepath on the SDN planes. Everything here is client-side; nothing is stored.
(function () {
  const PLANES = [["data", "Data plane"], ["control", "Control plane"], ["mgmt", "Management plane"], ["out", "Outside the three planes"]];
  const PARTS = [
    { n: "Firepath master", what: "The elected node that collects link state and redistributes it.", best: "control", ok: [],
      why: "It builds the Link State Database and sends it to every switch. This is the centralized part of Firepath. (Section 5.2.2, 5.2.4)" },
    { n: "Firepath client", what: "The process on every fabric switch.", best: "control", ok: [],
      why: "It runs on the switch, computes shortest paths with ECMP and programs the local hardware tables. The tables themselves are the data plane, but deciding what goes in them is control. This is the distributed part of Firepath. (Section 5.2.2)" },
    { n: "Link State Database (LSD)", what: "The versioned topology state the master sends to clients.", best: "control", ok: [],
      why: "It is the input to the routing computation: which links are up. It is control state, not packets and not configuration. (Section 5.2.2)" },
    { n: "Control Plane Network (CPN)", what: "The out-of-band network the master and clients talk over.", best: "out", ok: ["mgmt", "control"],
      why: "Best seen as the transport the planes use. It was first built to configure and manage the switches (Section 3.2), and later also carries link state between master and clients (Section 5.1, 5.2.2). So management and control are both defensible." },
    { n: "Neighbor Discovery (ND)", what: "The liveness and peer-correctness check on each link.", best: "control", ok: ["mgmt"],
      why: "A port is only declared up to the routing process when it is PHY UP and ND UP, so ND feeds the control plane like a hello protocol. It also drives LEDs and dashboards, which is why management is defensible. (Section 5.2.1)" },
    { n: "BGP at the cluster border routers", what: "Route exchange at the edge of the fabric.", best: "control", ok: ["out"],
      why: "It is ordinary distributed routing between Google's fabric and external networks. Firepath redistributes the routes it learns. So it is control, but outside the centralized part. (Section 5.2.5)" },
    { n: "Cluster config", what: "The static topology of the whole fabric, loaded at startup.", best: "mgmt", ok: ["control"],
      why: "It is generated top-down from a few fabric parameters and pushed to every switch, which is configuration. Firepath and ND also use it as input, which is why control is defensible. (Section 5.2.2, 5.3.1)" }
  ];
  const choice = {};
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function draw() {
    const rows = PARTS.map((p, i) => {
      const c = choice[i];
      let fb = "";
      if (c) {
        const kind = c === p.best ? "best" : p.ok.indexOf(c) >= 0 ? "ok" : "no";
        const head = kind === "best" ? "Best fit." : kind === "ok" ? "Defensible." : "Look again.";
        const best = (PLANES.filter(x => x[0] === p.best)[0] || [])[1];
        fb = '<p class="pl-fb ' + kind + '"><b>' + head + "</b> " + (kind === "best" ? "" : "The best fit is <b>" + esc(best) + "</b>. ") + esc(p.why) + "</p>";
      }
      return '<li class="pl-row"><div class="pl-name"><b>' + (i + 1) + ". " + esc(p.n) + "</b><span>" + esc(p.what) + '</span></div><div class="pl-opts" role="group" aria-label="Plane for ' + esc(p.n) + '">' +
        PLANES.map(pl => '<button type="button" class="pl-btn' + (c === pl[0] ? " on" : "") + '" data-i="' + i + '" data-p="' + pl[0] + '" aria-pressed="' + (c === pl[0]) + '">' + pl[1] + "</button>").join("") + "</div>" + fb + "</li>";
    }).join("");
    $("planeList").innerHTML = rows;
    const n = Object.keys(choice).length;
    $("planeCount").textContent = n + " of " + PARTS.length + " placed";
    $("planeDone").hidden = n < PARTS.length;
    document.dispatchEvent(new CustomEvent("planes-change"));
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!$("planeList")) return;
    $("planeList").addEventListener("click", e => {
      const b = e.target.closest(".pl-btn"); if (!b) return;
      choice[+b.dataset.i] = b.dataset.p; draw();
    });
    draw();
  });

  window.MH_PLANES = {
    count() { return Object.keys(choice).length; }, total: PARTS.length,
    update(joined, unlocked) {
      if (!$("planeCard")) return;
      $("planeCard").hidden = !joined;
      $("planeLock").hidden = !!unlocked;
      $("planeBody").hidden = !unlocked;
    }
  };
})();
