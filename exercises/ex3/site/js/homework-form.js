// The homework answer form: the draft lives in localStorage, Submit sends it to Supabase (submit_homework).
(function () {
  const $ = id => document.getElementById(id);
  const KEY = "mh-homework-v1";
  const PARTS = ["Firepath master", "Firepath client", "Link State Database (LSD)", "Control Plane Network (CPN)", "Neighbor Discovery (ND)", "BGP at the cluster border routers (CBRs)", "Cluster config"];
  const PLANES = [["", "Choose..."], ["data", "Data plane"], ["control", "Control plane"], ["management", "Management plane"], ["outside", "Outside the SDN picture"]];
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  let d = {}; try { d = JSON.parse(store.get(KEY) || "{}") || {}; } catch (e) { d = {}; }
  d.place = d.place || {};
  const opt = (v, t, sel) => '<option value="' + v + '"' + (sel ? " selected" : "") + ">" + t + "</option>";
  $("hwPlace").innerHTML = PARTS.map((p, i) => '<label for="hp' + (i + 1) + '"><span class="hw-pn">' + (i + 1) + "</span> " + p + '</label><select id="hp' + (i + 1) + '">' + PLANES.map(x => opt(x[0], x[1], d.place[i + 1] === x[0])).join("") + "</select>").join("");
  ["h1p1", "h1p2"].forEach(id => { $(id).innerHTML = opt("", "Choose...", !d[id]) + PARTS.map((p, i) => opt(String(i + 1), (i + 1) + ". " + p, d[id] === String(i + 1))).join(""); });
  const TEXT = ["hwName", "hwEmail", "h1t1", "h1t2", "h1c", "h2b", "h2c"];
  TEXT.forEach(id => { if (d[id]) $(id).value = d[id]; });
  if (d.h2a) { const r = document.querySelector('input[name="h2a"][value="' + d.h2a + '"]'); if (r) r.checked = true; }
  function collect() {
    const o = { place: {} };
    PARTS.forEach((p, i) => { o.place[i + 1] = $("hp" + (i + 1)).value; });
    ["h1p1", "h1p2"].concat(TEXT).forEach(id => { o[id] = $(id).value; });
    const r = document.querySelector('input[name="h2a"]:checked'); o.h2a = r ? r.value : "";
    return o;
  }
  $("hwForm").addEventListener("input", () => { d = collect(); store.set(KEY, JSON.stringify(d)); $("hwMsg").textContent = ""; });
  $("hwForm").addEventListener("submit", async e => {
    e.preventDefault();
    const o = collect(), email = o.hwEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $("hwMsg").textContent = "Enter your email address first."; $("hwEmail").focus(); return; }
    const missing = [];
    if (PARTS.some((p, i) => !o.place[i + 1])) missing.push("1a");
    if (!o.h2a) missing.push("2a");
    $("hwSubmit").disabled = true; $("hwMsg").textContent = "Sending...";
    const answers = { place: o.place, hard: [{ part: o.h1p1, text: o.h1t1 }, { part: o.h1p2, text: o.h1t2 }], diff: o.h1c, choice: o.h2a, why: o.h2b, change: o.h2c };
    try {
      await window.MH.rpc("submit_homework", { p_email: email, p_name: o.hwName, p_answers: answers });
      $("hwMsg").textContent = "Sent at " + new Date().toTimeString().slice(0, 5) + (missing.length ? " (not answered yet: " + missing.join(", ") + ")" : "") + ". Thanks! You can change your answers and send again until the deadline.";
    } catch (err) { $("hwMsg").textContent = "Could not send: " + err.message + " Your draft is saved in this browser. Try again."; }
    $("hwSubmit").disabled = false;
  });
})();
