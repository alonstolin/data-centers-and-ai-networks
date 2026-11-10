// Questions 1a-1c under the game: the draft lives in localStorage, Submit sends it to Supabase (submit_homework).
// Part 2 (the A/B/C position) is done in class, so choice/why/change are no longer sent.
(function () {
  const $ = id => document.getElementById(id);
  const KEY = "mh-homework-v1";
  const PARTS = ["Firepath master", "Firepath client", "Link State Database (LSD)", "Control Plane Network (CPN)", "Neighbor Discovery (ND)", "BGP at the cluster border routers (CBRs)", "Cluster config"];
  const SHORT = { data: "Data", control: "Control", management: "Management", outside: "Outside SDN" };
  const PLANES = [["", "Choose..."], ["data", "Data plane"], ["control", "Control plane"], ["management", "Management plane"], ["outside", "Outside the SDN picture"]];
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  let d = {}; try { d = JSON.parse(store.get(KEY) || "{}") || {}; } catch (e) { d = {}; }
  d.place = d.place || {};
  const opt = (v, t, sel) => '<option value="' + v + '"' + (sel ? " selected" : "") + ">" + t + "</option>";
  $("hwPlace").innerHTML = '<div class="hwp-head"><span></span>' + PLANES.slice(1).map(x => "<span>" + SHORT[x[0]] + "</span>").join("") + "</div>" +
    PARTS.map((p, i) => '<div class="hwp-row" role="radiogroup" aria-label="' + p + '"><span class="hwp-name"><span class="hw-pn">' + (i + 1) + "</span>" + p + "</span>" +
      PLANES.slice(1).map(x => '<label class="hwp-cell" title="' + x[1] + '"><input type="radio" name="hp' + (i + 1) + '" value="' + x[0] + '"' + (d.place[i + 1] === x[0] ? " checked" : "") + '><span class="hwp-dot"></span></label>').join("") + "</div>").join("");
  ["h1p1", "h1p2"].forEach(id => { $(id).innerHTML = opt("", "Choose...", !d[id]) + PARTS.map((p, i) => opt(String(i + 1), (i + 1) + ". " + p, d[id] === String(i + 1))).join(""); });
  const TEXT = ["hwName", "hwEmail", "h1t1", "h1t2", "h1c"];
  TEXT.forEach(id => { if (d[id]) $(id).value = d[id]; });
  if (!d.hwEmail) { try { const g = JSON.parse(store.get("mh-solo-v2") || "{}"); if (g && g.nick) $("hwEmail").value = g.nick; } catch (e) {} }
  function collect() {
    const o = { place: {} };
    PARTS.forEach((p, i) => { const r = document.querySelector('input[name="hp' + (i + 1) + '"]:checked'); o.place[i + 1] = r ? r.value : ""; });
    ["h1p1", "h1p2"].concat(TEXT).forEach(id => { o[id] = $(id).value; });
    return o;
  }
  $("hwForm").addEventListener("input", () => { d = collect(); store.set(KEY, JSON.stringify(d)); $("hwMsg").textContent = ""; });
  $("hwForm").addEventListener("submit", async e => {
    e.preventDefault();
    const o = collect(), email = o.hwEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $("hwMsg").textContent = "Enter your email address first."; $("hwEmail").focus(); return; }
    const missing = [];
    if (PARTS.some((p, i) => !o.place[i + 1])) missing.push("1a");
    $("hwSubmit").disabled = true; $("hwMsg").textContent = "Sending...";
    const answers = { place: o.place, hard: [{ part: o.h1p1, text: o.h1t1 }, { part: o.h1p2, text: o.h1t2 }], diff: o.h1c };
    try {
      await window.MH.rpc("submit_homework", { p_email: email, p_name: o.hwName, p_answers: answers });
      $("hwMsg").textContent = "Sent at " + new Date().toTimeString().slice(0, 5) + (missing.length ? " (not answered yet: " + missing.join(", ") + ")" : "") + ". Thanks! You can change your answers and send again until the deadline.";
    } catch (err) { $("hwMsg").textContent = "Could not send: " + err.message + " Your draft is saved in this browser. Try again."; }
    $("hwSubmit").disabled = false;
  });
})();
