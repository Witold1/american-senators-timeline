/**
 * Load timeline bounds from data/auxiliary/ and seat bars from data/processed/.
 */
(function () {
  const AUXILIARY = "data/auxiliary";
  const PROCESSED = "data/processed";

  async function fetchJson(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.json();
  }

  async function load() {
    const [meta, seats] = await Promise.all([
      fetchJson(`${AUXILIARY}/meta.json`),
      fetchJson(`${PROCESSED}/seats-all.json`),
    ]);

    if (!Array.isArray(seats) || seats.length !== 100) {
      throw new Error(`Expected 100 seats in seats-all.json, got ${seats?.length ?? 0}`);
    }

    return { ...meta, seats };
  }

  function showLoadError(message) {
    const el = document.getElementById("timeline");
    if (!el) return;
    el.innerHTML = "";
    const box = document.createElement("div");
    box.className = "data-load-error";
    box.setAttribute("role", "alert");
    box.innerHTML = `<strong>Timeline data did not load.</strong><p>${message}</p>`;
    el.appendChild(box);
  }

  async function init() {
    if (location.protocol !== "http:" && location.protocol !== "https:") {
      console.error(
        "Timeline data requires HTTP. Run .\\serve.ps1 or use GitHub Pages; opening index.html directly will not work."
      );
      showLoadError(
        "Browsers block local JSON over <code>file://</code>. Run <code>.\\serve.ps1</code> and open the localhost URL."
      );
      return;
    }

    try {
      window.TIMELINE_DATA = await load();
      window.dispatchEvent(new Event("timeline-data-ready"));
    } catch (err) {
      console.error("Failed to load timeline data:", err);
      showLoadError(
        "Could not fetch the timeline JSON. Check the console, then refresh."
      );
    }
  }

  init();
})();
