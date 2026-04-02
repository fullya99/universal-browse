export function getCookiePickerHTML(port, token) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Universal Browse Cookie Picker</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; margin: 20px; }
    .row { margin: 10px 0; }
    .domains { max-height: 320px; overflow: auto; border: 1px solid #ddd; padding: 8px; }
    button { padding: 8px 12px; margin-right: 8px; }
    .muted { color: #666; }
    .ok { color: #0a7f37; }
    .err { color: #b00020; }
  </style>
</head>
<body>
  <h2>Cookie Importer</h2>
  <p class="muted">Pick browser/profile/domains, then import into current Playwright session.</p>

  <div class="row">
    <label>Browser:</label>
    <select id="browser"></select>
  </div>
  <div class="row">
    <label>Profile:</label>
    <select id="profile"></select>
  </div>
  <div class="row">
    <button id="load">Load Domains</button>
    <button id="import">Import Selected</button>
    <button id="remove">Remove Selected</button>
  </div>
  <div class="row domains" id="domains"></div>
  <div class="row" id="status"></div>

  <script>
    const BASE = "http://127.0.0.1:${port}";
    const TOKEN = ${JSON.stringify(token || "")};

    const browserEl = document.getElementById("browser");
    const profileEl = document.getElementById("profile");
    const domainsEl = document.getElementById("domains");
    const statusEl = document.getElementById("status");

    function status(text, cls = "") {
      statusEl.className = cls;
      statusEl.textContent = text;
    }

    async function api(path, opts = {}) {
      const headers = { ...(opts.headers || {}) };
      if (TOKEN) headers["Authorization"] = "Bearer " + TOKEN;
      const r = await fetch(BASE + path, { ...opts, headers });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || body.message || "Request failed");
      return body;
    }

    async function loadBrowsers() {
      const data = await api("/cookie-picker/browsers");
      browserEl.innerHTML = "";
      for (const b of data.browsers || []) {
        const o = document.createElement("option");
        o.value = b.aliases?.[0] || b.name.toLowerCase();
        o.textContent = b.name;
        browserEl.appendChild(o);
      }
      await loadProfiles();
    }

    async function loadProfiles() {
      const browser = browserEl.value;
      const data = await api("/cookie-picker/profiles?browser=" + encodeURIComponent(browser));
      profileEl.innerHTML = "";
      for (const p of data.profiles || []) {
        const o = document.createElement("option");
        o.value = p.name;
        o.textContent = p.displayName ? p.displayName + " (" + p.name + ")" : p.name;
        profileEl.appendChild(o);
      }
      if (!profileEl.value) {
        const o = document.createElement("option");
        o.value = "Default";
        o.textContent = "Default";
        profileEl.appendChild(o);
      }
    }

    async function loadDomains() {
      const browser = browserEl.value;
      const profile = profileEl.value || "Default";
      const data = await api("/cookie-picker/domains?browser=" + encodeURIComponent(browser) + "&profile=" + encodeURIComponent(profile));
      domainsEl.innerHTML = "";
      for (const d of data.domains || []) {
        const row = document.createElement("label");
        row.style.display = "block";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = d.domain;
        row.appendChild(cb);
        row.appendChild(document.createTextNode(" " + d.domain + " (" + d.count + ")"));
        domainsEl.appendChild(row);
      }
      status("Domains loaded", "ok");
    }

    function selectedDomains() {
      return [...domainsEl.querySelectorAll("input[type=checkbox]:checked")].map((el) => el.value);
    }

    async function importSelected() {
      const domains = selectedDomains();
      if (domains.length === 0) return status("Select at least one domain", "err");
      const payload = {
        browser: browserEl.value,
        profile: profileEl.value || "Default",
        domains,
      };
      const data = await api("/cookie-picker/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      status("Imported " + data.imported + " cookies" + (data.failed ? (", failed " + data.failed) : ""), "ok");
    }

    async function removeSelected() {
      const domains = selectedDomains();
      if (domains.length === 0) return status("Select at least one domain", "err");
      const data = await api("/cookie-picker/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains }),
      });
      status("Removed cookies for " + data.removed + " domains", "ok");
    }

    browserEl.addEventListener("change", loadProfiles);
    document.getElementById("load").addEventListener("click", () => loadDomains().catch((e) => status(e.message, "err")));
    document.getElementById("import").addEventListener("click", () => importSelected().catch((e) => status(e.message, "err")));
    document.getElementById("remove").addEventListener("click", () => removeSelected().catch((e) => status(e.message, "err")));

    loadBrowsers().catch((e) => status(e.message, "err"));
  </script>
</body>
</html>`;
}
