/**
 * Load catalog + one dataset's meta and seats-all.json.
 * Pick with #hash (Kazakh-khanate style), else ?dataset=, else catalog.default.
 */
(function () {
  const CATALOG_PATH = "data/catalog.json";

  let catalogCache = null;
  let activeHash = null;
  let loadToken = 0;

  async function fetchJson(path) {
    // Avoid stale meta/catalog after local edits (browsers cache JSON aggressively).
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.json();
  }

  async function getCatalog() {
    if (catalogCache) return catalogCache;
    const catalog = await fetchJson(CATALOG_PATH);
    if (!Array.isArray(catalog.datasets) || !catalog.datasets.length) {
      throw new Error("catalog.json has no datasets");
    }
    catalogCache = catalog;
    return catalog;
  }

  function datasetHash(entry) {
    return String(entry.hash || entry.id || "").replace(/^#/, "");
  }

  function findDataset(catalog, key) {
    const needle = String(key || "").replace(/^#/, "");
    if (!needle) return null;
    return (
      catalog.datasets.find((d) => datasetHash(d) === needle) ||
      catalog.datasets.find((d) => d.id === needle) ||
      null
    );
  }

  function hashFromLocation() {
    return location.hash.replace(/^#/, "").trim();
  }

  function requestedDataset(catalog) {
    const fromHash = findDataset(catalog, hashFromLocation());
    if (fromHash) return fromHash;

    try {
      const queryId = new URLSearchParams(location.search).get("dataset");
      const fromQuery = findDataset(catalog, queryId);
      if (fromQuery) return fromQuery;
    } catch (_) {
      /* ignore */
    }

    return (
      findDataset(catalog, catalog.default) ||
      catalog.datasets[0]
    );
  }

  function syncHash(entry) {
    setViewHash(datasetHash(entry));
  }

  /** Update #hash without firing hashchange (replaceState). */
  function setViewHash(hash) {
    const next = String(hash || "").replace(/^#/, "").trim();
    if (!next) return;
    activeHash = next;
    if (hashFromLocation() !== next) {
      history.replaceState(null, "", `#${next}`);
    }
  }

  function applyDocumentMeta(data) {
    if (data.datasetTitle) document.title = data.datasetTitle;
    const heading = document.querySelector(".title-block h1");
    if (heading && data.title) heading.textContent = data.title;
    const lede = document.querySelector(".title-block .subtitle");
    if (lede && data.subtitle) lede.textContent = data.subtitle;
    // Footer may include <a> tags from meta.
    const authorEl = document.getElementById("footer-author");
    const sourcesEl = document.getElementById("footer-sources");
    if (authorEl && data.author) {
      const body = String(data.author).replace(/^Author\s*:\s*/i, "");
      authorEl.innerHTML = `Author: ${body}`;
    }
    if (sourcesEl && data.sources) {
      const body = String(data.sources).replace(/^Sources?\s*:\s*/i, "");
      sourcesEl.innerHTML = `Sources: ${body}`;
    }
  }

  function updateDatasetSwitcher(catalog, activeEntry) {
    const root = document.getElementById("dataset-switcher");
    if (!root) return;

    const active = datasetHash(activeEntry);
    root.hidden = catalog.datasets.length < 2;
    root.innerHTML = "";

    for (const entry of catalog.datasets) {
      const hash = datasetHash(entry);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip-btn dataset-btn";
      btn.dataset.dataset = hash;
      btn.textContent = entry.label || entry.title || hash;
      const on = hash === active;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.title = entry.title || hash;
      root.appendChild(btn);
    }
  }

  function pad2(n) {
    return String(Number(n) || 1).padStart(2, "0");
  }

  function dateToAdmitted(date) {
    if (!date?.year) return "";
    return `${date.year}-${pad2(date.month)}-${pad2(date.day)}`;
  }

  function normalizeSpan(leader, { soviet = false } = {}) {
    return {
      ...leader,
      role:
        leader.role ||
        (soviet ? "Republic head (USSR)" : "Head of state"),
      party: leader.party || "",
      era: soviet ? "soviet" : "independent",
    };
  }

  /** Map rulers-of-post-soviet-kingdoms country JSON into the shared seat shape. */
  function countryToSeat(country) {
    const rulers = [
      ...(country.sovietLeaders || []).map((leader) =>
        normalizeSpan(leader, { soviet: true })
      ),
      ...(country.rulers || []).map((leader) => normalizeSpan(leader)),
    ];
    const sovereigntyDate = dateToAdmitted(country.sovereignty);
    const independenceDate = dateToAdmitted(country.independence);
    return {
      id: country.id,
      name: country.name,
      state: country.id,
      flag: country.flag || country.id,
      region: country.region || "",
      // Shared "admitted" slot = independence (year chip + default date sort).
      admitted: independenceDate,
      sovereignty: country.sovereignty || null,
      independence: country.independence || null,
      sovereigntyDate,
      independenceDate,
      unrest: country.unrest || [],
      rulers,
    };
  }

  async function loadCountriesSeats(base) {
    const index = await fetchJson(`${base}/countries/index.json`);
    if (!Array.isArray(index) || !index.length) {
      throw new Error(`Expected country ids in ${base}/countries/index.json`);
    }
    const countries = await Promise.all(
      index.map((id) => fetchJson(`${base}/countries/${id}.json`))
    );
    for (const [i, id] of index.entries()) {
      if (countries[i]?.id !== id) {
        throw new Error(`Country file id mismatch for ${id}`);
      }
    }
    return countries.map(countryToSeat);
  }

  async function loadSeatsBundle(base) {
    const seats = await fetchJson(`${base}/processed/seats-all.json`);
    if (!Array.isArray(seats) || !seats.length) {
      throw new Error(`Expected seats array in ${base}/processed/seats-all.json`);
    }
    return seats;
  }

  async function loadEntry(entry) {
    const base = entry.path.replace(/\/$/, "");
    const format = entry.format || "seats";
    const [meta, seats] = await Promise.all([
      fetchJson(`${base}/auxiliary/meta.json`),
      format === "countries" ? loadCountriesSeats(base) : loadSeatsBundle(base),
    ]);

    const exclusive = meta.exclusive !== false;
    const annotated = window.TimelineLanes
      ? window.TimelineLanes.annotateSeats(seats, { exclusive })
      : seats.map((seat) => ({ ...seat, laneCount: 1 }));

    return {
      ...meta,
      exclusive,
      showCongress: meta.showCongress === true,
      entityLabel: meta.entityLabel || "State",
      roleLabel: meta.roleLabel || "Ruler",
      datasetId: entry.id,
      datasetHash: datasetHash(entry),
      datasetPath: base,
      datasetTitle: entry.title || meta.title || entry.id,
      seats: annotated,
    };
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

  async function activateDataset(entry, { syncUrl = true } = {}) {
    const token = ++loadToken;
    const data = await loadEntry(entry);
    if (token !== loadToken) return null;

    if (syncUrl) syncHash(entry);
    activeHash = datasetHash(entry);
    window.TIMELINE_DATA = data;
    applyDocumentMeta(data);

    const catalog = await getCatalog();
    updateDatasetSwitcher(catalog, entry);
    return data;
  }

  async function selectDataset(key, { force = false } = {}) {
    const catalog = await getCatalog();
    const entry = findDataset(catalog, key) || requestedDataset(catalog);
    if (!entry) throw new Error(`Unknown dataset: ${key}`);

    const hash = datasetHash(entry);
    if (
      !force &&
      hash === activeHash &&
      window.TIMELINE_DATA?.datasetId === entry.id &&
      window.TIMELINE_DATA?.seats?.length
    ) {
      syncHash(entry);
      updateDatasetSwitcher(catalog, entry);
      return window.TIMELINE_DATA;
    }

    const hadData = Boolean(window.TIMELINE_DATA?.seats?.length);
    const data = await activateDataset(entry);
    if (!data) return null;

    window.TimelineFilterControls?.applyDatasetView?.(entry);

    if (hadData) {
      window.TimelineGeometry?.invalidateCaches?.();
      window.TimelinePalette?.invalidate?.();
      if (typeof window.renderTimeline === "function") {
        window.renderTimeline();
      }
      window.dispatchEvent(new Event("timeline-dataset-change"));
    } else {
      window.dispatchEvent(new Event("timeline-data-ready"));
    }
    return data;
  }

  /** Raw records for the upload field map (countries JSON or seats-all). */
  async function loadPresetRecords(key) {
    const catalog = await getCatalog();
    const entry = findDataset(catalog, key) || requestedDataset(catalog);
    if (!entry) throw new Error(`Unknown dataset: ${key}`);
    const base = entry.path.replace(/\/$/, "");
    const format = entry.format || "seats";
    const meta = await fetchJson(`${base}/auxiliary/meta.json`);
    let records;
    if (format === "countries") {
      const index = await fetchJson(`${base}/countries/index.json`);
      if (!Array.isArray(index) || !index.length) {
        throw new Error(`Expected country ids in ${base}/countries/index.json`);
      }
      records = await Promise.all(
        index.map((id) => fetchJson(`${base}/countries/${id}.json`))
      );
    } else {
      records = await loadSeatsBundle(base);
    }
    return { entry, meta, records };
  }

  function bindDatasetSwitcher() {
    const root = document.getElementById("dataset-switcher");
    if (!root || root.dataset.bound === "1") return;
    root.dataset.bound = "1";
    root.addEventListener("click", (event) => {
      const btn = event.target.closest?.("[data-dataset]");
      if (!btn) return;
      const dialog = document.getElementById("upload-dialog");
      // Inside the upload dialog, open the field map instead of switching immediately.
      if (dialog?.open && window.TimelineUpload?.loadPreset) {
        window.TimelineUpload.loadPreset(btn.dataset.dataset).catch((err) => {
          console.error("Failed to load preset into upload map:", err);
          const box = document.getElementById("upload-error");
          if (box) {
            box.hidden = false;
            box.textContent = err?.message || "Could not load that preset.";
          }
        });
        return;
      }
      selectDataset(btn.dataset.dataset)
        .then(() => {
          dialog?.close();
        })
        .catch((err) => {
          console.error("Failed to switch dataset:", err);
          showLoadError("Could not switch timeline dataset. Check the console.");
        });
    });
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

    bindDatasetSwitcher();
    window.addEventListener("hashchange", () => {
      selectDataset(hashFromLocation() || undefined).catch((err) => {
        console.error("Failed to load dataset from hash:", err);
      });
    });

    try {
      const catalog = await getCatalog();
      const entry = requestedDataset(catalog);
      await selectDataset(datasetHash(entry), { force: true });
    } catch (err) {
      console.error("Failed to load timeline data:", err);
      showLoadError(
        "Could not fetch the timeline JSON. Check the console, then refresh."
      );
    }
  }

  window.TimelineDatasets = {
    select: selectDataset,
    activeHash: () => activeHash,
    setViewHash,
    loadPresetRecords,
  };

  init();
})();
